from django.urls import path
from . import views

urlpatterns = [
        path("create", views.create_competition, name="create_competition"),
        path("competitor/", views.all_competitors, name="all_competitors"),
        path("competitor/create", views.create_competitor, name="create_competitor"),
        path("competitor/<str:school_id>", views.competitor_detail, name="competitor"),
        path("competitor/<str:school_id>/<str:event_name>", views.competitor_event_solves, name="competitor_event_solves"),
        path("rankings/", views.events, name="events"),
        path("rankings/<str:event_name>/<str:single_or_average>", views.ranking_solves, name="ranking_solves"),
        path("", views.all_competitions, name="all_competitions"),
        path("<str:competition_name>/<str:event_name>/<int:round_number>", views.round, name="round"),
        path("<str:competition_name>/<str:event_name>/<int:round_number>/update", views.update_round_results, name="update_round_results"),
        path("<str:competition_name>", views.competition_info, name="competition_info"),
]
