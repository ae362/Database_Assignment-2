from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.decorators.csrf import ensure_csrf_cookie
from django.http import JsonResponse

@ensure_csrf_cookie
def get_csrf_token(request):
    return JsonResponse({"success": "CSRF cookie set"})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('appointments.mongo_urls')),  # This includes all routes from the appointments app
    path('api/csrf/', get_csrf_token, name='csrf'),
]+ static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)