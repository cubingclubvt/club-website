import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


def migrate_round_groups(apps, schema_editor):
    database = schema_editor.connection.alias
    Round = apps.get_model("competitions", "CompetitionRound")
    Group = apps.get_model("competitions", "RoundGroup")
    Assignment = apps.get_model("competitions", "GroupAssignment")
    Participant = apps.get_model("competitions", "CompetitionEventParticipant")
    Wave = apps.get_model("competitions", "CompetitionWave")
    Entry = apps.get_model("competitions", "WaveEntry")

    participants = {}
    for participant in Participant.objects.using(database).filter(
        models.Q(is_entered=True) | models.Q(is_pending=True),
    ):
        key = (participant.competition_id, participant.event_id)
        participants.setdefault(key, {})[participant.competitor_id] = participant.is_pending

    pending_events = {
        key for key, competitors in participants.items() if any(competitors.values())
    }
    migrated_events = set()
    wave_numbers = {}
    for round in Round.objects.using(database).order_by("competition_id", "event_id", "number", "pk"):
        key = (round.competition_id, round.event_id)
        event_entries = participants.get(key, {})
        # Event-level sign-ups had no round, so carry them over to the first round.
        entries = {} if key in migrated_events else event_entries.copy()
        migrated_events.add(key)
        pending_events.discard(key)
        groups = Group.objects.using(database).filter(competition_round_id=round.pk)
        assignments = Assignment.objects.using(database).filter(round_group__competition_round_id=round.pk)
        for competitor_id in assignments.filter(role="solver").values_list("competitor_id", flat=True):
            entries.setdefault(competitor_id, event_entries.get(competitor_id, False))
        if not entries and round.station_count is None and not groups.exists():
            continue

        number = wave_numbers.get(round.competition_id, 0) + 1
        wave_numbers[round.competition_id] = number
        wave = Wave.objects.using(database).create(
            competition_id=round.competition_id,
            number=number,
            station_count=round.station_count,
        )
        wave.allowed_rounds.add(round)
        groups.update(wave_id=wave.pk)
        assignments.update(competition_round_id=round.pk)
        Entry.objects.using(database).bulk_create([
            Entry(wave_id=wave.pk, competition_round_id=round.pk, competitor_id=competitor_id, is_pending=is_pending)
            for competitor_id, is_pending in entries.items()
        ])

    if pending_events:
        raise ValueError(
            f"Create a round for each competition/event with pending entries before migrating: {sorted(pending_events)}"
        )


class Migration(migrations.Migration):
    dependencies = [
        ("competitions", "0011_pending_event_entries"),
    ]

    operations = [
        migrations.CreateModel(
            name="CompetitionWave",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("number", models.PositiveSmallIntegerField(validators=[django.core.validators.MinValueValidator(1)])),
                ("name", models.CharField(blank=True, max_length=255)),
                ("station_count", models.PositiveSmallIntegerField(
                    blank=True, null=True, validators=[django.core.validators.MinValueValidator(1)],
                )),
                ("allowed_rounds", models.ManyToManyField(related_name="waves", to="competitions.competitionround")),
                ("competition", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE, related_name="waves", to="competitions.competition",
                )),
            ],
            options={
                "ordering": ["number"],
                "constraints": [
                    models.UniqueConstraint(fields=["competition", "number"], name="unique_competition_wave_number"),
                ],
            },
        ),
        migrations.CreateModel(
            name="WaveEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_pending", models.BooleanField(db_default=False, default=False)),
                ("competition_round", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="wave_entries",
                    to="competitions.competitionround",
                )),
                ("competitor", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE, related_name="wave_entries", to="competitions.competitor",
                )),
                ("wave", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE, related_name="entries", to="competitions.competitionwave",
                )),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(fields=["wave", "competitor"], name="unique_wave_entry_competitor"),
                    models.UniqueConstraint(
                        condition=models.Q(is_pending=False),
                        fields=["competition_round", "competitor"],
                        name="unique_approved_round_entry",
                    ),
                ],
            },
        ),
        migrations.AddField(
            model_name="roundgroup",
            name="wave",
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.CASCADE, related_name="groups",
                to="competitions.competitionwave",
            ),
        ),
        migrations.AddField(
            model_name="groupassignment",
            name="competition_round",
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.CASCADE, related_name="group_assignments",
                to="competitions.competitionround",
            ),
        ),
        migrations.RunPython(migrate_round_groups),
    ]
