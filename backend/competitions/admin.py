from django.contrib import admin

from .models import *

admin.site.register(Competitor)
admin.site.register(Competition)
admin.site.register(CompetitionRound)
admin.site.register(Solve)
admin.site.register(Event)
admin.site.register(RoundType)



# Register your models here.
