"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiBodyFetch, apiFetch } from "@/lib/api";
import AdminEditDialog from "../../../../_components/AdminEditDialog";
import AdminPagination from "../../../../_components/AdminPagination";
import CompetitorSearch from "../../../../_components/CompetitorSearch";
import useAdminPage from "../../../../_components/useAdminPage";
import CompetitionRoundPicker from "../../../_components/CompetitionRoundPicker";
import SolveTimeFields from "../../../_components/SolveTimeFields";
import { competitorName, roundSolvesPath, solveTimeErrors, type RecordedSolve, type SolveRound } from "../../../_lib/solves";
import roundRequestError from "../../../_lib/roundRequestError";

type SolveAction = { kind: "edit" | "remove"; solves: RecordedSolve[] };
type SolveVersion = Pick<RecordedSolve, "id" | "updated_at">;
type EventSolveVersion = SolveVersion & { competition_round_id: number };

export default function EditSolves({ competitionId, rounds }: { competitionId: number; rounds: SolveRound[] }) {
    const [event, setEvent] = useState(rounds[0].event);
    const [roundId, setRoundId] = useState<number | null>(rounds[0].id);
    const [query, setQuery] = useState("");
    const round = rounds.find(option => option.id === roundId);

    return (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-900 shadow-md shadow-black/20">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-8">
                <CompetitionRoundPicker
                    rounds={rounds}
                    event={event}
                    roundId={roundId}
                    onEventChange={name => {
                        setEvent(name);
                        setRoundId(rounds.find(round => round.event === name)?.id ?? null);
                    }}
                    onRoundChange={setRoundId}
                />
            </div>
            {round && (
                <RoundSolves key={round.id} round={round} eventRounds={rounds.filter(option => option.event === round.event)}
                    path={roundSolvesPath(competitionId, round.id)} query={query} onSearch={setQuery} />
            )}
        </div>
    );
}

function RoundSolves({ path, round, eventRounds, query, onSearch }: {
    path: string;
    round: SolveRound;
    eventRounds: SolveRound[];
    query: string;
    onSearch: (query: string) => void;
}) {
    const [page, setPage] = useState(1);
    const params = new URLSearchParams({ page: String(page), search: query });
    const { data, error, reload } = useAdminPage<RecordedSolve>(`${path}?${params}`, "Could not load solves.");
    const solves = data?.results;
    const [action, setAction] = useState<SolveAction | null>(null);
    const [notice, setNotice] = useState("");
    const grouped = new Map<number, RecordedSolve[]>();
    for (const solve of solves ?? []) {
        const attempts = grouped.get(solve.competitor.id);
        if (attempts) attempts.push(solve);
        else grouped.set(solve.competitor.id, [solve]);
    }

    return (
        <div className="px-5 py-5 sm:px-8">
            <CompetitorSearch
                query={query}
                onSearch={search => { onSearch(search); setPage(1); setNotice(""); reload(); }}
                onReload={() => { setNotice(""); reload(); }}
            />
            <h2 className="mb-4 text-xl font-bold">Recorded times</h2>
            {notice && <p role="status" className="mb-3 text-sm text-emerald-800">{notice}</p>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {!solves && !error && <p role="status" className="text-sm text-slate-600">Loading times…</p>}
            {solves?.length === 0 && <p className="text-sm text-slate-600">
                {query ? "No matching competitors with recorded times in this round." : "No solves recorded for this round."}
            </p>}
            <ul className="space-y-3">
                {[...grouped.entries()].map(([id, attempts]) => {
                    const person = attempts[0].competitor;
                    const name = competitorName(person);
                    return (
                        <li key={id} className="rounded-sm border border-slate-200 bg-white px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                <div>
                                    <h3 className="font-bold">{name}</h3>
                                    <span className="text-xs text-slate-600">{person.school_id}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => setAction({ kind: "edit", solves: attempts })}
                                        aria-label={`Edit times for ${name}`}
                                        className="flex min-h-10 items-center gap-2 rounded-sm px-2 text-xs font-semibold text-slate-700 hover:bg-orange-100"
                                    >
                                        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m14 6 4 4M4 20l4.5-1L20 7.5 16.5 4 5 15.5 4 20Z" />
                                        </svg>
                                        Edit times
                                    </button>
                                    <button type="button" onClick={() => setAction({ kind: "remove", solves: attempts })}
                                        aria-label={`Remove result for ${name}`}
                                        className="min-h-10 rounded-sm px-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                                    >Remove result</button>
                                </div>
                            </div>
                            <ul className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                                {attempts.map(solve => (
                                    <li key={solve.id} className="flex items-center gap-2 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2">
                                        <span className="text-xs text-slate-600">#{solve.solve_number}</span>
                                        <span className="font-semibold tabular-nums">{solve.time}</span>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    );
                })}
            </ul>
            {data && <AdminPagination page={data.page} totalPages={data.total_pages} onPageChange={nextPage => {
                setNotice("");
                setPage(nextPage);
            }} />}
            {action && (
                <SolveDialog action={action} path={path} round={round} eventRounds={eventRounds} onClose={() => setAction(null)} onSaved={() => {
                    setNotice(action.kind === "edit" ? "Times updated." : "Result removed.");
                    setAction(null);
                    if (data) setPage(data.page);
                    reload();
                }} />
            )}
        </div>
    );
}

function SolveDialog({ action, path, round, eventRounds, onClose, onSaved }: {
    action: SolveAction;
    path: string;
    round: SolveRound;
    eventRounds: SolveRound[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const numbers = [...new Set([
        ...Array.from({ length: round.attempt_limit }, (_, index) => index + 1),
        ...action.solves.map(solve => solve.solve_number),
    ])].sort((a, b) => a - b);
    const initialTimes = numbers.map(number => action.solves.find(solve => solve.solve_number === number)?.time ?? "");
    const [times, setTimes] = useState(initialTimes);
    const [timeErrors, setTimeErrors] = useState<Record<number, string>>({});
    const changes = Object.fromEntries(numbers.flatMap((number, index) =>
        times[index].trim() === initialTimes[index] ? [] : [[number, times[index].trim()]],
    ));
    const hasChanges = Object.keys(changes).length > 0;
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [scope, setScope] = useState<"round" | "event">("round");
    const [otherAttempts, setOtherAttempts] = useState<EventSolveVersion[]>([]);
    const [scopeError, setScopeError] = useState("");
    const removing = action.kind === "remove";
    const competitor = action.solves[0].competitor;
    const resultPath = `${path}/competitors/${competitor.id}`;
    const otherRoundIds = new Set(otherAttempts.map(solve => solve.competition_round_id));
    const otherRoundNumbers = eventRounds.filter(option => otherRoundIds.has(option.id)).map(option => option.number);

    useEffect(() => {
        if (!removing || eventRounds.length < 2) return;
        let active = true;
        apiFetch(resultPath, { cache: "no-store" }).then((solves: EventSolveVersion[]) => {
            if (active) setOtherAttempts(solves.filter(solve => solve.competition_round_id !== round.id));
        }).catch(() => {
            if (active) setScopeError("Could not check for results in other rounds.");
        });
        return () => { active = false; };
    }, [eventRounds.length, removing, resultPath, round.id]);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving || (!removing && !hasChanges)) return;
        setSaving(true);
        setError("");
        setTimeErrors({});
        try {
            if (action.kind === "remove") {
                const solves = scope === "event" ? [...action.solves, ...otherAttempts] : action.solves;
                await apiBodyFetch(resultPath, "DELETE", {
                    scope, solves: solves.map(({ id, updated_at }) => ({ id, updated_at })),
                });
            } else {
                await apiBodyFetch(resultPath, "PATCH", {
                    solves: action.solves.map(({ id, updated_at }) => ({ id, updated_at })),
                    times: changes,
                });
            }
            onSaved();
        } catch (failure) {
            const issues = solveTimeErrors(failure);
            if (Object.keys(issues).length) {
                setTimeErrors(Object.fromEntries(numbers.map((number, index) => [index, issues[number]])));
                setError("Check the highlighted times and save again.");
            } else {
                setError(roundRequestError(failure, "Could not confirm the change. Reload the results before trying again."));
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminEditDialog
            title={removing ? "Remove result?" : "Edit times"}
            description={`${competitorName(competitor)} · ${round.event} · Round ${round.number}`}
            onClose={onClose}
            onSubmit={submit}
            saving={saving}
            disabled={!removing && !hasChanges}
            error={error}
            size={removing ? "compact" : "wide"}
            destructive={removing}
            submitLabel={removing ? "Remove result" : undefined}
            savingLabel={removing ? "Removing…" : undefined}
        >
                {action.kind === "remove" ? (
                    <div className="space-y-4">
                        {otherRoundNumbers.length > 0 && (
                            <label className="block text-sm font-semibold">
                                Which rounds?
                                <select value={scope} onChange={event => setScope(event.target.value === "event" ? "event" : "round")}
                                    disabled={saving} className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2">
                                    <option value="round">Round {round.number} only</option>
                                    <option value="event">All {round.event} rounds ({[round.number, ...otherRoundNumbers].sort((a, b) => a - b).join(", ")})</option>
                                </select>
                            </label>
                        )}
                        <p className="text-sm">This removes {action.solves.length + (scope === "event" ? otherAttempts.length : 0)} recorded times {scope === "event" ? "across this event" : "from this round"}.</p>
                        {scopeError && <p className="text-xs text-slate-600">{scopeError}</p>}
                    </div>
                ) : (
                        <SolveTimeFields times={times} numbers={numbers} errors={timeErrors} required={false} onChange={(index, value) => {
                            setTimes(previous => previous.map((time, position) => position === index ? value : time));
                            setTimeErrors(previous => ({ ...previous, [index]: "" }));
                            setError("");
                        }} />
                )}
        </AdminEditDialog>
    );
}
