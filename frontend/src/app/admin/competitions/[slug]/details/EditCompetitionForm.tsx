"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiBodyFetch } from "@/lib/api";
import { adminRequestError, errorFields, fieldErrorMessage } from "../../../_components/formErrors";
import CompetitionDetailsFields, {
    type CompetitionDetails,
    type CompetitionDetailsErrors,
} from "../../_components/CompetitionDetailsFields";
import { competitionFields, maxCompetitionRounds, validateCompetitionDetails } from "../../_lib/competitionFields";

type EventRounds = { name: string; rounds: number };

function countsByEvent(events: EventRounds[]) {
    return Object.fromEntries(events.map(({ name, rounds }) => [name, rounds]));
}

export default function EditCompetitionForm({ competitionId, slug, initialValues, events, availableEvents }: {
    competitionId: number;
    slug: string;
    initialValues: CompetitionDetails;
    events: EventRounds[];
    availableEvents: string[];
}) {
    const router = useRouter();
    const [savedValues, setSavedValues] = useState(initialValues);
    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState<CompetitionDetailsErrors>({});
    const [savedCounts, setSavedCounts] = useState(() => countsByEvent(events));
    const [roundCounts, setRoundCounts] = useState<Record<string, string>>({});
    const [roundErrors, setRoundErrors] = useState<Record<string, string | undefined>>({});
    const [message, setMessage] = useState("");
    const [saveError, setSaveError] = useState("");
    const [saving, setSaving] = useState(false);
    const eventNames = [...new Set([...availableEvents, ...Object.keys(savedCounts)])];
    const changedFields = competitionFields.filter(field => values[field] !== savedValues[field]);
    const editedCounts = Object.entries(roundCounts).filter(
        ([name, count]) => count !== String(savedCounts[name] ?? 0),
    );
    const hasChanges = changedFields.length > 0 || editedCounts.length > 0;

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        const { name, value, type, checked } = event.target;
        setValues(previous => ({ ...previous, [name]: type === "checkbox" ? checked : value }));
        setErrors(previous => ({
            ...previous, [name]: undefined,
            ...(name === "official" && !checked ? { official_link: undefined } : {}),
            ...(name === "start_time" ? { end_time: undefined } : {}),
        }));
        setMessage("");
        setSaveError("");
    }

    function cancelChanges() {
        setValues(savedValues);
        setRoundCounts({});
        setErrors({});
        setRoundErrors({});
        setMessage("");
        setSaveError("");
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving || !hasChanges) return;
        const validationErrors = validateCompetitionDetails(values, changedFields);
        setErrors(validationErrors);
        setRoundErrors({});
        setSaveError("");
        setMessage("");
        if (Object.keys(validationErrors).length) {
            setSaveError("Check the highlighted fields and try again.");
            return;
        }
        const submitted = {
            ...values,
            name: values.name.trim(),
            location: values.location.trim(),
            official_link: values.official ? values.official_link?.trim() || null : null,
        };
        const changes: Record<string, unknown> = Object.fromEntries(
            changedFields.filter(field => submitted[field] !== savedValues[field]).map(field => [field, submitted[field]]),
        );
        const countChanges = Object.fromEntries(
            editedCounts.filter(([name, count]) => Number(count) !== (savedCounts[name] ?? 0))
                .map(([name, count]) => [name, Number(count)]),
        );
        if (Object.keys(countChanges).length) changes.event_round_counts = countChanges;
        if (!Object.keys(changes).length) {
            cancelChanges();
            setMessage("No changes to save.");
            return;
        }

        setSaving(true);
        try {
            const saved: CompetitionDetails & { events: EventRounds[] } = await apiBodyFetch(
                `/competitions/admin/${competitionId}/details`, "PATCH", changes,
            );
            const updated = {
                name: saved.name,
                location: saved.location,
                start_time: saved.start_time.slice(0, 16),
                end_time: saved.end_time.slice(0, 16),
                official: saved.official,
                official_link: saved.official_link,
            };
            setValues(updated);
            setSavedValues(updated);
            setSavedCounts(countsByEvent(saved.events));
            setRoundCounts({});
            setMessage("Competition details saved.");
            const updatedSlug = saved.name.replace(/ /g, "-");
            if (updatedSlug !== slug) {
                router.replace(`/admin/competitions/${encodeURIComponent(updatedSlug)}/details`);
            } else {
                router.refresh();
            }
        } catch (failure) {
            const fallback = "Could not save competition details. Try again.";
            if (failure instanceof ApiError && failure.status === 400) {
                const details = errorFields(failure.details);
                const fieldErrors = Object.fromEntries(competitionFields.flatMap(field => {
                    const message = fieldErrorMessage(details[field]);
                    return message ? [[field, message]] : [];
                }));
                const countErrors = Object.fromEntries(
                    Object.entries(errorFields(details.event_round_counts)).map(([name, value]) => [name, fieldErrorMessage(value)]),
                );
                setErrors(fieldErrors);
                setRoundErrors(countErrors);
                const hasFieldErrors = Object.keys(fieldErrors).length || eventNames.some(name => countErrors[name]);
                const roundMessage = hasFieldErrors ? undefined : fieldErrorMessage(details.event_round_counts);
                setSaveError(adminRequestError(
                    failure, hasFieldErrors ? "Check the highlighted fields and try again." : roundMessage ?? fallback,
                ));
            } else {
                setSaveError(adminRequestError(failure, fallback));
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-neutral-900 shadow-xl shadow-black/25">
            <fieldset disabled={saving} className="grid min-w-0 md:grid-cols-[minmax(0,1fr)_15rem] lg:grid-cols-[minmax(0,1fr)_17rem]">
                <section aria-labelledby="competition-information" className="grid content-start gap-5 p-5 sm:p-8">
                    <h2 id="competition-information" className="text-xl font-bold sm:text-2xl">Competition information</h2>
                    <CompetitionDetailsFields values={values} errors={errors} onChange={handleChange} />
                </section>
                <section aria-labelledby="competition-events" className="min-w-0 border-t border-slate-200 bg-slate-100/70 p-5 md:border-t-0 md:border-l">
                    <h2 id="competition-events" className="text-xl font-bold sm:text-2xl">Events</h2>
                    <p className="mt-2 text-sm text-neutral-700">Number of rounds per event. Set to 0 to leave an event out.</p>
                    {eventNames.length === 0 ? (
                        <p className="mt-5 text-sm text-neutral-700">No events are available.</p>
                    ) : (
                        <div className="mt-4 divide-y divide-slate-200 md:max-h-96 md:overflow-y-auto md:pr-2">
                            {eventNames.map((name, index) => (
                                <div key={name} className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-x-3 gap-y-2 py-2">
                                    <label htmlFor={`event-rounds-${index}`} className="break-words text-sm font-semibold">{name}</label>
                                    <input
                                        id={`event-rounds-${index}`}
                                        type="number"
                                        min={0}
                                        max={Math.max(maxCompetitionRounds, savedCounts[name] ?? 0)}
                                        required
                                        value={roundCounts[name] ?? String(savedCounts[name] ?? 0)}
                                        aria-label={`${name} round count`}
                                        aria-invalid={roundErrors[name] ? true : undefined}
                                        aria-describedby={roundErrors[name] ? `event-rounds-error-${index}` : undefined}
                                        onChange={event => {
                                            setRoundCounts(previous => ({ ...previous, [name]: event.target.value }));
                                            setRoundErrors(previous => ({ ...previous, [name]: undefined }));
                                            setMessage("");
                                            setSaveError("");
                                        }}
                                        className={`min-h-10 w-full rounded-sm border px-1 text-center focus-visible:outline-2 focus-visible:outline-orange-700 ${roundErrors[name] ? "border-red-500 bg-red-50" : "border-slate-300 bg-white"}`}
                                    />
                                    {roundErrors[name] && <p id={`event-rounds-error-${index}`} className="col-span-2 text-sm text-red-700">{roundErrors[name]}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </fieldset>
            {(hasChanges || message || saveError) && (
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-8">
                    {message && <p role="status" className="mr-auto text-sm text-green-800">{message}</p>}
                    {saveError && <p role="alert" className="mr-auto text-sm text-red-700">{saveError}</p>}
                    {hasChanges && (
                        <>
                            <button type="button" onClick={cancelChanges} disabled={saving} className="min-h-11 rounded-sm border border-slate-300 px-4 py-2 text-sm font-semibold transition-colors hover:bg-slate-100 disabled:opacity-60">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving} className="min-h-11 rounded-sm bg-orange-300 px-5 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-admin-button-hover disabled:opacity-60">
                                {saving ? "Saving…" : "Save changes"}
                            </button>
                        </>
                    )}
                </div>
            )}
        </form>
    );
}
