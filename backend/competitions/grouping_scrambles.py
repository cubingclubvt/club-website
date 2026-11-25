from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AUTOMATIC_SCRAMBLE_GENERATOR, Competition, CompetitionGroup, GroupAssignment, ScrambleSet
from .services.solve_service import SolveService


EXTRA_SCRAMBLES = 2


class GeneratedSetSerializer(serializers.Serializer):
    group_id = serializers.IntegerField(min_value=1)
    round_id = serializers.IntegerField(min_value=1)
    scrambles = serializers.ListField(child=serializers.CharField(max_length=4096), min_length=1, max_length=5)
    extra_scrambles = serializers.ListField(
        child=serializers.CharField(max_length=4096), min_length=EXTRA_SCRAMBLES, max_length=EXTRA_SCRAMBLES,
    )


class GeneratedBatchSerializer(serializers.Serializer):
    version = serializers.CharField(max_length=32)
    sets = GeneratedSetSerializer(many=True, allow_empty=False, max_length=8)


def missing_sets(competition):
    existing = set(ScrambleSet.objects.filter(group__wave__competition=competition).values_list(
        "group_id", "competition_round_id",
    ))
    assignments = GroupAssignment.objects.filter(
        role=GroupAssignment.Role.SOLVER, group__wave__competition=competition,
        group__status=CompetitionGroup.Status.UPCOMING,
    ).order_by("group_id", "competition_round_id").values_list(
        "group_id", "competition_round_id", "competition_round__event__name", "competition_round__event__average_type",
    ).distinct()
    return {
        (group_id, round_id): {
            "group_id": group_id, "round_id": round_id, "event": event,
            "attempts": SolveService.attempt_limit(average_type), "extras": EXTRA_SCRAMBLES,
        }
        for group_id, round_id, event, average_type in assignments
        if (group_id, round_id) not in existing
    }


@never_cache
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def group_scramble_sets(request, competition_id):
    if request.method == "GET":
        competition = get_object_or_404(Competition, pk=competition_id)
        return Response({"missing": list(missing_sets(competition).values())})

    serializer = GeneratedBatchSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    batch = serializer.validated_data
    with transaction.atomic():
        # Match the lock order of both the grouping commands and Manage scrambles.
        competition = get_object_or_404(Competition.objects.select_for_update(), pk=competition_id)
        targets = missing_sets(competition)
        created = 0
        for item in batch["sets"]:
            round_id = item["round_id"]
            target = targets.pop((item["group_id"], round_id), None)
            if target is None:
                # The group may have changed or received a manual set during generation.
                continue
            if len(item["scrambles"]) != target["attempts"]:
                raise ValidationError({"sets": "A scramble set does not match the current round's attempt count."})
            last = ScrambleSet.objects.filter(competition_round_id=round_id).aggregate(last=Max("number"))["last"] or 0
            if last >= 32767:
                raise ValidationError({"sets": "A round has reached the scramble set number limit."})
            ScrambleSet.objects.create(
                group_id=target["group_id"], competition_round_id=round_id, number=last + 1,
                scrambles=item["scrambles"], extra_scrambles=item["extra_scrambles"],
                generator_name=AUTOMATIC_SCRAMBLE_GENERATOR, generator_version=batch["version"],
                generated_at=timezone.now(),
            )
            created += 1
    return Response({"created": created, "missing": list(targets.values())})
