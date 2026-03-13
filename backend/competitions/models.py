from django.db import models
from .services.competitor_service import SolveService

# Create your models here.
class Competitor(models.Model):
    first_name = models.CharField(max_length=255,
                                  db_index=True)
    last_name = models.CharField(max_length=255,
                                  db_index=True)
    school_id = models.CharField(max_length=255,
                                     db_index=True)
    grade = models.SmallIntegerField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Competition(models.Model):
    name = models.CharField(max_length=255,
                            db_index=True)
    location = models.CharField(max_length=255)
    start_time = models.DateTimeField(db_index=True)
    end_time = models.DateTimeField()
    official = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    official_link = models.URLField(max_length=255, null=True,blank=True)

    def __str__(self):
        return f"{self.name}"

class CompetitionRound(models.Model):
    number = models.SmallIntegerField(db_index=True)
    competition = models.ForeignKey("Competition", 
                                   on_delete=models.CASCADE,
                                   related_name="rounds",
                                   db_index=True)
    event = models.ForeignKey("Event", 
                                   on_delete=models.CASCADE,
                                   related_name="rounds",
                                   db_index=True)
    round_type = models.ForeignKey("RoundType", 
                                   on_delete=models.CASCADE,
                                   related_name="rounds")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.competition}: {self.event} Round {self.number}"


class Solve(models.Model):
    solve_time = models.DurationField(null=True, blank=True)
    solve_number = models.SmallIntegerField(db_index=True)
    competitor = models.ForeignKey("Competitor", 
                                   on_delete=models.CASCADE,
                                   related_name="solves",
                                   db_index=True)

    competition_round = models.ForeignKey("CompetitionRound", 
                                   on_delete=models.CASCADE,
                                   related_name="solves",
                                   db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.competitor} - {SolveService.format_solve_time(self.solve_time)}"
    

class Event(models.Model):
    name = models.CharField(max_length=255, unique=True)

    average_type = models.CharField(max_length=255) # mean or average
    ranking_format = models.CharField(max_length=255) # single or average

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):

        return f"{self.name}"

    def get_alternative_ranking_format(self):
        if self.ranking_format == "average":
            return "single"
        else:
            return "average"

class RoundType(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name}"
