"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiBodyFetch, apiFetch } from "@/lib/api";
import AdminEditDialog from "../../../_components/AdminEditDialog";

const confirmationCounts = {
    solves: "Solves to delete",
    competitors_with_solves: "Competitors with solves",
    check_ins: "Check-ins",
} as const;

const reviewCounts = {
    ...confirmationCounts,
    rounds: "Event rounds",
    scramble_sets: "Scramble sets",
    scrambler_approvals: "Scrambler approvals",
    waves: "Waves",
    wave_entries: "Wave entries",
    groups: "Groups",
    group_assignments: "Group assignments",
} as const;

type DeletionSummary = {
    name: string;
    is_published: boolean;
    counts: Record<keyof typeof reviewCounts, number>;
    version: string;
};

export default function DeleteCompetition({ competitionId }: { competitionId: number }) {
    const [open, setOpen] = useState(false);

    return (
        <section aria-labelledby="deletion-heading" className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md border border-red-200 bg-slate-50 px-5 py-5 text-neutral-900 shadow-md shadow-black/20 sm:px-8">
            <div>
                <h2 id="deletion-heading" className="text-lg font-bold">Delete competition</h2>
                <p className="mt-2 text-sm text-slate-600">Permanently removes this competition, including all of its solves.</p>
            </div>
            <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-sm border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
                Delete competition
            </button>
            {open && <DeletionDialog competitionId={competitionId} onClose={() => setOpen(false)} />}
        </section>
    );
}

function DeletionDialog({ competitionId, onClose }: { competitionId: number; onClose: () => void }) {
    const path = `/competitions/admin/${competitionId}/deletion`;
    const [summary, setSummary] = useState<DeletionSummary | null>(null);
    const [retry, setRetry] = useState(0);
    const [confirming, setConfirming] = useState(false);
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const nameInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let active = true;
        apiFetch(path, { cache: "no-store" }).then((data: DeletionSummary) => {
            if (active) setSummary(data);
        }).catch(() => {
            if (active) setError("Could not load the deletion summary.");
        });
        return () => { active = false; };
    }, [path, retry]);

    useEffect(() => {
        if (confirming) nameInput.current?.focus();
    }, [confirming]);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!summary || saving) return;
        setError("");
        if (!confirming) {
            setConfirming(true);
            return;
        }
        if (name !== summary.name) return;

        setSaving(true);
        try {
            await apiBodyFetch(path, "DELETE", { name, version: summary.version });
            window.location.replace(summary.is_published ? "/admin/competitions?status=published" : "/admin/competitions");
        } catch (failure) {
            const details = failure instanceof ApiError
                ? failure.details as { summary?: DeletionSummary; detail?: string; name?: string[] } | undefined
                : undefined;
            if (failure instanceof ApiError && failure.status === 409 && details?.summary) {
                setSummary(details.summary);
                setConfirming(false);
                setName("");
            }
            setError(details?.detail ?? details?.name?.[0] ?? "Could not delete the competition. Reload the page before trying again.");
            setSaving(false);
        }
    }

    return (
        <AdminEditDialog
            title={confirming ? "Confirm permanent deletion" : "Review competition deletion"}
            description={summary ? `${summary.name} · ${summary.is_published ? "Published" : "Unpublished"}` : undefined}
            onClose={onClose} onSubmit={submit} saving={saving} disabled={!summary || (confirming && name !== summary.name)}
            error={error} destructive={confirming} size="medium"
            submitLabel={confirming ? "Permanently delete" : "Continue to confirmation"} savingLabel="Deleting…"
        >
            {summary ? (
                <div className="space-y-4">
                    <p className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">
                        This permanently deletes the competition and all of its solves.
                    </p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {Object.entries(confirming ? confirmationCounts : reviewCounts).map(([key, label]) => (
                            <div key={key} className="flex justify-between gap-2 border-b border-slate-200 pb-1">
                                <dt>{label}</dt>
                                <dd className="font-semibold tabular-nums">
                                    {summary.counts[key as keyof typeof reviewCounts]?.toLocaleString() ?? "Unavailable"}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    {confirming ? (
                        <label className="block space-y-2 text-sm">
                            <span>Type <strong>{summary.name}</strong> exactly to confirm.</span>
                            <input
                                ref={nameInput}
                                type="text"
                                autoComplete="off"
                                spellCheck={false}
                                required
                                value={name}
                                onChange={event => setName(event.target.value)}
                                className="block w-full rounded-sm border border-slate-300 bg-white px-3 py-2.5"
                            />
                        </label>
                    ) : (
                        <p className="text-sm text-slate-600">
                            Check-ins and scored results are counted separately. Competitor profiles and results from other competitions are kept.
                        </p>
                    )}
                </div>
            ) : error ? (
                <button type="button" onClick={() => { setError(""); setRetry(attempt => attempt + 1); }}
                    className="text-sm font-semibold underline">Retry loading summary</button>
            ) : <p role="status" className="text-sm text-slate-600">Loading deletion summary…</p>}
        </AdminEditDialog>
    );
}
