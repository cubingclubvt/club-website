"use client";

import { useEffect, useState, Suspense, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, apiBodyFetch, apiFetch } from "@/lib/api";
import type { Event } from "@/types/Event";
import AdminCreatePage, { AdminCreateSuccess } from "../../_components/AdminCreatePage";
import { adminRequestError, errorFields, fieldErrorMessage } from "../../_components/formErrors";
import CompetitionDetailsFields, {
    type CompetitionDetails,
    type CompetitionDetailsErrors,
} from "../_components/CompetitionDetailsFields";
import { competitionFields, maxCompetitionRounds, validateCompetitionDetails } from "../_lib/competitionFields";

type FormErrors = CompetitionDetailsErrors & { events?: string };
type RoundErrors = Partial<Record<Event, string>>;

function SubmissionForm() {
    const secret = useSearchParams().get("secret");
    const [values, setValues] = useState<CompetitionDetails>({
        name: "", location: "", start_time: "", end_time: "", official: false, official_link: "",
    });
    const [roundCounts, setRoundCounts] = useState<Partial<Record<Event, string>>>({});
    const [eventOptions, setEventOptions] = useState<Event[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [eventLoadError, setEventLoadError] = useState("");
    const [eventRetry, setEventRetry] = useState(0);
    const [errors, setErrors] = useState<FormErrors>({});
    const [roundErrors, setRoundErrors] = useState<RoundErrors>({});
    const [saveError, setSaveError] = useState("");
    const [saving, setSaving] = useState(false);
    const [createdName, setCreatedName] = useState("");

    useEffect(() => {
        let active = true;
        apiFetch("/competitions/rankings/").then(({ events }: { events: Event[] }) => {
            if (active) setEventOptions(events);
        }).catch(() => {
            if (active) setEventLoadError("Could not load the events.");
        }).finally(() => {
            if (active) setLoadingEvents(false);
        });
        return () => { active = false; };
    }, [eventRetry]);

    function changeField(event: ChangeEvent<HTMLInputElement>) {
        const { name, value, type, checked } = event.target;
        setValues(previous => ({ ...previous, [name]: type === "checkbox" ? checked : value }));
        setErrors(previous => ({
            ...previous, [name]: undefined,
            ...(name === "official" && !checked ? { official_link: undefined } : {}),
            ...(name === "start_time" ? { end_time: undefined } : {}),
        }));
        setSaveError("");
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving || loadingEvents || eventLoadError) return;

        const nextErrors: FormErrors = validateCompetitionDetails(values);
        const nextRoundErrors: RoundErrors = {};
        const events = [];
        for (const [index, name] of eventOptions.entries()) {
            const input = event.currentTarget.elements.namedItem(`create-rounds-${index}`);
            const count = Number(roundCounts[name] ?? "");
            const badInput = input instanceof HTMLInputElement && input.validity.badInput;
            if (badInput || !Number.isInteger(count) || count < 0 || count > maxCompetitionRounds) {
                nextRoundErrors[name] = `Enter a whole number from 0 to ${maxCompetitionRounds}.`;
            } else if (count > 0) {
                events.push({ "event-name": name, Rounds: count });
            }
        }
        if (!events.length && !Object.keys(nextRoundErrors).length) {
            nextErrors.events = "Enter at least one event with one or more rounds.";
        }
        setErrors(nextErrors);
        setRoundErrors(nextRoundErrors);
        setSaveError("");
        if (Object.keys(nextErrors).length || Object.keys(nextRoundErrors).length) {
            setSaveError("Check the highlighted fields and try again.");
            return;
        }

        setSaving(true);
        try {
            const path = secret === null ? "/competitions/create" : `/competitions/create?secret=${encodeURIComponent(secret)}`;
            const created: { name: string } = await apiBodyFetch(path, "POST", {
                ...values,
                official_link: values.official ? values.official_link?.trim() || null : null,
                events,
                competitors: [],
            });
            setCreatedName(created.name);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (failure) {
            const fallback = "Could not create the competition. Try again.";
            if (failure instanceof ApiError && failure.status === 400) {
                const details = errorFields(failure.details);
                const fields = Object.fromEntries(competitionFields.flatMap(name => {
                    const message = fieldErrorMessage(details[name]);
                    return message ? [[name, message]] : [];
                }));
                const issues = errorFields(details.events);
                const byEvent = Object.fromEntries(eventOptions.flatMap(name => {
                    const message = fieldErrorMessage(issues[name]);
                    return message ? [[name, message]] : [];
                }));
                const unmatched = Object.entries(issues).filter(([name]) => !(name in byEvent));
                const eventError = Object.keys(issues).length
                    ? fieldErrorMessage(unmatched.map(([, issue]) => issue))
                    : fieldErrorMessage(details.events);
                setErrors({ ...fields, events: eventError });
                setRoundErrors(byEvent);
                const hasFieldErrors = Object.keys(fields).length || Object.keys(byEvent).length || eventError;
                setSaveError(adminRequestError(failure, hasFieldErrors ? "Check the highlighted fields and try again." : fallback));
            } else {
                setSaveError(adminRequestError(failure, fallback));
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminCreatePage title="Create a Competition">
            {createdName ? (
                <AdminCreateSuccess message="Competition created" name={createdName}
                    href={`/admin/competitions/${encodeURIComponent(createdName.replace(/ /g, "-"))}`} />
            ) : (
                <form noValidate onSubmit={submit} className="space-y-8 p-8">
                    <fieldset disabled={saving} className="grid min-w-0 gap-6">
                        <CompetitionDetailsFields values={values} errors={errors} onChange={changeField} />
                        <fieldset className="min-w-0" aria-describedby={errors.events ? "create-events-error" : undefined}>
                            <legend className="mx-auto mb-2 text-center text-sm font-medium text-gray-700">Events (# of rounds)</legend>
                            {loadingEvents && <p role="status" className="text-center text-sm text-gray-600">Loading events…</p>}
                            {eventLoadError && (
                                <p role="alert" className="text-center text-sm text-red-700">
                                    {eventLoadError}{" "}
                                    <button type="button" className="font-semibold underline" onClick={() => {
                                        setEventLoadError("");
                                        setLoadingEvents(true);
                                        setEventRetry(previous => previous + 1);
                                    }}>Retry</button>
                                </p>
                            )}
                            {!loadingEvents && !eventLoadError && !eventOptions.length && (
                                <p role="alert" className="text-center text-sm text-red-700">No events are available.</p>
                            )}
                            {errors.events && <p id="create-events-error" className="mb-3 text-center text-sm text-red-700">{errors.events}</p>}
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
                                {eventOptions.map((name, index) => {
                                    const id = `create-rounds-${index}`;
                                    const error = roundErrors[name];
                                    return (
                                        <div key={name}>
                                            <label htmlFor={id} className="mb-2 block text-center text-sm font-medium text-gray-700">{name}</label>
                                            <input type="number" id={id} value={roundCounts[name] ?? ""}
                                                min={0} max={maxCompetitionRounds} aria-label={`${name} round count`}
                                                aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
                                                onChange={event => {
                                                    const value = event.target.value;
                                                    setRoundCounts(previous => ({ ...previous, [name]: value }));
                                                    setErrors(previous => ({ ...previous, events: undefined }));
                                                    setRoundErrors(previous => ({ ...previous, [name]: undefined }));
                                                    setSaveError("");
                                                }}
                                                className={`w-full rounded-lg border px-4 py-3 text-black focus:ring focus:ring-blue-500 ${error ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                                            />
                                            {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </fieldset>
                    </fieldset>
                    <div className="space-y-3 text-center">
                        <button type="submit" disabled={saving || loadingEvents || !!eventLoadError || !eventOptions.length}
                            className="rounded-md bg-slate-900 px-8 py-4 font-semibold text-white transition-all enabled:cursor-pointer enabled:hover:scale-105 disabled:opacity-50">
                            {saving ? "Creating…" : "Create"}
                        </button>
                        {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
                    </div>
                </form>
            )}
        </AdminCreatePage>
    );
}

export default function Page() {
    return <Suspense fallback={<div>Loading...</div>}><SubmissionForm /></Suspense>;
}
