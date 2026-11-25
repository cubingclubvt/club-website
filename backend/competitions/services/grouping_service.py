from collections import Counter, defaultdict
from dataclasses import dataclass
from functools import lru_cache
from itertools import chain

from ..models import AUTOMATIC_SCRAMBLE_GENERATOR, CompetitionGroup, CompetitionScrambler, GroupAssignment, WaveEntry


Role = GroupAssignment.Role


class GroupingConflict(Exception):
    pass


@dataclass(frozen=True)
class Assignment:
    attendee_id: int
    round_id: int | None
    role: str
    station: int | None = None
    scramble_round_ids: tuple[int, ...] = ()


def match_scramble_rounds(rounds, eligible, people, previous, priority):
    assigned = {}

    def match(round_id, seen):
        candidates = sorted(eligible[round_id] & people, key=lambda person: (
            round_id not in previous.get(person, ()), priority(person),
        ))
        for person in candidates:
            if person not in seen:
                seen.add(person)
                if person not in assigned or match(assigned[person], seen):
                    assigned[person] = round_id
                    return True
        return False

    for round_id in rounds:
        match(round_id, set())
    return assigned


class Staffing:
    def __init__(self, wave):
        self.present = set(wave.competition.attendance.filter(is_present=True).values_list("pk", flat=True))
        self.events = dict(wave.allowed_rounds.values_list("pk", "event_id"))
        self.scramblers = defaultdict(set)
        for event_id, person in CompetitionScrambler.objects.filter(
            attendee_id__in=self.present,
        ).values_list("event_id", "attendee_id"):
            self.scramblers[event_id].add(person)
        self.entrants = defaultdict(set)
        self.approved_entries = set()
        for wave_id, round_id, event_id, person in WaveEntry.objects.filter(
            attendee_id__in=self.present, is_pending=False,
        ).values_list("wave_id", "competition_round_id", "competition_round__event_id", "attendee_id"):
            self.entrants[event_id].add(person)
            if wave_id == wave.pk:
                self.approved_entries.add((person, round_id))
        self.scrambler_count = wave.scramblers_per_group or 0
        self.judges_per_group = wave.judges_per_group

    def judge_count(self, solver_count):
        return solver_count if self.judges_per_group is None else self.judges_per_group

    def assign_scramblers(self, solvers, free, loads, existing, limit):
        rounds = sorted({solver.round_id for solver in solvers})
        if not self.scrambler_count:
            return []
        eligible = {
            round_id: self.scramblers[self.events[round_id]] & free for round_id in rounds
        }
        people = set().union(*eligible.values())
        if len(people) < self.scrambler_count or not all(eligible.values()):
            return None
        count = self.scrambler_count
        limit = max(count, min(limit, len(rounds), len(people)))
        rounds.sort(key=lambda round_id: (len(eligible[round_id]), round_id))
        previous = {assignment.attendee_id: assignment.scramble_round_ids for assignment in existing}
        approved = {person: {round_id for round_id in rounds if person in eligible[round_id]} for person in people}

        def priority(person):
            return (person not in previous, loads[person], person)

        # Give events dedicated scramblers when the group can staff them separately.
        dedicated = match_scramble_rounds(rounds, eligible, people, previous, priority)
        if len(dedicated) == len(rounds) and len(dedicated) <= count:
            selected = set(dedicated)
        else:
            @lru_cache(maxsize=None)
            def find_coverage(remaining, slots):
                if not remaining:
                    return ()
                if not slots:
                    return None
                first = next(round_id for round_id in rounds if round_id in remaining)
                for person in sorted(eligible[first], key=lambda item: (-len(approved[item] & remaining), priority(item))):
                    rest = find_coverage(remaining - approved[person], slots - 1)
                    if rest is not None:
                        return (person, *rest)
                return None

            remaining = frozenset(rounds)
            covering = find_coverage(remaining, count)
            while covering is None and count < limit:
                count += 1
                covering = find_coverage(remaining, count)
            if covering is None:
                return None
            selected = set(covering)

        additional = sorted(people - selected, key=priority)[:count - len(selected)]
        selected.update(additional)
        assigned = {person: [round_id] for person, round_id in
                    match_scramble_rounds(rounds, eligible, selected, previous, priority).items()}
        covered = Counter(round_id for round_ids in assigned.values() for round_id in round_ids)
        for round_id in rounds:
            if not covered[round_id]:
                person = min(eligible[round_id] & selected, key=lambda item: (
                    len(assigned.get(item, ())), round_id not in previous.get(item, ()), priority(item),
                ))
                assigned.setdefault(person, []).append(round_id)
                covered[round_id] += 1
        for person in sorted(selected - assigned.keys(), key=priority):
            round_id = min(approved[person], key=lambda item: (item not in previous.get(person, ()), covered[item], item))
            assigned[person] = [round_id]
            covered[round_id] += 1
        return [Assignment(person, None, Role.SCRAMBLER, scramble_round_ids=tuple(sorted(round_ids)))
                for person, round_ids in assigned.items()]

    def staff(self, solvers, judge_loads, scramble_loads, judges=(), scramblers=(), *, extra_scrambler_slots=0):
        free = self.present - {assignment.attendee_id for assignment in chain(solvers, judges)}
        if any(solver.attendee_id not in self.present or solver.round_id not in self.events for solver in solvers):
            return None
        if any(judge.attendee_id not in self.present for judge in judges):
            return None
        missing_judges = self.judge_count(len(solvers)) - len(judges)
        if missing_judges < 0 or len(free) < missing_judges + self.scrambler_count:
            return None
        limit = min(len(free) - missing_judges, self.scrambler_count + extra_scrambler_slots)
        scramblers = self.assign_scramblers(solvers, free, scramble_loads, scramblers, limit)
        if scramblers is None:
            return None
        free -= {assignment.attendee_id for assignment in scramblers}
        event_entrants = set().union(*(self.entrants[self.events[solver.round_id]] for solver in solvers))
        available = sorted(free, key=lambda person: (person not in event_entrants, judge_loads[person], person))
        judges = [*judges, *(Assignment(person, None, Role.JUDGE) for person in available[:missing_judges])]
        return [*solvers, *judges, *scramblers]


def group_assignments(group):
    return [
        Assignment(item.attendee_id, item.competition_round_id, item.role, item.station_number,
                   tuple(sorted(round_obj.pk for round_obj in item.scramble_rounds.all())) if item.role == Role.SCRAMBLER else ())
        for item in group.assignments.all()
    ]


def save_assignments(group, assignments):
    group.assignments.all().delete()
    saved = GroupAssignment.objects.bulk_create([
        GroupAssignment(group=group, attendee_id=item.attendee_id, competition_round_id=item.round_id,
                        role=item.role, station_number=item.station)
        for item in assignments
    ])
    coverage = GroupAssignment.scramble_rounds.through
    coverage.objects.bulk_create([
        coverage(groupassignment_id=row.pk, competitionround_id=round_id)
        for row, item in zip(saved, assignments) for round_id in item.scramble_round_ids
    ])


def remove_unused_generated_scrambles(group):
    rounds = group.assignments.filter(role=Role.SOLVER).values("competition_round_id")
    group.scramble_sets.filter(generator_name=AUTOMATIC_SCRAMBLE_GENERATOR).exclude(
        competition_round_id__in=rounds,
    ).delete()


def bump_schedule(wave):
    wave.schedule_version += 1
    wave.save(update_fields=["schedule_version"])


def generate_schedule(wave):
    from .grouping_optimizer import optimize_groups

    upcoming = list(wave.groups.filter(status=CompetitionGroup.Status.UPCOMING).prefetch_related(
        "scramble_sets", "assignments__scramble_rounds",
    ))
    locked = list(wave.groups.exclude(status=CompetitionGroup.Status.UPCOMING))
    historical = list(GroupAssignment.objects.filter(group__wave__competition=wave.competition)
                      .exclude(group__in=upcoming).exclude(role=Role.SOLVER).values_list("attendee_id", "role"))
    already_solved = set(GroupAssignment.objects.filter(group__in=locked, role=Role.SOLVER).values_list(
        "attendee_id", flat=True,
    ))
    staffing = Staffing(wave)
    entries = list(wave.entries.filter(
        is_pending=False, attendee_id__in=staffing.present,
    ).exclude(attendee_id__in=already_solved).select_related("competition_round__event").order_by(
        "competition_round_id", "pk",
    ))
    if not entries and not upcoming:
        raise GroupingConflict("There are no approved entries to schedule.")
    if any(entry.competition_round_id not in staffing.events for entry in entries):
        raise GroupingConflict("An entry has a round that is no longer offered in this wave.")
    required = {}
    for index, group in enumerate(upcoming):
        manual_rounds = {item.competition_round_id for item in group.scramble_sets.all()
                         if item.generator_name != AUTOMATIC_SCRAMBLE_GENERATOR}
        if manual_rounds:
            required[index] = manual_rounds
    incumbent = [group_assignments(group) for group in upcoming]
    expected = Counter((entry.attendee_id, entry.competition_round_id) for entry in entries)
    assigned = Counter((item.attendee_id, item.round_id) for group in incumbent for item in group if item.role == Role.SOLVER)
    if assigned != expected or any(group_problem(wave, group, staffing) for group in incumbent):
        incumbent = []
    plan, report = optimize_groups(wave, entries, staffing, required, historical, incumbent, allow_settings_change=not locked)
    last_number = max((group.number for group in [*locked, *upcoming]), default=0)
    for index, assignments in enumerate(plan):
        if index < len(upcoming):
            group = upcoming[index]
        else:
            last_number += 1
            group = wave.groups.create(number=last_number)
        save_assignments(group, assignments)
        remove_unused_generated_scrambles(group)
    for obsolete in upcoming[len(plan):]:
        obsolete.scramble_sets.filter(generator_name=AUTOMATIC_SCRAMBLE_GENERATOR).delete()
        obsolete.delete()
    bump_schedule(wave)
    return {**report, "version": wave.schedule_version}


def late_assignments(wave, entry, group, staffing, selected_judge=None):
    if entry.attendee_id not in staffing.present or entry.competition_round_id not in staffing.events:
        return None
    existing = group_assignments(group) if group is not None else []
    solvers = [item for item in existing if item.role == Role.SOLVER]
    judges = [item for item in existing if item.role == Role.JUDGE]
    scramblers = [item for item in existing if item.role == Role.SCRAMBLER]
    if entry.attendee_id in {item.attendee_id for item in existing}:
        return None
    if existing and group_problem(wave, existing, staffing) is not None:
        return None
    occupied = {solver.station for solver in solvers}
    station = next((number for number in range(1, (wave.station_count or 0) + 1) if number not in occupied), None)
    if station is None:
        return None
    if selected_judge is not None:
        if selected_judge not in staffing.present or selected_judge == entry.attendee_id:
            return None
        if selected_judge in {item.attendee_id for item in existing}:
            return None
        if len(judges) >= staffing.judge_count(len(solvers) + 1):
            return None
        judges.append(Assignment(selected_judge, None, Role.JUDGE))
    solvers.append(Assignment(entry.attendee_id, entry.competition_round_id, Role.SOLVER, station))
    return staffing.staff(solvers, Counter(), Counter(), judges, scramblers,
                          extra_scrambler_slots=max(0, len(scramblers) - staffing.scrambler_count))


def group_problem(wave, assignments, staffing):
    if any(item.attendee_id not in staffing.present for item in assignments):
        return "An assigned person is away. Regenerate upcoming groups or update the assignment."
    solvers = [item for item in assignments if item.role == Role.SOLVER]
    judges = [item for item in assignments if item.role == Role.JUDGE]
    scramblers = [item for item in assignments if item.role == Role.SCRAMBLER]
    if not solvers:
        return "This group has no solvers."
    if any((item.attendee_id, item.round_id) not in staffing.approved_entries for item in solvers):
        return "A solver is missing an approved entry for their assigned round."
    if any(item.station is None or item.station > (wave.station_count or 0) for item in solvers):
        return "A solver is missing a valid station. Regenerate upcoming groups."
    if len(judges) != staffing.judge_count(len(solvers)):
        return "This group needs the configured number of judges. Regenerate upcoming groups."
    rounds = {item.round_id for item in solvers}
    covered = {round_id for item in scramblers for round_id in item.scramble_round_ids}
    if not (rounds | covered) <= staffing.events.keys():
        return "An assigned round is no longer offered in this wave."
    max_scramblers = max(staffing.scrambler_count, len(rounds)) if staffing.scrambler_count else 0
    if not staffing.scrambler_count <= len(scramblers) <= max_scramblers:
        return "This group needs the configured scrambler staffing. Regenerate upcoming groups."
    if scramblers and (rounds != covered or any(not item.scramble_round_ids for item in scramblers)):
        return "Each event in this group needs trusted scramble coverage."
    if any(item.attendee_id not in staffing.scramblers[staffing.events[round_id]]
           for item in scramblers for round_id in item.scramble_round_ids):
        return "A scrambler is missing approval for their assigned event."
    return None
