from rest_framework import serializers


class EntrySelectionSerializer(serializers.Serializer):
    wave_id = serializers.IntegerField(min_value=1)
    round_id = serializers.IntegerField(min_value=1)


class AttendeeSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=511)
    entries = EntrySelectionSerializer(many=True, max_length=50)

    def validate_entries(self, entries):
        if len({item["wave_id"] for item in entries}) != len(entries):
            raise serializers.ValidationError("Choose at most one event per wave.")
        if len({item["round_id"] for item in entries}) != len(entries):
            raise serializers.ValidationError("Choose each event round only once.")
        return entries


class PublicCheckInSerializer(AttendeeSerializer):
    check_in_key = serializers.UUIDField()
    entries = EntrySelectionSerializer(many=True, allow_empty=False, max_length=50)


class WaveSettingsSerializer(serializers.Serializer):
    id = serializers.IntegerField(min_value=1, required=False)
    version = serializers.IntegerField(min_value=0, required=False)
    number = serializers.IntegerField(min_value=1, max_value=32767)
    name = serializers.CharField(max_length=255, allow_blank=True)
    station_count = serializers.IntegerField(min_value=1, max_value=100)
    scramblers_per_group = serializers.IntegerField(min_value=0, max_value=50)
    judges_per_group = serializers.IntegerField(min_value=0, max_value=100, allow_null=True, default=None)
    round_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False, max_length=100)

    def validate_round_ids(self, rounds):
        return list(dict.fromkeys(rounds))


class RecordIdSerializer(serializers.Serializer):
    id = serializers.IntegerField(min_value=1)


class EditAttendeeSerializer(AttendeeSerializer, RecordIdSerializer):
    pass


class WaveVersionSerializer(RecordIdSerializer):
    version = serializers.IntegerField(min_value=0)


class GroupStatusSerializer(WaveVersionSerializer):
    status = serializers.ChoiceField(choices=["active", "finished"])


class JudgeSerializer(WaveVersionSerializer):
    previous_attendee_id = serializers.IntegerField(min_value=1)
    attendee_id = serializers.IntegerField(min_value=1)


class ApproveEntrySerializer(WaveVersionSerializer):
    group_id = serializers.IntegerField(min_value=1, allow_null=True)
    judge_id = serializers.IntegerField(min_value=1, required=False)


class AttendanceStatusSerializer(RecordIdSerializer):
    is_present = serializers.BooleanField()


class ScramblerApprovalSerializer(serializers.Serializer):
    attendee_id = serializers.IntegerField(min_value=1)
    event_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), max_length=100)


class CheckInStatusSerializer(serializers.Serializer):
    closed = serializers.BooleanField()


class ShareQrSerializer(serializers.Serializer):
    origin = serializers.URLField(max_length=400)
