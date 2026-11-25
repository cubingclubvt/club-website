from competitions.services.ranking_service import RankingService
from rest_framework import serializers
from django.db.models import Q
from datetime import timedelta
import hashlib
import json
import re
from .models import Competition, Competitor, Event, RoundType, CompetitionRound, ScrambleSet, Solve
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

class AdminCompetitorSerializer(CompetitorSerializer):
    class Meta(CompetitorSerializer.Meta):
        fields = ['id', *CompetitorSerializer.Meta.fields, 'updated_at']


class EditCompetitorSerializer(CompetitorSerializer):
    updated_at = serializers.DateTimeField(write_only=True)

    class Meta(CompetitorSerializer.Meta):
        fields = [*CompetitorSerializer.Meta.fields, 'updated_at']

    def validate_school_id(self, school_id):
        if school_id == self.instance.school_id:
            return school_id
        if school_id in {'.', '..'} or any(char in '/\\?#%' or char.isspace() for char in school_id):
            raise serializers.ValidationError('Enter a school ID that can be used in the competitor profile URL.')
        if Competitor.objects.filter(school_id__iexact=school_id).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError('This school ID is already in use.')
        return school_id


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

        events = Event.objects.filter(
            rounds__solves__competitor=obj, rounds__competition__is_published=True,
        ).distinct()
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
        fields = ['id', 'name', 'date', 'official', 'is_published']

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
                  'date', 'official', 'official_link', 'is_published']

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
        return Solve.objects.filter(competition_round__competition=obj, solve_time__isnull=False).values('competitor').distinct().count()

    def get_date(self, obj):
        return obj.start_time.strftime("%m/%d/%y")


class PublicCompetitionInfoSerializer(CompetitionInfoSerializer):
    scramble_rounds = serializers.SerializerMethodField()

    class Meta(CompetitionInfoSerializer.Meta):
        fields = CompetitionInfoSerializer.Meta.fields + ['scramble_rounds']

    def get_scramble_rounds(self, obj):
        rounds = ScrambleSet.objects.with_scrambles().filter(
            competition_round__competition=obj,
        ).order_by('competition_round__event__name', 'competition_round__number').values_list(
            'competition_round__event__name', 'competition_round__number',
        ).distinct()
        return [{'event': event, 'round': number} for event, number in rounds]


ROUND_TYPE_NAMES = ("First", "Second", "Final")


class AdminCompetitionInfoSerializer(CompetitionInfoSerializer):
    available_events = serializers.SerializerMethodField()
    solve_rounds = serializers.SerializerMethodField()

    class Meta(CompetitionInfoSerializer.Meta):
        fields = CompetitionInfoSerializer.Meta.fields + ['start_time', 'end_time', 'available_events', 'solve_rounds']

    def get_available_events(self, obj):
        return list(Event.objects.order_by('name').values_list('name', flat=True))

    def get_solve_rounds(self, obj):
        return [
            {'id': round_obj.pk, 'event': round_obj.event.name, 'number': round_obj.number,
             'attempt_limit': SolveService.attempt_limit(round_obj.event.average_type)}
            for round_obj in obj.rounds.select_related('event').order_by('event__name', 'number')
        ]


class CompetitionDetailsUpdateSerializer(serializers.ModelSerializer):
    event_round_counts = serializers.DictField(
        child=serializers.IntegerField(min_value=0, max_value=len(ROUND_TYPE_NAMES)), required=False, write_only=True,
    )

    class Meta:
        model = Competition
        fields = ['name', 'location', 'start_time', 'end_time', 'official', 'official_link', 'event_round_counts']

    def update_round_counts(self, competition, counts):
        events = Event.objects.in_bulk(counts.keys(), field_name='name')
        errors = {}
        for name, count in counts.items():
            if name not in events:
                errors[name] = 'Unknown event.'
                continue
            event = events[name]
            rounds = competition.rounds.filter(event=event).order_by('number')
            round_numbers = list(rounds.select_for_update().values_list('number', flat=True))
            if round_numbers != list(range(1, len(round_numbers) + 1)):
                errors[name] = 'Existing rounds must be numbered consecutively before changing their count.'
                continue
            removed_rounds = rounds.filter(number__gt=count)
            if removed_rounds.filter(
                Q(solves__isnull=False) | Q(waves__isnull=False) | Q(wave_entries__isnull=False)
                | Q(group_assignments__isnull=False) | Q(scramble_sets__isnull=False),
            ).exists():
                errors[name] = 'Rounds with solves, waves, assignments, or scrambles cannot be removed here.'
                continue
            if count < len(round_numbers):
                removed_rounds.delete()
            for number in range(len(round_numbers) + 1, count + 1):
                round_type, _ = RoundType.objects.get_or_create(name=ROUND_TYPE_NAMES[number - 1])
                competition.rounds.create(event=event, number=number, round_type=round_type)
        if errors:
            raise serializers.ValidationError({'event_round_counts': errors})

    def validate_name(self, name):
        if name == self.instance.name:
            return name
        url_name = name.replace(' ', '-')
        if '/' in name or '\\' in name or url_name.lower() in {'.', '..', 'create', 'new'}:
            raise serializers.ValidationError('Choose a name that can be used in the competition URL.')
        if Competition.objects.with_url_name().filter(url_name__iexact=url_name).exclude(
            pk=self.instance.pk,
        ).exists():
            raise serializers.ValidationError('A competition already uses this name or URL.')
        return name

    def validate(self, attrs):
        if 'start_time' in attrs or 'end_time' in attrs:
            start_time = attrs.get('start_time', self.instance.start_time)
            end_time = attrs.get('end_time', self.instance.end_time)
            if end_time < start_time:
                raise serializers.ValidationError({'end_time': 'End time must be on or after start time.'})
        if ('official' in attrs or 'official_link' in attrs) and not attrs.get('official', self.instance.official):
            attrs['official_link'] = None
        return attrs

    def update(self, instance, validated_data):
        event_round_counts = validated_data.pop('event_round_counts', {})
        if event_round_counts:
            self.update_round_counts(instance, event_round_counts)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if validated_data or event_round_counts:
            instance.save(update_fields=[*validated_data, 'updated_at'])
        return instance


class CompetitionCreateSerializer(serializers.Serializer):
    name = serializers.CharField()
    location = serializers.CharField()
    official = serializers.BooleanField()
    official_link = serializers.URLField(required=False, allow_null=True)
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


        # Create CompetitionRounds
        round_map = {}  # (event_name, round_number) → CompetitionRound
        for event_info in events_data:
            event = Event.objects.get(name=event_info["event-name"])
            for number in range(1, int(event_info["Rounds"]) + 1):
                round_type = RoundType.objects.get(name=ROUND_TYPE_NAMES[number - 1])
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

class SolveCompetitorSerializer(CompetitorSerializer):
    class Meta(CompetitorSerializer.Meta):
        fields = ['id', 'first_name', 'last_name', 'school_id']


class AdminSolveSerializer(serializers.ModelSerializer):
    competitor = SolveCompetitorSerializer()
    time = serializers.SerializerMethodField()

    class Meta:
        model = Solve
        fields = ['id', 'competitor', 'solve_number', 'time', 'updated_at']

    def get_time(self, solve):
        return SolveService.format_solve_time(solve.solve_time)


class SolveTimeField(serializers.CharField):
    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if value.upper() == 'DNF':
            return timedelta(0)
        match = re.fullmatch(r'(?:(\d{1,5}):)?(\d{1,6})(?:\.(\d{1,2}))?', value, flags=re.ASCII)
        if match:
            minutes, seconds, fraction = match.groups()
            seconds = int(seconds)
            hundredths = int((fraction or '').ljust(2, '0'))
            if (minutes is None or (len(match[2]) == 2 and seconds < 60)) and (int(minutes or 0) or seconds or hundredths):
                return timedelta(minutes=int(minutes or 0), seconds=seconds, milliseconds=hundredths * 10)
        raise serializers.ValidationError('Enter a positive time such as 12.34 or 1:02.34, or enter DNF.')


class PublicScrambleSetSerializer(serializers.ModelSerializer):
    group = serializers.SerializerMethodField()

    class Meta:
        model = ScrambleSet
        fields = ['number', 'group', 'scrambles', 'extra_scrambles']

    def get_group(self, scramble_set):
        group = scramble_set.group
        if group is None:
            return None
        return {'number': group.number, 'wave_number': group.wave.number, 'wave_name': group.wave.name}


class AdminScrambleSetSerializer(serializers.ModelSerializer):
    version = serializers.SerializerMethodField()

    class Meta:
        model = ScrambleSet
        fields = ['id', 'number', 'group_id', 'scrambles', 'extra_scrambles', 'version']

    @staticmethod
    def get_version(scramble_set):
        snapshot = json.dumps([
            scramble_set.group_id, scramble_set.scrambles, scramble_set.extra_scrambles,
        ])
        return hashlib.sha256(snapshot.encode()).hexdigest()


class ScrambleSetVersionSerializer(serializers.Serializer):
    version = serializers.CharField(max_length=64)


class ScrambleSetWriteSerializer(serializers.Serializer):
    group_id = serializers.IntegerField(min_value=1, allow_null=True, default=None)
    scrambles = serializers.ListField(child=serializers.CharField(max_length=4096), allow_empty=False)
    extra_scrambles = serializers.ListField(child=serializers.CharField(max_length=4096), default=list)


class EditScrambleSetSerializer(ScrambleSetWriteSerializer, ScrambleSetVersionSerializer):
    pass


class AddRoundResultSerializer(serializers.Serializer):
    competitor_id = serializers.PrimaryKeyRelatedField(queryset=Competitor.objects.all())
    times = serializers.ListField(child=SolveTimeField(), min_length=1, max_length=5)


class RecordVersionSerializer(serializers.Serializer):
    updated_at = serializers.DateTimeField()


class EditSolveSerializer(RecordVersionSerializer):
    time = SolveTimeField()


class RecordedSolveVersionSerializer(RecordVersionSerializer):
    id = serializers.IntegerField(min_value=1)


class ResultVersionSerializer(serializers.Serializer):
    solves = RecordedSolveVersionSerializer(many=True, allow_empty=False)


class EditRoundResultSerializer(ResultVersionSerializer):
    times = serializers.DictField(child=SolveTimeField(), allow_empty=False)


class RemoveResultSerializer(ResultVersionSerializer):
    scope = serializers.ChoiceField(choices=['round', 'event'])


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
        self.competition_name = raw_name.replace(" ", "-")
        self.event_name = kwargs.pop("event_name")
        self.round_number = kwargs.pop("round_number")
        super().__init__(*args, **kwargs)

    def validate(self, data):
        try:
            self.competition = Competition.objects.with_url_name().get(url_name__iexact=self.competition_name)
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
