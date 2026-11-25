import django.db.models.deletion
from django.db import migrations, models


def copy_scrambler_approvals(apps, schema_editor):
    database = schema_editor.connection.alias
    Participant = apps.get_model("competitions", "CompetitionEventParticipant")
    Scrambler = apps.get_model("competitions", "CompetitionScrambler")
    approved = Participant.objects.using(database).filter(can_scramble=True).values_list(
        "competition_id", "event_id", "competitor_id",
    )
    Scrambler.objects.using(database).bulk_create([
        Scrambler(competition_id=competition_id, event_id=event_id, competitor_id=competitor_id)
        for competition_id, event_id, competitor_id in approved
    ])


class Migration(migrations.Migration):
    dependencies = [
        ("competitions", "0015_remove_round_scrambler_count"),
    ]

    operations = [
        migrations.CreateModel(
            name="CompetitionScrambler",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("competition", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="scrambler_approvals",
                    to="competitions.competition",
                )),
                ("event", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="scrambler_approvals",
                    to="competitions.event",
                )),
                ("competitor", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="scrambler_approvals",
                    to="competitions.competitor",
                )),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=["competition", "event", "competitor"], name="unique_competition_scrambler",
                    ),
                ],
            },
        ),
        migrations.RunPython(copy_scrambler_approvals),
        migrations.DeleteModel(name="CompetitionEventParticipant"),
    ]
