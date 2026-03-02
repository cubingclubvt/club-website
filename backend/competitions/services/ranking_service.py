from types import NoneType
from django.db import models
from django.db.models import Min
from competitions.models import Solve, CompetitionRound, Competitor
from competitions.services.solve_service import SolveService
from competitions.services.average_calculator import AverageCalculator

from collections import defaultdict
from datetime import timedelta
import time


class RankingService:

    @staticmethod
    def _to_seconds(val):
        """Normalize different time representations to float seconds.

        Accepts:
        - datetime.timedelta -> seconds
        - int/float -> seconds
        - formatted string like 'mm:ss.xx' or 'ss.xx' -> seconds
        - 'DNF' or None -> float('inf')
        """
        if val is None:
            return float('inf')

        if isinstance(val, timedelta):
            return val.total_seconds()

        if isinstance(val, (int, float)):
            # assume already in seconds
            return float(val)

        if isinstance(val, str):
            v = val.strip()
            if v.upper() == "DNF":
                return float('inf')
            # possible formats: mm:ss.xx or ss.xx
            try:
                if ":" in v:
                    minutes, seconds = v.split(":")
                    return int(minutes) * 60 + float(seconds)
                return float(v)
            except Exception:
                return float('inf')

        # unknown type -> treat as DNF
        return float('inf')

    @staticmethod
    def sort_solves(solves, primary_key, secondary_key):
        """Stable sort of a list of dicts using normalized numeric values.

        primary_key and secondary_key refer to keys inside each dict whose values
        may be strings, timedeltas, or numeric; this function will normalize to
        seconds and sort by numeric order treating DNF as +inf.
        """
        return sorted(
            solves,
            key=lambda x: (
                RankingService._to_seconds(x.get(primary_key)),
                RankingService._to_seconds(x.get(secondary_key)),
            ),
        )

    @staticmethod
    def get_all_single_rankings(event, current_only=False):
        """Return a list of competitors and their best single for the event.

        Each entry contains both a human-readable `result` and a numeric
        `raw_result` in seconds so later consumers can sort reliably.

        If current_only=True, competitors with grade=-1 are excluded.
        """
        qs = (
            Solve.objects
            .filter(competition_round__event=event, solve_time__isnull=False)
            .exclude(solve_time=timedelta(0))
            .select_related('competitor', 'competition_round__competition')
            .values(
                'competitor__id',
                'competitor__first_name',
                'competitor__last_name',
                'competitor__school_id',
                'competition_round__competition__name',
            )
            .annotate(best_single=Min('solve_time'))
        )

        if current_only:
            qs = qs.exclude(competitor__grade=-1)

        # Convert annotated timedelta to seconds for sorting
        sorted_bests = sorted(
            qs,
            key=lambda x: RankingService._to_seconds(x['best_single'])
        )

        result = []
        for i, entry in enumerate(sorted_bests):
            full_name = f"{entry['competitor__first_name']} {entry['competitor__last_name']}"
            raw_seconds = RankingService._to_seconds(entry['best_single'])
            result.append({
                'competitor_id': entry['competitor__id'],
                'competitor_name': full_name,
                'school_id': entry['competitor__school_id'],
                'rank': i + 1,
                'competition_name': entry['competition_round__competition__name'],
                'raw_result': raw_seconds,
                'result': SolveService.format_solve_time(timedelta(seconds=raw_seconds)) if raw_seconds != float('inf') else 'DNF',
            })

        return result

    @staticmethod
    def get_all_average_rankings(event, current_only=False):
        """Return a list of competitors and their best average for the event.

        If current_only=True, competitors with grade=-1 are excluded.
        """
        start_time = time.time()

        qs = (
            Solve.objects
            .filter(competition_round__event=event)
            .select_related("competitor", "competition_round__competition", "competition_round__event")
            .order_by("competition_round_id", "competitor_id", "solve_number")
        )

        if current_only:
            qs = qs.exclude(competitor__grade=-1)

        # Group solves by competitor → round
        competitor_rounds = defaultdict(lambda: defaultdict(list))
        for s in qs:
            competitor_rounds[s.competitor][s.competition_round_id].append(s)

        competitor_stats = []
        for competitor, rounds in competitor_rounds.items():
            averages = []  # list of (avg_seconds, comp_round)
            singles = []   # list of single seconds

            for round_id, round_solves in rounds.items():
                comp_round = round_solves[0].competition_round

                avg = AverageCalculator.calculate_solves_average(round_solves, comp_round.event.average_type)
                avg_seconds = RankingService._to_seconds(avg)
                if avg_seconds != float('inf'):
                    averages.append((avg_seconds, comp_round))

                single = SolveService.get_round_single_from_solves(round_solves)
                single_seconds = RankingService._to_seconds(single)
                if single_seconds != float('inf'):
                    singles.append(single_seconds)

            if averages:
                # Pick best average (lowest seconds)
                best_avg, best_avg_round = min(averages, key=lambda x: x[0])
                best_single = min(singles) if singles else float('inf')

                competitor_stats.append({
                    "competitor_id": competitor.id,
                    "competitor_name": f"{competitor.first_name} {competitor.last_name}",
                    "school_id": competitor.school_id,
                    "best_average": best_avg,   # numeric seconds
                    "best_single": best_single, # numeric seconds
                    "competition_name": best_avg_round.competition.name,
                })

        # Sort by numeric best_average with best_single as tiebreaker
        sorted_stats = sorted(
            competitor_stats,
            key=lambda x: (x['best_average'], x['best_single'])
        )

        # Assign ranks and format result
        result = []
        for i, entry in enumerate(sorted_stats):
            result.append({
                "competitor_id": entry["competitor_id"],
                "competitor_name": entry["competitor_name"],
                "school_id": entry["school_id"],
                "rank": i + 1,
                "competition_name": entry["competition_name"],
                "raw_result": entry["best_average"],
                "result": SolveService.format_solve_time(timedelta(seconds=entry["best_average"])) if entry["best_average"] != float('inf') else 'DNF',
            })

        end_time = time.time()
        print(f"Average calc took: {end_time - start_time} seconds")
        return result

    @staticmethod
    def get_distinct_single_rankings(event, current_only=False):
        """Return one entry per competitor with their best single, ranked.

        If current_only=True, competitors with grade=-1 are excluded.
        """
        all_rankings = RankingService.get_all_single_rankings(event, current_only=current_only)

        best_by_competitor = {}
        for entry in all_rankings:
            cid = entry['competitor_id']
            if cid not in best_by_competitor or entry['raw_result'] < best_by_competitor[cid]['raw_result']:
                best_by_competitor[cid] = entry

        distinct_rankings = list(best_by_competitor.values())
        distinct_rankings.sort(key=lambda x: x['raw_result'])

        for i, entry in enumerate(distinct_rankings):
            entry['rank'] = i + 1

        return distinct_rankings

    @staticmethod
    def get_competitor_best_single(competitor, event):
        solve_obj = (Solve.objects
                      .filter(
                          competitor=competitor,
                          competition_round__event=event,
                          solve_time__isnull=False
                          )
                      .order_by('solve_time')
                      .exclude(solve_time=timedelta(0))
                      .first()
                      )
        if solve_obj is not None:
            solve_time = solve_obj.solve_time
            return SolveService.format_solve_time(solve_time)
        else:
            return "DNF"

    @staticmethod
    def get_competitor_best_average(competitor, event):
        all_average_rankings = RankingService.get_all_average_rankings(event)
        for entry in all_average_rankings:
            if entry['competitor_id'] == competitor.id:
                return entry['result']
        return None

    @staticmethod
    def get_competitor_single_ranking(competitor, event, current_only=False):
        """Return the competitor's single ranking.

        If current_only=True and the competitor has grade=-1, returns None (N/A).
        Otherwise ranks them against all competitors with grade != -1.
        """
        if current_only and competitor.grade == -1:
            return None

        distinct_rankings = RankingService.get_distinct_single_rankings(event, current_only=current_only)
        for entry in distinct_rankings:
            if entry.get('competitor_id') == competitor.id:
                return entry['rank']
        return None

    @staticmethod
    def get_competitor_average_ranking(competitor, event, current_only=False):
        """Return the competitor's average ranking.

        If current_only=True and the competitor has grade=-1, returns None (N/A).
        Otherwise ranks them against all competitors with grade != -1.
        """
        if current_only and competitor.grade == -1:
            return None

        all_average_rankings = RankingService.get_all_average_rankings(event, current_only=current_only)
        for entry in all_average_rankings:
            if entry['competitor_id'] == competitor.id:
                return entry['rank']
        return None
