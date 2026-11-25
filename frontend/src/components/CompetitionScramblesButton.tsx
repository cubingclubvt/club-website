"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";

type ScrambleSet = {
    number: number;
    group: { number: number; wave_number: number; wave_name: string } | null;
    scrambles: string[];
    extra_scrambles: string[];
};

type Props = { slug: string; event: string; round: number };

export default function CompetitionScramblesButton(props: Props) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}
                className="min-h-11 whitespace-nowrap rounded-sm bg-orange-300 px-4 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-orange-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300">
                View scrambles
            </button>
            {open && <ScramblesDialog {...props} onClose={() => setOpen(false)} />}
        </>
    );
}

function setLabel({ number, group }: ScrambleSet) {
    if (group === null) return `Set ${number} · Round only`;
    const wave = group.wave_name ? `Wave ${group.wave_number} (${group.wave_name})` : `Wave ${group.wave_number}`;
    return `${wave} · Group ${group.number}`;
}

function ScramblesDialog({ slug, event, round, onClose }: Props & { onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const [sets, setSets] = useState<ScrambleSet[] | null>(null);
    const [selected, setSelected] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const [copyMessage, setCopyMessage] = useState("");
    const currentSet = sets?.find(set => set.number === selected) ?? sets?.[0];

    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);

    useEffect(() => {
        let active = true;
        const path = `/competitions/${encodeURIComponent(slug)}/${encodeURIComponent(event)}/${round}/scrambles`;
        apiFetch(path, { cache: "no-store" }).then((data: ScrambleSet[]) => {
            if (active) setSets(data);
        }).catch((failure: unknown) => {
            if (active) setError(failure instanceof ApiError && failure.status === 404
                ? "Scrambles are no longer available for this round."
                : "Could not load scrambles.");
        });
        return () => { active = false; };
    }, [slug, event, round, attempt]);

    async function copySet() {
        if (!currentSet) return;
        const text = [currentSet.scrambles, currentSet.extra_scrambles]
            .filter(lines => lines.length).map(lines => lines.join("\n")).join("\n\n");
        try {
            await navigator.clipboard.writeText(text);
            setCopyMessage("Scrambles copied.");
        } catch {
            setCopyMessage("Could not copy automatically. You can select and copy the text.");
        }
    }

    return (
        <dialog ref={dialog} aria-labelledby={titleId}
            onCancel={event => { event.preventDefault(); onClose(); }}
            className="m-auto max-h-[88dvh] w-11/12 max-w-2xl overflow-y-auto rounded-md border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/65 sm:p-7">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <h2 id={titleId} className="text-xl font-bold sm:text-2xl">{event} · Round {round} scrambles</h2>
                <button type="button" onClick={onClose}
                    className="min-h-10 rounded-sm border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-100">
                    Close
                </button>
            </header>
            {!sets && !error && <p role="status" className="mt-5 text-sm text-slate-600">Loading scrambles…</p>}
            {error && (
                <p role="alert" className="mt-5 text-sm text-red-700">
                    {error} <button type="button" className="font-semibold underline"
                        onClick={() => { setError(""); setAttempt(previous => previous + 1); }}>Retry</button>
                </p>
            )}
            {sets?.length === 0 && <p className="mt-5 text-sm text-slate-600">No scrambles are available for this round.</p>}
            {currentSet && (
                <div className="space-y-5 pt-5">
                    {sets && sets.length > 1 ? (
                        <label className="block text-sm font-semibold">
                            Scramble set
                            <select value={currentSet.number} onChange={change => {
                                setSelected(Number(change.target.value));
                                setCopyMessage("");
                            }} className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2.5">
                                {sets.map(set => <option key={set.number} value={set.number}>{setLabel(set)}</option>)}
                            </select>
                        </label>
                    ) : (
                        <p className="text-sm text-slate-600">{setLabel(currentSet)}</p>
                    )}
                    {currentSet.scrambles.length > 0 && <ScrambleList title="Scrambles" scrambles={currentSet.scrambles} />}
                    {currentSet.extra_scrambles.length > 0 && <ScrambleList title="Extra scrambles" scrambles={currentSet.extra_scrambles} />}
                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={copySet}
                            className="min-h-10 rounded-sm bg-orange-300 px-4 text-sm font-semibold hover:bg-orange-200">
                            Copy scrambles
                        </button>
                        <p role="status" className="text-sm text-slate-600">{copyMessage}</p>
                    </div>
                </div>
            )}
        </dialog>
    );
}

function ScrambleList({ title, scrambles }: { title: string; scrambles: string[] }) {
    return (
        <section>
            <h3 className="font-semibold">{title}</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-7 text-sm">
                {scrambles.map((scramble, index) => (
                    <li key={index} className="whitespace-pre-wrap break-words pl-1">{scramble}</li>
                ))}
            </ol>
        </section>
    );
}
