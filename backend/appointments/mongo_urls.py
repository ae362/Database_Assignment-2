from django.urls import path
from . import mongo_views
from .mongo_views import validate_token
from .csrf_view import get_csrf_token

urlpatterns = [
    # Auth endpoints
    path('api/login/', mongo_views.login, name='login'),
    path('api/logout/', mongo_views.logout, name='logout'),
    path('api/register/patient/', mongo_views.register_patient, name='register_patient'),
    path('api/register/doctor/', mongo_views.register_doctor, name='register_doctor'),
    path('api/validate-token/', validate_token, name='validate_token'),
    path('api/csrf/', get_csrf_token, name='csrf_token'),
    
    # User endpoints
    path('api/users/', mongo_views.users, name='user_list'),
    path('api/users/<str:id>/', mongo_views.users, name='user_detail'),
    path('api/users/new/', mongo_views.new_user_form, name='new_user_form'),
    path('api/profile/', mongo_views.user_profile, name='user_profile'),
    path('api/profile/avatar/', mongo_views.avatar_upload, name='user_avatar'),
    
    # Doctor endpoints
    path('api/doctors/', mongo_views.doctors, name='doctor_list'),
    path('api/doctors/<str:id>/', mongo_views.doctors, name='doctor_detail'),
    path('api/doctors/new/', mongo_views.new_doctor_form, name='new_doctor_form'),
    path('api/doctors/availability/', mongo_views.doctor_availability, name='all_doctor_availability'),
    path('api/doctors/<str:doctor_id>/availability/', mongo_views.doctor_availability, name='doctor_availability'),
    
    # Doctor exceptions (days off)
    path('api/doctors/exceptions/', mongo_views.doctor_exceptions, name='all_doctor_exceptions'),
    path('api/doctors/<str:doctor_id>/exceptions/', mongo_views.doctor_exceptions, name='doctor_exceptions'),
    path('api/doctors/<str:doctor_id>/exceptions/<str:exception_id>/', mongo_views.doctor_exceptions, name='doctor_exception_detail'),
    
    # Patient endpoints
    path('api/patients/', mongo_views.patients, name='patient_list'),
    path('api/patients/<str:id>/', mongo_views.patients, name='patient_detail'),
    path('api/patients/my-record/', mongo_views.my_patient_record, name='my_patient_record'),

    # Appointment endpoints
    path('api/appointments/', mongo_views.appointments, name='appointment_list'),
    path('api/appointments/<str:id>/', mongo_views.appointments, name='appointment_detail'),
    path('api/appointments/<str:appointment_id>/update_status/', mongo_views.update_appointment_status, name='update_appointment_status'),
    path('api/appointments/new/', mongo_views.new_appointment_form, name='new_appointment'),
    path('api/appointments/<str:appointment_id>/direct-update/', mongo_views.direct_update_appointment_status, name='direct_update_appointment_status'),
    path('api/appointments/stats/', mongo_views.appointment_stats, name='appointment_stats'),
    path('api/api/appointments/count/', mongo_views.appointment_count, name='appointment_count'),
    # Notification endpoints
    path('api/notifications/', mongo_views.notifications, name='notifications'),
    path('api/notifications/<str:notification_id>/', mongo_views.notifications, name='notification_detail'),
    path('api/notifications/<str:notification_id>/read/', mongo_views.mark_notification_read, name='mark_notification_read'),
    path('api/notifications/mark-all-read/', mongo_views.mark_all_notifications_read, name='mark_all_notifications_read'),
    path('api/notifications/unread-count/', mongo_views.get_unread_notification_count, name='get_unread_notification_count'),
    path('api/schedule-notifications/', mongo_views.schedule_appointment_notifications, name='schedule_notifications'),
]