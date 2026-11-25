from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    Competition, CompetitionAttendance, CompetitionGroup, CompetitionRound, CompetitionScrambler,
    CompetitionWave, Competitor, Event, GroupAssignment, RoundType, ScrambleSet, Solve, WaveEntry,
)


class CompetitionAdminTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        now = timezone.now()
        cls.competition = Competition.objects.create(
            name="Club Draft", location="Club room", start_time=now,
            end_time=now + timedelta(hours=1), official=False,
        )
        cls.event = Event.objects.create(name="3x3", average_type="average", ranking_format="average")
        cls.competitor = Competitor.objects.create(first_name="Maya", last_name="Chen", school_id="maya", grade=1)
        round = CompetitionRound.objects.create(
            competition=cls.competition, event=cls.event, number=1,
            round_type=RoundType.objects.create(name="First"),
        )
        Solve.objects.create(
            competitor=cls.competitor, competition_round=round, solve_number=1,
            solve_time=timedelta(seconds=15),
        )
        cls.organizer = get_user_model().objects.create_user(username="organizer")

    def test_create_competition_reports_field_errors_and_invalid_round_counts(self):
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        path = reverse("create_competition")
        payload = {
            "name": "New Club Meet", "location": "Club room", "official": True, "official_link": None,
            "start_time": self.competition.start_time.isoformat(), "end_time": self.competition.end_time.isoformat(),
            "events": [{"event-name": self.event.name, "Rounds": 3}], "competitors": [],
        }
        invalid_fields = (
            ("name", "club-draft"),
            ("name", "A" * 256),
            ("location", ""),
            ("end_time", (self.competition.start_time - timedelta(hours=1)).isoformat()),
            ("official_link", "invalid"),
            ("events", []),
        )
        for field, value in invalid_fields:
            with self.subTest(field=field, value=value):
                response = admin.post(path, {**payload, field: value}, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json())

        for rounds in (0, 4, "1.5", "invalid"):
            with self.subTest(rounds=rounds):
                events = [{"event-name": self.event.name, "Rounds": rounds}]
                response = admin.post(path, {**payload, "events": events}, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertIn(self.event.name, response.json()["events"])
        self.assertEqual(Competition.objects.count(), 1)

        response = admin.post(path, payload, format="json")
        self.assertEqual(response.status_code, 201)
        created = Competition.objects.get(pk=response.json()["id"])
        self.assertFalse(created.is_published)
        self.assertEqual(list(created.rounds.order_by("number").values_list("number", flat=True)), [1, 2, 3])

    def test_create_competitor_reports_duplicate_school_id_and_invalid_grade(self):
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        path = reverse("create_competitor")
        payload = {"first_name": "alex", "last_name": "lee", "school_id": "MAYA", "grade": 1.5}
        response = admin.post(path, payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.json()), {"school_id", "grade"})
        self.assertEqual(Competitor.objects.count(), 1)

        response = admin.post(path, {**payload, "school_id": "alex", "grade": 2}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["first_name"], "Alex")

    def test_competitor_roster_searches_all_pages_and_updates_by_id(self):
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        Competitor.objects.bulk_create([
            Competitor(first_name=f"Alex {number:02}", last_name="Lee", school_id=f"alex{number}", grade=1)
            for number in range(10)
        ])
        path = reverse("admin_competitors")
        self.assertIn(APIClient().get(path).status_code, (401, 403))
        first = admin.get(path).json()
        self.assertEqual((first["count"], first["total_pages"], len(first["results"])), (11, 2, 10))
        maya = admin.get(path, {"page": 2}).json()["results"][0]
        self.assertEqual(maya["id"], self.competitor.pk)
        self.assertEqual(admin.get(path, {"search": "Chen Maya"}).json()["results"], [maya])
        self.assertEqual(admin.get(path, {"search": "maya"}).json()["count"], 1)

        detail = reverse("admin_edit_competitor", args=[self.competitor.pk])
        version = {"updated_at": maya["updated_at"]}
        duplicate = admin.patch(detail, {**version, "school_id": "ALEX0"}, format="json")
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn("school_id", duplicate.json())
        response = admin.patch(detail, {**version, "first_name": "May", "school_id": "may", "grade": 2}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.json()["first_name"], response.json()["grade"]), ("May", 2))
        self.assertTrue(Solve.objects.filter(competitor=self.competitor, competitor__school_id="may").exists())
        self.assertEqual(admin.patch(detail, {**version, "grade": 3}, format="json").status_code, 409)

    def test_solve_pagination_keeps_all_attempts_for_each_competitor_together(self):
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        round_obj = self.competition.rounds.get()
        people = Competitor.objects.bulk_create([
            Competitor(first_name=f"Alex {number:02}", school_id=f"alex{number}", grade=1)
            for number in range(7)
        ])
        Solve.objects.bulk_create([
            Solve(competitor=person, competition_round=round_obj, solve_number=attempt, solve_time=timedelta(seconds=15))
            for person in people for attempt in range(1, 6)
        ])
        path = reverse("admin_round_solves", args=[self.competition.pk, round_obj.pk])
        first = admin.get(path, {"page": 1}).json()
        self.assertEqual((first["count"], first["total_pages"], len(first["results"])), (8, 2, 35))
        self.assertEqual([solve["solve_number"] for solve in first["results"][:5]], [1, 2, 3, 4, 5])
        second = admin.get(path, {"page": 2}).json()
        self.assertEqual([solve["competitor"]["id"] for solve in second["results"]], [self.competitor.pk])
        found = admin.get(path, {"page": 1, "search": "Chen Maya"}).json()
        self.assertEqual((found["count"], found["total_pages"]), (1, 1))
        self.assertEqual([solve["competitor"]["id"] for solve in found["results"]], [self.competitor.pk])
        found = admin.get(path, {"search": "alex0"}).json()
        self.assertEqual(found["count"], 1)
        self.assertEqual([solve["solve_number"] for solve in found["results"]], [1, 2, 3, 4, 5])
        round_obj.solves.filter(competitor=self.competitor).delete()
        self.assertEqual(admin.get(path, {"page": 2}).json()["page"], 1)
        self.assertEqual(len(admin.get(path).json()), 35)

    def test_remove_competitor_requires_current_version_and_preserves_linked_records(self):
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        used = reverse("admin_edit_competitor", args=[self.competitor.pk])
        used_version = {"updated_at": self.competitor.updated_at.isoformat()}
        self.assertEqual(admin.delete(used, used_version, format="json").status_code, 409)
        self.assertTrue(Solve.objects.filter(competitor=self.competitor).exists())

        spare = Competitor.objects.create(first_name="Alex", last_name="Lee", school_id="alex", grade=1)
        path = reverse("admin_edit_competitor", args=[spare.pk])
        version = {"updated_at": spare.updated_at.isoformat()}
        self.assertIn(APIClient().delete(path, version, format="json").status_code, (401, 403))
        attendance = CompetitionAttendance.objects.create(competition=self.competition, display_name="Alex Lee")
        spare.save()
        self.assertEqual(admin.delete(path, version, format="json").status_code, 409)
        self.assertEqual(admin.delete(path, {"updated_at": spare.updated_at.isoformat()}, format="json").status_code, 204)
        self.assertFalse(Competitor.objects.filter(pk=spare.pk).exists())
        self.assertTrue(CompetitionAttendance.objects.filter(pk=attendance.pk).exists())

    def test_add_result_requires_all_times_and_rejects_duplicate_competitors(self):
        admin = APIClient()
        public = APIClient()
        admin.force_authenticate(user=self.organizer)
        round_obj = self.competition.rounds.get()
        round_url = reverse("admin_round_solves", args=[self.competition.pk, round_obj.pk])
        new_competitor = Competitor.objects.create(first_name="Alex", school_id="alex", grade=1)
        payload = {"competitor_id": new_competitor.pk, "times": ["10.00", "12", "12.30", "DNF", "1:02.34"]}
        self.assertIn(public.post(round_url, payload, format="json").status_code, (401, 403))

        placeholder = round_obj.solves.create(competitor=new_competitor, solve_number=2)
        self.assertEqual(admin.post(round_url, {**payload, "times": ["12"]}, format="json").status_code, 400)
        response = admin.post(round_url, {**payload, "times": ["12", "12", "invalid", "12", "12"]}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("2", response.json()["times"])
        self.assertEqual(round_obj.solves.filter(competitor=new_competitor, solve_time__isnull=False).count(), 0)

        response = admin.post(round_url, payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual([solve["solve_number"] for solve in response.json()], [1, 2, 3, 4, 5])
        self.assertEqual(response.json()[1]["id"], placeholder.pk)
        self.assertEqual(response.json()[4]["time"], "1:02.34")
        self.assertEqual(admin.post(round_url, payload, format="json").status_code, 409)
        self.assertEqual(admin.post(round_url, {**payload, "competitor_id": self.competitor.pk}, format="json").status_code, 409)

        self.competition.is_published = True
        self.competition.save(update_fields=["is_published"])
        public_round = reverse("round", args=["Club-Draft", self.event.name, 1])
        results = {row["school_id"]: row for row in public.get(public_round).json()}
        self.assertEqual(results["alex"]["average"], "28.88")
        self.assertEqual(results["maya"]["average"], "—")

    def test_edit_result_saves_multiple_attempts_without_overwriting_other_times(self):
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        round_obj = self.competition.rounds.get()
        retained = round_obj.solves.create(
            competitor=self.competitor, solve_number=2, solve_time=timedelta(seconds=12, microseconds=34567),
        )
        result_url = reverse("admin_competitor_result", args=[self.competition.pk, round_obj.pk, self.competitor.pk])
        versions = admin.get(result_url).json()
        bad = admin.patch(result_url, {"solves": versions, "times": {"1": "13", "3": "invalid"}}, format="json")
        self.assertEqual(bad.status_code, 400)
        self.assertIn("3", bad.json()["times"])
        self.assertEqual(round_obj.solves.get(solve_number=1).solve_time, timedelta(seconds=15))
        bad = admin.patch(result_url, {"solves": versions, "times": {"6": "13"}}, format="json")
        self.assertEqual(bad.status_code, 400)

        payload = {"solves": versions, "times": {"1": "14.52", "3": "DNF", "4": "13", "5": "1:02.34"}}
        response = admin.patch(result_url, payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["time"] for item in response.json()], ["14.52", "12.03", "DNF", "13.00", "1:02.34"])
        retained.refresh_from_db()
        self.assertEqual(retained.solve_time, timedelta(seconds=12, microseconds=34567))
        self.assertEqual(admin.patch(result_url, payload, format="json").status_code, 409)

    def test_removing_round_or_event_result_preserves_other_results(self):
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        round_obj = self.competition.rounds.get()
        second = self.competition.rounds.create(event=self.event, number=2, round_type=round_obj.round_type)
        second.solves.create(competitor=self.competitor, solve_number=1, solve_time=timedelta(seconds=18))
        other_event = Event.objects.create(name="2x2", average_type="average", ranking_format="average")
        other_round = self.competition.rounds.create(event=other_event, number=1, round_type=round_obj.round_type)
        other_solve = other_round.solves.create(competitor=self.competitor, solve_number=1, solve_time=timedelta(seconds=7))
        other_competitor = Competitor.objects.create(first_name="Alex", school_id="alex", grade=1)
        untouched = round_obj.solves.create(competitor=other_competitor, solve_number=1, solve_time=timedelta(seconds=5))
        solve = round_obj.solves.get(competitor=self.competitor)
        solve_url = reverse("admin_solve", args=[self.competition.pk, round_obj.pk, solve.pk])
        result_url = reverse("admin_competitor_result", args=[self.competition.pk, round_obj.pk, self.competitor.pk])
        versions = admin.get(result_url).json()
        self.assertEqual(len(versions), 2)
        response = admin.patch(solve_url, {"updated_at": versions[0]["updated_at"], "time": "DNF"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["time"], "DNF")
        self.assertEqual(admin.delete(result_url, {"scope": "event", "solves": versions}, format="json").status_code, 409)

        versions = admin.get(result_url).json()
        self.assertEqual(admin.delete(result_url, {"scope": "round", "solves": versions[:1]}, format="json").status_code, 204)
        self.assertTrue(second.solves.filter(competitor=self.competitor).exists())
        self.assertTrue(Solve.objects.filter(pk=untouched.pk).exists())

        round_obj.solves.create(competitor=self.competitor, solve_number=1, solve_time=timedelta(seconds=15))
        versions = admin.get(result_url).json()
        self.assertEqual(admin.delete(result_url, {"scope": "event", "solves": versions}, format="json").status_code, 204)
        self.assertFalse(Solve.objects.filter(competitor=self.competitor, competition_round__event=self.event).exists())
        self.assertTrue(Solve.objects.filter(pk=other_solve.pk).exists())
        self.assertTrue(Solve.objects.filter(pk=untouched.pk).exists())


    def test_competition_deletion_requires_exact_name_and_cascades_only_its_data(self):
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        guest = APIClient()
        competition = self.competition
        competition.is_published = True
        competition.save(update_fields=["is_published"])
        round_obj = competition.rounds.get()
        round_obj.solves.create(competitor=self.competitor, solve_number=2, solve_time=timedelta(0))
        attendance = competition.attendance.create(display_name="Maya Chen")
        approval = attendance.scrambler_approvals.create(event=self.event)
        wave = CompetitionWave.objects.create(competition=competition, number=1)
        wave.allowed_rounds.add(round_obj)
        entry = wave.entries.create(competition_round=round_obj, attendee=attendance)
        group = wave.groups.create(number=1)
        assignment = group.assignments.create(competition_round=round_obj, attendee=attendance, role="solver")
        scramble = round_obj.scramble_sets.create(number=1, group=group, scrambles=["R U2"], generator_name="manual")
        _, scrambler, entrant, judge = CompetitionAttendance.objects.bulk_create([
            CompetitionAttendance(competition=competition, display_name=name)
            for name in ("Maya Chen", "Blake Lee", "Casey Lee", "Dana Lee")
        ])
        scrambler.scrambler_approvals.create(event=self.event)
        wave.entries.create(competition_round=round_obj, attendee=entrant)
        group.assignments.create(attendee=judge, role="judge")

        other = Competition.objects.create(
            name="Other meet", location="Club room", start_time=competition.start_time,
            end_time=competition.end_time, official=False,
        )
        other_round = other.rounds.create(event=self.event, number=1, round_type=round_obj.round_type)
        kept_solve = other_round.solves.create(competitor=self.competitor, solve_number=1, solve_time=timedelta(seconds=8))
        other.attendance.create(display_name="Elliot Lee")
        path = reverse("admin_competition_deletion", args=[competition.pk])
        self.assertIn(guest.get(path).status_code, (401, 403))
        review = admin.get(path)
        self.assertEqual(review.status_code, 200)
        self.assertIn("no-store", review.headers["Cache-Control"])
        summary = review.json()
        self.assertTrue(summary["is_published"])
        self.assertEqual(summary["counts"], {
            "rounds": 1, "solves": 2, "competitors_with_solves": 1, "scramble_sets": 1, "check_ins": 5,
            "scrambler_approvals": 2, "waves": 1, "wave_entries": 2, "groups": 1, "group_assignments": 2,
        })
        payload = {"name": competition.name, "version": summary["version"]}
        self.assertIn(guest.delete(path, payload, format="json").status_code, (401, 403))
        self.assertEqual(admin.delete(path, {"name": competition.name}, format="json").status_code, 400)
        self.assertEqual(admin.delete(path, {**payload, "name": competition.name + " "}, format="json").status_code, 400)
        self.assertTrue(Solve.objects.filter(competition_round=round_obj).exists())

        changed_solve = round_obj.solves.get(solve_number=1)
        changed_solve.solve_time = timedelta(seconds=16)
        changed_solve.save(update_fields=["solve_time", "updated_at"])
        stale = admin.delete(path, payload, format="json")
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.json()["summary"]["counts"]["solves"], 2)
        response = admin.delete(path, {**payload, "version": stale.json()["summary"]["version"]}, format="json")
        self.assertEqual(response.status_code, 204)

        for model, pk in (
            (Competition, competition.pk), (CompetitionRound, round_obj.pk), (Solve, changed_solve.pk),
            (CompetitionAttendance, attendance.pk), (CompetitionScrambler, approval.pk), (CompetitionWave, wave.pk),
            (WaveEntry, entry.pk), (CompetitionGroup, group.pk), (GroupAssignment, assignment.pk), (ScrambleSet, scramble.pk),
        ):
            self.assertFalse(model.objects.filter(pk=pk).exists())
        self.assertFalse(Solve.objects.filter(competition_round_id=round_obj.pk).exists())
        self.assertTrue(Competitor.objects.filter(pk=self.competitor.pk).exists())
        self.assertTrue(Solve.objects.filter(pk=kept_solve.pk, competition_round__competition=other).exists())
        self.assertEqual(guest.get(reverse("competition_info", args=["Club-Draft"])).status_code, 404)

    def test_private_preview_matches_public_data_without_publishing(self):
        round_obj = self.competition.rounds.get()
        round_obj.scramble_sets.create(number=1, group_label="Group A", scrambles=["R U2"], generator_name="manual")
        slug = "Club-Draft"
        paths = [
            (reverse("admin_preview_competition", args=[slug]), reverse("competition_info", args=[slug])),
            (reverse("admin_preview_round", args=[slug, self.event.name, 1]), reverse("round", args=[slug, self.event.name, 1])),
            (
                reverse("admin_preview_scrambles", args=[slug, self.event.name, 1]),
                reverse("round_scrambles", args=[slug, self.event.name, 1]),
            ),
        ]
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        guest = APIClient()
        preview_data = []
        for preview, public in paths:
            self.assertIn(guest.get(preview).status_code, (401, 403))
            self.assertEqual(guest.get(public).status_code, 404)
            response = admin.get(preview)
            self.assertEqual(response.status_code, 200)
            self.assertIn("no-store", response.headers["Cache-Control"])
            preview_data.append(response.json())

        self.assertEqual(preview_data[0]["scramble_rounds"], [{"event": self.event.name, "round": 1}])
        self.assertEqual(preview_data[1][0]["rank"], 1)
        self.assertEqual(preview_data[2][0]["group_label"], "Group A")
        self.competition.refresh_from_db()
        self.assertFalse(self.competition.is_published)

        self.competition.is_published = True
        self.competition.save(update_fields=["is_published"])
        preview_data[0]["is_published"] = True
        for (_, public), expected in zip(paths, preview_data):
            self.assertEqual(guest.get(public).json(), expected)

    def test_public_scrambles_follow_round_and_competition_visibility(self):
        round_obj = self.competition.rounds.get()
        other_round = self.competition.rounds.create(event=self.event, number=2, round_type=round_obj.round_type)
        wave = CompetitionWave.objects.create(competition=self.competition, number=1, name="Morning")
        wave.allowed_rounds.add(round_obj)
        group = wave.groups.create(number=2)
        round_obj.scramble_sets.create(number=1, group_label="Group A", scrambles=["R U2"], generator_name="manual")
        round_obj.scramble_sets.create(
            number=2, group=group, scrambles=["F2 U"], extra_scrambles=["B L'"], generator_name="manual",
        )
        other_round.scramble_sets.create(number=1, generator_name="manual")
        public = APIClient()
        details = reverse("competition_info", args=["Club-Draft"])
        first = reverse("round_scrambles", args=["Club-Draft", self.event.name, 1])
        second = reverse("round_scrambles", args=["Club-Draft", self.event.name, 2])
        self.assertEqual(public.get(details).status_code, 404)
        self.assertEqual(public.get(first).status_code, 404)

        self.competition.is_published = True
        self.competition.save(update_fields=["is_published"])
        self.assertEqual(public.get(details).json()["scramble_rounds"], [{"event": self.event.name, "round": 1}])
        self.assertEqual(public.get(first).json(), [
            {"number": 1, "group": None, "group_label": "Group A", "scrambles": ["R U2"], "extra_scrambles": []},
            {
                "number": 2, "group": {"number": 2, "wave_number": 1, "wave_name": "Morning"},
                "group_label": "", "scrambles": ["F2 U"], "extra_scrambles": ["B L'"],
            },
        ])
        self.assertEqual(public.get(second).json(), [])

        self.competition.is_published = False
        self.competition.save(update_fields=["is_published"])
        self.assertEqual(public.get(first).status_code, 404)

    def test_manage_scrambles_scopes_rounds_and_groups(self):
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        first = self.competition.rounds.get()
        other_event = Event.objects.create(name="2x2", average_type="average", ranking_format="average")
        second = self.competition.rounds.create(event=other_event, number=1, round_type=first.round_type)
        mixed_wave = CompetitionWave.objects.create(competition=self.competition, number=1, name="Morning")
        mixed_wave.allowed_rounds.add(first, second)
        mixed_group = mixed_wave.groups.create(number=1)
        other_wave = CompetitionWave.objects.create(competition=self.competition, number=2)
        other_wave.allowed_rounds.add(second)
        other_group = other_wave.groups.create(number=1)

        path = reverse("admin_round_scrambles", args=[self.competition.pk, first.pk])
        self.assertIn(APIClient().get(path).status_code, (401, 403))
        self.assertEqual([group["id"] for group in admin.get(path).json()["groups"]], [mixed_group.pk])
        payload = {"scrambles": ["R U2", "F2  U"], "extra_scrambles": ["B L'"]}
        self.assertEqual(admin.post(path, {**payload, "group_id": other_group.pk}, format="json").status_code, 400)
        response = admin.post(path, payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.json()["group_id"])
        self.assertEqual(response.json()["group_label"], "")
        self.assertEqual(admin.post(
            path, {**payload, "group_id": mixed_group.pk, "group_label": "Group A"}, format="json",
        ).status_code, 400)
        response = admin.post(path, {**payload, "group_id": mixed_group.pk}, format="json")
        self.assertEqual(response.status_code, 201)
        grouped = response.json()
        self.assertEqual(admin.post(path, {**payload, "group_id": mixed_group.pk}, format="json").status_code, 400)

        second_path = reverse("admin_round_scrambles", args=[self.competition.pk, second.pk])
        self.assertEqual(admin.post(second_path, {**payload, "group_id": mixed_group.pk}, format="json").status_code, 201)
        self.assertEqual(len(admin.get(path).json()["sets"]), 2)
        self.assertEqual(len(admin.get(second_path).json()["sets"]), 1)

        item = reverse("admin_scramble_set", args=[self.competition.pk, first.pk, grouped["id"]])
        version = {"version": grouped["version"]}
        self.assertEqual(admin.patch(item, {"scrambles": ["R2"]}, format="json").status_code, 400)
        response = admin.patch(item, {**version, "scrambles": ["R2"]}, format="json")
        self.assertEqual(response.status_code, 200)
        edited = response.json()
        self.assertEqual(edited["scrambles"], ["R2"])
        self.assertEqual(edited["extra_scrambles"], payload["extra_scrambles"])
        self.assertEqual(edited["group_id"], mixed_group.pk)
        self.assertEqual(ScrambleSet.objects.get(pk=grouped["id"]).generator_name, "manual")
        self.assertEqual(admin.delete(item, version, format="json").status_code, 409)
        wrong_round = reverse("admin_scramble_set", args=[self.competition.pk, second.pk, grouped["id"]])
        self.assertEqual(admin.delete(wrong_round, {"version": edited["version"]}, format="json").status_code, 404)
        self.assertEqual(admin.delete(item, {"version": edited["version"]}, format="json").status_code, 204)
        self.assertEqual(first.scramble_sets.count(), 1)
        self.assertEqual(second.scramble_sets.count(), 1)

    def test_manage_scrambles_saves_custom_labels_without_live_groups(self):
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        round_obj = self.competition.rounds.get()
        path = reverse("admin_round_scrambles", args=[self.competition.pk, round_obj.pk])
        self.assertEqual(admin.get(path).json()["groups"], [])
        response = admin.post(path, {"group_label": " Group A ", "scrambles": ["R U2"]}, format="json")
        self.assertEqual(response.status_code, 201)
        custom_set = response.json()
        self.assertEqual(custom_set["group_label"], "Group A")
        self.assertIsNone(custom_set["group_id"])
        item = reverse("admin_scramble_set", args=[self.competition.pk, round_obj.pk, custom_set["id"]])
        response = admin.patch(item, {"version": custom_set["version"], "group_label": "Group B"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["group_label"], "Group B")
        self.assertEqual(response.json()["scrambles"], ["R U2"])
        self.assertEqual(admin.delete(item, {"version": custom_set["version"]}, format="json").status_code, 409)

    def test_edit_round_counts_preserves_used_rounds(self):
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        details = reverse("update_competition_details", args=[self.competition.pk])
        first_round_id = self.competition.rounds.get(number=1).pk

        response = admin.patch(details, {"event_round_counts": {self.event.name: 2}}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["events"], [{"name": self.event.name, "rounds": 2}])
        second_round = self.competition.rounds.get(number=2)
        wave = CompetitionWave.objects.create(competition=self.competition, number=1)
        wave.allowed_rounds.add(second_round)

        response = admin.patch(details, {
            "location": "New room",
            "event_round_counts": {self.event.name: 1},
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.competition.refresh_from_db()
        self.assertEqual(self.competition.location, "Club room")
        self.assertTrue(self.competition.rounds.filter(pk=second_round.pk).exists())

        wave.allowed_rounds.clear()
        response = admin.patch(details, {"event_round_counts": {self.event.name: 1}}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.competition.rounds.get().pk, first_round_id)
        response = admin.patch(details, {"event_round_counts": {self.event.name: 0}}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertTrue(Solve.objects.filter(competition_round_id=first_round_id).exists())

    def test_draft_is_hidden_until_published_and_hidden_again_after_unpublishing(self):
        public = APIClient()
        admin = APIClient()
        admin.force_authenticate(user=self.organizer)
        slug = "Club-Draft"
        detail = reverse("competition_info", args=[slug])
        round_results = reverse("round", args=[slug, self.event.name, 1])
        rankings = reverse("ranking_solves", args=[self.event.name, "single"])
        history = reverse("competitor_event_solves", args=[self.competitor.school_id, self.event.name])
        profile = reverse("competitor", args=[self.competitor.school_id])
        listing = reverse("all_competitions")
        visibility = reverse("update_competition_publication", args=[self.competition.pk])
        admin_detail = reverse("admin_competition_info", args=[slug])

        self.assertIn(public.get(admin_detail).status_code, [401, 403])
        self.assertIn(public.patch(visibility, {"is_published": True}, format="json").status_code, [401, 403])
        self.assertFalse(admin.get(admin_detail).json()["is_published"])
        self.assertEqual(public.get(listing).json(), [])
        self.assertEqual(public.get(detail).status_code, 404)
        self.assertEqual(public.get(round_results).status_code, 404)
        self.assertEqual(public.get(rankings).json(), [])
        self.assertEqual(public.get(history).json(), [])
        self.assertEqual(public.get(profile).json()["total_solves"], 0)

        self.assertEqual(admin.patch(visibility, {"is_published": True}, format="json").status_code, 200)
        self.assertEqual(public.get(detail).status_code, 200)
        self.assertEqual(public.get(round_results).status_code, 200)
        self.assertEqual(len(public.get(listing).json()), 1)
        self.assertEqual(len(public.get(rankings).json()), 1)
        self.assertEqual(len(public.get(history).json()), 1)
        self.assertEqual(public.get(profile).json()["total_solves"], 1)

        self.assertEqual(admin.patch(visibility, {"is_published": False}, format="json").status_code, 200)
        self.assertEqual(public.get(detail).status_code, 404)
        self.assertEqual(public.get(rankings).json(), [])
