class SolveService:
    @staticmethod
    def format_solve_time(solve_time):
        if solve_time is None or solve_time.total_seconds() == 0:
            return "DNF"
        total_seconds = round(solve_time.total_seconds(), 2)
        minutes, seconds = divmod(total_seconds, 60)
        whole_seconds = int(seconds)
        hundredths = int(round((seconds - whole_seconds) * 100))
        if minutes >= 1:
            return f"{int(minutes)}:{whole_seconds:02d}.{hundredths:02d}"
        else:
            return f"{whole_seconds}.{hundredths:02d}"

    @staticmethod
    def solves_to_durations(solves):
        return [s.solve_time.total_seconds() if s.solve_time else 0 for s in solves]

    @staticmethod
    def get_round_solves(comp_round, competitor_id):
        from .average_calculator import AverageCalculator
        event = comp_round.event
        solves = list(comp_round.solves.filter(competitor__id=competitor_id).order_by('solve_number'))
        str_solves = [SolveService.format_solve_time(s.solve_time) for s in solves]

        if event.average_type == "average":
            durations = SolveService.solves_to_durations(solves)
            non_counting = AverageCalculator.get_noncounting_indexes(durations)
            str_solves = [
                f"({SolveService.format_solve_time(s.solve_time)})" if i in non_counting else SolveService.format_solve_time(s.solve_time)
                for i, s in enumerate(solves)
            ]

        return str_solves

    @staticmethod
    def get_round_single(comp_round, competitor_id):
        solves = list(comp_round.solves.filter(competitor__id=competitor_id).order_by('solve_number'))
        sorted_solves = sorted(
            solves,
            key=lambda s: (
                s.solve_time is None or s.solve_time.total_seconds() == 0,
                s.solve_time.total_seconds() if s.solve_time else 0
            )
        )
        return SolveService.format_solve_time(sorted_solves[0].solve_time)

    @staticmethod
    def get_round_single_from_solves(round_solves):
        """
        round_solves: list of Solve objects or list[float seconds]
        returns best single as a formatted string or 'DNF'
        """
        # normalize to seconds
        if round_solves and hasattr(round_solves[0], "solve_time"):
            durations = [s.solve_time.total_seconds() if s.solve_time else 0 for s in round_solves]
        else:
            durations = round_solves

        valid = [d for d in durations if d > 0]
        if not valid:
            return "DNF"

        best = min(valid)
        from datetime import timedelta
        return SolveService.format_solve_time(timedelta(seconds=best))


    @staticmethod
    def get_round_solves_from_list(solves, average_type):
        from datetime import timedelta
        """
            solves: list of Solve objects or list[float seconds]
            returns: list[str] like ["(13.00)", "20.00", ...] (5 items typically)
            """
        # normalize to seconds
        if solves and hasattr(solves[0], "solve_time"):
            durations = [s.solve_time.total_seconds() if s.solve_time else 0 for s in solves]
        else:
            durations = solves

        # which indexes to parenthesize (trimmed) for WCA-style "average"
        if average_type == "average":
            from competitions.services.average_calculator import AverageCalculator
            non_counting = AverageCalculator.get_noncounting_indexes(durations)
        else:
            non_counting = set()

        out = []
        for i, secs in enumerate(durations):
            label = SolveService.format_solve_time(timedelta(seconds=secs))
            if i in non_counting:
                label = f"({label})"
            out.append(label)
        return out
