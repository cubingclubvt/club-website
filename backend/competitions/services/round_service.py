from .solve_service import SolveService
from .average_calculator import AverageCalculator
from datetime import timedelta, datetime
from collections import defaultdict
# from .apps import apps  # Avoid circular import

class RoundService:
    @staticmethod
    # def get_competitor_round_results(round_obj, competitor):
    #     return {
    #         "name": competitor.first_name + " " + competitor.last_name,
    #         "single": SolveService.get_round_single(round_obj, competitor.id),
    #         "average": AverageCalculator.calculate_round_average(round_obj, competitor),
    #         "solves": SolveService.get_round_solves(round_obj, competitor.id),
    #     }
    def get_competitor_round_results(round_obj, competitor):
        return {
            "competitor_id": competitor.id,
            "name": competitor.first_name + " " + competitor.last_name,
            "school_id": competitor.school_id,
            "single": SolveService.get_round_single(round_obj, competitor.id),
            "average": AverageCalculator.calculate_round_average(round_obj, competitor),
            "solves": SolveService.get_round_solves(round_obj, competitor.id),
        }

    @staticmethod
    def get_competitor_round_results_from_solves(round_obj, competitor, solves):
            """
            solves: list of Solve objects for THIS competitor & THIS round (usually 5)
            """
            from competitions.services.average_calculator import AverageCalculator
            from competitions.services.solve_service import SolveService

            # seconds
            durations = [s.solve_time.total_seconds() if s.solve_time else 0 for s in solves]

            avg_type = round_obj.event.average_type
            if avg_type == "mean":
                avg_val = AverageCalculator.calculate_mean(durations)
            elif avg_type == "average":
                avg_val = AverageCalculator.calculate_average(durations)
            else:
                avg_val = None

            average_str = (
                SolveService.format_solve_time(timedelta(seconds=avg_val))
                if (avg_val is not None and avg_val > 0)
                else "DNF"
            )

            return {
                "competitor_id": competitor.id,
                "name": f"{competitor.first_name} {competitor.last_name}",
                "school_id": competitor.school_id,
                "single": SolveService.get_round_single_from_solves(solves),
                "average": average_str,
                "solves": SolveService.get_round_solves_from_list(solves, avg_type),
            }

    @staticmethod
    def get_round_results(round_obj):
        from .ranking_service import RankingService
        from competitions.models import Competitor

        # Competitor = apps.get_model('competitions', 'Competitor')
        competitors = Competitor.objects.filter(solves__competition_round=round_obj).distinct()
        results = [RoundService.get_competitor_round_results(round_obj, c) for c in competitors]

        ranking_format = round_obj.event.ranking_format
        alt_format = round_obj.event.get_alternative_ranking_format()

        # results.sort(key=lambda x: (
        #     x[ranking_format] == "DNF",
        #     x[ranking_format],
        #     x[alt_format] == "DNF",
        #     x[alt_format]
        # ))
        # results.sort(key=lambda x: (
        #     x[ranking_format] == "DNF",
        #     float(x[ranking_format]),
        #     x[alt_format] == "DNF",
        #     float(x[alt_format])
        # ))
        results = RankingService.sort_solves(results, ranking_format, alt_format)

        for i, r in enumerate(results):
            r["rank"] = i + 1

        return results


    @staticmethod
    def get_rank_in_round(round_obj, competitor):
        results = RoundService.get_round_results(round_obj)
        for result in results:
            if result.get("competitor_id") == competitor.id:
                return result["rank"]
        return None  # Or -1 or "Unranked" depending on how you want to handle not found

    @staticmethod
    def get_rank_in_round_from_solves(round_obj, competitor, all_solves_for_round):
            """
            all_solves_for_round: list of Solve for ALL competitors in this round
            returns this competitor's rank according to round_obj.event.ranking_format
            """
            from competitions.services.solve_service import SolveService
            from competitions.services.average_calculator import AverageCalculator
            from competitions.services.ranking_service import RankingService

            # group all solves by competitor in this round
            by_comp = defaultdict(list)
            for s in all_solves_for_round:
                by_comp[s.competitor_id].append(s)

            avg_type = round_obj.event.average_type
            ranking_key = round_obj.event.ranking_format
            alt_key = round_obj.event.get_alternative_ranking_format()

            # build minimal rows for ranking (no extra DB hits)
            rows = []
            for comp_id, solves in by_comp.items():
                # seconds
                durations = [s.solve_time.total_seconds() if s.solve_time else 0 for s in solves]

                # average string
                if avg_type == "mean":
                    avg_val = AverageCalculator.calculate_mean(durations)
                elif avg_type == "average":
                    avg_val = AverageCalculator.calculate_average(durations)
                else:
                    avg_val = None

                avg_str = (
                    SolveService.format_solve_time(timedelta(seconds=avg_val))
                    if (avg_val is not None and avg_val > 0) else "DNF"
                )

                rows.append({
                    "competitor_id": comp_id,
                    "single": SolveService.get_round_single_from_solves(solves),
                    "average": avg_str,
                })

            # rank
            ranked = RankingService.sort_solves(rows, ranking_key, alt_key)
            for i, r in enumerate(ranked, start=1):
                if r["competitor_id"] == competitor.id:
                    return i
            return None
