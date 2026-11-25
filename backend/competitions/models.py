from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.functions import Replace
from django.db.models.signals import m2m_changed
from django.dispatch import receiver
from .services.competitor_service import SolveService


# Stores a competitor's name, school ID, and grade across competitions.
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


class CompetitionQuerySet(models.QuerySet):
    def with_url_name(self):
        return self.alias(url_name=Replace("name", models.Value(" "), models.Value("-")))


# Stores a meet's schedule, location, official status, and publication and completion flags.
class Competition(models.Model):
    objects = CompetitionQuerySet.as_manager()

    name = models.CharField(max_length=255,
                            db_index=True)
    location = models.CharField(max_length=255)
    start_time = models.DateTimeField(db_index=True)
    end_time = models.DateTimeField()
    official = models.BooleanField()
    is_published = models.BooleanField(default=False, db_default=False)
    is_finished = models.BooleanField(default=False, db_default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    official_link = models.URLField(max_length=255, null=True,blank=True)

    def __str__(self):
        return f"{self.name}"

# Represents a scored round of one event at a competition, such as 3x3 Round 1.
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


class SolveQuerySet(models.QuerySet):
    def published(self):
        return self.filter(competition_round__competition__is_published=True)


# Records one competitor's numbered attempt in a scored round.
class Solve(models.Model):
    objects = SolveQuerySet.as_manager()

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
    

# Defines a cubing event and how its results are calculated and ranked.
class Event(models.Model):
    name = models.CharField(max_length=255, unique=True)

    average_type = models.CharField(max_length=255) # mean or average
    ranking_format = models.CharField(max_length=255) # single or average

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):

        return f"{self.name}"

    def get_alternative_ranking_format(self):
        if self.ranking_format in {"average", "mean"}:
            return "single"
        else:
            return "average"

# Defines reusable round labels such as First Round or Final.
class RoundType(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name}"


# Tracks whether a checked-in competitor is still present at the competition.
class CompetitionAttendance(models.Model):
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name="attendance")
    competitor = models.ForeignKey(Competitor, on_delete=models.CASCADE, related_name="attendance")
    is_present = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["competition", "competitor"], name="unique_competition_attendee"),
        ]


# Approves a person to scramble a specific event across all waves at a competition.
class CompetitionScrambler(models.Model):
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name="scrambler_approvals")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="scrambler_approvals")
    competitor = models.ForeignKey(Competitor, on_delete=models.CASCADE, related_name="scrambler_approvals")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["competition", "event", "competitor"], name="unique_competition_scrambler",
            ),
        ]


# Defines a sign-up slot, its allowed event rounds, and its station and scrambler counts.
class CompetitionWave(models.Model):
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name="waves")
    number = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    name = models.CharField(max_length=255, blank=True)
    station_count = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    scramblers_per_group = models.PositiveIntegerField(null=True, blank=True)
    allowed_rounds = models.ManyToManyField(CompetitionRound, related_name="waves")

    class Meta:
        ordering = ["number"]
        constraints = [
            models.UniqueConstraint(fields=["competition", "number"], name="unique_competition_wave_number"),
        ]

    def allows_round(self, competition_round):
        return (
            competition_round.competition_id == self.competition_id
            and self.allowed_rounds.filter(pk=competition_round.pk).exists()
        )


@receiver(m2m_changed, sender=CompetitionWave.allowed_rounds.through)
def validate_wave_rounds(sender, instance, action, reverse, model, pk_set, using, **kwargs):
    if action == "pre_add" and model.objects.using(using).filter(pk__in=pk_set).exclude(
        competition_id=instance.competition_id,
    ).exists():
        raise ValidationError("A wave can only offer rounds from its competition.")


# Stores a competitor's chosen round within a wave and whether approval is pending.
class WaveEntry(models.Model):
    wave = models.ForeignKey(CompetitionWave, on_delete=models.CASCADE, related_name="entries")
    competitor = models.ForeignKey(Competitor, on_delete=models.CASCADE, related_name="wave_entries")
    competition_round = models.ForeignKey(CompetitionRound, on_delete=models.CASCADE, related_name="wave_entries")
    is_pending = models.BooleanField(default=False, db_default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["wave", "competitor"], name="unique_wave_entry_competitor"),
            models.UniqueConstraint(
                fields=["competition_round", "competitor"],
                condition=models.Q(is_pending=False),
                name="unique_approved_round_entry",
            ),
        ]

    def clean(self):
        super().clean()
        if self.wave_id and self.competition_round_id and not self.wave.allows_round(self.competition_round):
            raise ValidationError({"competition_round": "Choose a round offered by this wave."})


# Represents one turn at the stations within a wave and tracks its run status.
class CompetitionGroup(models.Model):
    class Status(models.TextChoices):
        UPCOMING = "upcoming", "Upcoming"
        ACTIVE = "active", "Active"
        FINISHED = "finished", "Finished"

    wave = models.ForeignKey(CompetitionWave, on_delete=models.CASCADE, related_name="groups")
    number = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.UPCOMING)

    class Meta:
        ordering = ["number"]
        constraints = [
            models.UniqueConstraint(fields=["wave", "number"], name="unique_wave_group_number"),
        ]


# Assigns a competitor to solve, judge, or scramble for an event round within a group.
class GroupAssignment(models.Model):
    class Role(models.TextChoices):
        SOLVER = "solver", "Solver"
        JUDGE = "judge", "Judge"
        SCRAMBLER = "scrambler", "Scrambler"

    group = models.ForeignKey(CompetitionGroup, on_delete=models.CASCADE, related_name="assignments")
    competition_round = models.ForeignKey(CompetitionRound, on_delete=models.CASCADE, related_name="group_assignments")
    competitor = models.ForeignKey(Competitor, on_delete=models.CASCADE, related_name="group_assignments")
    role = models.CharField(max_length=10, choices=Role.choices)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["group", "competitor"], name="unique_group_assignment_person"),
        ]

    def clean(self):
        super().clean()
        if self.group_id and self.competition_round_id and not self.group.wave.allows_round(self.competition_round):
            raise ValidationError({"competition_round": "Choose a round offered by this group's wave."})


class ScrambleSetQuerySet(models.QuerySet):
    def with_scrambles(self):
        return self.exclude(scrambles=[], extra_scrambles=[])


# Stores regular and extra scrambles for a round, optionally tied to a specific group.
class ScrambleSet(models.Model):
    objects = ScrambleSetQuerySet.as_manager()

    competition_round = models.ForeignKey(CompetitionRound, on_delete=models.CASCADE, related_name="scramble_sets")
    group = models.ForeignKey(
        CompetitionGroup, on_delete=models.SET_NULL, related_name="scramble_sets", null=True, blank=True,
    )
    group_label = models.CharField(max_length=100, blank=True, default="", db_default="")
    number = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    scrambles = models.JSONField(default=list)
    extra_scrambles = models.JSONField(default=list, blank=True)
    generator_name = models.CharField(max_length=100)
    generator_version = models.CharField(max_length=100, blank=True)
    generated_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["number"]
        constraints = [
            models.UniqueConstraint(fields=["competition_round", "number"], name="unique_round_scramble_set_number"),
            models.UniqueConstraint(fields=["group", "competition_round"], name="unique_group_round_scramble_set"),
            models.CheckConstraint(
                condition=models.Q(group__isnull=True) | models.Q(group_label=""),
                name="scramble_label_requires_unlinked_set",
            ),
        ]

    def clean(self):
        super().clean()
        if self.group_id and self.competition_round_id and not self.group.wave.allows_round(self.competition_round):
            raise ValidationError({"group": "Choose a group whose wave offers this round."})
