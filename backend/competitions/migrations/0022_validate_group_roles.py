from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("competitions", "0021_group_judge_pool")]

    operations = [
        migrations.AddConstraint(
            model_name="groupassignment",
            constraint=models.CheckConstraint(
                condition=models.Q(role="judge", competition_round__isnull=True, station_number__isnull=True)
                | models.Q(role="scrambler", competition_round__isnull=False, station_number__isnull=True)
                | (models.Q(role="solver", competition_round__isnull=False)
                   & (models.Q(station_number__isnull=True) | models.Q(station_number__gt=0))),
                name="assignment_round_and_station_match_role",
            ),
        ),
    ]
