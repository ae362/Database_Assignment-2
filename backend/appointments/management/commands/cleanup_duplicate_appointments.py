from django.core.management.base import BaseCommand
from appointments.models import Appointment
from django.db.models import Count
from django.utils import timezone

class Command(BaseCommand):
    help = 'Cleans up duplicate appointments and updates past scheduled appointments'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without actually making changes',
        )

    def handle(self, *args, **options):
        self.stdout.write('Starting appointment cleanup...')
        
        self.cleanup_duplicates(options['dry_run'])
        self.update_past_appointments(options['dry_run'])

    def cleanup_duplicates(self, dry_run):
        # Find duplicates based on patient, doctor, and date
        duplicates = (
            Appointment.objects.values('patient', 'doctor', 'date')
            .annotate(count=Count('id'))
            .filter(count__gt=1)
        )

        total_found = 0
        total_removed = 0

        for dup in duplicates:
            # Get all appointments matching these criteria
            appointments = Appointment.objects.filter(
                patient=dup['patient'],
                doctor=dup['doctor'],
                date=dup['date']
            ).order_by('id')
            
            # Keep the first one, mark others for deletion
            to_delete = appointments[1:]
            count = len(to_delete)
            total_found += count
            
            if dry_run:
                self.stdout.write(
                    self.style.WARNING(
                        f"Would remove {count} duplicate appointments for "
                        f"patient {appointments[0].patient.name} with "
                        f"doctor {appointments[0].doctor.name} on "
                        f"{appointments[0].date.strftime('%Y-%m-%d %H:%M')}"
                    )
                )
            else:
                for appointment in to_delete:
                    appointment.delete()
                total_removed += count
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Removed {count} duplicate appointments for "
                        f"patient {appointments[0].patient.name} with "
                        f"doctor {appointments[0].doctor.name} on "
                        f"{appointments[0].date.strftime('%Y-%m-%d %H:%M')}"
                    )
                )

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Found {total_found} duplicate appointments that would be removed'
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully removed {total_removed} duplicate appointments'
                )
            )

    def update_past_appointments(self, dry_run):
        now = timezone.now()
        past_scheduled = Appointment.objects.filter(
            date__lt=now,
            status='scheduled'
        )

        total_updated = 0

        for appointment in past_scheduled:
            if dry_run:
                self.stdout.write(
                    self.style.WARNING(
                        f"Would update past appointment for "
                        f"patient {appointment.patient.name} with "
                        f"doctor {appointment.doctor.name} on "
                        f"{appointment.date.strftime('%Y-%m-%d %H:%M')} "
                        f"from 'scheduled' to 'completed'"
                    )
                )
            else:
                appointment.status = 'completed'
                appointment.save()
                total_updated += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Updated past appointment for "
                        f"patient {appointment.patient.name} with "
                        f"doctor {appointment.doctor.name} on "
                        f"{appointment.date.strftime('%Y-%m-%d %H:%M')} "
                        f"from 'scheduled' to 'completed'"
                    )
                )

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Found {len(past_scheduled)} past scheduled appointments that would be updated'
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully updated {total_updated} past scheduled appointments'
                )
            )

