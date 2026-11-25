from django.urls import path
from . import views

urlpatterns = [
        path("admin/", views.admin_competitions, name="admin_competitions"),
        path("admin/competitors/", views.admin_competitors, name="admin_competitors"),
        path("admin/competitors/<int:competitor_id>", views.admin_edit_competitor, name="admin_edit_competitor"),
        path("admin/<str:competition_name>", views.admin_competition_info, name="admin_competition_info"),
        path("admin/<int:competition_id>/details", views.update_competition_details, name="update_competition_details"),
        path("admin/<int:competition_id>/publication", views.update_competition_publication, name="update_competition_publication"),
        path("admin/solves/competitors", views.solve_competitors, name="solve_competitors"),
        path("admin/<int:competition_id>/rounds/<int:round_id>/solves", views.admin_round_solves, name="admin_round_solves"),
        path("admin/<int:competition_id>/rounds/<int:round_id>/solves/<int:solve_id>", views.admin_solve, name="admin_solve"),
        path("admin/<int:competition_id>/rounds/<int:round_id>/solves/competitors/<int:competitor_id>", views.admin_competitor_result, name="admin_competitor_result"),
        path("admin/<int:competition_id>/rounds/<int:round_id>/scrambles", views.admin_round_scrambles, name="admin_round_scrambles"),
        path("admin/<int:competition_id>/rounds/<int:round_id>/scrambles/<int:set_id>", views.admin_scramble_set, name="admin_scramble_set"),
        path("create", views.create_competition, name="create_competition"),
        path("competitor/", views.all_competitors, name="all_competitors"),
        path("competitor/create", views.create_competitor, name="create_competitor"),
        path("competitor/<str:school_id>", views.competitor_detail, name="competitor"),
        path("competitor/<str:school_id>/<str:event_name>", views.competitor_event_solves, name="competitor_event_solves"),
        path("rankings/", views.events, name="events"),
        path("rankings/<str:event_name>/<str:single_or_average>", views.ranking_solves, name="ranking_solves"),
        path("", views.all_competitions, name="all_competitions"),
        path("<str:competition_name>/<str:event_name>/<int:round_number>", views.round, name="round"),
        path("<str:competition_name>/<str:event_name>/<int:round_number>/scrambles", views.round_scrambles, name="round_scrambles"),
        path("<str:competition_name>/<str:event_name>/<int:round_number>/update", views.update_round_results, name="update_round_results"),
        path("<str:competition_name>", views.competition_info, name="competition_info"),
]
