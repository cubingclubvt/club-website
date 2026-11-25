from django.db import migrations, models
from django.db.migrations.exceptions import IrreversibleError


def move_scrambler_rounds(apps, schema_editor):
    assignments = apps.get_model("competitions", "GroupAssignment")
    database = schema_editor.connection.alias
    scramblers = assignments.objects.using(database).filter(role="scrambler")
    coverage = assignments.scramble_rounds.through
    coverage.objects.using(database).bulk_create(
        coverage(groupassignment_id=assignment_id, competitionround_id=round_id)
        for assignment_id, round_id in scramblers.values_list("pk", "competition_round_id")
    )
    scramblers.update(competition_round_id=None)


def restore_scrambler_rounds(apps, schema_editor):
    assignments = apps.get_model("competitions", "GroupAssignment")
    database = schema_editor.connection.alias
    scramblers = assignments.objects.using(database).filter(role="scrambler").prefetch_related("scramble_rounds")
    updated = []
    for assignment in scramblers:
        rounds = list(assignment.scramble_rounds.all())
        if len(rounds) != 1:
            raise IrreversibleError("Each scrambler must cover exactly one round before reversing this migration.")
        assignment.competition_round_id = rounds[0].pk
        updated.append(assignment)
    assignments.objects.using(database).bulk_update(updated, ["competition_round"])


class Migration(migrations.Migration):
    dependencies = [("competitions", "0022_validate_group_roles")]

    operations = [
        migrations.AddField(
            model_name="groupassignment",
            name="scramble_rounds",
            field=models.ManyToManyField(blank=True, related_name="scrambler_assignments", to="competitions.competitionround"),
        ),
        migrations.RemoveConstraint(
            model_name="groupassignment",
            name="assignment_round_and_station_match_role",
        ),
        migrations.RunPython(move_scrambler_rounds, restore_scrambler_rounds),
        migrations.AddConstraint(
            model_name="groupassignment",
            constraint=models.CheckConstraint(
                condition=models.Q(role__in=("judge", "scrambler"), competition_round__isnull=True, station_number__isnull=True)
                | (models.Q(role="solver", competition_round__isnull=False)
                   & (models.Q(station_number__isnull=True) | models.Q(station_number__gt=0))),
                name="assignment_round_and_station_match_role",
            ),
        ),
    ]
