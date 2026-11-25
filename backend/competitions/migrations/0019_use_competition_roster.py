import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("competitions", "0018_backfill_competition_roster"),
    ]

    operations = [
        migrations.RemoveConstraint(model_name="competitionattendance", name="unique_competition_attendee"),
        migrations.RemoveConstraint(model_name="waveentry", name="unique_wave_entry_competitor"),
        migrations.RemoveConstraint(model_name="waveentry", name="unique_approved_round_entry"),
        migrations.RemoveConstraint(model_name="groupassignment", name="unique_group_assignment_person"),
        migrations.RemoveConstraint(model_name="competitionscrambler", name="unique_competition_scrambler"),
        migrations.RemoveField(model_name="competitionattendance", name="competitor"),
        migrations.RemoveField(model_name="waveentry", name="competitor"),
        migrations.RemoveField(model_name="groupassignment", name="competitor"),
        migrations.RemoveField(model_name="competitionscrambler", name="competitor"),
        migrations.RemoveField(model_name="competitionscrambler", name="competition"),
        migrations.AlterField(
            model_name="competitionattendance", name="display_name",
            field=models.CharField(max_length=511),
        ),
        migrations.AlterField(
            model_name="waveentry", name="attendee",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="wave_entries", to="competitions.competitionattendance",
            ),
        ),
        migrations.AlterField(
            model_name="groupassignment", name="attendee",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="group_assignments", to="competitions.competitionattendance",
            ),
        ),
        migrations.AlterField(
            model_name="competitionscrambler", name="attendee",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="scrambler_approvals", to="competitions.competitionattendance",
            ),
        ),
        migrations.AddConstraint(
            model_name="waveentry",
            constraint=models.UniqueConstraint(fields=["wave", "attendee"], name="unique_wave_entry_attendee"),
        ),
        migrations.AddConstraint(
            model_name="waveentry",
            constraint=models.UniqueConstraint(
                fields=["competition_round", "attendee"], condition=models.Q(is_pending=False),
                name="unique_approved_round_entry",
            ),
        ),
        migrations.AddConstraint(
            model_name="groupassignment",
            constraint=models.UniqueConstraint(fields=["group", "attendee"], name="unique_group_assignment_person"),
        ),
        migrations.AddConstraint(
            model_name="competitionscrambler",
            constraint=models.UniqueConstraint(fields=["event", "attendee"], name="unique_competition_scrambler"),
        ),
        # Roster names cannot reliably recover the removed profile links.
        migrations.RunPython(migrations.RunPython.noop),
    ]
