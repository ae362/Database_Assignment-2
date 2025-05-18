# models.py
from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils import timezone
from django.core.validators import MinValueValidator
from decimal import Decimal

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        
        # Set default role as patient for regular users
        if 'role' not in extra_fields:
            extra_fields['role'] = 'patient'
            
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')  # Set role as admin for superuser

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    ROLE_CHOICES = [
        ('patient', 'Patient'),
        ('doctor', 'Doctor'),
        ('admin', 'Admin'),
    ]
    
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
        ('prefer_not_to_say', 'Prefer not to say'),
    ]

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    birthday = models.DateField(null=True, blank=True)
    medical_history = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='patient')
    
    # Patient fields
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    chronic_diseases = models.TextField(blank=True, null=True, help_text="List any chronic diseases the patient has")
    recent_doctor = models.ForeignKey('Doctor', on_delete=models.SET_NULL, null=True, blank=True, related_name='recent_patients')
    past_examinations = models.TextField(blank=True, null=True, help_text="List of past medical examinations")

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    objects = CustomUserManager()

    class Meta:
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['username']),
            models.Index(fields=['role']),
        ]

    def __str__(self):
        return self.email

    @property
    def is_patient(self):
        return self.role == 'patient'

    @property
    def is_doctor(self):
        return self.role == 'doctor'

    @property
    def is_admin(self):
        return self.role == 'admin'

class MedicalCenter(models.Model):
    name = models.CharField(max_length=100)
    address = models.TextField()
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    
    def __str__(self):
        return self.name

class Doctor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile', null=True)
    name = models.CharField(max_length=100)
    specialization = models.CharField(max_length=100)
    qualification = models.CharField(
        max_length=100,
        default="No qualification",
        blank=False,
        null=False
    )
    experience_years = models.IntegerField(
        default=0,
        blank=False,
        null=False,
        validators=[MinValueValidator(0)]
    )
    consultation_fee = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        default=Decimal('20.00'),
        validators=[MinValueValidator(Decimal('20.00'))]
    )
    available_days = models.CharField(max_length=100, blank=True, null=True)
    bio = models.TextField(blank=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    
    # New fields for Doctor
    medical_center = models.ForeignKey(MedicalCenter, on_delete=models.SET_NULL, null=True, blank=True, related_name='doctors')
    emergency_available = models.BooleanField(default=False, help_text="Available for emergency response")
    daily_patient_limit = models.PositiveIntegerField(default=10, help_text="Maximum number of patients per day")
    is_available = models.BooleanField(default=True, help_text="Currently accepting appointments")
    booking_history = models.TextField(blank=True, null=True, help_text="History of bookings")

    class Meta:
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return f"Dr. {self.name} - {self.specialization}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.consultation_fee < Decimal('20.00'):
            raise ValidationError({
                'consultation_fee': 'Consultation fee cannot be less than £20.00'
            })
        if self.experience_years < 0:
            raise ValidationError({
                'experience_years': 'Years of experience cannot be negative'
            })

class Appointment(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='appointments')
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='appointments')
    date = models.DateTimeField()
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    
    # Medical information fields
    blood_type = models.CharField(max_length=10, blank=True, null=True)
    medications = models.TextField(blank=True, null=True)
    allergies = models.TextField(blank=True, null=True)
    medical_conditions = models.TextField(blank=True, null=True)
    reason_for_visit = models.TextField(blank=True, null=True)
    
    # New field for Appointment
    patient_phone = models.CharField(max_length=20, blank=True, null=True, help_text="Patient's contact phone for this appointment")
    
    class Meta:
        ordering = ['-date']
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['status']),
            models.Index(fields=['patient']),
            models.Index(fields=['doctor']),
        ]

    def save(self, *args, **kwargs):
        if self.date < timezone.now() and self.status == 'scheduled':
            self.status = 'completed'
            
        # Update patient's recent doctor when appointment is created or completed
        if self.status == 'completed' and self.patient:
            self.patient.recent_doctor = self.doctor
            self.patient.save()
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.patient.get_full_name()} with {self.doctor} on {self.date}"

    @property
    def is_past(self):
        return self.date < timezone.now()

    @property
    def can_cancel(self):
        if self.status != 'scheduled':
            return False
        if self.is_past:
            return False
        time_until = self.date - timezone.now()
        return time_until.total_seconds() >= 3600  # At least 1 hour before appointment

class DoctorAvailability(models.Model):
    DAYS_OF_WEEK = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    ]

    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='availability')
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_available = models.BooleanField(default=True)

    class Meta:
        ordering = ['day_of_week', 'start_time']
        unique_together = ['doctor', 'day_of_week', 'start_time', 'end_time']
        indexes = [
            models.Index(fields=['doctor', 'day_of_week']),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.start_time >= self.end_time:
            raise ValidationError('End time must be after start time')

    def __str__(self):
        return f"{self.doctor.name} - {self.get_day_of_week_display()} ({self.start_time} - {self.end_time})"

class AvailabilityException(models.Model):
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='availability_exceptions')
    date = models.DateField()
    is_available = models.BooleanField(default=False)
    reason = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['date']
        unique_together = ['doctor', 'date']
        indexes = [
            models.Index(fields=['doctor', 'date']),
        ]

    def __str__(self):
        status = "Available" if self.is_available else "Unavailable"
        return f"{self.doctor.name} - {self.date} ({status})"

class MedicalExamination(models.Model):
    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='medical_examinations')
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='conducted_examinations')
    date = models.DateField()
    examination_type = models.CharField(max_length=100)
    results = models.TextField()
    recommendations = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return f"{self.patient.get_full_name()} - {self.examination_type} - {self.date}"