from django.db import migrations, models


def move_scrambler_counts_to_waves(apps, schema_editor):
    database = schema_editor.connection.alias
    Wave = apps.get_model("competitions", "CompetitionWave")
    Round = apps.get_model("competitions", "CompetitionRound")
    waves = Wave.objects.using(database)
    rounds = Round.objects.using(database)

    for wave in waves.annotate(scrambler_total=models.Sum("allowed_rounds__scramblers_per_group")).exclude(
        scrambler_total__isnull=True,
    ):
        waves.filter(pk=wave.pk).update(scramblers_per_group=wave.scrambler_total)

    # A round might have had staffing configured before any wave or group existed.
    for competition_round in rounds.filter(
        scramblers_per_group__isnull=False, waves__isnull=True,
    ).order_by("competition_id", "event_id", "number", "pk"):
        competition_id = competition_round.competition_id
        last_number = waves.filter(competition_id=competition_id).aggregate(models.Max("number"))["number__max"]
        wave = waves.create(
            competition_id=competition_id,
            number=(last_number or 0) + 1,
            scramblers_per_group=competition_round.scramblers_per_group,
        )
        wave.allowed_rounds.add(competition_round)


class Migration(migrations.Migration):
    dependencies = [
        ("competitions", "0013_groups_belong_to_waves"),
    ]

    operations = [
        migrations.AddField(
            model_name="competitionwave",
            name="scramblers_per_group",
            field=models.PositiveIntegerField(null=True, blank=True),
        ),
        migrations.RunPython(move_scrambler_counts_to_waves),
    ]
