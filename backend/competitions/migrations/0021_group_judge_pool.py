import django.db.models.deletion
from django.db import migrations, models


def move_judges_to_groups(apps, schema_editor):
    Assignment = apps.get_model("competitions", "GroupAssignment")
    Assignment.objects.using(schema_editor.connection.alias).filter(role="judge").update(
        competition_round=None, station_number=None,
    )


class Migration(migrations.Migration):
    dependencies = [("competitions", "0020_live_group_schedule")]

    operations = [
        migrations.AddField(
            model_name="competitionwave", name="judges_per_group",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="groupassignment", name="competition_round",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name="group_assignments", to="competitions.competitionround",
            ),
        ),
        migrations.RemoveConstraint(model_name="groupassignment", name="station_only_for_solver_or_judge"),
        migrations.RunPython(move_judges_to_groups),
    ]
