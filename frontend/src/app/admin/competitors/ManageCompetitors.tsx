"use client";

import { useState, type FormEvent } from "react";
import { ApiError, apiBodyFetch } from "@/lib/api";
import AdminEditDialog from "../_components/AdminEditDialog";
import AdminPagination from "../_components/AdminPagination";
import CompetitorSearch from "../_components/CompetitorSearch";
import useAdminPage from "../_components/useAdminPage";

type Competitor = { id: number; first_name: string; last_name: string; school_id: string; grade: number; updated_at: string };
const rosterPath = "/competitions/admin/competitors/";
const inputClass = "w-full rounded-sm border border-slate-300 bg-white px-3 py-2.5 text-slate-900";

export default function ManageCompetitors() {
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [action, setAction] = useState<{ kind: "edit" | "remove"; competitor: Competitor } | null>(null);
    const [notice, setNotice] = useState("");
    const params = new URLSearchParams({ page: String(page), search: query });
    const { data, error, reload } = useAdminPage<Competitor>(`${rosterPath}?${params}`, "Could not load competitors.");

    function applySearch(search: string) {
        setQuery(search);
        setPage(1);
        setNotice("");
        reload();
    }

    function finishAction() {
        setNotice(action?.kind === "remove" ? "Competitor removed." : "Competitor updated.");
        setAction(null);
        if (data) setPage(data.page);
        reload();
    }

    return (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-5 text-slate-900 shadow-md shadow-black/20 sm:p-8">
            <CompetitorSearch query={query} onSearch={applySearch} onReload={() => { setNotice(""); reload(); }} />
            {notice && <p role="status" className="mb-3 text-sm text-emerald-800">{notice}</p>}
            {error && <p role="alert" className="text-sm text-red-700">{error} <button type="button" onClick={reload} className="underline">Retry</button></p>}
            {!data && !error && <p role="status" className="text-sm text-slate-600">Loading competitors…</p>}
            {data?.results.length === 0 && <p className="text-sm text-slate-600">{query ? "No matching competitors." : "No competitors yet."}</p>}
            {data && data.results.length > 0 && (
                <>
                    <ul className="overflow-hidden rounded-sm border border-slate-200 bg-white">
                        {data.results.map(competitor => (
                            <li key={competitor.id} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-slate-200 px-4 py-3.5 last:border-b-0">
                                <div className="min-w-0">
                                    <h2 className="break-words font-bold">{competitor.first_name} {competitor.last_name}</h2>
                                    <p className="break-words text-sm text-slate-600">{competitor.school_id} · Grade {competitor.grade}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setAction({ kind: "edit", competitor })}
                                        aria-label={`Edit ${competitor.first_name} ${competitor.last_name} (${competitor.school_id})`}
                                        className="min-h-10 rounded-sm border border-slate-200 px-3 text-sm font-semibold hover:bg-orange-100">
                                        Edit
                                    </button>
                                    <button type="button" onClick={() => setAction({ kind: "remove", competitor })}
                                        aria-label={`Remove ${competitor.first_name} ${competitor.last_name} (${competitor.school_id})`}
                                        className="min-h-10 rounded-sm px-3 text-sm font-semibold text-red-700 hover:bg-red-50">
                                        Remove
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <AdminPagination page={data.page} totalPages={data.total_pages} onPageChange={nextPage => {
                        setNotice("");
                        setPage(nextPage);
                    }} />
                </>
            )}
            {action?.kind === "edit" && (
                <CompetitorDialog competitor={action.competitor} onClose={() => setAction(null)} onSaved={finishAction} />
            )}
            {action?.kind === "remove" && (
                <RemoveCompetitorDialog competitor={action.competitor} onClose={() => setAction(null)} onRemoved={finishAction} />
            )}
        </div>
    );
}

function RemoveCompetitorDialog({ competitor, onClose, onRemoved }: {
    competitor: Competitor;
    onClose: () => void;
    onRemoved: () => void;
}) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function remove(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        setError("");
        try {
            await apiBodyFetch(`${rosterPath}${competitor.id}`, "DELETE", { updated_at: competitor.updated_at });
            onRemoved();
        } catch (failure) {
            const details = failure instanceof ApiError ? failure.details : undefined;
            const message = details && typeof details === "object" && "detail" in details ? details.detail : undefined;
            setError(typeof message === "string" ? message : "Could not remove the competitor. Reload the list before trying again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminEditDialog
            title="Remove competitor?"
            description={`${competitor.first_name} ${competitor.last_name} · ${competitor.school_id}`}
            onClose={onClose} onSubmit={remove} saving={saving} error={error} destructive
            submitLabel="Remove competitor" savingLabel="Removing…"
        >
            <p className="text-sm">This permanently removes the competitor from the roster. Competitors with linked competition records are protected.</p>
        </AdminEditDialog>
    );
}

const fields = [
    { name: "first_name", label: "First name", layout: "sm:col-span-3" },
    { name: "last_name", label: "Last name", layout: "sm:col-span-3" },
    { name: "school_id", label: "School ID", layout: "sm:col-span-4" },
    { name: "grade", label: "Grade", layout: "sm:col-span-2" },
] as const;

function CompetitorDialog({ competitor, onClose, onSaved }: {
    competitor: Competitor;
    onClose: () => void;
    onSaved: () => void;
}) {
    const initial = {
        first_name: competitor.first_name, last_name: competitor.last_name,
        school_id: competitor.school_id, grade: String(competitor.grade),
    };
    const [values, setValues] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const changes = Object.fromEntries(fields.flatMap(({ name }) => {
        const value = values[name].trim();
        return values[name] === initial[name] || value === initial[name] ? [] : [[name, name === "grade" ? Number(value) : value]];
    }));
    const hasChanges = Object.keys(changes).length > 0;

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving || !hasChanges) return;
        setSaving(true);
        setError("");
        setFieldErrors({});
        try {
            await apiBodyFetch(`${rosterPath}${competitor.id}`, "PATCH", {
                ...changes, updated_at: competitor.updated_at,
            });
            onSaved();
        } catch (failure) {
            if (failure instanceof ApiError && failure.status === 400 && failure.details && typeof failure.details === "object") {
                setFieldErrors(Object.fromEntries(Object.entries(failure.details).map(
                    ([name, messages]) => [name, Array.isArray(messages) ? messages.join(" ") : String(messages)],
                )));
                setError("Check the highlighted fields and save again.");
            } else if (failure instanceof ApiError && failure.status === 409) {
                setError("This competitor changed. Close the dialog and reload the list before editing again.");
            } else {
                setError("Could not save the competitor. Try again.");
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminEditDialog
            title="Edit competitor"
            description={`${competitor.first_name} ${competitor.last_name} · ${competitor.school_id}`}
            size="medium"
            onClose={onClose} onSubmit={save} saving={saving} disabled={!hasChanges} error={error}
        >
            <div className="grid gap-y-5 sm:grid-cols-6 sm:gap-x-5">
                {fields.map(({ name, label, layout }) => (
                    <div key={name} className={`min-w-0 ${layout}`}>
                        <label htmlFor={`edit-competitor-${name}`} className="mb-2 block text-sm font-semibold">{label}</label>
                        <input
                            id={`edit-competitor-${name}`}
                            className={inputClass}
                            type={name === "grade" ? "number" : "text"}
                            maxLength={name === "grade" ? undefined : 255}
                            required
                            value={values[name]}
                            aria-invalid={fieldErrors[name] ? true : undefined}
                            aria-describedby={fieldErrors[name] ? `competitor-field-error-${name}` : undefined}
                            onChange={event => {
                                const value = event.target.value;
                                setValues(previous => ({ ...previous, [name]: value }));
                                setFieldErrors(previous => ({ ...previous, [name]: "" }));
                                setError("");
                            }}
                        />
                        {fieldErrors[name] && <p id={`competitor-field-error-${name}`} className="mt-1 text-xs text-red-700">{fieldErrors[name]}</p>}
                    </div>
                ))}
            </div>
        </AdminEditDialog>
    );
}
