from collections import Counter, defaultdict
from dataclasses import dataclass
from itertools import combinations
from math import ceil
from time import monotonic

from ortools.sat.python import cp_model

from .grouping_service import Assignment, GroupingConflict, Role


FEASIBLE = (cp_model.OPTIMAL, cp_model.FEASIBLE)


def solve(model, seconds):
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = seconds
    solver.parameters.num_search_workers = 2
    return solver, solver.solve(model)


@dataclass
class GroupModel:
    model: cp_model.CpModel
    used: list
    sizes: list
    at_station: list
    judging: list
    scrambling: list
    covers: list
    event_flags: list


def build_group_model(entries_by_round, judge_pool, people_by_round, judges_per_group, target, capacity, group_slots, required_rounds):
    model = cp_model.CpModel()
    solvers = [person for entrants in entries_by_round.values() for person in entrants]
    rounds = list(entries_by_round)
    pinned_count = max(required_rounds, default=-1) + 1
    used = [model.new_bool_var(f"used_{slot}") for slot in group_slots]
    sizes, at_station, judging, scrambling, covers, event_flags = [], [], [], [], [], []
    automatic_judges = judges_per_group is None
    scramble_options = defaultdict(list)
    if target:
        for round_id, people in people_by_round.items():
            for person in people:
                scramble_options[person].append(round_id)

    participants = sorted(set(solvers) | set(judge_pool) | scramble_options.keys())
    for slot in group_slots:
        seated = {person: model.new_bool_var(f"solve_{slot}_{person}") for person in solvers}
        judges = {person: model.new_bool_var(f"judge_{slot}_{person}") for person in judge_pool}
        scramblers = {person: model.new_bool_var(f"scramble_{slot}_{person}") for person in sorted(scramble_options)}
        size = model.new_int_var(0, capacity, f"size_{slot}")
        model.add(size == sum(seated.values()))
        model.add(size >= used[slot])
        model.add(size <= capacity * used[slot])
        if slot:
            model.add(used[slot - 1] >= used[slot])
            # Groups without linked sets can exchange positions beyond the pinned prefix.
            if slot > pinned_count:
                model.add(sizes[slot - 1] >= size)
        model.add(sum(judges.values()) == (size if automatic_judges else judges_per_group * used[slot]))

        active_events = {}
        for round_id, entrants in entries_by_round.items():
            active = model.new_bool_var(f"round_{slot}_{round_id}")
            count = sum(seated[person] for person in entrants)
            model.add(count >= active)
            model.add(count <= min(capacity, len(entrants)) * active)
            if round_id in required_rounds.get(slot, ()):
                model.add(active == 1)
            active_events[round_id] = active

        coverage = {}
        if scramblers:
            for round_id, people in people_by_round.items():
                for person in people:
                    variable = model.new_bool_var(f"cover_{slot}_{round_id}_{person}")
                    model.add(variable <= scramblers[person])
                    model.add(variable <= active_events[round_id])
                    coverage[person, round_id] = variable
                model.add(sum(coverage[person, round_id] for person in people) >= active_events[round_id])
            for person, options in scramble_options.items():
                model.add(sum(coverage[person, round_id] for round_id in options) >= scramblers[person])
            target_for_slot = target * used[slot]
            limit = model.new_int_var(0, max(target, len(rounds)), f"scrambler_limit_{slot}")
            model.add_max_equality(limit, [target_for_slot, sum(active_events.values())])
            model.add(sum(scramblers.values()) >= target_for_slot)
            model.add(sum(scramblers.values()) <= limit)

        for person in participants:
            roles = [role[person] for role in (seated, judges, scramblers) if person in role]
            if len(roles) > 1:
                model.add_at_most_one(roles)
        sizes.append(size)
        at_station.append(seated)
        judging.append(judges)
        scrambling.append(scramblers)
        covers.append(coverage)
        event_flags.append(active_events)

    for person in solvers:
        model.add_exactly_one(group[person] for group in at_station)
    return GroupModel(model, used, sizes, at_station, judging, scrambling, covers, event_flags)


def optimize_groups(wave, entries, staffing, required_rounds, historical, incumbent, *, allow_settings_change):
    if not entries:
        if required_rounds:
            raise GroupingConflict("Detach scramble sets from empty upcoming groups before regenerating.")
        return [], generation_report(wave, staffing, 0, 0, 0, 0, 0, 0)
    if not wave.station_count:
        raise GroupingConflict("Set the number of stations before generating groups.")

    target = staffing.scrambler_count
    present = sorted(staffing.present)
    available = len(present) - target
    automatic_judges = staffing.judges_per_group is None
    staff_capacity = available // 2 if automatic_judges else available - staffing.judges_per_group
    capacity = min(wave.station_count, staff_capacity)
    if capacity < 1:
        raise GroupingConflict("There are not enough checked-in people to staff a group. Check attendance or reduce the judge or scrambler count.")
    entries_by_round = defaultdict(list)
    for entry in entries:
        entries_by_round[entry.competition_round_id].append(entry.attendee_id)
    rounds = sorted(entries_by_round)
    people_by_round = {round_id: sorted(staffing.scramblers[staffing.events[round_id]]) for round_id in rounds}
    if target:
        missing = [entry.competition_round.event.name for entry in entries if not people_by_round[entry.competition_round_id]]
        if missing:
            raise GroupingConflict("Choose a checked-in scrambler for " + ", ".join(sorted(set(missing))) + ".")

    pinned_count = max(required_rounds, default=-1) + 1
    roster_lower_bound = ceil(len(entries) / capacity)
    lower_bound = max(roster_lower_bound, pinned_count)
    upper_bound = len(incumbent) if incumbent else len(entries)
    if lower_bound > upper_bound or any(set(pinned) - entries_by_round.keys() for pinned in required_rounds.values()):
        raise GroupingConflict("Linked scramble sets require upcoming groups for events without eligible solvers.")

    group_slots = range(upper_bound)
    judge_pool = present if automatic_judges or staffing.judges_per_group else []
    grouped = build_group_model(entries_by_round, judge_pool, people_by_round, staffing.judges_per_group,
                                target, capacity, group_slots, required_rounds)
    model, used, sizes = grouped.model, grouped.used, grouped.sizes
    at_station, judging, scrambling, covers = grouped.at_station, grouped.judging, grouped.scrambling, grouped.covers
    group_count = sum(used)
    model.add(group_count >= lower_bound)
    scrambler_total = sum(variable for group in scrambling for variable in group.values())
    # There can be at most one extra slot per solving entry across the entire wave.
    # The weight guarantees that dropping a group outranks any change in headcount.
    group_weight = len(entries) + 1
    model.minimize(group_count * group_weight + scrambler_total - target * group_count)

    def add_hint(plan):
        model.clear_hints()
        for slot in group_slots:
            members = {(item.role, item.attendee_id): item for item in plan[slot]} if slot < len(plan) else {}
            model.add_hint(used[slot], slot < len(plan))
            for role, variables in ((Role.SOLVER, at_station[slot]), (Role.JUDGE, judging[slot]), (Role.SCRAMBLER, scrambling[slot])):
                for person, variable in variables.items():
                    model.add_hint(variable, (role, person) in members)
            for (person, round_id), variable in covers[slot].items():
                assignment = members.get((Role.SCRAMBLER, person))
                model.add_hint(variable, assignment is not None and round_id in assignment.scramble_round_ids)

    def extract(solver, count):
        result = []
        for slot in range(count):
            seated = [person for person, variable in at_station[slot].items() if solver.value(variable)]
            group = [Assignment(person, staffing_round[person], Role.SOLVER, station)
                     for station, person in enumerate(seated, start=1)]
            group += [Assignment(person, None, Role.JUDGE) for person, variable in judging[slot].items() if solver.value(variable)]
            group += [
                Assignment(person, None, Role.SCRAMBLER, scramble_round_ids=tuple(
                    round_id for round_id in rounds
                    if (person, round_id) in covers[slot] and solver.value(covers[slot][person, round_id])
                ))
                for person, variable in scrambling[slot].items() if solver.value(variable)
            ]
            result.append(group)
        return result

    staffing_round = {entry.attendee_id: entry.competition_round_id for entry in entries}
    if incumbent:
        add_hint(incumbent)
    solver, status = solve(model, 4)
    if status == cp_model.INFEASIBLE:
        detail = "No schedule meets the station limits, judge count, and trusted scrambler approvals."
        if required_rounds:
            detail += " Manually linked scramble sets also restrict which events can move."
        raise GroupingConflict(detail)
    if status == cp_model.MODEL_INVALID:
        raise RuntimeError(model.validate())
    if status in FEASIBLE:
        plan = extract(solver, int(solver.value(group_count)))
        if status == cp_model.OPTIMAL:
            lower_bound = len(plan)
        else:
            objective_bound = ceil(solver.best_objective_bound - 1e-6)
            lower_bound = max(lower_bound, objective_bound // group_weight)
    elif incumbent:
        plan = incumbent
    else:
        raise GroupingConflict("The search timed out before finding a valid schedule. The existing groups were kept.")

    # With the number of groups fixed, keep staffing near the target and spread work.
    count = len(plan)
    model.add(group_count == count)
    model.add(scrambler_total <= sum(item.role == Role.SCRAMBLER for group in plan for item in group))
    fairness, fairness_bound = staffing_penalties(model, present, judging[:count], scrambling[:count], historical)
    mismatch = []
    for slot in range(count):
        for person, judge in judging[slot].items():
            events = [flag for round_id, flag in grouped.event_flags[slot].items()
                      if person in staffing.entrants[staffing.events[round_id]]]
            penalty = model.new_bool_var(f"judge_other_event_{slot}_{person}")
            model.add(penalty >= judge - sum(events))
            mismatch.append(penalty)
    largest = model.new_int_var(1, capacity, "largest_group")
    smallest = model.new_int_var(1, capacity, "smallest_group")
    model.add_max_equality(largest, sizes[:count])
    model.add_min_equality(smallest, sizes[:count])
    # At equal staffing and workload, prefer even group sizes and judges who know the events.
    coverage_count = sum(variable for group in covers[:count] for variable in group.values())
    tie_bound = len(mismatch) + count * max(target, len(rounds)) * len(rounds)
    balance_weight = tie_bound + 1
    fairness_weight = balance_weight * (capacity + 1)
    scrambler_weight = fairness_weight * (fairness_bound + 1)
    model.minimize((scrambler_total - target * count) * scrambler_weight + sum(fairness) * fairness_weight
                   + (largest - smallest) * balance_weight + sum(mismatch) + coverage_count)
    add_hint(plan)
    refined, status = solve(model, 2)
    if status in FEASIBLE:
        plan = extract(refined, count)
    extras = sum(item.role == Role.SCRAMBLER for group in plan for item in group) - target * count
    report = generation_report(wave, staffing, count, lower_bound, len(entries), staff_capacity, pinned_count, extras)
    if count > 1 and report["minimum_proven"]:
        event_names = {entry.competition_round_id: entry.competition_round.event.name for entry in entries}
        report.update(suggest_smaller_schedule(
            wave.station_count, staffing, entries_by_round, judge_pool, people_by_round, event_names, required_rounds, count,
            allow_settings_change=allow_settings_change,
        ))
    return plan, report


def suggest_smaller_schedule(stations, staffing, entries_by_round, judge_pool, people_by_round, event_names, required_rounds,
                             count, *, allow_settings_change):
    slots = count - 1
    if max(required_rounds, default=-1) >= slots:
        return {"suggestion": "Fewer groups would require changing the linked scramble sets."}

    present = len(staffing.present)
    target = staffing.scrambler_count
    judges_per_group = staffing.judges_per_group
    entry_count = sum(map(len, entries_by_round.values()))
    needed_size = ceil(entry_count / slots)
    people_needed = needed_size + staffing.judge_count(needed_size) + target
    helper_id = max(staffing.present) + 1
    deadline = monotonic() + 2

    def changes():
        extra_station_size = stations + 1
        if allow_settings_change and stations < entry_count and needed_size <= extra_station_size:
            if extra_station_size + staffing.judge_count(extra_station_size) + target <= present:
                yield "Add one station", extra_station_size, judge_pool, people_by_round
        if needed_size <= stations and people_needed <= present + 1:
            if judge_pool:
                yield "Add one judge", stations, [*judge_pool, helper_id], people_by_round
            if target:
                rounds = sorted(entries_by_round, key=lambda key: (len(people_by_round[key]), event_names[key]))
                for round_id in rounds:
                    yield scrambler_change((round_id,))
                for coverage in combinations(rounds, 2):
                    yield scrambler_change(coverage)

    def scrambler_change(coverage):
        approvals = {**people_by_round, **{
            round_id: [*people_by_round[round_id], helper_id] for round_id in coverage
        }}
        names = " and ".join(event_names[round_id] for round_id in coverage)
        return f"Add one scrambler approved for {names}", stations, judge_pool, approvals

    def try_change(capacity, judges, approvals, judge_count, limit):
        if monotonic() >= limit:
            return None, cp_model.UNKNOWN
        grouped = build_group_model(entries_by_round, judges, approvals, judge_count, target, capacity,
                                    range(slots), required_rounds)
        remaining = limit - monotonic()
        if remaining <= 0:
            return None, cp_model.UNKNOWN
        group_count = sum(grouped.used)
        grouped.model.minimize(group_count)
        solver, status = solve(grouped.model, min(0.4, remaining))
        return (solver.value(group_count), status) if status in FEASIBLE else (None, status)

    suggestions = {}
    uncertain = False
    if allow_settings_change and judge_pool and needed_size <= stations:
        judge_deadline = min(deadline, monotonic() + 0.8)
        highest_smaller_count = min(staffing.judge_count(needed_size) - 1, present - needed_size - target)
        for fixed_judges in range(highest_smaller_count, 0, -1):
            if monotonic() >= judge_deadline:
                uncertain = True
                break
            fewer, status = try_change(stations, judge_pool, people_by_round, fixed_judges, judge_deadline)
            if fewer is not None:
                judge_label = "judge" if fixed_judges == 1 else "judges"
                group_label = "group" if fewer == 1 else "groups"
                suggestions["judge_suggestion"] = (
                    f"Use {fixed_judges} {judge_label} per group to run {fewer} {group_label} instead of {count}. "
                    "With fewer judges, solvers may wait longer between attempts."
                )
                break
            uncertain |= status != cp_model.INFEASIBLE

    for label, capacity, judges, approvals in changes():
        if monotonic() >= deadline:
            uncertain = True
            break
        fewer, status = try_change(capacity, judges, approvals, judges_per_group, deadline)
        if fewer is not None:
            suggestions["suggestion"] = f"{label} to run {fewer} {'group' if fewer == 1 else 'groups'} instead of {count}."
            return suggestions
        uncertain |= status != cp_model.INFEASIBLE

    if suggestions:
        return suggestions
    if uncertain:
        return {"suggestion": "The check didn't verify a change that would reduce the group count."}
    return {"suggestion": "The changes checked would still leave the same group count."}


def staffing_penalties(model, people, judging, scrambling, history):
    history_by_role = Counter(history)
    penalties = []
    for person in people:
        judge_duties = [group[person] for group in judging if person in group]
        scramble_duties = [group[person] for group in scrambling if person in group]
        past_judging = history_by_role[person, Role.JUDGE]
        past_scrambling = history_by_role[person, Role.SCRAMBLER]
        workloads = [
            (judge_duties, past_judging),
            (scramble_duties, past_scrambling),
            (judge_duties + scramble_duties, past_judging + past_scrambling),
        ]
        for role_index, (duties, previous) in enumerate(workloads):
            if not duties:
                continue
            maximum = min(len(judging), len(duties))
            cost_by_count = [jobs * (2 * previous + jobs) for jobs in range(maximum + 1)]
            count = model.new_int_var(0, maximum, f"load_{person}_{role_index}")
            cost = model.new_int_var(0, cost_by_count[-1], f"load_cost_{person}_{role_index}")
            model.add(count == sum(duties))
            model.add_element(count, cost_by_count, cost)
            penalties.append((cost, cost_by_count[-1]))
    return [cost for cost, _ in penalties], sum(maximum for _, maximum in penalties)


def generation_report(wave, staffing, count, lower_bound, entry_count, staff_capacity, pinned_count, extras):
    if count <= 1:
        bottleneck = "No bottleneck"
        detail = "All eligible solvers fit in one group." if count else "There are no available solvers left to schedule."
    elif count > lower_bound:
        bottleneck = "Search limit"
        detail = "The search ended before ruling out fewer groups."
    else:
        labels = []
        details = []
        size = ceil(entry_count / (count - 1))
        if size > wave.station_count:
            labels.append("Stations")
            details.append(f"Fewer groups would need {size} stations, and there are {wave.station_count}.")
        if size > staff_capacity:
            judges = staffing.judge_count(size)
            scramblers = staffing.scrambler_count
            present = len(staffing.present)
            free = present - size
            if not scramblers or judges > free >= scramblers:
                labels.append("Judges")
            elif not judges or scramblers > free >= judges:
                labels.append("Scramblers")
            else:
                labels.append("Judges and scramblers")
            duties = []
            if judges:
                duties.append(f"{judges} judge" + ("s" if judges != 1 else ""))
            if scramblers:
                duties.append(f"{scramblers} scrambler" + ("s" if scramblers != 1 else ""))
            details.append(f"{size} solvers plus {' and '.join(duties)} need {size + judges + scramblers} people. "
                           f"{present} are present.")
        if count == pinned_count:
            labels.append("Linked scramble sets")
            details.append("Manually linked scramble sets reserve these group slots.")
        if not labels:
            if pinned_count:
                labels.append("Linked scramble sets")
                if staffing.scrambler_count:
                    labels.append("Scrambler coverage")
                    details.append("Linked sets and approved scrambler coverage limit which events can run together.")
                else:
                    details.append("Linked scramble sets limit which events can run together.")
            else:
                labels.append("Scrambler coverage")
                details.append("The available approved scramblers cannot cover all events in fewer groups.")
        bottleneck = " · ".join(labels)
        detail = " ".join(details)
    return {"wave_id": wave.pk, "group_count": count, "lower_bound": lower_bound, "minimum_proven": count == lower_bound,
            "bottleneck": bottleneck, "detail": detail, "extra_scrambler_assignments": extras}
