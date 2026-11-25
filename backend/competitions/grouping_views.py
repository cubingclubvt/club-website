from base64 import b64encode
from io import BytesIO
from urllib.parse import quote, urlsplit

from django.core import signing
from django.db import transaction
from django.db.models import Max, Prefetch
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import never_cache
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .grouping_serializers import (
    ApproveEntrySerializer, AttendanceStatusSerializer, AttendeeSerializer, CheckInStatusSerializer, EditAttendeeSerializer,
    GroupStatusSerializer, JudgeSerializer, PublicCheckInSerializer, RecordIdSerializer,
    ScramblerApprovalSerializer, ShareQrSerializer, WaveSettingsSerializer, WaveVersionSerializer,
)
from .models import (
    Competition, CompetitionGroup, CompetitionRound, CompetitionScrambler, ScrambleSet, WaveEntry,
)
from .services.grouping_service import (
    GroupingConflict, Role, Staffing, bump_schedule, generate_schedule, group_assignments,
    group_problem, late_assignments, remove_unused_generated_scrambles, save_assignments,
)


signer = signing.Signer(salt="competitions.check-in", sep=".")
GroupStatus = CompetitionGroup.Status


def wave_complete(wave):
    groups = list(wave.groups.all())
    return bool(groups) and all(group.status == GroupStatus.FINISHED for group in groups)


def round_data(round_obj):
    return {"id": round_obj.pk, "event": round_obj.event.name, "event_id": round_obj.event_id, "number": round_obj.number}


def read_waves(competition):
    return competition.waves.prefetch_related(
        Prefetch("allowed_rounds", queryset=CompetitionRound.objects.select_related("event").order_by("event__name", "number")),
        "groups",
    )


def check_in_state(competition):
    return {
        "name": competition.name,
        "closed": competition.is_finished,
        "waves": [
            {
                "id": wave.pk, "name": wave.name, "number": wave.number, "pending": bool(wave.groups.all()),
                "rounds": [round_data(round_obj) for round_obj in wave.allowed_rounds.all()],
            }
            for wave in read_waves(competition)
            if not competition.is_finished and not wave_complete(wave) and wave.allowed_rounds.all()
        ],
    }


def grouping_state(competition):
    waves = []
    for wave in read_waves(competition).prefetch_related("entries", "groups__assignments__scramble_rounds", "groups__scramble_sets"):
        staffing = Staffing(wave) if any(group.status == GroupStatus.UPCOMING for group in wave.groups.all()) else None
        groups = []
        for group in wave.groups.all():
            assignments = group_assignments(group)
            problem = None
            if staffing is not None and group.status == GroupStatus.UPCOMING:
                problem = group_problem(wave, assignments, staffing)
            groups.append({
                "id": group.pk, "number": group.number, "status": group.status, "problem": problem,
                "scramble_round_ids": [item.competition_round_id for item in group.scramble_sets.all()],
                "assignments": [
                    {"attendee_id": item.attendee_id, "round_id": item.round_id, "role": item.role,
                     "station": item.station, **({"round_ids": item.scramble_round_ids} if item.role == Role.SCRAMBLER else {})}
                    for item in assignments
                ],
            })
        waves.append({
            "id": wave.pk, "number": wave.number, "name": wave.name, "station_count": wave.station_count,
            "scramblers_per_group": wave.scramblers_per_group, "judges_per_group": wave.judges_per_group,
            "version": wave.schedule_version,
            "round_ids": [round_obj.pk for round_obj in wave.allowed_rounds.all()],
            "entries": [
                {"id": item.pk, "attendee_id": item.attendee_id, "round_id": item.competition_round_id,
                 "pending": item.is_pending}
                for item in wave.entries.all()
            ],
            "groups": groups,
        })
    return {
        "closed": competition.is_finished,
        "token": signer.sign(str(competition.pk)),
        "rounds": [
            round_data(round_obj)
            for round_obj in competition.rounds.select_related("event").order_by("event__name", "number")
        ],
        "attendees": list(competition.attendance.order_by("display_name", "pk").values("id", "display_name", "is_present")),
        "scrambler_approvals": list(CompetitionScrambler.objects.filter(attendee__competition=competition).values(
            "attendee_id", "event_id",
        )),
        "waves": waves,
    }


def select_entries(competition, entries):
    selections = []
    for item in entries:
        wave = competition.waves.filter(pk=item["wave_id"]).first()
        if wave is None or not wave.allowed_rounds.filter(pk=item["round_id"], competition=competition).exists():
            raise ValidationError({"entries": "One of the selected rounds is no longer offered. Reload the check-in."})
        if wave_complete(wave):
            raise GroupingConflict(f"Wave {wave.number} has finished. Reload to see which waves are open.")
        selections.append((wave, item["round_id"]))
    return selections


def write_entries(attendee, selections):
    entries = [
        WaveEntry(wave=wave, attendee=attendee, competition_round_id=round_id, is_pending=wave.groups.exists())
        for wave, round_id in selections
    ]
    WaveEntry.objects.bulk_create(entries)


def add_attendee(competition, data):
    selections = select_entries(competition, data["entries"])
    attendee = competition.attendance.create(display_name=data["name"], check_in_key=data.get("check_in_key"))
    write_entries(attendee, selections)
    return attendee


@never_cache
@api_view(["GET", "POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def competition_check_in(request, token):
    try:
        competition_id = int(signer.unsign(token))
    except (signing.BadSignature, ValueError):
        raise Http404
    if request.method == "GET":
        return Response(check_in_state(get_object_or_404(Competition, pk=competition_id)))

    serializer = PublicCheckInSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    try:
        with transaction.atomic():
            competition = get_object_or_404(Competition.objects.select_for_update(), pk=competition_id)
            attendee = competition.attendance.filter(check_in_key=data["check_in_key"]).first()
            if attendee is None:
                if competition.is_finished:
                    raise GroupingConflict("Check-in is closed for this competition.")
                attendee = add_attendee(competition, data)
            pending = list(attendee.wave_entries.filter(is_pending=True).values_list("wave__number", flat=True))
    except GroupingConflict as error:
        return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)
    return Response({"name": attendee.display_name, "pending_waves": sorted(pending)}, status=status.HTTP_201_CREATED)


def check_version(wave, version):
    if wave.schedule_version != version:
        raise GroupingConflict("This schedule changed. Review the latest groups and try again.")


def save_wave(competition, data):
    wave_id = data.pop("id", None)
    version = data.pop("version", None)
    wave = get_object_or_404(competition.waves, pk=wave_id) if wave_id is not None else None
    if competition.waves.filter(number=data["number"]).exclude(pk=wave_id).exists():
        raise ValidationError({"number": "Another wave is already using this number."})
    round_ids = set(data.pop("round_ids"))
    rounds = list(competition.rounds.filter(pk__in=round_ids).values_list("event_id", flat=True))
    if len(rounds) != len(round_ids):
        raise ValidationError({"round_ids": "Choose rounds from this competition."})
    old_round_ids = set(wave.allowed_rounds.values_list("pk", flat=True)) if wave is not None else set()
    if old_round_ids != round_ids and len(set(rounds)) != len(rounds):
        raise ValidationError({"round_ids": "Choose one scored round per event in a wave."})
    if wave is None:
        wave = competition.waves.create(**data)
    else:
        if version is None:
            raise ValidationError({"version": "Reload the wave before editing it."})
        check_version(wave, version)
        if wave.entries.exclude(competition_round_id__in=round_ids).exists():
            raise GroupingConflict("Remove entries for a round before taking it out of the wave.")
        settings_changed = (
            any(data[field] != getattr(wave, field) for field in (
                "number", "station_count", "scramblers_per_group", "judges_per_group",
            ))
            or round_ids != old_round_ids
        )
        if settings_changed and wave.groups.exclude(status=GroupStatus.UPCOMING).exists():
            raise GroupingConflict("The wave's number, rounds and staffing settings are locked after a group starts.")
        if ScrambleSet.objects.filter(group__wave=wave).exclude(competition_round_id__in=round_ids).exists():
            raise GroupingConflict("Detach the linked scramble sets before removing that round from the wave.")
        name_changed = wave.name != data["name"]
        for field, value in data.items():
            setattr(wave, field, value)
        wave.save(update_fields=list(data))
        if settings_changed or name_changed:
            bump_schedule(wave)
    wave.allowed_rounds.set(round_ids)


def available_group_slots(wave):
    next_number = (wave.groups.aggregate(last=Max("number"))["last"] or 0) + 1
    return [(group, group.number) for group in wave.groups.filter(status=GroupStatus.UPCOMING)] + [(None, next_number)]


@never_cache
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def late_entry_placements(request, competition_id, entry_id):
    competition = get_object_or_404(Competition, pk=competition_id)
    entry = get_object_or_404(WaveEntry.objects.select_related("wave"), pk=entry_id, wave__competition=competition, is_pending=True)
    wave = entry.wave
    staffing = Staffing(wave)
    placements = []
    for group, number in available_group_slots(wave):
        assignments = late_assignments(wave, entry, group, staffing)
        if assignments is None:
            continue
        solver = next(item for item in assignments if item.role == Role.SOLVER and item.attendee_id == entry.attendee_id)
        occupied = set(group.assignments.values_list("attendee_id", flat=True)) if group else set()
        judges = [item.attendee_id for item in assignments if item.role == Role.JUDGE]
        judge = next((attendee_id for attendee_id in judges if attendee_id not in occupied), None)
        options = [
            attendee_id for attendee_id in sorted(staffing.present - occupied - {entry.attendee_id})
            if late_assignments(wave, entry, group, staffing, attendee_id) is not None
        ] if judge is not None else []
        placements.append({
            "group_id": group.pk if group else None, "group_number": number, "station": solver.station,
            "suggested_judges": judges, "judge_id": judge, "judge_ids": options,
        })
    return Response({"version": wave.schedule_version, "placements": placements})


def approve_entry(competition, data, *, rebalance=False):
    entry = get_object_or_404(WaveEntry.objects.select_related("wave"), pk=data["id"], wave__competition=competition, is_pending=True)
    wave = entry.wave
    check_version(wave, data["version"])
    if entry.attendee.wave_entries.filter(competition_round_id=entry.competition_round_id, is_pending=False).exists():
        raise GroupingConflict("This person already has an approved entry for that round.")
    if rebalance:
        if not entry.attendee.is_present:
            raise GroupingConflict("Mark this attendee present before approving the entry.")
        entry.is_pending = False
        entry.save(update_fields=["is_pending"])
        return generate_schedule(wave)
    group_id = data["group_id"]
    group = get_object_or_404(wave.groups, pk=group_id, status=GroupStatus.UPCOMING) if group_id is not None else None
    assignments = late_assignments(wave, entry, group, Staffing(wave), data.get("judge_id"))
    if assignments is None:
        raise GroupingConflict("This placement no longer fits. Check station availability and staffing.")
    if group is None:
        number = (wave.groups.aggregate(last=Max("number"))["last"] or 0) + 1
        group = wave.groups.create(number=number)
    entry.is_pending = False
    entry.save(update_fields=["is_pending"])
    save_assignments(group, assignments)
    bump_schedule(wave)


def update_group(competition, action, data):
    group = get_object_or_404(CompetitionGroup.objects.select_related("wave"), pk=data["id"], wave__competition=competition)
    wave = group.wave
    check_version(wave, data["version"])
    if action == "judge":
        if group.status != GroupStatus.UPCOMING:
            raise GroupingConflict("Judges can only be changed for upcoming groups.")
        judge = get_object_or_404(group.assignments, attendee_id=data["previous_attendee_id"], role=Role.JUDGE)
        if judge.attendee_id == data["attendee_id"]:
            return
        attendee = get_object_or_404(competition.attendance, pk=data["attendee_id"], is_present=True)
        if group.assignments.filter(attendee=attendee).exists():
            raise GroupingConflict("That person already has an assignment in this group.")
        judge.attendee = attendee
        judge.save(update_fields=["attendee"])
    elif group.status == GroupStatus.UPCOMING and (action == "record_finished" or data["status"] == GroupStatus.ACTIVE):
        if CompetitionGroup.objects.filter(wave__competition=competition, status=GroupStatus.ACTIVE).exists():
            raise GroupingConflict("Finish the running group before starting another one.")
        if wave.groups.filter(number__lt=group.number).exclude(status=GroupStatus.FINISHED).exists():
            raise GroupingConflict("Run the earlier groups in this wave first.")
        if action == "record_finished":
            if not group.assignments.filter(role=Role.SOLVER).exists():
                raise GroupingConflict("A group without solvers cannot be recorded as finished.")
            group.status = GroupStatus.FINISHED
        else:
            problem = group_problem(wave, group_assignments(group), Staffing(wave))
            if problem is not None:
                raise GroupingConflict(problem)
            group.status = GroupStatus.ACTIVE
        group.save(update_fields=["status"])
    elif action == "group_status" and data["status"] == GroupStatus.FINISHED and group.status == GroupStatus.ACTIVE:
        group.status = GroupStatus.FINISHED
        group.save(update_fields=["status"])
    else:
        raise GroupingConflict("That group can no longer change to this status.")
    bump_schedule(wave)


def update_attendee(competition, action, data):
    attendee = get_object_or_404(competition.attendance, pk=data["id"])
    if action == "remove_attendee":
        if attendee.group_assignments.exclude(group__status=GroupStatus.UPCOMING).exists():
            raise GroupingConflict("This person has a running or finished assignment. Mark them away to keep the group history.")
        affected_waves = list(competition.waves.filter(groups__assignments__attendee=attendee).distinct())
        affected_groups = list(CompetitionGroup.objects.filter(assignments__attendee=attendee, wave__competition=competition))
        attendee.delete()
        for group in affected_groups:
            remove_unused_generated_scrambles(group)
        for wave in affected_waves:
            bump_schedule(wave)
    elif action == "attendance":
        attendee.is_present = data["is_present"]
        attendee.save(update_fields=["is_present"])
    else:
        selections = select_entries(competition, data["entries"])
        if selections:
            existing = attendee.wave_entries.all()
            if existing.filter(wave__in=[wave for wave, _ in selections]).exists():
                raise GroupingConflict("This person already has an entry in one of the selected waves.")
            if existing.filter(competition_round_id__in=[round_id for _, round_id in selections]).exists():
                raise GroupingConflict("This person is already entered in one of the selected rounds.")
        attendee.display_name = data["name"]
        attendee.save(update_fields=["display_name"])
        write_entries(attendee, selections)


def remove_entry(competition, entry_id):
    entry = get_object_or_404(WaveEntry.objects.select_related("wave"), pk=entry_id, wave__competition=competition)
    assignments = entry.attendee.group_assignments.filter(
        group__wave=entry.wave, role=Role.SOLVER, competition_round_id=entry.competition_round_id,
    )
    if assignments.exclude(group__status=GroupStatus.UPCOMING).exists():
        raise GroupingConflict("This entry has a running or finished group and is kept for the schedule history.")
    if assignments.exists():
        groups = list(CompetitionGroup.objects.filter(pk__in=assignments.values("group_id")))
        assignments.delete()
        for group in groups:
            remove_unused_generated_scrambles(group)
        bump_schedule(entry.wave)
    entry.delete()


def update_approvals(competition, data):
    attendee = get_object_or_404(competition.attendance, pk=data["attendee_id"])
    events = set(data["event_ids"])
    offered = set(competition.rounds.values_list("event_id", flat=True))
    if not events.issubset(offered):
        raise ValidationError({"event_ids": "Choose events from this competition."})
    existing = set(attendee.scrambler_approvals.values_list("event_id", flat=True))
    attendee.scrambler_approvals.exclude(event_id__in=events).delete()
    CompetitionScrambler.objects.bulk_create([
        CompetitionScrambler(attendee=attendee, event_id=event_id) for event_id in events - existing
    ])


COMMANDS = {
    "save_wave": WaveSettingsSerializer, "remove_wave": RecordIdSerializer, "generate": WaveVersionSerializer,
    "group_status": GroupStatusSerializer, "record_finished": WaveVersionSerializer,
    "judge": JudgeSerializer, "approve_entry": ApproveEntrySerializer,
    "approve_rebalance": WaveVersionSerializer,
    "reject_entry": RecordIdSerializer, "remove_entry": RecordIdSerializer,
    "add_attendee": AttendeeSerializer, "edit_attendee": EditAttendeeSerializer, "attendance": AttendanceStatusSerializer,
    "remove_attendee": RecordIdSerializer, "scrambler_approvals": ScramblerApprovalSerializer,
    "check_in_status": CheckInStatusSerializer,
}


def change_grouping(competition, action, data):
    if action == "save_wave":
        save_wave(competition, data)
    elif action == "remove_wave":
        wave = get_object_or_404(competition.waves, pk=data["id"])
        if wave.groups.exists() or wave.entries.exists():
            raise GroupingConflict("Remove the wave’s entries before deleting it. A wave with groups cannot be deleted.")
        wave.delete()
    elif action == "generate":
        wave = get_object_or_404(competition.waves, pk=data["id"])
        check_version(wave, data["version"])
        return generate_schedule(wave)
    elif action in ("group_status", "record_finished", "judge"):
        update_group(competition, action, data)
    elif action in ("approve_entry", "approve_rebalance"):
        return approve_entry(competition, data, rebalance=action == "approve_rebalance")
    elif action == "reject_entry":
        get_object_or_404(WaveEntry, pk=data["id"], wave__competition=competition, is_pending=True).delete()
    elif action == "remove_entry":
        remove_entry(competition, data["id"])
    elif action == "add_attendee":
        add_attendee(competition, data)
    elif action in ("attendance", "remove_attendee", "edit_attendee"):
        update_attendee(competition, action, data)
    elif action == "scrambler_approvals":
        update_approvals(competition, data)
    elif action == "check_in_status":
        competition.is_finished = data["closed"]
        competition.save(update_fields=["is_finished", "updated_at"])


@never_cache
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admin_grouping(request, competition_id):
    if request.method == "GET":
        return Response(grouping_state(get_object_or_404(Competition, pk=competition_id)))
    action = request.data.get("action") if isinstance(request.data, dict) else None
    serializer_class = COMMANDS.get(action) if isinstance(action, str) else None
    if serializer_class is None:
        raise ValidationError({"action": "Choose a grouping action."})
    serializer = serializer_class(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        with transaction.atomic():
            competition = get_object_or_404(Competition.objects.select_for_update(), pk=competition_id)
            generation = change_grouping(competition, action, serializer.validated_data)
            result = grouping_state(competition)
            if generation is not None:
                result["generation"] = generation
    except GroupingConflict as error:
        return Response({"detail": str(error)}, status=status.HTTP_409_CONFLICT)
    return Response(result)


@never_cache
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def check_in_qr(request, competition_id):
    import segno

    competition = get_object_or_404(Competition, pk=competition_id)
    serializer = ShareQrSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    origin = urlsplit(serializer.validated_data["origin"])
    if origin.scheme not in {"https", "http"} or origin.username is not None or origin.path not in {"", "/"} or origin.query or origin.fragment:
        raise ValidationError({"origin": "Enter the website origin."})
    url = f"{origin.scheme}://{origin.netloc}/check-in/{quote(signer.sign(str(competition.pk)), safe='')}"
    image = BytesIO()
    segno.make_qr(url).save(image, kind="png", scale=8)
    return Response({"url": url, "png": b64encode(image.getvalue()).decode("ascii")})
