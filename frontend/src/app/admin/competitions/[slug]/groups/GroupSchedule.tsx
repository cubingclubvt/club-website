"use client";

import Link from "next/link";
import { useRef } from "react";
import { waveLabel, type OfferedRound } from "@/lib/grouping";
import { field, panel, primary, secondary, type Attendee, type Entry, type GenerationReport, type Group, type ProgressAction, type Wave } from "./groupingTypes";

const statusLabel = { upcoming: "Upcoming", active: "Running", finished: "Finished" };
const quietAction = "min-h-9 text-sm font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-950 disabled:opacity-50";

export default function GroupSchedule({ wave, waves, group, rounds, people, personLabel, running, saving, preparing, missingSets,
    onWave, onGroup, onGenerate, onPrepare, onReview, onStatus, onJudge, slug, generation }: {
    wave: Wave; waves: Wave[]; group: Group | undefined; rounds: Map<number, OfferedRound>; people: Map<number, Attendee>;
    personLabel: (id: number) => string; running: boolean; saving: boolean; preparing: boolean; missingSets: boolean;
    onWave: (id: number) => void; onGroup: (id: number) => void; onGenerate: () => void; onPrepare: () => void;
    onReview: (entry: Entry) => void; onStatus: (action: ProgressAction) => void; onJudge: (id: number) => void;
    slug: string;
    generation?: GenerationReport;
}) {
    const actions = useRef<HTMLDetailsElement>(null);

    function selectAction(action: () => void) {
        if (actions.current) {
            actions.current.open = false;
            actions.current.querySelector("summary")?.focus();
        }
        action();
    }

    const pending = wave.entries.filter(entry => entry.pending);
    const lockedSolvers = new Set(wave.groups.filter(item => item.status !== "upcoming")
        .flatMap(item => item.assignments.filter(assignment => assignment.role === "solver").map(assignment => assignment.attendee_id)));
    const canGenerate = wave.groups.some(item => item.status === "upcoming") || wave.entries.some(entry =>
        !entry.pending && !lockedSolvers.has(entry.attendee_id) && people.get(entry.attendee_id)?.is_present);
    const next = wave.groups.find(item => item.status !== "finished");
    const finishedCount = wave.groups.filter(item => item.status === "finished").length;
    const nextWave = !next && waves.find(item => item.number > wave.number
        && (!item.groups.length || item.groups.some(candidate => candidate.status !== "finished")));
    const judges = group?.assignments.filter(item => item.role === "judge") ?? [];
    const scramblers = group?.assignments.filter(item => item.role === "scrambler") ?? [];
    const extraScramblers = scramblers.length - (wave.scramblers_per_group ?? 0);
    const solvers = (group?.assignments.filter(item => item.role === "solver") ?? []).sort(
        (left, right) => (left.station ?? 0) - (right.station ?? 0),
    );
    const eventIds = [...new Set(solvers.map(solver => solver.round_id))];
    const missingEvents = eventIds.filter(id => !group?.scramble_round_ids.includes(id)).map(id => rounds.get(id)?.event ?? "Event");
    const showEvent = eventIds.length > 1;

    return (
        <section className={panel} aria-label="Group schedule">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="grid w-full min-w-0 gap-1 text-sm font-semibold sm:max-w-sm">
                    Wave
                    <select className={field} value={wave.id} onChange={event => onWave(Number(event.target.value))}>
                        {waves.map(item => <option key={item.id} value={item.id}>{waveLabel(item)}</option>)}
                    </select>
                </label>
                {wave.groups.length ? (
                    <details ref={actions} className="relative">
                        <summary className="cursor-pointer py-2.5 text-sm font-semibold text-slate-700">Schedule actions</summary>
                        <div className="absolute left-0 z-10 mt-1 grid w-64 gap-1 rounded-sm border border-slate-200 bg-white p-2 shadow-lg sm:left-auto sm:right-0">
                            <button type="button" className="rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-50"
                                disabled={saving || !canGenerate} onClick={() => selectAction(onGenerate)}>Regenerate upcoming groups</button>
                            <button type="button" className="rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-50"
                                disabled={saving || !missingSets} onClick={() => selectAction(onPrepare)}>
                                {preparing ? "Generating scrambles…" : "Generate missing scrambles"}
                            </button>
                            {group?.status === "upcoming" && next?.id === group.id && solvers.length > 0 &&
                                <button type="button" className="rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100 disabled:opacity-50"
                                    disabled={saving || running} onClick={() => selectAction(() => onStatus("record_finished"))}>
                                    Record group as already finished
                                </button>}
                        </div>
                    </details>
                ) : (
                    <button type="button" className={primary} disabled={saving || !canGenerate} onClick={onGenerate}>Generate groups</button>
                )}
            </div>

            {generation && <section aria-label="Grouping bottleneck" className="mt-4 rounded-sm border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <h2 className="font-bold">{generation.bottleneck === "No bottleneck" ? generation.bottleneck : `Bottleneck · ${generation.bottleneck}`}</h2>
                <p className="mt-1 text-slate-700">{generation.detail}</p>
                {generation.suggestion && <p className="mt-1 font-medium text-slate-800">{generation.suggestion}</p>}
                {generation.judge_suggestion && <p className="mt-1 font-medium text-slate-800">{generation.judge_suggestion}</p>}
            </section>}

            {pending.length > 0 && <details className="mt-5 rounded-sm border border-amber-200 bg-amber-50 px-3 text-sm">
                <summary className="cursor-pointer py-2.5 font-semibold text-amber-950">
                    {pending.length} late {pending.length === 1 ? "entry" : "entries"} to review
                </summary>
                <ul className="divide-y divide-amber-200">
                    {pending.map(entry => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-3 border-t border-amber-200 py-1.5">
                        <span className="min-w-0 break-words">
                            <strong>{personLabel(entry.attendee_id)}</strong> · {rounds.get(entry.round_id)?.event}
                        </span>
                        <button type="button" className={quietAction} onClick={() => onReview(entry)}>Review entry</button>
                    </li>)}
                </ul>
            </details>}

            {!group && <p className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-700">
                {canGenerate ? "This wave is ready to group." : "Check in competitors for this wave to generate groups."}
            </p>}

            {group && <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">
                        {finishedCount === wave.groups.length ? "Wave finished" : `${finishedCount} of ${wave.groups.length} groups finished`}
                    </p>
                    {nextWave && <button type="button" className={quietAction} onClick={() => onWave(nextWave.id)}>
                        Go to wave {nextWave.number}
                    </button>}
                </div>
                <nav aria-label="Groups in this wave" className="mt-2 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
                    {wave.groups.map(item => <button type="button" key={item.id} aria-pressed={item.id === group.id}
                        aria-label={`Group ${item.number}, ${item.problem ? "needs attention" : statusLabel[item.status]}`}
                        className={`${item.id === group.id ? primary : secondary} gap-2`} onClick={() => onGroup(item.id)}>
                        Group {item.number}
                        {item.status === "active" && <span className="text-xs text-emerald-800">Running</span>}
                        {item.status === "finished" && <span className="text-xs text-slate-600" aria-hidden="true">✓</span>}
                        {item.problem && <span className="text-xs text-red-800" aria-hidden="true">!</span>}
                    </button>)}
                </nav>

                <header className="flex flex-wrap items-center justify-between gap-3 pt-4">
                    <div>
                        <h2 className="text-xl font-bold">Group {group.number}</h2>
                        <p className="mt-0.5 text-sm text-slate-600">
                            {statusLabel[group.status]}
                            {!showEvent && eventIds[0] !== undefined && ` · ${rounds.get(eventIds[0])?.event ?? "Event"}`}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {eventIds.length > 0 && <Link className={quietAction + " inline-flex items-center"}
                            href={`/admin/competitions/${encodeURIComponent(slug)}/scrambles?from=groups&group=${group.id}`}>View scrambles</Link>}
                        {group.status === "upcoming" && next?.id === group.id && <button type="button" className={primary}
                            disabled={saving || running || !!group.problem} onClick={() => onStatus("active")}>Start group</button>}
                        {group.status === "active" && <button type="button" className={primary} disabled={saving}
                            onClick={() => onStatus("finished")}>Finish group</button>}
                    </div>
                </header>

                {group.problem && <p className="mt-3 rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800">{group.problem}</p>}
                {!group.problem && missingEvents.length > 0 && <p className="mt-3 flex flex-wrap items-center gap-x-3 text-sm text-amber-900">
                    <span>Missing scrambles for {missingEvents.join(", ")}.</span>
                    {group.status === "upcoming" && <button type="button" className={quietAction} disabled={saving} onClick={onPrepare}>
                        {preparing ? "Generating…" : "Generate missing scrambles"}
                    </button>}
                </p>}

                <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                    <section className="min-w-0">
                        <h3 className="font-bold">Solvers <span className="text-sm font-normal text-slate-600">({solvers.length})</span></h3>
                        {solvers.length ? <table className="mt-2 w-full text-left text-sm">
                            <thead><tr className="border-b border-slate-200 text-xs text-slate-600">
                                <th scope="col" className="w-20 pb-2 pr-3">Station</th>
                                <th scope="col" className="pb-2 pr-3">Name</th>
                                {showEvent && <th scope="col" className="pb-2">Event</th>}
                            </tr></thead>
                            <tbody className="divide-y divide-slate-200">
                                {solvers.map(solver => <tr key={solver.attendee_id}>
                                    <td className="py-2 pr-3 tabular-nums">{solver.station ?? "–"}</td>
                                    <td className="break-words py-2 pr-3 font-medium">{personLabel(solver.attendee_id)}</td>
                                    {showEvent && <td className="break-words py-2 text-slate-700">{rounds.get(solver.round_id)?.event}</td>}
                                </tr>)}
                            </tbody>
                        </table> : <p className="mt-2 text-sm text-slate-600">No solvers assigned.</p>}
                    </section>
                    <div className="grid min-w-0 content-start gap-5 border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                        <section>
                            <h3 className="font-bold">Judges <span className="text-sm font-normal text-slate-600">({judges.length})</span></h3>
                            {judges.length ? <ul className="mt-1 divide-y divide-slate-200 text-sm">
                                {judges.map(judge => <li key={judge.attendee_id} className="flex items-center justify-between gap-3 py-1">
                                    <span className="min-w-0 break-words">{personLabel(judge.attendee_id)}</span>
                                    {group.status === "upcoming" && <button type="button" className="min-h-7 text-xs font-semibold text-slate-700 underline"
                                        aria-label={`Change judge ${personLabel(judge.attendee_id)}`} onClick={() => onJudge(judge.attendee_id)}>Change</button>}
                                </li>)}
                            </ul> : <p className="mt-1 text-sm text-slate-600">No judges assigned.</p>}
                        </section>
                        <section>
                            <h3 className="font-bold">Scramblers <span className="text-sm font-normal text-slate-600">({scramblers.length})</span></h3>
                            {extraScramblers > 0 && <p className="mt-1 text-xs text-slate-600">
                                {extraScramblers} {extraScramblers === 1 ? "extra scrambler" : "extra scramblers"} for event coverage
                            </p>}
                            {scramblers.length ? <ul className="mt-1 space-y-1 text-sm">
                                {scramblers.map(item => <li key={item.attendee_id} className="break-words">
                                    {personLabel(item.attendee_id)}{showEvent && <span className="text-slate-600">
                                        {" · "}{item.round_ids.map(id => rounds.get(id)?.event).filter(Boolean).join(", ")}
                                    </span>}
                                </li>)}
                            </ul> : <p className="mt-1 text-sm text-slate-600">No scramblers assigned.</p>}
                        </section>
                    </div>
                </div>
            </>}
        </section>
    );
}
