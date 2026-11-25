from django.db import migrations, models


def preserve_existing_visibility(apps, schema_editor):
    Competition = apps.get_model("competitions", "Competition")
    Competition.objects.using(schema_editor.connection.alias).update(is_published=True)


class Migration(migrations.Migration):
    dependencies = [("competitions", "0006_competition_official_link")]

    operations = [
        migrations.AddField(
            model_name="competition",
            name="is_published",
            field=models.BooleanField(default=False, db_default=False),
        ),
        migrations.RunPython(preserve_existing_visibility, migrations.RunPython.noop),
    ]
