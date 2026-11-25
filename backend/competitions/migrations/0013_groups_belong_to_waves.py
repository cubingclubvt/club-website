import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("competitions", "0012_add_competition_waves"),
    ]

    operations = [
        migrations.RemoveConstraint(model_name="roundgroup", name="unique_round_group_number"),
        migrations.RemoveConstraint(model_name="groupassignment", name="unique_group_assignment_person"),
        migrations.RenameModel(old_name="RoundGroup", new_name="CompetitionGroup"),
        migrations.RenameField(model_name="groupassignment", old_name="round_group", new_name="group"),
        migrations.RenameField(model_name="scrambleset", old_name="round_group", new_name="group"),
        migrations.AlterField(
            model_name="competitiongroup",
            name="wave",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE, related_name="groups", to="competitions.competitionwave",
            ),
        ),
        migrations.AlterField(
            model_name="groupassignment",
            name="competition_round",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="group_assignments",
                to="competitions.competitionround",
            ),
        ),
        migrations.AlterField(
            model_name="scrambleset",
            name="group",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name="scramble_sets", to="competitions.competitiongroup",
            ),
        ),
        migrations.RemoveField(model_name="competitiongroup", name="competition_round"),
        migrations.RemoveField(model_name="competitionround", name="station_count"),
        migrations.RemoveField(model_name="competitioneventparticipant", name="is_pending"),
        migrations.AddConstraint(
            model_name="competitiongroup",
            constraint=models.UniqueConstraint(fields=["wave", "number"], name="unique_wave_group_number"),
        ),
        migrations.AddConstraint(
            model_name="groupassignment",
            constraint=models.UniqueConstraint(fields=["group", "competitor"], name="unique_group_assignment_person"),
        ),
        migrations.AddConstraint(
            model_name="scrambleset",
            constraint=models.UniqueConstraint(fields=["group", "competition_round"], name="unique_group_round_scramble_set"),
        ),
    ]
