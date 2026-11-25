from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("competitions", "0019_use_competition_roster")]

    operations = [
        migrations.AddField(
            model_name="competitionattendance", name="check_in_key",
            field=models.UUIDField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="competitionwave", name="schedule_version",
            field=models.PositiveIntegerField(db_default=0, default=0),
        ),
        migrations.AddField(
            model_name="groupassignment", name="station_number",
            field=models.PositiveSmallIntegerField(blank=True, null=True, validators=[MinValueValidator(1)]),
        ),
        migrations.AddConstraint(
            model_name="competitionattendance",
            constraint=models.UniqueConstraint(
                fields=("competition", "check_in_key"), name="unique_competition_check_in_key",
            ),
        ),
        migrations.AddConstraint(
            model_name="groupassignment",
            constraint=models.UniqueConstraint(
                fields=("group", "role", "station_number"), name="unique_group_role_per_station",
            ),
        ),
        migrations.AddConstraint(
            model_name="groupassignment",
            constraint=models.CheckConstraint(
                condition=models.Q(station_number__isnull=True)
                | models.Q(role__in=["solver", "judge"], station_number__gt=0),
                name="station_only_for_solver_or_judge",
            ),
        ),
    ]
