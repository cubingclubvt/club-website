from collections import defaultdict

from .average_calculator import AverageCalculator
from .solve_service import SolveService


class RoundService:
    @staticmethod
    def get_competitor_round_results(round_obj, competitor):
        solves = round_obj.solves.filter(competitor=competitor).order_by("solve_number", "pk")
        return RoundService.get_competitor_round_results_from_solves(round_obj, competitor, solves)

    @staticmethod
    def get_competitor_round_results_from_solves(round_obj, competitor, solves):
        recorded = [solve for solve in solves if solve.solve_time is not None]
        average_type = round_obj.event.average_type
        average = AverageCalculator.calculate_solves_average(recorded, average_type)
        labels = SolveService.get_round_solves_from_list(recorded, average_type if average != "—" else None)
        by_number = {solve.solve_number: label for solve, label in zip(recorded, labels)}
        return {
            "competitor_id": competitor.id,
            "name": f"{competitor.first_name} {competitor.last_name}",
            "school_id": competitor.school_id,
            "single": SolveService.get_round_single_from_solves(recorded),
            "average": average,
            "solves": [by_number.get(number, "—") for number in range(1, max(by_number, default=0) + 1)],
        }

    @staticmethod
    def sort_results(round_obj, results):
        from .ranking_service import RankingService

        ranking_format = "single" if round_obj.event.ranking_format == "single" else "average"
        return RankingService.sort_solves(results, ranking_format, round_obj.event.get_alternative_ranking_format())

    @staticmethod
    def get_round_results(round_obj):
        grouped = defaultdict(list)
        solves = round_obj.solves.filter(solve_time__isnull=False).select_related("competitor").order_by(
            "competitor_id", "solve_number", "pk",
        )
        for solve in solves:
            grouped[solve.competitor].append(solve)
        results = RoundService.sort_results(round_obj, [
            RoundService.get_competitor_round_results_from_solves(round_obj, competitor, solves)
            for competitor, solves in grouped.items()
        ])
        for rank, result in enumerate(results, start=1):
            result["rank"] = rank
        return results

    @staticmethod
    def get_rank_in_round(round_obj, competitor):
        return next(
            (result["rank"] for result in RoundService.get_round_results(round_obj)
             if result["competitor_id"] == competitor.pk),
            None,
        )

    @staticmethod
    def get_rank_in_round_from_solves(round_obj, competitor, all_solves_for_round):
        grouped = defaultdict(list)
        for solve in all_solves_for_round:
            if solve.solve_time is not None:
                grouped[solve.competitor_id].append(solve)
        results = RoundService.sort_results(round_obj, [
            {
                "competitor_id": competitor_id,
                "single": SolveService.get_round_single_from_solves(solves),
                "average": AverageCalculator.calculate_solves_average(solves, round_obj.event.average_type),
            }
            for competitor_id, solves in grouped.items()
        ])
        return next(
            (rank for rank, result in enumerate(results, start=1) if result["competitor_id"] == competitor.pk),
            None,
        )
