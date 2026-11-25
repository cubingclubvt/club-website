import django.db.models.deletion
from django.db import migrations, models


def display_name(competitor):
    name = " ".join(part.strip() for part in (competitor.first_name, competitor.last_name) if part.strip())
    return name or f"Attendee {competitor.pk}"


def backfill_competition_roster(apps, schema_editor):
    database = schema_editor.connection.alias
    Attendance = apps.get_model("competitions", "CompetitionAttendance")
    WaveEntry = apps.get_model("competitions", "WaveEntry")
    GroupAssignment = apps.get_model("competitions", "GroupAssignment")
    Scrambler = apps.get_model("competitions", "CompetitionScrambler")

    attendance = Attendance.objects.using(database)
    existing = list(attendance.select_related("competitor"))
    roster = {}
    for attendee in existing:
        attendee.display_name = display_name(attendee.competitor)
        roster[attendee.competition_id, attendee.competitor_id] = attendee.pk
    attendance.bulk_update(existing, ["display_name"], batch_size=500)

    def link_attendees(rows):
        updated = []
        for row in rows.select_related("competitor").iterator(chunk_size=500):
            key = (row.roster_competition_id, row.competitor_id)
            if key not in roster:
                # Legacy staff and entries could exist without a check-in.
                attendee = attendance.create(
                    competition_id=row.roster_competition_id, competitor_id=row.competitor_id,
                    display_name=display_name(row.competitor), is_present=False,
                )
                roster[key] = attendee.pk
            row.attendee_id = roster[key]
            updated.append(row)
        rows.model.objects.using(database).bulk_update(updated, ["attendee"], batch_size=500)

    for model, competition_path in (
        (WaveEntry, "wave__competition_id"),
        (GroupAssignment, "group__wave__competition_id"),
        (Scrambler, "competition_id"),
    ):
        link_attendees(model.objects.using(database).annotate(roster_competition_id=models.F(competition_path)))


class Migration(migrations.Migration):
    dependencies = [
        ("competitions", "0017_scrambleset_group_label"),
    ]

    operations = [
        migrations.AddField(
            model_name="competitionattendance", name="display_name",
            field=models.CharField(max_length=511, null=True),
        ),
        migrations.AddField(
            model_name="waveentry", name="attendee",
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name="wave_entries", to="competitions.competitionattendance",
            ),
        ),
        migrations.AddField(
            model_name="groupassignment", name="attendee",
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name="group_assignments", to="competitions.competitionattendance",
            ),
        ),
        migrations.AddField(
            model_name="competitionscrambler", name="attendee",
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name="scrambler_approvals", to="competitions.competitionattendance",
            ),
        ),
        migrations.RunPython(backfill_competition_roster),
    ]
