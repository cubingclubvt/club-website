from base64 import b64decode
from datetime import timedelta
from urllib.parse import unquote, urlsplit
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from ortools.sat.python import cp_model
from rest_framework.test import APIClient

from .models import Competition, Event, GroupAssignment, RoundType, WaveEntry


class GroupingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        organizer = get_user_model().objects.create_user(username="organizer")
        now = timezone.now()
        cls.competition = Competition.objects.create(
            name="Club Open", location="Club room", start_time=now, end_time=now + timedelta(hours=1), official=False,
        )
        kind = RoundType.objects.create(name="First")
        cls.first_event = Event.objects.create(name="3x3", average_type="average", ranking_format="average")
        cls.second_event = Event.objects.create(name="2x2", average_type="average", ranking_format="average")
        cls.round = cls.competition.rounds.create(event=cls.first_event, round_type=kind, number=1)
        cls.other_round = cls.competition.rounds.create(event=cls.second_event, round_type=kind, number=1)
        cls.organizer = organizer

    def setUp(self):
        self.admin = APIClient()
        self.admin.force_authenticate(user=self.organizer)
        self.guest = APIClient()
        self.path = reverse("admin_grouping", args=[self.competition.pk])

    def command(self, action, **data):
        return self.admin.post(self.path, {"action": action, **data}, format="json")

    def wave(self, *, number=1, stations=2, scramblers=1, judges=None, rounds=None):
        response = self.command(
            "save_wave", number=number, name="", station_count=stations, scramblers_per_group=scramblers,
            round_ids=rounds or [self.round.pk], judges_per_group=judges,
        )
        self.assertEqual(response.status_code, 200, response.json())
        return next(wave for wave in response.json()["waves"] if wave["number"] == number)

    def attendee(self, name, wave=None, round_id=None):
        entries = [{"wave_id": wave["id"], "round_id": round_id or self.round.pk}] if wave else []
        result = self.command("add_attendee", name=name, entries=entries)
        self.assertEqual(result.status_code, 200, result.json())
        return next(person for person in result.json()["attendees"] if person["display_name"] == name)

    def approved_scrambler(self, name, *events):
        person = self.attendee(name)
        result = self.command("scrambler_approvals", attendee_id=person["id"], event_ids=[event.pk for event in events])
        self.assertEqual(result.status_code, 200, result.json())
        return person

    def generated(self, wave):
        result = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(result.status_code, 200, result.json())
        return next(item for item in result.json()["waves"] if item["id"] == wave["id"])

    def test_signed_qr_public_form_and_duplicate_name_check_ins(self):
        self.assertIn(self.guest.get(self.path).status_code, (401, 403))
        wave = self.wave(scramblers=0)
        qr = self.admin.post(reverse("check_in_qr", args=[self.competition.pk]), {"origin": "https://club.example"}, format="json")
        self.assertEqual(qr.status_code, 200, qr.json())
        self.assertTrue(b64decode(qr.json()["png"]).startswith(b"\x89PNG\r\n\x1a\n"))
        path_segment = urlsplit(qr.json()["url"]).path.rsplit("/", 1)[-1]
        token = unquote(path_segment)
        self.assertEqual(path_segment, token)
        path = reverse("competition_check_in", args=[token])
        self.assertEqual(self.guest.get(path + "X").status_code, 404)
        offer = self.guest.get(path)
        self.assertEqual(offer.status_code, 200, offer.json())
        self.assertIn("no-store", offer.headers["Cache-Control"])
        self.assertEqual(offer.json()["waves"][0]["rounds"][0]["id"], self.round.pk)
        self.assertNotIn("attendees", offer.json())
        payload = {
            "name": "Same Name", "check_in_key": str(uuid4()),
            "entries": [{"wave_id": wave["id"], "round_id": self.round.pk}],
        }
        invalid_choice = self.guest.post(path, {
            **payload, "entries": [{"wave_id": wave["id"], "round_id": self.other_round.pk}],
        }, format="json")
        self.assertEqual(invalid_choice.status_code, 400)
        for _ in range(2):
            response = self.guest.post(path, payload, format="json")
            self.assertEqual(response.status_code, 201, response.json())
            self.assertEqual(response.json()["pending_waves"], [])
        self.assertEqual(self.competition.attendance.count(), 1)
        self.assertEqual(self.guest.post(path, {**payload, "check_in_key": str(uuid4())}, format="json").status_code, 201)
        self.assertEqual(self.competition.attendance.filter(display_name="Same Name").count(), 2)
        self.assertEqual(self.command("check_in_status", closed=True).status_code, 200)
        self.assertTrue(self.guest.get(path).json()["closed"])
        self.assertEqual(self.guest.post(path, {**payload, "check_in_key": str(uuid4())}, format="json").status_code, 409)

    def test_mixed_group_staffing_respects_stations_and_event_approval(self):
        wave = self.wave(stations=2, scramblers=2, rounds=[self.round.pk, self.other_round.pk])
        self.attendee("Three solver", wave)
        self.attendee("Two solver", wave, self.other_round.pk)
        self.attendee("Judge A")
        self.attendee("Judge B")
        dual = self.approved_scrambler("Both events", self.first_event, self.second_event)
        limited = self.approved_scrambler("Three-only", self.first_event)
        wave = self.generated(wave)
        group, = wave["groups"]
        roles = group["assignments"]
        solver_seats = {(row["round_id"], row["station"]) for row in roles if row["role"] == "solver"}
        judges = [row for row in roles if row["role"] == "judge"]
        self.assertEqual(len(judges), len(solver_seats))
        self.assertTrue(all(row["round_id"] is None and row["station"] is None for row in judges))
        self.assertEqual({station for _, station in solver_seats}, {1, 2})
        self.assertEqual(len({row["attendee_id"] for row in roles}), 6)
        self.assertEqual(
            {round_id: row["attendee_id"] for row in roles if row["role"] == "scrambler" for round_id in row["round_ids"]},
            {self.round.pk: limited["id"], self.other_round.pk: dual["id"]},
        )
        self.assertIsNone(group["problem"])

    def test_one_scrambler_can_cover_two_events_in_the_same_group(self):
        wave = self.wave(stations=2, scramblers=1, judges=1, rounds=[self.round.pk, self.other_round.pk])
        self.attendee("Three solver", wave)
        self.attendee("Two solver", wave, self.other_round.pk)
        self.attendee("Judge")
        self.approved_scrambler("Three only", self.first_event)
        shared = self.approved_scrambler("Both events", self.first_event, self.second_event)

        wave = self.generated(wave)
        group, = wave["groups"]
        scrambler, = [row for row in group["assignments"] if row["role"] == "scrambler"]
        self.assertEqual(scrambler["attendee_id"], shared["id"])
        self.assertCountEqual(scrambler["round_ids"], [self.round.pk, self.other_round.pk])
        self.assertEqual(len({item["attendee_id"] for item in group["assignments"]}), 4)
        self.assertEqual(sum(row["role"] == "judge" for row in group["assignments"]), 1)
        self.assertIsNone(group["problem"])

        updated = self.command("scrambler_approvals", attendee_id=shared["id"], event_ids=[self.first_event.pk])
        self.assertIn("approval", updated.json()["waves"][0]["groups"][0]["problem"])
        blocked = self.command("group_status", id=group["id"], version=wave["version"], status="active")
        self.assertEqual(blocked.status_code, 409, blocked.json())

    def test_adds_only_the_extra_scrambler_needed_to_balance_the_wave(self):
        wave = self.wave(stations=4, scramblers=1, rounds=[self.round.pk, self.other_round.pk])
        for number in range(5):
            self.attendee(f"Three solver {number}", wave)
        self.attendee("Two solver", wave, self.other_round.pk)
        three_scrambler = self.approved_scrambler("Three scrambler", self.first_event)
        two_scrambler = self.approved_scrambler("Two scrambler", self.second_event)
        wave = self.generated(wave)
        self.assertEqual(len(wave["groups"]), 2)
        self.assertCountEqual(
            [sum(item["role"] == "scrambler" for item in group["assignments"]) for group in wave["groups"]],
            [1, 2],
        )
        for group in wave["groups"]:
            solvers = [item for item in group["assignments"] if item["role"] == "solver"]
            self.assertEqual(len(solvers), 3)
            assigned = {round_id: item["attendee_id"] for item in group["assignments"] if item["role"] == "scrambler"
                        for round_id in item["round_ids"]}
            self.assertEqual(set(assigned), {item["round_id"] for item in solvers})
            self.assertEqual(assigned[self.round.pk], three_scrambler["id"])
            if self.other_round.pk in assigned:
                self.assertEqual(assigned[self.other_round.pk], two_scrambler["id"])
            self.assertIsNone(group["problem"])
        first, second = wave["groups"]
        started = self.command("group_status", id=first["id"], version=wave["version"], status="active")
        self.assertEqual(started.status_code, 200, started.json())
        finished = self.command("group_status", id=first["id"], version=started.json()["waves"][0]["version"], status="finished")
        self.assertEqual(finished.status_code, 200, finished.json())
        started = self.command("group_status", id=second["id"], version=finished.json()["waves"][0]["version"], status="active")
        self.assertEqual(started.status_code, 200, started.json())

    def test_extra_scrambler_can_reduce_the_count_even_when_larger_schedule_is_balanced(self):
        wave = self.wave(stations=4, scramblers=1, judges=0, rounds=[self.round.pk, self.other_round.pk])
        for number in range(2):
            self.attendee(f"Three solver {number}", wave)
            self.attendee(f"Two solver {number}", wave, self.other_round.pk)
        self.approved_scrambler("Three scrambler", self.first_event)
        self.approved_scrambler("Two scrambler", self.second_event)
        response = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(response.status_code, 200, response.json())
        result = response.json()
        group, = result["waves"][0]["groups"]
        self.assertEqual(sum(item["role"] == "solver" for item in group["assignments"]), 4)
        self.assertEqual(sum(item["role"] == "scrambler" for item in group["assignments"]), 2)
        self.assertEqual(result["generation"]["lower_bound"], 1)
        self.assertTrue(result["generation"]["minimum_proven"])
        self.assertEqual(result["generation"]["extra_scrambler_assignments"], 1)
        self.assertNotIn("suggestion", result["generation"])

    def test_rotates_judges_and_scramblers_when_approved_people_are_available(self):
        wave = self.wave(stations=2, scramblers=1, judges=1)
        for number in range(4):
            self.attendee(f"Solver {number}", wave)
        self.approved_scrambler("Scrambler A", self.first_event)
        self.approved_scrambler("Scrambler B", self.first_event)
        response = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(response.status_code, 200, response.json())
        result = response.json()
        groups = result["waves"][0]["groups"]
        self.assertEqual(len(groups), 2)
        workers = [row["attendee_id"] for group in groups for row in group["assignments"] if row["role"] != "solver"]
        self.assertEqual(len(workers), 4)
        self.assertEqual(len(set(workers)), 4)
        self.assertEqual(result["generation"]["extra_scrambler_assignments"], 0)
        self.assertTrue(result["generation"]["minimum_proven"])
        self.assertEqual(result["generation"]["bottleneck"], "Stations")
        self.assertIn("would still leave the same group count", result["generation"]["suggestion"])

    def test_suggests_one_station_when_it_makes_a_smaller_schedule_possible(self):
        wave = self.wave(stations=2, scramblers=0, judges=0)
        for number in range(3):
            self.attendee(f"Solver {number}", wave)
        response = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()["generation"]["suggestion"], "Add one station to run 1 group instead of 2.")

    def test_reports_staffing_when_it_limits_capacity_below_the_station_count(self):
        wave = self.wave(stations=4, scramblers=1)
        for number in range(5):
            self.attendee(f"Solver {number}", wave)
        self.approved_scrambler("Trusted", self.first_event)
        response = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(response.status_code, 200, response.json())
        report = response.json()["generation"]
        self.assertEqual(report["group_count"], 3)
        self.assertEqual(report["lower_bound"], 3)
        self.assertTrue(report["minimum_proven"])
        self.assertEqual(report["bottleneck"], "Judges and scramblers")
        self.assertEqual(report["detail"], "3 solvers plus 3 judges and 1 scrambler need 7 people. 6 are present.")
        self.assertEqual(report["suggestion"], "Add one judge to run 2 groups instead of 3.")
        self.assertEqual(report["judge_suggestion"],
                         "Use 2 judges per group to run 2 groups instead of 3. With fewer judges, solvers may wait longer between attempts.")

    def test_suggests_lowering_a_fixed_judge_count_when_adding_one_person_cannot_help(self):
        wave = self.wave(stations=4, scramblers=1, judges=3)
        for number in range(4):
            self.attendee(f"Solver {number}", wave)
        self.approved_scrambler("Trusted", self.first_event)
        self.attendee("Volunteer")
        response = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(response.status_code, 200, response.json())
        report = response.json()["generation"]
        self.assertEqual(report["group_count"], 2)
        self.assertNotIn("suggestion", report)
        self.assertEqual(report["judge_suggestion"],
                         "Use 1 judge per group to run 1 group instead of 2. With fewer judges, solvers may wait longer between attempts.")

    def test_omits_judge_count_changes_once_the_wave_has_started(self):
        wave = self.wave(stations=4, scramblers=1)
        for number in range(7):
            self.attendee(f"Solver {number}", wave)
        self.approved_scrambler("Trusted", self.first_event)
        wave = self.generated(wave)
        recorded = self.command("record_finished", id=wave["groups"][0]["id"], version=wave["version"])
        self.assertEqual(recorded.status_code, 200, recorded.json())
        wave = recorded.json()["waves"][0]
        response = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(response.status_code, 200, response.json())
        report = response.json()["generation"]
        self.assertEqual(report["group_count"], 2)
        self.assertEqual(report["suggestion"], "Add one judge to run 1 group instead of 2.")
        self.assertNotIn("judge_suggestion", report)

    def test_reports_judges_as_the_bottleneck_without_scramble_duties(self):
        wave = self.wave(stations=4, scramblers=0)
        for number in range(4):
            self.attendee(f"Solver {number}", wave)
        response = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()["generation"]["bottleneck"], "Judges")

    def test_reports_scramblers_as_the_bottleneck_without_judge_duties(self):
        wave = self.wave(stations=4, scramblers=2, judges=0)
        for number in range(4):
            solver = self.attendee(f"Solver {number}", wave)
            self.command("scrambler_approvals", attendee_id=solver["id"], event_ids=[self.first_event.pk])
        self.approved_scrambler("Trusted", self.first_event)
        response = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(response.status_code, 200, response.json())
        report = response.json()["generation"]
        self.assertEqual(report["bottleneck"], "Scramblers")
        self.assertEqual(report["suggestion"], "Add one scrambler approved for 3x3 to run 1 group instead of 2.")

    def test_reports_scrambler_coverage_when_the_only_approved_people_are_solving(self):
        wave = self.wave(stations=4, scramblers=1, judges=0, rounds=[self.round.pk, self.other_round.pk])
        for number in range(2):
            three = self.attendee(f"Three solver {number}", wave)
            two = self.attendee(f"Two solver {number}", wave, self.other_round.pk)
        self.command("scrambler_approvals", attendee_id=three["id"], event_ids=[self.second_event.pk])
        self.command("scrambler_approvals", attendee_id=two["id"], event_ids=[self.first_event.pk])
        self.attendee("Unapproved volunteer")
        response = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(response.status_code, 200, response.json())
        report = response.json()["generation"]
        self.assertEqual(report["group_count"], 2)
        self.assertTrue(report["minimum_proven"])
        self.assertEqual(report["bottleneck"], "Scrambler coverage")
        self.assertEqual(report["suggestion"], "Add one scrambler approved for 2x2 and 3x3 to run 1 group instead of 2.")

    def test_timeout_keeps_valid_existing_groups_with_an_unproven_minimum(self):
        wave = self.wave(stations=2, scramblers=0, judges=0)
        solvers = [self.attendee(f"Solver {number}", wave) for number in range(1, 3)]
        groups = self.competition.waves.get(pk=wave["id"]).groups
        for number, solver in enumerate(solvers, start=1):
            group = groups.create(number=number)
            GroupAssignment.objects.create(group=group, attendee_id=solver["id"], competition_round=self.round,
                                           role=GroupAssignment.Role.SOLVER, station_number=1)
        with patch("competitions.services.grouping_optimizer.solve", return_value=(None, cp_model.UNKNOWN)):
            response = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(response.status_code, 200, response.json())
        report = response.json()["generation"]
        self.assertEqual(report["group_count"], 2)
        self.assertEqual(report["lower_bound"], 1)
        self.assertFalse(report["minimum_proven"])
        self.assertEqual(report["bottleneck"], "Search limit")

    def test_recording_completed_groups_respects_order_and_preserves_them_on_regeneration(self):
        wave = self.wave(stations=1, scramblers=0, judges=0)
        for number in range(3):
            self.attendee(f"Solver {number}", wave)
        wave = self.generated(wave)
        first, second, _ = wave["groups"]
        skipped = self.command("record_finished", id=second["id"], version=wave["version"])
        self.assertEqual(skipped.status_code, 409, skipped.json())
        recorded = self.command("record_finished", id=first["id"], version=wave["version"])
        self.assertEqual(recorded.status_code, 200, recorded.json())
        wave = recorded.json()["waves"][0]
        self.assertEqual(wave["groups"][0]["status"], "finished")

        self.attendee("Late solver", wave)
        wave = self.generated(wave)
        finished, *upcoming = wave["groups"]
        self.assertEqual(finished["id"], first["id"])
        self.assertEqual(finished["assignments"], first["assignments"])
        self.assertEqual(len(upcoming), 2)
        completed_attendee = finished["assignments"][0]["attendee_id"]
        self.assertTrue(all(row["attendee_id"] != completed_attendee
                            for group in upcoming for row in group["assignments"] if row["role"] == "solver"))

    def test_late_entry_preserves_running_group_and_linked_scrambles(self):
        wave = self.wave(stations=2)
        attendees = [self.attendee(f"Solver {number}", wave) for number in range(3)]
        alternate = self.attendee("Volunteer judge")
        self.approved_scrambler("Trusted staff", self.first_event)
        wave = self.generated(wave)
        first, second = wave["groups"]
        self.assertEqual(self.command("group_status", id=second["id"], version=wave["version"], status="active").status_code, 409)
        record = self.round.scramble_sets.create(number=1, group_id=second["id"], scrambles=["R U"], generator_name="manual")
        started = self.command("group_status", id=first["id"], version=wave["version"], status="active")
        self.assertEqual(started.status_code, 200, started.json())
        wave = started.json()["waves"][0]
        previous = next(row["attendee_id"] for row in first["assignments"] if row["role"] == "judge")
        self.assertEqual(self.command(
            "judge", id=first["id"], version=wave["version"], previous_attendee_id=previous, attendee_id=alternate["id"],
        ).status_code, 409)
        check_in = reverse("competition_check_in", args=[started.json()["token"]])
        late = self.guest.post(check_in, {
            "name": "Late arrival", "check_in_key": str(uuid4()),
            "entries": [{"wave_id": wave["id"], "round_id": self.round.pk}],
        }, format="json")
        self.assertEqual(late.json()["pending_waves"], [1])
        entry = WaveEntry.objects.get(is_pending=True)
        url = reverse("late_entry_placements", args=[self.competition.id, entry.pk])
        placements = self.admin.get(url).json()["placements"]
        self.assertNotIn(first["id"], {item["group_id"] for item in placements})
        placement = next(item for item in placements if item["group_id"] == second["id"])
        judge_id = placement["judge_ids"][-1]
        approval = self.command("approve_entry", id=entry.pk, version=wave["version"], group_id=second["id"], judge_id=judge_id)
        self.assertEqual(approval.status_code, 200, approval.json())
        wave = approval.json()["waves"][0]
        locked, enlarged = wave["groups"]
        self.assertEqual(locked["assignments"], first["assignments"])
        self.assertEqual(locked["status"], "active")
        self.assertIn(
            {"attendee_id": judge_id, "round_id": None, "role": "judge", "station": None},
            enlarged["assignments"],
        )
        self.assertEqual(enlarged["scramble_round_ids"], [self.round.pk])
        self.assertFalse(WaveEntry.objects.get(pk=entry.pk).is_pending)
        record.refresh_from_db()
        self.assertEqual(record.group_id, second["id"])

        finished = self.command("group_status", id=first["id"], version=wave["version"], status="finished")
        self.assertEqual(finished.status_code, 200, finished.json())
        locked_solver = next(row["attendee_id"] for row in first["assignments"] if row["role"] == "solver")
        self.assertIn(locked_solver, {person["id"] for person in attendees})
        self.assertEqual(self.command("remove_attendee", id=locked_solver).status_code, 409)
        rebuilt = self.generated(finished.json()["waves"][0])
        self.assertEqual(rebuilt["groups"][0]["assignments"], first["assignments"])
        self.assertEqual(rebuilt["groups"][1]["id"], second["id"])

    def test_failed_staffing_does_not_save_a_partial_schedule(self):
        wave = self.wave()
        self.attendee("First solver", wave)
        self.attendee("Second solver", wave)
        failure = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(failure.status_code, 409, failure.json())
        self.assertEqual(self.competition.waves.get().groups.count(), 0)
        self.approved_scrambler("Volunteer", self.first_event)
        changed = self.generated(wave)
        stale = self.command("generate", id=wave["id"], version=wave["version"])
        self.assertEqual(stale.status_code, 409, stale.json())
        self.assertEqual(len(changed["groups"]), 2)

    def test_configuration_and_roster_edits_keep_competition_scope(self):
        wave = self.wave(scramblers=0, rounds=[self.round.pk, self.other_round.pk])
        person = self.attendee("Typed Name")
        added = self.command(
            "edit_attendee", id=person["id"], name="Corrected Name", entries=[{"wave_id": wave["id"], "round_id": self.round.pk}],
        )
        self.assertEqual(added.status_code, 200, added.json())
        self.assertEqual(added.json()["attendees"][0]["display_name"], "Corrected Name")
        other = self.wave(number=2)
        duplicate_round = self.command(
            "edit_attendee", id=person["id"], name="New Name", entries=[{"wave_id": other["id"], "round_id": self.round.pk}],
        )
        self.assertEqual(duplicate_round.status_code, 409)
        refused = self.command(
            "save_wave", id=wave["id"], version=wave["version"], number=1, name="", station_count=2,
            scramblers_per_group=0, round_ids=[self.other_round.pk],
        )
        self.assertEqual(refused.status_code, 409)
        entry_id = added.json()["waves"][0]["entries"][0]["id"]
        self.assertEqual(self.command("remove_entry", id=entry_id).status_code, 200)
        self.assertEqual(self.competition.attendance.count(), 1)

    def test_fixed_judge_pool_does_not_add_a_judge_for_a_late_solver(self):
        wave = self.wave(stations=3, scramblers=0, judges=1)
        self.attendee("First solver", wave)
        self.attendee("Second solver", wave)
        judge = self.attendee("Volunteer judge")
        wave = self.generated(wave)
        group, = wave["groups"]
        self.assertEqual(
            [row for row in group["assignments"] if row["role"] == "judge"],
            [{"attendee_id": judge["id"], "round_id": None, "station": None, "role": "judge"}],
        )
        self.attendee("Late solver", wave)
        entry = WaveEntry.objects.get(is_pending=True)
        path = reverse("late_entry_placements", args=[self.competition.pk, entry.pk])
        placement = self.admin.get(path).json()["placements"][0]
        self.assertEqual(placement["group_id"], group["id"])
        self.assertIsNone(placement["judge_id"])
        self.assertEqual(placement["suggested_judges"], [judge["id"]])
        result = self.command("approve_entry", id=entry.pk, version=wave["version"], group_id=group["id"])
        self.assertEqual(result.status_code, 200, result.json())
        assignments = result.json()["waves"][0]["groups"][0]["assignments"]
        self.assertEqual([row["attendee_id"] for row in assignments if row["role"] == "judge"], [judge["id"]])
        self.assertEqual(len([row for row in assignments if row["role"] == "solver"]), 3)

    def test_same_event_round_can_span_multiple_waves(self):
        second_round = self.competition.rounds.create(event=self.first_event, round_type=self.round.round_type, number=2)
        result = self.command(
            "save_wave", number=1, name="", station_count=2, scramblers_per_group=0,
            round_ids=[self.round.pk, second_round.pk],
        )
        self.assertEqual(result.status_code, 400)
        first = self.wave(number=1)
        second = self.wave(number=2)
        self.assertEqual(first["round_ids"], second["round_ids"])
        first_person = self.attendee("First wave", first)
        second_person = self.attendee("Second wave", second)
        self.assertNotEqual(first_person["id"], second_person["id"])

    def test_generated_scrambles_fill_missing_rounds_and_release_after_finish(self):
        self.second_event.average_type = "mean"
        self.second_event.save(update_fields=["average_type"])
        wave = self.wave(stations=2, scramblers=0, judges=0, rounds=[self.round.pk, self.other_round.pk])
        self.attendee("3x3 solver", wave)
        self.attendee("2x2 solver", wave, self.other_round.pk)
        wave = self.generated(wave)
        group, = wave["groups"]
        path = reverse("group_scramble_sets", args=[self.competition.pk])
        self.assertIn(self.guest.get(path).status_code, (401, 403))
        missing = self.admin.get(path).json()["missing"]
        self.assertEqual(
            {row["round_id"]: (row["attempts"], row["extras"]) for row in missing},
            {self.round.pk: (5, 2), self.other_round.pk: (3, 2)},
        )
        manual = self.round.scramble_sets.create(
            number=1, group_id=group["id"], scrambles=["R U"], generator_name="manual",
        )
        payload = {"version": "0.66.1", "sets": [
            {"group_id": group["id"], "round_id": self.round.pk, "scrambles": ["F"] * 5, "extra_scrambles": ["R", "L"]},
            {"group_id": group["id"], "round_id": self.other_round.pk, "scrambles": ["D"] * 3, "extra_scrambles": ["R", "L"]},
        ]}
        saved = self.admin.post(path, payload, format="json")
        self.assertEqual(saved.json(), {"created": 1, "missing": []})
        self.assertEqual(self.admin.post(path, payload, format="json").json(), {"created": 0, "missing": []})
        manual.refresh_from_db()
        self.assertEqual(manual.scrambles, ["R U"])
        generated = self.other_round.scramble_sets.get()
        self.assertEqual(generated.generator_name, "cubing.js")
        self.assertIsNotNone(generated.generated_at)
        self.competition.is_published = True
        self.competition.save(update_fields=["is_published"])
        public_path = reverse("round_scrambles", args=["Club-Open", "2x2", 1])
        self.assertEqual(self.guest.get(public_path).json(), [])
        result = self.command("group_status", id=group["id"], version=wave["version"], status="active")
        wave = result.json()["waves"][0]
        self.assertEqual(self.guest.get(public_path).json(), [])
        result = self.command("group_status", id=group["id"], version=wave["version"], status="finished")
        self.assertEqual(result.status_code, 200, result.json())
        self.assertEqual(self.guest.get(public_path).json()[0]["scrambles"], ["D"] * 3)
