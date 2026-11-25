"use client";

import { useState, Suspense, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, apiBodyFetch } from "@/lib/api";
import AdminCreatePage, { AdminCreateSuccess } from "../../_components/AdminCreatePage";
import { adminRequestError, errorFields, fieldErrorMessage } from "../../_components/formErrors";

const fields = [
    { name: "first_name", label: "First Name" },
    { name: "last_name", label: "Last Name" },
    { name: "school_id", label: "School ID" },
    { name: "grade", label: "Grade" },
] as const;

type Field = typeof fields[number]["name"];
type FormErrors = Partial<Record<Field, string>>;
type CreatedCompetitor = Omit<Record<Field, string>, "grade">;

function SubmissionForm() {
    const secret = useSearchParams().get("secret");
    const [values, setValues] = useState<Record<Field, string>>({
        first_name: "", last_name: "", school_id: "", grade: "",
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [saveError, setSaveError] = useState("");
    const [saving, setSaving] = useState(false);
    const [created, setCreated] = useState<CreatedCompetitor | null>(null);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        const nextErrors: FormErrors = {};
        if (!values.first_name.trim()) nextErrors.first_name = "Enter a first name.";
        if (!values.last_name.trim()) nextErrors.last_name = "Enter a last name.";
        if (!values.school_id.trim()) nextErrors.school_id = "Enter a school ID.";
        if (!values.grade) nextErrors.grade = "Enter a grade.";
        else if (!Number.isInteger(Number(values.grade))) nextErrors.grade = "Enter a whole number.";
        setErrors(nextErrors);
        setSaveError("");
        if (Object.keys(nextErrors).length) {
            setSaveError("Check the highlighted fields and try again.");
            return;
        }

        setSaving(true);
        try {
            const path = secret === null ? "/competitions/competitor/create"
                : `/competitions/competitor/create?secret=${encodeURIComponent(secret)}`;
            const competitor: CreatedCompetitor = await apiBodyFetch(path, "POST", { ...values, grade: Number(values.grade) });
            setCreated(competitor);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (failure) {
            const fallback = "Could not create the competitor. Try again.";
            if (failure instanceof ApiError && failure.status === 400) {
                const details = errorFields(failure.details);
                const fieldErrors = Object.fromEntries(fields.flatMap(({ name }) => {
                    const message = fieldErrorMessage(details[name]);
                    return message ? [[name, message]] : [];
                }));
                setErrors(fieldErrors);
                setSaveError(adminRequestError(failure, Object.keys(fieldErrors).length
                    ? "Check the highlighted fields and try again." : fallback));
            } else {
                setSaveError(adminRequestError(failure, fallback));
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminCreatePage title="Create a Competitor">
            {created ? (
                <AdminCreateSuccess message="Competitor created" name={`${created.first_name} ${created.last_name}`}
                    href={`/competitors/${encodeURIComponent(created.school_id)}`} />
            ) : (
                <form noValidate onSubmit={submit} className="space-y-8 p-8">
                    <fieldset disabled={saving} className="grid min-w-0 gap-6">
                        {fields.map(({ name, label }) => {
                            const id = `create-competitor-${name}`;
                            const error = errors[name];
                            return (
                                <div key={name}>
                                    <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
                                    <input id={id} name={name} type={name === "grade" ? "number" : "text"} value={values[name]}
                                        required aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
                                        onChange={event => {
                                            const value = event.target.value;
                                            setValues(previous => ({ ...previous, [name]: value }));
                                            setErrors(previous => ({ ...previous, [name]: undefined }));
                                            setSaveError("");
                                        }}
                                        className={`w-full rounded-lg border px-4 py-3 text-black focus:ring-2 focus:ring-blue-500 ${error ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                                    />
                                    {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>}
                                </div>
                            );
                        })}
                    </fieldset>
                    <div className="space-y-3 text-center">
                        <button type="submit" disabled={saving}
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
