import math
from datetime import timedelta

class AverageCalculator:
    @staticmethod
    def get_noncounting_indexes(durations):
        sorted_indices = sorted(range(len(durations)), key=lambda i: (durations[i] == 0, durations[i]))
        trim_count = math.ceil(len(durations) * 0.05)
        return set(sorted_indices[:trim_count] + sorted_indices[-trim_count:])

    @staticmethod
    def calculate_mean(durations):
        return 0 if 0 in durations or len(durations) == 0 else sum(durations) / len(durations)

    @staticmethod
    def calculate_average(durations):
        non_counting = AverageCalculator.get_noncounting_indexes(durations)
        counting = [d for i, d in enumerate(durations) if i not in non_counting]
        return AverageCalculator.calculate_mean(counting)

    @staticmethod
    def calculate_solves_average(solves, avg_type):
        from .solve_service import SolveService
        durations = SolveService.solves_to_durations(solves)

        if avg_type == "mean":
            value = AverageCalculator.calculate_mean(durations)
        elif avg_type == "average":
            value = AverageCalculator.calculate_average(durations)
        else:
            raise ValueError(f"Invalid average type: {avg_type}")

        return SolveService.format_solve_time(timedelta(seconds=value))

    @staticmethod
    def calculate_round_average(comp_round, competitor):
        from .solve_service import SolveService
        solves = list(comp_round.solves.filter(competitor=competitor).order_by('solve_number'))
        return AverageCalculator.calculate_solves_average(solves, comp_round.event.average_type)
