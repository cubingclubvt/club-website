from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework import status
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.middleware.csrf import get_token

@api_view(["POST"])
def login_view(request):
    username = request.data.get("username")
    password = request.data.get("password")

    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return Response({"detail": "logged in"})
    else:  
        return Response({"detail": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
    
@api_view(["POST"])
def logout_view(request):
    logout(request)
    return Response({"detail": "Logged out"})

@api_view(["GET"])
def check_auth_view(request):
    if request.user.is_authenticated: 
        return Response({"isAuthenticated": True})
    else:
        return Response({"isAuthenticated": False})