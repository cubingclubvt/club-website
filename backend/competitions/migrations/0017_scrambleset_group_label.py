from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("competitions", "0016_competition_scrambler_approvals"),
    ]

    operations = [
        migrations.AddField(
            model_name="scrambleset",
            name="group_label",
            field=models.CharField(blank=True, db_default="", default="", max_length=100),
        ),
        migrations.AddConstraint(
            model_name="scrambleset",
            constraint=models.CheckConstraint(
                condition=models.Q(group__isnull=True) | models.Q(group_label=""),
                name="scramble_label_requires_unlinked_set",
            ),
        ),
    ]
