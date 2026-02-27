import random
from competitions.services.round_service import RoundService
from competitions.services.competitor_service import CompetitorService
from competitions.services.ranking_service import RankingService
from competitions.models import Competition, Competitor, CompetitionRound, Event
from rest_framework.response import Response 
from rest_framework.decorators import api_view, permission_classes
from rest_framework import status
from competitions.serializers import AllCompetitionListSerializer, CompetitorDetailSerializer, CompetitorRoundResultsSerializer, CompetitionInfoSerializer, CompetitorCompetitionSolvesSerializer, CompetitorSerializer, GlobalRankingSerializer, Events, CompetitionCreateSerializer, RoundResultsUpdateSerializer
from django.contrib.auth.decorators import login_required
from rest_framework.permissions import IsAuthenticated


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
    competitions = Competition.objects.all().order_by('start_time').reverse()
    serializer = AllCompetitionListSerializer(competitions, many=True)

    return Response(serializer.data)

@api_view(['GET'])
def competition_info(request, competition_name):
    competition_name = competition_name.replace("-", ' ')
    competition = Competition.objects.get(name=competition_name)

    serializer = CompetitionInfoSerializer(competition)
    return Response(serializer.data)


@api_view(['GET'])
def round(request, competition_name, event_name, round_number):
    competition_name = competition_name.replace("-", ' ')
    competition = Competition.objects.get(name=competition_name)

    round_obj = CompetitionRound.objects.get(
            competition=competition,
            event__name=event_name,
            number=round_number
            )

    results = RoundService.get_round_results(round_obj)
    serializer = CompetitorRoundResultsSerializer(results, many=True)
    return Response(serializer.data)

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
def update_round_results(request, competition_name, event_name, round_number):
    serializer = RoundResultsUpdateSerializer(
        data=request.data,
        competition_name=competition_name,
        event_name=event_name,
        round_number=round_number
    )
    if serializer.is_valid():
        result = serializer.save()
        return Response(result, status=status.HTTP_200_OK)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

