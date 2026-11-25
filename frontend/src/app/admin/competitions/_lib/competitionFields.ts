import type { CompetitionDetails, CompetitionDetailsErrors } from "../_components/CompetitionDetailsFields";

export const competitionFields = ["name", "location", "start_time", "end_time", "official", "official_link"] as const;
export const maxCompetitionRounds = 3;

export function validateCompetitionDetails(
    values: CompetitionDetails, fields: readonly (keyof CompetitionDetails)[] = competitionFields,
): CompetitionDetailsErrors {
    const errors: CompetitionDetailsErrors = {};
    if (fields.includes("name") && !values.name.trim()) errors.name = "Enter a competition name.";
    if (fields.includes("location") && !values.location.trim()) errors.location = "Enter a location.";
    if (fields.includes("start_time") && !values.start_time) errors.start_time = "Enter a start time.";
    if (fields.includes("end_time") && !values.end_time) errors.end_time = "Enter an end time.";
    if ((fields.includes("start_time") || fields.includes("end_time"))
        && values.start_time && values.end_time && values.end_time < values.start_time) {
        errors.end_time = "End time must be on or after start time.";
    }
    return errors;
}
