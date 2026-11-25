import random
from competitions.services.round_service import RoundService
from competitions.services.competitor_service import CompetitorService
from competitions.services.ranking_service import RankingService
from competitions.models import Competition, CompetitionGroup, Competitor, CompetitionRound, Event, ScrambleSet, Solve
from competitions.services.solve_service import SolveService
from rest_framework.response import Response 
from rest_framework.decorators import api_view, permission_classes
from rest_framework import status
from competitions.serializers import AllCompetitionListSerializer, CompetitorDetailSerializer, CompetitorRoundResultsSerializer, CompetitionInfoSerializer, CompetitorCompetitionSolvesSerializer, CompetitorSerializer, GlobalRankingSerializer, Events, CompetitionCreateSerializer, RoundResultsUpdateSerializer
from competitions.serializers import AdminCompetitionInfoSerializer, CompetitionDetailsUpdateSerializer
from competitions.serializers import AdminCompetitorSerializer, EditCompetitorSerializer, RecordVersionSerializer
from competitions.serializers import AdminSolveSerializer, AddRoundResultSerializer, EditRoundResultSerializer, EditSolveSerializer, RemoveResultSerializer, SolveCompetitorSerializer
from competitions.serializers import AdminScrambleSetSerializer, EditScrambleSetSerializer, ScrambleSetVersionSerializer, ScrambleSetWriteSerializer
from competitions.serializers import PublicCompetitionInfoSerializer, PublicScrambleSetSerializer
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Max, Q
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError


# def check_secret(request):
#     # Either from query param or header
#     secret = request.GET.get('secret') or request.headers.get('X-Admin-Secret')
#     return secret == settings.SECRET_KEY

@api_view(['GET'])
def competitor_detail(request, school_id):
    # Get the competitor
    competitor = Competitor.objects.get(
            school_id= school_id
            )


    serializer = CompetitorDetailSerializer(competitor)
    return Response(serializer.data)

@api_view(['GET'])
def competitor_event_solves(request, school_id, event_name):
    competitor = Competitor.objects.get(
            school_id= school_id
            )

    event = Event.objects.get(name__iexact=event_name)

    data = CompetitorService.get_event_solves_for_competitor(competitor, event)
    serializer = CompetitorCompetitionSolvesSerializer(data, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def all_competitions(request):
    competitions = Competition.objects.filter(is_published=True).order_by('-start_time')
    serializer = AllCompetitionListSerializer(competitions, many=True)

    return Response(serializer.data)

def _published_competition(competition_name):
    return get_object_or_404(
        Competition.objects.with_url_name(), url_name=competition_name.replace(' ', '-'), is_published=True,
    )

def _published_round(competition_name, event_name, round_number):
    return get_object_or_404(
        CompetitionRound,
        competition=_published_competition(competition_name),
        event__name=event_name,
        number=round_number,
    )


@api_view(['GET'])
def competition_info(request, competition_name):
    competition = _published_competition(competition_name)
    return Response(PublicCompetitionInfoSerializer(competition).data)


@api_view(['GET'])
def round(request, competition_name, event_name, round_number):
    round_obj = _published_round(competition_name, event_name, round_number)
    results = RoundService.get_round_results(round_obj)
    serializer = CompetitorRoundResultsSerializer(results, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def round_scrambles(request, competition_name, event_name, round_number):
    round_obj = _published_round(competition_name, event_name, round_number)
    sets = round_obj.scramble_sets.with_scrambles().select_related('group__wave')
    return Response(PublicScrambleSetSerializer(sets, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_competitions(request):
    competitions = Competition.objects.order_by('-start_time')
    return Response(AllCompetitionListSerializer(competitions, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_competition_info(request, competition_name):
    competition = get_object_or_404(Competition.objects.with_url_name(), url_name=competition_name.replace(' ', '-'))
    return Response(AdminCompetitionInfoSerializer(competition).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def update_competition_details(request, competition_id):
    competition = get_object_or_404(Competition.objects.select_for_update(), pk=competition_id)
    serializer = CompetitionDetailsUpdateSerializer(competition, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    competition = serializer.save()
    return Response(AdminCompetitionInfoSerializer(competition).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_competition_publication(request, competition_id):
    competition = get_object_or_404(Competition, pk=competition_id)
    is_published = request.data.get('is_published') if isinstance(request.data, dict) else None
    if not isinstance(is_published, bool):
        return Response({'is_published': 'A boolean is required.'}, status=status.HTTP_400_BAD_REQUEST)

    competition.is_published = is_published
    competition.save(update_fields=['is_published', 'updated_at'])
    return Response({'is_published': competition.is_published})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def solve_competitors(request):
    competitors = Competitor.objects.order_by('first_name', 'last_name', 'pk')
    return Response(SolveCompetitorSerializer(competitors, many=True).data)


def _admin_page(request, queryset, *, page_size):
    return Paginator(queryset, page_size).get_page(request.query_params.get('page', 1))


def _admin_page_response(page, results):
    return Response({
        'results': results,
        'page': page.number,
        'total_pages': page.paginator.num_pages,
        'count': page.paginator.count,
    })


def _filter_competitors(competitors, search):
    for term in search.split():
        competitors = competitors.filter(
            Q(first_name__icontains=term) | Q(last_name__icontains=term) | Q(school_id__icontains=term),
        )
    return competitors


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_competitors(request):
    competitors = Competitor.objects.order_by('first_name', 'last_name', 'pk')
    competitors = _filter_competitors(competitors, request.query_params.get('search', ''))
    page = _admin_page(request, competitors, page_size=10)
    return _admin_page_response(page, AdminCompetitorSerializer(page.object_list, many=True).data)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def admin_edit_competitor(request, competitor_id):
    competitor = get_object_or_404(Competitor.objects.select_for_update(), pk=competitor_id)
    removing = request.method == 'DELETE'
    serializer = (
        RecordVersionSerializer(data=request.data) if removing
        else EditCompetitorSerializer(competitor, data=request.data, partial=True)
    )
    serializer.is_valid(raise_exception=True)
    if serializer.validated_data.pop('updated_at', None) != competitor.updated_at:
        return Response({'detail': 'This competitor changed. Reload the list before trying again.'}, status=status.HTTP_409_CONFLICT)
    if removing:
        if any(relation.exists() for relation in (
            competitor.solves, competitor.attendance, competitor.scrambler_approvals,
            competitor.wave_entries, competitor.group_assignments,
        )):
            return Response(
                {'detail': 'This competitor has linked competition records and cannot be removed.'},
                status=status.HTTP_409_CONFLICT,
            )
        competitor.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    competitor = serializer.save()
    return Response(AdminCompetitorSerializer(competitor).data)


def _save_round_times(round_obj, competitor_id, times):
    solves = round_obj.solves.filter(competitor_id=competitor_id)
    by_number = {}
    for solve in solves.order_by('pk'):
        current = by_number.get(solve.solve_number)
        if current is None or (current.solve_time is None and solve.solve_time is not None):
            by_number[solve.solve_number] = solve
    for number, time in times.items():
        solve = by_number.get(number)
        if solve is None:
            round_obj.solves.create(competitor_id=competitor_id, solve_number=number, solve_time=time)
        elif solve.solve_time != time:
            solve.solve_time = time
            solve.save(update_fields=['solve_time', 'updated_at'])
    return solves.filter(solve_time__isnull=False).select_related('competitor').order_by('solve_number', 'pk')


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def admin_round_solves(request, competition_id, round_id):
    rounds = CompetitionRound.objects.select_related('event')
    if request.method == 'POST':
        rounds = rounds.select_for_update(of=('self',))
    round_obj = get_object_or_404(rounds, pk=round_id, competition_id=competition_id)
    solves = round_obj.solves.filter(solve_time__isnull=False)
    if request.method == 'GET':
        page = None
        if 'page' in request.query_params or 'search' in request.query_params:
            competitors = Competitor.objects.filter(pk__in=solves.values('competitor_id')).order_by(
                'first_name', 'last_name', 'pk',
            )
            competitors = _filter_competitors(competitors, request.query_params.get('search', ''))
            page = _admin_page(request, competitors, page_size=7)
            solves = solves.filter(competitor_id__in=list(page.object_list.values_list('pk', flat=True)))
        solves = solves.select_related('competitor').order_by(
            'competitor__first_name', 'competitor__last_name', 'competitor_id', 'solve_number', 'pk',
        )
        results = AdminSolveSerializer(solves, many=True).data
        return _admin_page_response(page, results) if page is not None else Response(results)

    serializer = AddRoundResultSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    competitor = data['competitor_id']
    attempt_limit = SolveService.attempt_limit(round_obj.event.average_type)
    if len(data['times']) != attempt_limit:
        return Response({'times': f'Enter all {attempt_limit} attempts for this round.'}, status=status.HTTP_400_BAD_REQUEST)
    if solves.filter(competitor=competitor).exists():
        return Response({'detail': 'This competitor already has a result for this round.'}, status=status.HTTP_409_CONFLICT)

    saved = _save_round_times(round_obj, competitor.pk, dict(enumerate(data['times'], start=1)))
    return Response(AdminSolveSerializer(saved, many=True).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def admin_solve(request, competition_id, round_id, solve_id):
    round_obj = get_object_or_404(CompetitionRound.objects.select_for_update(), pk=round_id, competition_id=competition_id)
    solve = get_object_or_404(round_obj.solves.select_related('competitor'), pk=solve_id, solve_time__isnull=False)
    serializer = EditSolveSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if serializer.validated_data['updated_at'] != solve.updated_at:
        return Response({'detail': 'This solve changed. Reload the results before trying again.'}, status=status.HTTP_409_CONFLICT)
    solve.solve_time = serializer.validated_data['time']
    solve.save(update_fields=['solve_time', 'updated_at'])
    return Response(AdminSolveSerializer(solve).data)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def admin_competitor_result(request, competition_id, round_id, competitor_id):
    round_obj = get_object_or_404(CompetitionRound.objects.select_related('event'), pk=round_id, competition_id=competition_id)
    rounds = CompetitionRound.objects.filter(competition_id=competition_id, event_id=round_obj.event_id)
    if request.method == 'GET':
        solves = Solve.objects.filter(
            competition_round__in=rounds, competitor_id=competitor_id, solve_time__isnull=False,
        ).order_by('competition_round__number', 'solve_number', 'pk')
        return Response(list(solves.values('id', 'competition_round_id', 'updated_at')))

    editing = request.method == 'PATCH'
    serializer_class = EditRoundResultSerializer if editing else RemoveResultSerializer
    serializer = serializer_class(data=request.data)
    serializer.is_valid(raise_exception=True)
    if editing or serializer.validated_data['scope'] == 'round':
        rounds = rounds.filter(pk=round_id)
    round_ids = list(rounds.order_by('pk').select_for_update().values_list('pk', flat=True))
    if round_id not in round_ids:
        return Response(status=status.HTTP_404_NOT_FOUND)
    solves = Solve.objects.filter(competition_round_id__in=round_ids, competitor_id=competitor_id)
    recorded = solves.filter(solve_time__isnull=False)
    current = dict(recorded.values_list('pk', 'updated_at'))
    expected = {solve['id']: solve['updated_at'] for solve in serializer.validated_data['solves']}
    if current != expected:
        return Response({'detail': 'This result changed. Reload the results before trying again.'}, status=status.HTTP_409_CONFLICT)
    if editing:
        allowed = set(range(1, SolveService.attempt_limit(round_obj.event.average_type) + 1))
        allowed.update(recorded.values_list('solve_number', flat=True))
        allowed_keys = {str(number) for number in allowed}
        times = serializer.validated_data['times']
        if not times.keys() <= allowed_keys:
            return Response({'times': 'One or more attempt numbers are invalid for this round.'}, status=status.HTTP_400_BAD_REQUEST)
        updated = _save_round_times(round_obj, competitor_id, {int(number): time for number, time in times.items()})
        return Response(AdminSolveSerializer(updated, many=True).data)
    solves.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


def _round_scramble_groups(round_obj):
    return CompetitionGroup.objects.filter(
        wave__competition_id=round_obj.competition_id, wave__allowed_rounds=round_obj,
    )


def _validate_scramble_group(round_obj, group_id, *, existing=None):
    if group_id is None or (existing is not None and group_id == existing.group_id):
        return
    if not _round_scramble_groups(round_obj).filter(pk=group_id).exists():
        raise ValidationError({'group_id': 'Choose a group whose wave offers this round.'})
    if round_obj.scramble_sets.filter(group_id=group_id).exists():
        raise ValidationError({'group_id': 'This group already has a set for this round.'})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def admin_round_scrambles(request, competition_id, round_id):
    rounds = CompetitionRound.objects.all()
    if request.method == 'POST':
        rounds = rounds.select_for_update()
    round_obj = get_object_or_404(rounds, pk=round_id, competition_id=competition_id)
    sets = round_obj.scramble_sets.all()
    if request.method == 'GET':
        # Include previously assigned sets even if their wave no longer offers this round.
        groups = CompetitionGroup.objects.filter(
            Q(pk__in=_round_scramble_groups(round_obj).values('pk'))
            | Q(pk__in=sets.exclude(group_id=None).values('group_id')),
            wave__competition_id=competition_id,
        ).select_related('wave').order_by('wave__number', 'number')
        return Response({
            'groups': [
                {'id': group.pk, 'number': group.number, 'wave_number': group.wave.number, 'wave_name': group.wave.name}
                for group in groups
            ],
            'sets': AdminScrambleSetSerializer(sets, many=True).data,
        })

    serializer = ScrambleSetWriteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    _validate_scramble_group(round_obj, data['group_id'])
    last_number = sets.aggregate(last=Max('number'))['last'] or 0
    if last_number >= 32767:
        raise ValidationError({'detail': 'This round has reached its scramble set number limit.'})
    scramble_set = round_obj.scramble_sets.create(number=last_number + 1, generator_name='manual', **data)
    return Response(AdminScrambleSetSerializer(scramble_set).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def admin_scramble_set(request, competition_id, round_id, set_id):
    round_obj = get_object_or_404(CompetitionRound.objects.select_for_update(), pk=round_id, competition_id=competition_id)
    scramble_set = get_object_or_404(round_obj.scramble_sets, pk=set_id)
    removing = request.method == 'DELETE'
    serializer_class = ScrambleSetVersionSerializer if removing else EditScrambleSetSerializer
    serializer = serializer_class(data=request.data, partial=not removing)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    version = data.pop('version', None)
    if version is None:
        raise ValidationError({'version': 'A version is required to edit a scramble set.'})
    if version != AdminScrambleSetSerializer.get_version(scramble_set):
        return Response({'detail': 'This scramble set changed. Reload the round before trying again.'}, status=status.HTTP_409_CONFLICT)
    if removing:
        scramble_set.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if 'group_id' in data:
        _validate_scramble_group(round_obj, data['group_id'], existing=scramble_set)
    for field, value in data.items():
        setattr(scramble_set, field, value)
    if data:
        scramble_set.save(update_fields=['group' if field == 'group_id' else field for field in data])
    return Response(AdminScrambleSetSerializer(scramble_set).data)


# Rankings
@api_view(['GET'])
def ranking_solves(request, event_name, single_or_average):
    data = None

    event = Event.objects.get(name = event_name)

    if single_or_average == "single":
        data = RankingService.get_distinct_single_rankings(event)
    elif single_or_average == "average":
        data = RankingService.get_all_average_rankings(event)
    else:
        pass # Return an error

    # print(data)
    serializer = GlobalRankingSerializer(data, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def events(request):
    event_names = list(Event.objects.values_list('name', flat=True))
    serializer = Events({"events": event_names})
    return Response(serializer.data)
    # EventsWithRankings

@api_view(['GET'])
def all_competitors(request):
    competitors = Competitor.objects.order_by('first_name').distinct()
    serializer = CompetitorSerializer(competitors, many=True)
    return Response({"competitors": serializer.data})

# Create methods
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_competitor(request):
    serializer = CompetitorSerializer(data=request.data)
    if serializer.is_valid():
        competitor = serializer.save()
        # Optionally return full detail after creation:
        # return Response(CompetitorDetailSerializer(competitor).data, status=201)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_competition(request):
    serializer = CompetitionCreateSerializer(data=request.data)
    if serializer.is_valid():
        competition = serializer.save()
        return Response(CompetitionInfoSerializer(competition).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def update_round_results(request, competition_name, event_name, round_number):
    serializer = RoundResultsUpdateSerializer(
        data=request.data,
        competition_name=competition_name,
        event_name=event_name,
        round_number=round_number
    )
    if serializer.is_valid():
        get_object_or_404(CompetitionRound.objects.select_for_update(), pk=serializer.comp_round.pk)
        result = serializer.save()
        return Response(result, status=status.HTTP_200_OK)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

