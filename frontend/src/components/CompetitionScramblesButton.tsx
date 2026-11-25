"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { ApiError, apiFetch } from "@/lib/api";

type ScrambleSet = {
    number: number;
    group: { number: number; wave_number: number; wave_name: string } | null;
    group_label?: string;
    scrambles: string[];
    extra_scrambles: string[];
};

type Props = { roundPath: string; event: string; round: number };

export default function CompetitionScramblesButton(props: Props) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}
                className="min-h-11 cursor-pointer whitespace-nowrap rounded-sm border border-slate-500/60 bg-transparent px-4 text-sm font-medium text-slate-200 transition-colors hover:border-slate-300 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300">
                View scrambles
            </button>
            {open && <ScramblesDialog {...props} onClose={() => setOpen(false)} />}
        </>
    );
}

function groupLabel({ number, group, group_label: customLabel }: ScrambleSet) {
    if (group === null) return customLabel || `Round only · ${number}`;
    const wave = group.wave_name ? `Wave ${group.wave_number} (${group.wave_name})` : `Wave ${group.wave_number}`;
    return `Group ${group.number} · ${wave}`;
}

function isBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return false;
    const { left, top, right, bottom } = event.currentTarget.getBoundingClientRect();
    return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom;
}

function ScramblesDialog({ roundPath, event, round, onClose }: Props & { onClose: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const pressedBackdrop = useRef(false);
    const titleId = useId();
    const [sets, setSets] = useState<ScrambleSet[] | null>(null);
    const [selected, setSelected] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const currentSet = sets?.find(set => set.number === selected) ?? sets?.[0];

    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);

    useEffect(() => {
        let active = true;
        apiFetch(`${roundPath}/scrambles`, { cache: "no-store" }).then((data: ScrambleSet[]) => {
            if (active) setSets(data);
        }).catch((failure: unknown) => {
            if (active) setError(failure instanceof ApiError && failure.status === 404
                ? "Scrambles are no longer available for this round."
                : "Could not load scrambles.");
        });
        return () => { active = false; };
    }, [roundPath, attempt]);

    return (
        <dialog ref={dialog} aria-labelledby={titleId}
            onCancel={event => { event.preventDefault(); onClose(); }}
            onPointerDown={event => { pressedBackdrop.current = isBackdrop(event); }}
            onClick={event => {
                if (pressedBackdrop.current && isBackdrop(event)) onClose();
                pressedBackdrop.current = false;
            }}
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
                            Group
                            <select value={currentSet.number} onChange={change => setSelected(Number(change.target.value))}
                                className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2.5">
                                {sets.map(set => <option key={set.number} value={set.number}>{groupLabel(set)}</option>)}
                            </select>
                        </label>
                    ) : (currentSet.group || currentSet.group_label) && <p className="text-sm text-slate-600">{groupLabel(currentSet)}</p>}
                    {currentSet.scrambles.length > 0 && <ScrambleList title="Scrambles" scrambles={currentSet.scrambles} />}
                    {currentSet.extra_scrambles.length > 0 && <ScrambleList title="Extra scrambles" scrambles={currentSet.extra_scrambles} />}
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
