from competitions.models import Event, RoundType
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = "Seed database with test data"

    def handle(self, *args, **kwargs):
        # Create Events
        wca_events = {
            "3x3":     {"average_type": "average", "ranking_format": "average"},  # Average of 5
            "2x2":     {"average_type": "average", "ranking_format": "average"},
            "4x4":     {"average_type": "average", "ranking_format": "average"},
            "5x5":     {"average_type": "average", "ranking_format": "average"},
            "6x6":     {"average_type": "mean",    "ranking_format": "mean"},
            "7x7":     {"average_type": "mean",    "ranking_format": "mean"},
            "OH":      {"average_type": "average", "ranking_format": "average"},  # One-Handed
            "BLD":     {"average_type": "mean",    "ranking_format": "mean"},     # 3x3 Blindfolded
            "4BLD":    {"average_type": "mean",    "ranking_format": "mean"},
            "5BLD":    {"average_type": "mean",    "ranking_format": "mean"},
            "MBLD":    {"average_type": "single",  "ranking_format": "single"},   # Multi-Blind
            "FMC":     {"average_type": "mean",    "ranking_format": "mean"},     # Fewest Moves
            "Clock":   {"average_type": "average", "ranking_format": "average"},
            "Megaminx":{"average_type": "average", "ranking_format": "average"},
            "Pyraminx":{"average_type": "average", "ranking_format": "average"},
            "Skewb":   {"average_type": "average", "ranking_format": "average"},
            "Sq1":     {"average_type": "average", "ranking_format": "average"}   # Square-1
        }

        for name, props in wca_events.items():
            event, created = Event.objects.get_or_create(
                name=name,
                defaults={
                    "average_type": props["average_type"],
                    "ranking_format": props["ranking_format"],
                }
            )
            if not created:  # Already existed, so update it if mismatched
                if (event.average_type != props["average_type"] or
                    event.ranking_format != props["ranking_format"]):
                    event.average_type = props["average_type"]
                    event.ranking_format = props["ranking_format"]
                    event.save()
        round_types = [RoundType.objects.get_or_create(name=rt)[0] for rt in ["First", "Second", "Final"]]
