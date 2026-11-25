from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("competitions", "0014_add_wave_scrambler_count"),
    ]

    operations = [
        migrations.RemoveField(model_name="competitionround", name="scramblers_per_group"),
    ]
