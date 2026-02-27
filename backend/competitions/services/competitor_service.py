from .solve_service import SolveService
from collections import defaultdict
from collections import OrderedDict
class CompetitorService:
    @staticmethod
    # def get_best_single(competitor):
    #     # logic to compute best single
    #     return SolveService.format_solve_time(competitor.solves.filter(solve_time__isnull=False).order_by('solve_time').first().solve_time) 

    @staticmethod
    def get_first_competition_date(competitor):
        competitions = (competitor.solves
                        .select_related('competition_round__competition')
                        .values_list('competition_round__competition__start_time', flat = True)
                        .distinct())

        if not competitions:
            return None 
        earliest_date = min(competitions)
        return earliest_date.strftime("%m/%d/%y")

    @staticmethod
    def get_num_competitions(competitor):
        return (competitor.solves
                .values('competition_round__competition')
                .distinct()
                .count())

    @staticmethod
    def get_total_solves(competitor):
        return (competitor.solves.count())

    @staticmethod
    def get_event_solves_for_competitor(competitor, event):
            from competitions.models import Solve
            from competitions.services.round_service import RoundService

            # fetch THIS competitor's solves for THIS event (ordered)
            solves = (
                Solve.objects
                .filter(competitor=competitor, competition_round__event=event)
                .select_related('competition_round__competition', 'competition_round__event')
                .order_by('competition_round__competition__start_time',
                          'competition_round__number',
                          'solve_number')
            )

            # group the competitor's solves by round (preserve chronological order)
            round_map = OrderedDict()  # (round_id, comp_name, round_no) -> list[Solve]
            for s in solves:
                r = s.competition_round
                key = (r.id, r.competition.name, r.number)
                round_map.setdefault(key, []).append(s)

            if not round_map:
                return []

            # prefetch ALL solves for those rounds (for ranking; single query)
            round_ids = [rid for (rid, _, _) in round_map.keys()]
            all_round_solves = (
                Solve.objects
                .filter(competition_round_id__in=round_ids)
                .select_related('competitor', 'competition_round__event', 'competition_round__competition')
                .order_by('competition_round_id', 'solve_number')
            )

            all_by_round = defaultdict(list)
            for s in all_round_solves:
                all_by_round[s.competition_round_id].append(s)

            # build output grouped by competition name
            by_competition = OrderedDict()  # comp_name -> list[round_result]
            for (rid, comp_name, round_no), my_solves in round_map.items():
                round_obj = my_solves[0].competition_round
                rr = RoundService.get_competitor_round_results_from_solves(round_obj, competitor, my_solves)
                rr["round_number"] = round_no
                rr["rank"] = RoundService.get_rank_in_round_from_solves(round_obj, competitor, all_by_round[rid])
                by_competition.setdefault(comp_name, []).append(rr)

            # shape + sort rounds newest->oldest inside each competition
            out = []
            for comp_name, rounds_list in by_competition.items():
                rounds_list.sort(key=lambda r: r["round_number"], reverse=True)
                out.append({
                    "competition_name": comp_name,
                    "round_results": rounds_list,
                })
            out.reverse()
            return out

    # @staticmethod
    # def get_event_solves_for_competitor(competitor, event):
    #     from competitions.models import CompetitionRound
    #     from competitions.services.round_service import RoundService
    #
    #     rounds = CompetitionRound.objects.filter(
    #             event=event,
    #             solves__competitor=competitor
    #             ).distinct().order_by('competition__start_time', 'number')
    #
    #     comp_dict = {}
    #
    #     for round_obj in rounds:
    #         comp_name = round_obj.competition.name
    #         if comp_name not in comp_dict:
    #             comp_dict[comp_name] = []
    #
    #         round_data = RoundService.get_competitor_round_results(round_obj, competitor)
    #         round_data['round_number'] = round_obj.number
    #         round_data['rank'] = RoundService.get_rank_in_round(round_obj, competitor)
    #
    #         # round_data.pop('name', None)
    #         comp_dict[comp_name].append(round_data)
    #
    #     # Format it into the desired list
    #     return [
    #             {
    #                 "competition_name": name,
    #                 "round_results": sorted(rounds_list, key=lambda r: r['round_number'], reverse=True)
    #                 }
    #             for name, rounds_list in reversed(list(comp_dict.items()))
    #             ]
