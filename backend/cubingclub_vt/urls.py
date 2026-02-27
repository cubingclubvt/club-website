"""
URL configuration for cubingclub_vt project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

from . import auth_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path("login/", auth_views.login_view, name="admin_login"),
    path("auth_status/", auth_views.check_auth_view, name="admin_auth_status"),
    path("logout/", auth_views.logout_view, name="admin_logout"),
    path('competitions/', include('competitions.urls'))
]
