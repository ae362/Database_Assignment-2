from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('appointments', '0002_alter_user_options_user_avatar_alter_doctor_email_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[('patient', 'Patient'), ('doctor', 'Doctor'), ('admin', 'Admin')],
                default='patient',
                max_length=20
            ),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['role'], name='user_role_idx'),
        ),
    ]