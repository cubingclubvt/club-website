from competitions.services.ranking_service import RankingService
from rest_framework import serializers
from datetime import timedelta
from .models import Competition, Competitor, Event, RoundType, CompetitionRound, Solve
from .services.competitor_service import CompetitorService
from .services.solve_service import SolveService

class CompetitorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Competitor
        fields = ['first_name', 'last_name', 'school_id', 'grade']
    def create(self, validated_data):
        validated_data['first_name'] = validated_data['first_name'].title()
        validated_data['last_name'] = validated_data['last_name'].title()
        return super().create(validated_data)

class CompetitorDetailSerializer(CompetitorSerializer):
    first_competition_date = serializers.SerializerMethodField()
    num_competitions = serializers.SerializerMethodField()
    event_rankings = serializers.SerializerMethodField()
    total_solves = serializers.SerializerMethodField()

    class Meta(CompetitorSerializer.Meta):
        fields = CompetitorSerializer.Meta.fields + [
            'first_competition_date', 'num_competitions', 'total_solves',
            'event_rankings',
        ]
    
    def get_first_competition_date(self, obj):
        return CompetitorService.get_first_competition_date(obj)

    def get_num_competitions(self, obj):
        return CompetitorService.get_num_competitions(obj)

    def get_total_solves(self, obj):
        return CompetitorService.get_total_solves(obj)

    # Vibe coded event ranking function that is fast but doesn't use any internal functions
    # def get_event_rankings(self, obj):
    #     from competitions.models import Solve, Event
    #     from competitions.services.ranking_service import RankingService
    #
    #     # Organize solves by event, only include solves with a valid time
    #     event_to_solves = {}
    #     solves_qs = Solve.objects.filter(competitor=obj).select_related('competition_round', 'competition_round__event')
    #     for solve in solves_qs:
    #         if solve.solve_time is None:
    #             continue
    #         event_name = solve.competition_round.event.name
    #         event_to_solves.setdefault(event_name, []).append(solve.solve_time.total_seconds())
    #
    #     data = []
    #     for event_name, times in event_to_solves.items():
    #         best_single = min(times) if times else None
    #
    #         # Calculate rolling averages for this competitor
    #         best_average = None
    #         if len(times) >= 5:
    #             rolling_averages = [sum(times[i:i+5])/5 for i in range(len(times)-4)]
    #             best_average = min(rolling_averages)
    #
    #         # Compute simple ranking for this event
    #         all_solves = Solve.objects.filter(competition_round__event__name=event_name).select_related('competitor')
    #         competitor_times = {}
    #         for s in all_solves:
    #             if s.solve_time is None:
    #                 continue
    #             competitor_times.setdefault(s.competitor_id, []).append(s.solve_time.total_seconds())
    #
    #         # Compute best single and best average per competitor without mutating the list
    #         competitor_best_singles = {c_id: min(times_list) for c_id, times_list in competitor_times.items()}
    #         competitor_best_averages = {}
    #         for c_id, times_list in competitor_times.items():
    #             if len(times_list) >= 5:
    #                 rolling = [sum(times_list[i:i+5])/5 for i in range(len(times_list)-4)]
    #                 competitor_best_averages[c_id] = min(rolling)
    #             else:
    #                 competitor_best_averages[c_id] = None
    #
    #         single_ranking = 1 + sum(1 for v in competitor_best_singles.values() if v is not None and v < best_single)
    #         average_ranking = 1 + sum(1 for v in competitor_best_averages.values() if v is not None and v < best_average)
    #
    #         data.append({
    #             "event_name": event_name,
    #             "best_single": best_single,
    #             "best_average": best_average,
    #             "single_ranking": single_ranking,
    #             "average_ranking": average_ranking
    #         })
    #
    #     return data
    def get_event_rankings(self, obj):
        # events = Event.objects.filter(rounds__solves__competitor=obj).distinct()

        events = Event.objects.filter(rounds__solves__competitor=obj).distinct().prefetch_related(
            "rounds__solves"
        )
        data = []
        for event in events:
            best_single = RankingService.get_competitor_best_single(obj, event)
            best_average = RankingService.get_competitor_best_average(obj, event)
            single_ranking = RankingService.get_competitor_single_ranking(obj, event, current_only=False)
            average_ranking = RankingService.get_competitor_average_ranking(obj, event, current_only=False)
            current_single_ranking = RankingService.get_competitor_single_ranking(obj, event, current_only=True)
            current_average_ranking = RankingService.get_competitor_average_ranking(obj, event, current_only=True)
            data.append({
                "event_name": event.name,
                "best_single": best_single,
                "best_average": best_average,
                "single_ranking": single_ranking,
                "average_ranking": average_ranking,
                "current_single_ranking": current_single_ranking,
                "current_average_ranking": current_average_ranking,
                })
        return EventRankingSerializer(data, many=True).data


class AllCompetitionListSerializer(serializers.ModelSerializer):
    date = serializers.SerializerMethodField()

    class Meta:
        model = Competition
        fields = ['id', 'name', 'date', 'official']

    def get_date(self, obj):
        return obj.start_time.strftime("%m/%d/%y")


class CompetitionInfoSerializer(serializers.ModelSerializer):
    events = serializers.SerializerMethodField()
    num_competitors = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()

    class Meta:
        model = Competition
        fields = ['id', 'name', 'location',
                  'events', 'num_competitors',
                  'date', 'official']

    def get_events(self, obj):
        # Get all rounds for this competition
        rounds = obj.rounds.select_related('event')

        # Build a dictionary counting rounds per event
        event_round_count = {}
        for r in rounds:
            name = r.event.name
            event_round_count[name] = event_round_count.get(name, 0) + 1

        # Convert to desired format
        return [{"name": name, "rounds": count} for name, count in event_round_count.items()]

    def get_num_competitors(self, obj):
        from .models import Solve  # Lazy import to avoid circular issues
        return Solve.objects.filter(competition_round__competition=obj).values('competitor').distinct().count()

    def get_date(self, obj):
        return obj.start_time.strftime("%m/%d/%y")


class CompetitionCreateSerializer(serializers.Serializer):
    name = serializers.CharField()
    location = serializers.CharField()
    official = serializers.BooleanField()
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()

    events = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField())
    )
    competitors = serializers.ListField(
        child=serializers.DictField()
    )

    def validate_events(self, value):
        for event in value:
            if "event-name" not in event or "Rounds" not in event:
                raise serializers.ValidationError("Each event must include 'event-name' and 'Rounds'.")
            if not Event.objects.filter(name=event["event-name"]).exists():
                raise serializers.ValidationError(f"Event '{event['event-name']}' does not exist.")
        return value

    def validate_competitors(self, value):
        for comp in value:
            if "school_id" not in comp or "events" not in comp:
                raise serializers.ValidationError("Each competitor must include 'school_id' and 'events'.")
            if not isinstance(comp["events"], list):
                raise serializers.ValidationError(f"'events' for {comp['school_id']} must be a list.")
            for ename in comp["events"]:
                if not Event.objects.filter(name=ename).exists():
                    raise serializers.ValidationError(f"Event '{ename}' for competitor '{comp['school_id']}' does not exist.")
        return value

    def create(self, validated_data):
        from .models import CompetitionRound, Solve, Competitor, Competition, Event, RoundType

        events_data = validated_data.pop("events")
        competitors_data = validated_data.pop("competitors")

        competition = Competition.objects.create(**validated_data)

        round_types = ["First", "Second", "Final"]

        # Create CompetitionRounds
        round_map = {}  # (event_name, round_number) → CompetitionRound
        for event_info in events_data:
            event = Event.objects.get(name=event_info["event-name"])
            for number in range(1, int(event_info["Rounds"]) + 1):
                round_type = RoundType.objects.get(name=round_types[number - 1])
                comp_round = CompetitionRound.objects.create(
                    competition=competition,
                    event=event,
                    number=number,
                    round_type=round_type
                )
                round_map.setdefault(event.name, []).append(comp_round)

        # Handle Competitors
        for comp_info in competitors_data:
            school_id = comp_info["school_id"].strip()
            try:
                competitor = Competitor.objects.get(school_id=school_id)
            except Competitor.DoesNotExist:
                raise serializers.ValidationError(f"Competitor with school_id '{school_id}' not found.")

            for event_name in comp_info["events"]:
                if event_name not in round_map:
                    continue
                for comp_round in round_map[event_name]:
                    for solve_number in range(1, 6):
                        Solve.objects.create(
                            competitor=competitor,
                            competition_round=comp_round,
                            solve_number=solve_number
                        )

        return competition

class EventRankingSerializer(serializers.Serializer):
    event_name = serializers.CharField()
    best_single = serializers.CharField()
    best_average = serializers.CharField()
    single_ranking = serializers.IntegerField(allow_null=True)
    average_ranking = serializers.IntegerField(allow_null=True)
    current_single_ranking = serializers.IntegerField(allow_null=True)
    current_average_ranking = serializers.IntegerField(allow_null=True)


class AbstractResultsSerializer(serializers.Serializer):
    single = serializers.CharField()
    average = serializers.CharField()
    rank = serializers.IntegerField()
    solves = serializers.ListField()

# Used for a round result's page
class CompetitorRoundResultsSerializer(AbstractResultsSerializer):
    name = serializers.CharField()
    school_id = serializers.CharField()

# Used for the detail page
class CompetitorRoundSolvesSerializer(AbstractResultsSerializer):
    round_number = serializers.IntegerField()

# Used for the rankings page
class GlobalRankingSerializer(serializers.Serializer):
    competitor_name = serializers.CharField()
    school_id = serializers.CharField()
    rank = serializers.IntegerField()
    competition_name = serializers.CharField()
    result = serializers.CharField()

class Events(serializers.Serializer):
    events = serializers.ListField()

class CompetitorCompetitionSolvesSerializer(serializers.Serializer):
    competition_name = serializers.CharField()
    round_results = CompetitorRoundSolvesSerializer(many=True)

class SolveUpdateEntrySerializer(serializers.Serializer):
    school_id = serializers.CharField()
    solves = serializers.ListField(
        child=serializers.CharField(),  # "24.00", "DNF", etc.
        min_length=5,
        max_length=5
    )

class RoundResultsUpdateSerializer(serializers.Serializer):
    results = serializers.ListField(
        child=SolveUpdateEntrySerializer()
    )

    def __init__(self, *args, **kwargs):
        raw_name = kwargs.pop("competition_name")
        self.competition_name = raw_name.replace("-", " ")
        self.event_name = kwargs.pop("event_name")
        self.round_number = kwargs.pop("round_number")
        super().__init__(*args, **kwargs)

    def validate(self, data):
        try:
            self.competition = Competition.objects.get(name__iexact=self.competition_name)
        except Competition.DoesNotExist:
            raise serializers.ValidationError(f"Competition '{self.competition_name}' not found.")

        try:
            self.event = Event.objects.get(name=self.event_name)
        except Event.DoesNotExist:
            raise serializers.ValidationError(f"Event '{self.event_name}' not found.")

        try:
            self.comp_round = CompetitionRound.objects.get(
                competition=self.competition,
                event=self.event,
                number=self.round_number
            )
        except CompetitionRound.DoesNotExist:
            raise serializers.ValidationError(
                f"Round {self.round_number} of event '{self.event_name}' not found in competition '{self.competition_name}'."
            )

        return data

    def save(self):
        updated = 0
        errors = []

        for entry in self.validated_data["results"]:
            school_id = entry["school_id"]

            competitor = Competitor.objects.filter(
                    school_id = school_id
                    ).first()

            if not competitor:
                errors.append(f"Competitor '{full_name}' not found.")
                continue

            solve_times = entry["solves"]
            for i, raw_result in enumerate(solve_times):
                normalized_result = "0.00" if raw_result.strip().upper() == "DNF" else raw_result
                try:
                    seconds = float(normalized_result)
                except ValueError:
                    errors.append(f"Invalid time format '{raw_result}' for '{full_name}'.")
                    continue

                duration = timedelta(seconds=seconds)
                solve_number = i + 1

                solve, created = Solve.objects.get_or_create(
                        competitor=competitor,
                        competition_round=self.comp_round,
                        solve_number=solve_number,
                        defaults={"solve_time": duration}
                        )

                if not created:
                    solve.solve_time = duration
                    solve.save()

            updated += 1

        return {
                "updated": updated,
                "errors": errors
                }
