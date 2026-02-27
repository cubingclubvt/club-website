from django.core.management.base import BaseCommand
from competitions.models import Competitor, Competition, Event, RoundType, CompetitionRound, Solve
from faker import Faker
from random import randint, choice
from datetime import timedelta, datetime

fake = Faker()

class Command(BaseCommand):
    help = "Seed database with test data"

    def handle(self, *args, **kwargs):
        # Create Events
        event_names = ["3x3", "2x2", "4x4", "Pyraminx", "Skewb", "Clock"]
        events = [Event.objects.get_or_create(name=name,
                                              average_type="average",
                                              ranking_format="average")[0] for name in event_names]

        # Create Round Types
        round_types = [RoundType.objects.get_or_create(name=rt)[0] for rt in ["First", "Second", "Final"]]

        # Create Competitors
        competitors = []
        for _ in range(20):
            rand_first_name=fake.first_name()
            rand_last_name=fake.last_name()

            competitors.append(Competitor.objects.create(
                first_name=rand_first_name,
                last_name=rand_last_name,
                school_id= f"{rand_first_name}_{rand_last_name}_01",
                grade=randint(9, 12)
            ))

        # Create Competitions
        for _ in range(3):
            start = fake.date_time_this_year()
            end = start + timedelta(hours=6)

            competition = Competition.objects.create(
                name=fake.city() + " Open",
                location=fake.address(),
                official=bool(randint(0, 1)),
                start_time=start,
                end_time=end
            )

            for event in events[:3]:  # 3 events per competition
                for i, rt in enumerate(round_types):
                    round_obj = CompetitionRound.objects.create(
                        number=i+1,
                        competition=competition,
                        event=event,
                        round_type=rt
                    )

                    for competitor in competitors:
                        if randint(0, 10) < 8:  # 80% chance to compete
                            for i in range(5):  # Each gets 5 solves
                                time = None if randint(0, 20) == 0 else timedelta(seconds=randint(10, 45))
                                Solve.objects.create(
                                    competitor=competitor,
                                    competition_round=round_obj,
                                    solve_time=time,
                                    solve_number=i+1
                                )
        self.stdout.write(self.style.SUCCESS("✅ Database seeded successfully!"))
