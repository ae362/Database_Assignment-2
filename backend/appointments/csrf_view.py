from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET

@require_GET
@ensure_csrf_cookie
def get_csrf_token(request):
    """
    This view sets a CSRF cookie and returns a 200 OK response.
    The CSRF cookie is needed for POST requests.
    """
    return JsonResponse({"success": True, "message": "CSRF cookie set"})