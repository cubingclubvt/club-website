"use client";

import { useRef, useState, type FormEvent } from "react";
import { ApiError, apiBodyFetch } from "@/lib/api";
import CompetitionRoundPicker from "../../../_components/CompetitionRoundPicker";
import SolveTimeFields from "../../../_components/SolveTimeFields";
import useRoundSolves from "../../../_components/useRoundSolves";
import { competitorName, roundSolvesPath, solveTimeErrors, type RecordedSolve, type SolveCompetitor, type SolveRound } from "../../../_lib/solves";
import roundRequestError from "../../../_lib/roundRequestError";

const primaryButton = "min-h-11 rounded-sm bg-orange-300 px-4 py-2 font-semibold text-neutral-900 hover:bg-admin-button-hover disabled:opacity-50";
const inputClass = "mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2.5 text-slate-900";

export default function AddSolves({ competitionId, rounds, competitors }: {
    competitionId: number;
    rounds: SolveRound[];
    competitors: SolveCompetitor[];
}) {
    const [event, setEvent] = useState("");
    const [roundId, setRoundId] = useState<number | null>(null);
    const [entering, setEntering] = useState(false);
    const round = rounds.find(option => option.id === roundId);

    return (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-5 text-slate-900 shadow-md shadow-black/20 sm:p-8">
            {entering && round ? (
                <AddResultForm key={round.id} path={roundSolvesPath(competitionId, round.id)} round={round} competitors={competitors} onBack={() => setEntering(false)} />
            ) : (
                <form onSubmit={submit => { submit.preventDefault(); if (round) setEntering(true); }} className="space-y-5">
                    <h2 className="text-xl font-bold">Choose an event and round</h2>
                    <CompetitionRoundPicker rounds={rounds} event={event} roundId={roundId} onEventChange={name => { setEvent(name); setRoundId(null); }} onRoundChange={setRoundId} />
                    <div className="flex justify-end">
                        <button type="submit" className={primaryButton} disabled={!round}>Next</button>
                    </div>
                </form>
            )}
        </div>
    );
}

function AddResultForm({ path, round, competitors, onBack }: {
    path: string;
    round: SolveRound;
    competitors: SolveCompetitor[];
    onBack: () => void;
}) {
    const { solves, setSolves, error: loadError, reload } = useRoundSolves(path);
    const [search, setSearch] = useState("");
    const [competitor, setCompetitor] = useState<SolveCompetitor | null>(null);
    const [times, setTimes] = useState<string[]>(() => Array(round.attempt_limit).fill(""));
    const [timeErrors, setTimeErrors] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [lastSaved, setLastSaved] = useState("");
    const searchInput = useRef<HTMLInputElement>(null);
    const timeInput = useRef<HTMLInputElement>(null);

    const searchWords = search.trim().toLowerCase().split(/\s+/);
    const recorded = new Set(solves?.map(solve => solve.competitor.id));
    const matches = search.trim() ? competitors.filter(person => {
        const searchable = `${competitorName(person)} ${person.school_id}`.toLowerCase();
        return searchWords.every(word => searchable.includes(word));
    }).sort((a, b) => Number(recorded.has(a.id)) - Number(recorded.has(b.id))).slice(0, 8) : [];
    const alreadyEntered = competitor !== null && recorded.has(competitor.id);
    const canSubmit = solves !== null && competitor !== null && !alreadyEntered && times.every(time => time.trim());

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!competitor || !canSubmit || saving) return;
        setSaving(true);
        setError("");
        setTimeErrors({});
        setLastSaved("");
        try {
            const saved: RecordedSolve[] = await apiBodyFetch(path, "POST", {
                competitor_id: competitor.id, times,
            });
            setSolves(previous => [...(previous ?? []), ...saved]);
            setLastSaved(`Saved ${saved.length} times for ${competitorName(competitor)}.`);
            setCompetitor(null);
            setTimes(Array(round.attempt_limit).fill(""));
            setSearch("");
            requestAnimationFrame(() => searchInput.current?.focus());
        } catch (failure) {
            const issues = solveTimeErrors(failure);
            if (Object.keys(issues).length) {
                setTimeErrors(issues);
                setError("Check the highlighted times and save again.");
            } else {
                setError(roundRequestError(failure, "Could not confirm the save. Check the current round before trying again."));
            }
            if (!(failure instanceof ApiError) || failure.status === 409 || failure.status >= 500) {
                reload();
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={submit} className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <h2 className="text-xl font-bold">{round.event} · Round {round.number}</h2>
                <button type="button" onClick={onBack} disabled={saving} className="rounded-sm border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50">
                    ← Change event or round
                </button>
            </div>
            {lastSaved && <p role="status" className="rounded-sm bg-emerald-100 px-4 py-3 text-sm text-emerald-900">{lastSaved}</p>}
            {loadError && <p role="alert" className="text-red-700">{loadError} <button type="button" onClick={reload} className="underline">Retry</button></p>}
            {!solves && !loadError && <p role="status">Loading round attempts…</p>}
            {solves && (
                <fieldset disabled={saving} className="space-y-4">
                    {competitor ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-slate-200 bg-white px-4 py-3">
                            <div><p className="font-bold">{competitorName(competitor)}</p><p className="text-xs text-slate-600">{competitor.school_id}</p></div>
                            <button type="button" onClick={() => {
                                setCompetitor(null); setTimes(Array(round.attempt_limit).fill("")); setSearch(""); setError(""); setTimeErrors({});
                                requestAnimationFrame(() => searchInput.current?.focus());
                            }} className="text-sm font-semibold text-slate-700 underline">Change competitor</button>
                        </div>
                    ) : (
                        <div>
                            <label htmlFor="solve-competitor" className="text-sm font-semibold">Competitor</label>
                            <input id="solve-competitor" ref={searchInput} className={inputClass} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name or school ID" autoComplete="off" />
                            {matches.length > 0 && (
                                <ul className="mt-2 divide-y divide-slate-200 rounded-sm border border-slate-200 bg-white">
                                    {matches.map(person => (
                                        <li key={person.id}>
                                            <button type="button" disabled={recorded.has(person.id)} onClick={() => {
                                                setCompetitor(person); setError("");
                                                requestAnimationFrame(() => timeInput.current?.focus());
                                            }} className="flex w-full flex-wrap justify-between gap-x-3 px-3 py-2.5 text-left enabled:hover:bg-orange-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
                                                <span>{competitorName(person)}</span>
                                                <span className="text-sm text-slate-600">
                                                    {person.school_id}{recorded.has(person.id) ? " · Already entered" : ""}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {search.trim() && matches.length === 0 && <p className="mt-2 text-sm text-slate-600">No matching competitors.</p>}
                            {competitors.length === 0 && <p className="mt-2 text-sm text-slate-600">Create a competitor before entering a solve.</p>}
                        </div>
                    )}
                    {competitor && (alreadyEntered ? <p className="text-sm text-slate-600">This competitor already has a result for this round. Use Edit solves to make changes.</p> : (
                        <SolveTimeFields times={times} errors={timeErrors} firstInput={timeInput} onChange={(index, value) => {
                            setTimes(previous => previous.map((item, position) => position === index ? value : item));
                            setTimeErrors(previous => ({ ...previous, [index]: "" }));
                            setError("");
                        }} />
                    ))}
                </fieldset>
            )}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex justify-end">
                <button type="submit" className={primaryButton} disabled={!canSubmit || saving}>
                    {saving ? "Saving…" : "Save & next competitor"}
                </button>
            </div>
        </form>
    );
}
