"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiBodyFetch, apiFetch } from "@/lib/api";
import { checkInPath, waveLabel } from "@/lib/grouping";
import {
    AttendeeEditor, ConfirmGroupingChange, ConfirmGroupProgress, groupingError, JudgeEditor, LateEntryEditor,
    ScramblerEditor, ShareCheckIn, WaveEditor,
} from "./GroupingDialogs";
import GroupSchedule from "./GroupSchedule";
import { field, panel, primary, rosterLabels, secondary, type Attendee, type Entry, type GenerationReport, type Group, type GroupingData, type ProgressAction, type Wave } from "./groupingTypes";

const tabs = [
    { id: "waves", label: "Waves" }, { id: "checkin", label: "Check-in" }, { id: "groups", label: "Groups" },
] as const;

type Dialog =
    | { kind: "wave"; wave?: Wave }
    | { kind: "add" | "share" }
    | { kind: "scrambler" | "remove-attendee" | "edit-attendee"; attendee: Attendee }
    | { kind: "remove-wave"; wave: Wave }
    | { kind: "regenerate"; wave: Wave }
    | { kind: "progress"; action: ProgressAction; group: Group; wave: Wave }
    | { kind: "late" | "remove-entry"; entry: Entry }
    | { kind: "judge"; waveId: number; groupId: number; previousAttendeeId: number; version: number };

type ScrambleResult = { created: number; remaining: boolean; unsupported: string[]; failed: string[] };
const rosterAction = "min-h-8 rounded-sm border border-slate-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-100 disabled:opacity-60";

export default function ManageGroups({ competitionId, slug, initial, requestedGroup }: {
    competitionId: number; slug: string; initial: GroupingData; requestedGroup?: string;
}) {
    const path = `/competitions/admin/${competitionId}/grouping`;
    const requestedWave = initial.waves.find(wave => wave.groups.some(group => String(group.id) === requestedGroup));
    const firstWave = requestedWave
        ?? initial.waves.find(wave => wave.groups.some(group => group.status === "active"))
        ?? initial.waves.find(wave => wave.groups.some(group => group.status === "upcoming"))
        ?? initial.waves.find(wave => !wave.groups.length)
        ?? initial.waves[0];
    const [data, setData] = useState(initial);
    const [tab, setTab] = useState<typeof tabs[number]["id"]>(firstWave?.groups.length ? "groups" : firstWave ? "checkin" : "waves");
    const [waveId, setWaveId] = useState<number | undefined>(firstWave?.id);
    const [groupId, setGroupId] = useState(requestedWave?.groups.find(group => String(group.id) === requestedGroup)?.id);
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [refreshError, setRefreshError] = useState("");
    const [preparing, setPreparing] = useState(false);
    const [scrambleNotice, setScrambleNotice] = useState("");
    const [scrambleError, setScrambleError] = useState("");
    const [generation, setGeneration] = useState<GenerationReport>();
    const requestId = useRef(0);
    const mutation = useRef(false);
    const waves = data.waves;
    const wave = waves.find(item => item.id === waveId) ?? waves[0];
    const currentGroup = wave?.groups.find(group => group.id === groupId)
        ?? wave?.groups.find(group => group.status === "active")
        ?? wave?.groups.find(group => group.status === "upcoming")
        ?? wave?.groups[0];
    const pendingTotal = waves.reduce((count, item) => count + item.entries.filter(entry => entry.pending).length, 0);
    const running = waves.flatMap(item => item.groups).some(group => group.status === "active");
    const missingSets = waves.some(item => item.groups.some(group => group.status === "upcoming"
        && group.assignments.some(assignment => assignment.role === "solver" && !group.scramble_round_ids.includes(assignment.round_id))));
    const people = new Map(data.attendees.map(person => [person.id, person]));
    const labels = rosterLabels(data.attendees);
    function personLabel(id: number) {
        return labels.get(id) ?? "Attendee";
    }
    const rounds = new Map(data.rounds.map(round => [round.id, round]));
    const events = new Map(data.rounds.map(round => [round.event_id, round.event]));
    const presentCount = data.attendees.filter(person => person.is_present).length;
    const visibleRoster = data.attendees.filter(person => personLabel(person.id).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    const entriesByPerson = new Map<number, { entry: Entry; waveId: number }[]>();
    const startedPeople = new Set<number>();
    const startedEntries = new Set<string>();
    for (const item of waves) {
        for (const entry of item.entries) {
            const entries = entriesByPerson.get(entry.attendee_id) ?? [];
            entries.push({ entry, waveId: item.id });
            entriesByPerson.set(entry.attendee_id, entries);
        }
        for (const group of item.groups) {
            if (group.status === "upcoming") continue;
            for (const assignment of group.assignments) {
                startedPeople.add(assignment.attendee_id);
                if (assignment.role === "solver") {
                    startedEntries.add(`${item.id}/${assignment.attendee_id}/${assignment.round_id}`);
                }
            }
        }
    }
    const approvedPeople = new Set(data.scrambler_approvals.map(approval => approval.attendee_id));
    const success = [notice, tab === "groups" && !preparing ? scrambleNotice : ""].filter(Boolean).join(" ");

    useEffect(() => {
        let active = true;
        const timer = window.setInterval(() => {
            if (document.visibilityState !== "visible" || mutation.current) return;
            const id = ++requestId.current;
            apiFetch(path, { cache: "no-store" }).then((result: GroupingData) => {
                if (active && id === requestId.current) { setData(result); setRefreshError(""); }
            }).catch(() => {
                if (active && id === requestId.current) setRefreshError("Live refresh failed. Reload to see the latest check-ins.");
            });
        }, 10000);
        return () => {
            window.clearInterval(timer);
            active = false;
        };
    }, [path]);

    async function refresh() {
        if (mutation.current) return;
        const id = ++requestId.current;
        try {
            const result: GroupingData = await apiFetch(path, { cache: "no-store" });
            if (id === requestId.current) { setData(result); setRefreshError(""); }
        } catch (failure) {
            if (id === requestId.current) setRefreshError(groupingError(failure, "Could not reload the grouping schedule."));
        }
    }

    async function change(payload: Record<string, unknown>, message: string) {
        if (mutation.current) return;
        mutation.current = true;
        requestId.current++;
        setSaving(true);
        setError("");
        setNotice("");
        try {
            const result: GroupingData = await apiBodyFetch(path, "POST", payload);
            setData(result);
            if (result.generation) setGeneration(result.generation);
            setRefreshError("");
            if (payload.action === "save_wave") {
                setWaveId(result.waves.find(item => item.number === payload.number)?.id);
            }
            if (payload.action === "generate") setTab("groups");
            if (payload.action === "record_finished" || (payload.action === "group_status" && payload.status === "finished")) {
                const nextGroup = result.waves.find(item => item.id === waveId)?.groups.find(group => group.status === "upcoming");
                setGroupId(nextGroup?.id ?? Number(payload.id));
            }
            setDialog(null);
            setNotice(message);
            if (["generate", "approve_entry", "approve_rebalance"].includes(String(payload.action))) {
                await prepareScrambles();
            }
        } catch (failure) {
            setError(groupingError(failure, "Could not save this change."));
            if (failure instanceof ApiError && [404, 409].includes(failure.status)) {
                mutation.current = false;
                await refresh();
            }
        } finally {
            mutation.current = false;
            setSaving(false);
        }
    }

    async function prepareScrambles() {
        setPreparing(true);
        setScrambleNotice("");
        setScrambleError("");
        let total = 0;
        try {
            let result: ScrambleResult;
            do {
                const response = await fetch(`/api/grouping/${competitionId}/scrambles`, { method: "POST" });
                const value = await response.json();
                if (!response.ok) throw new ApiError(response.status, value);
                result = value;
                total += result.created;
            } while (result.remaining && result.created > 0 && result.failed.length === 0);
            if (result.failed.length || result.remaining) {
                setScrambleError(result.failed.length
                    ? `Could not finish scramble generation for ${result.failed.join(", ")}. Retry the missing sets.`
                    : "Some sets are still missing. Retry the missing sets.");
            }
            if (result.unsupported.length) {
                setScrambleError(previous => [
                    previous, `Enter scramble sets for ${result.unsupported.join(", ")} in Manage scrambles.`,
                ].filter(Boolean).join(" "));
            }
            if (total) setScrambleNotice(`${total} scramble ${total === 1 ? "set" : "sets"} generated.`);
        } catch (failure) {
            setScrambleError(groupingError(failure, "Could not generate scrambles. Retry the missing sets."));
        } finally {
            try {
                setData(await apiFetch(path, { cache: "no-store" }));
            } catch {
                setRefreshError("Refresh to check which scramble sets were saved.");
            }
            setPreparing(false);
        }
    }

    async function retryScrambles() {
        if (mutation.current) return;
        mutation.current = true;
        requestId.current++;
        setSaving(true);
        try {
            await prepareScrambles();
        } finally {
            mutation.current = false;
            setSaving(false);
        }
    }

    function open(next: Dialog | null) {
        setError("");
        setNotice("");
        setDialog(next);
    }

    function showGroups(id: number) {
        setWaveId(id);
        setGroupId(undefined);
        setTab("groups");
        setNotice("");
        setScrambleNotice("");
    }

    const dialogProps = { close: () => open(null), change, saving, error };
    const judgeWave = dialog?.kind === "judge" ? waves.find(item => item.id === dialog.waveId) : undefined;
    const judgeGroup = dialog?.kind === "judge" ? judgeWave?.groups.find(item => item.id === dialog.groupId) : undefined;

    return (
        <div className="grid gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-500">
                <nav aria-label="Grouping workflow" className="flex flex-wrap gap-2">
                    {tabs.map(item => (
                        <button type="button" key={item.id} aria-current={tab === item.id ? "page" : undefined}
                            className={`min-h-11 rounded-t-sm border-b-2 px-3 text-sm font-semibold ${tab === item.id
                                ? "border-orange-300 text-orange-200" : "border-transparent text-slate-200 hover:text-orange-200"}`}
                            onClick={() => { setTab(item.id); setError(""); setNotice(""); }}>
                            {item.label}{item.id === "groups" && pendingTotal > 0 ? ` (${pendingTotal})` : ""}
                        </button>
                    ))}
                </nav>
                <button type="button" className="mb-2 text-sm text-slate-100 underline" onClick={refresh} disabled={saving}>Refresh</button>
            </div>
            {refreshError && <p role="alert" className="rounded-sm bg-red-50 px-4 py-2 text-sm text-red-800">{refreshError}</p>}
            {success && <p role="status" className="rounded-sm bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{success}</p>}
            {error && !dialog && <p role="alert" className="rounded-sm bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
            {tab === "groups" && preparing && <p role="status" className="rounded-sm bg-slate-50 px-4 py-2 text-sm text-slate-800">
                Generating scramble sets for upcoming groups…
            </p>}
            {tab === "groups" && scrambleError && <p role="alert" className="rounded-sm bg-amber-50 px-4 py-2 text-sm text-amber-900">{scrambleError}</p>}

            {tab === "waves" && (
                <section className={panel} aria-labelledby="wave-heading">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-xl font-bold" id="wave-heading">Waves</h2>
                        <button type="button" className={primary} disabled={!data.rounds.length} onClick={() => open({ kind: "wave" })}>Add wave</button>
                    </div>
                    {!data.rounds.length && <p className="mt-4 text-sm">Add event rounds in Edit competition details to set up a wave.</p>}
                    {!!data.rounds.length && !waves.length && <p className="mt-4 text-sm">Add a wave and choose the event rounds people can enter.</p>}
                    <div className="mt-2 divide-y divide-slate-200">
                        {waves.map(item => (
                            <div key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                                <div className="min-w-0">
                                    <h3 className="break-words font-bold">{waveLabel(item)}</h3>
                                    <p className="mt-1 text-sm text-slate-700">
                                        {[...new Set(item.round_ids.map(id => rounds.get(id)?.event).filter(Boolean))].join(" · ")}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-700">
                                        {item.station_count ?? "–"} stations · {item.judges_per_group === null
                                            ? "Judges match solvers" : `${item.judges_per_group} judges per group`}
                                        {" · "}{item.scramblers_per_group ?? "–"} scramblers per group target · {item.entries.length} entries
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button type="button" className={secondary} onClick={() => open({ kind: "wave", wave: item })}>Edit wave</button>
                                    <button type="button" className={secondary} onClick={() => showGroups(item.id)}>View groups</button>
                                    {!item.groups.length && !item.entries.length && (
                                        <button type="button" className={secondary} onClick={() => open({ kind: "remove-wave", wave: item })}>Remove</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {tab === "checkin" && (
                <>
                    <section className={panel} aria-labelledby="checkin-heading">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold" id="checkin-heading">Competition check-in</h2>
                                <p className="mt-1 text-sm text-slate-700">
                                    {data.closed ? "Check-in closed" : waves.length ? "Check-in open" : "Set up a wave to open check-in"} · {presentCount} present
                                </p>
                            </div>
                            <button type="button" className={secondary} disabled={saving} onClick={() => void change({
                                action: "check_in_status", closed: !data.closed,
                            }, data.closed ? "Check-in reopened." : "Check-in closed.")}>
                                {data.closed ? "Reopen check-in" : "Close check-in"}
                            </button>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <Link href={checkInPath(data.token)} className={secondary} target="_blank" rel="noopener noreferrer">Open check-in page</Link>
                            <button type="button" className={secondary} onClick={() => open({ kind: "share" })}>Share check-in</button>
                        </div>
                    </section>
                    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2.4fr)_minmax(15rem,1fr)]">
                    <section className={panel} aria-labelledby="roster-heading">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-xl font-bold" id="roster-heading">Attendees</h2>
                            <button type="button" className={primary} onClick={() => open({ kind: "add" })}>Add attendee</button>
                        </div>
                        <label className="mt-4 grid max-w-md gap-1 text-sm">Search attendees
                            <input className={field} type="search" value={search} onChange={event => setSearch(event.target.value)} />
                        </label>
                        <div role="region" aria-label="Attendee roster" tabIndex={0}
                            className="mt-3 max-h-[min(60dvh,29rem)] divide-y divide-slate-200 overflow-y-auto overscroll-contain pr-2">
                            {visibleRoster.map(person => {
                                const entries = entriesByPerson.get(person.id) ?? [];
                                const name = personLabel(person.id);
                                const approved = approvedPeople.has(person.id);
                                return (
                                    <div key={person.id} className="grid gap-2 py-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                        <div className="min-w-0 break-words">
                                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                <h3 className="font-bold">{name}</h3>
                                                {!person.is_present && <span className="text-xs text-slate-600">Away</span>}
                                            </div>
                                            {entries.length > 0 && <ul className="mt-1 flex flex-wrap gap-1.5">
                                                {entries.map(({ entry, waveId }) => {
                                                    const round = rounds.get(entry.round_id);
                                                    const started = startedEntries.has(`${waveId}/${person.id}/${entry.round_id}`);
                                                    return round ? <li key={entry.id} className="inline-flex items-center gap-1 rounded-sm bg-slate-100 pl-1.5 pr-1 text-xs text-slate-700">
                                                        <span>{round.event}{entry.pending ? " (pending)" : ""}</span>
                                                        {!started && <button type="button" className="min-h-6 min-w-6 text-sm text-slate-600 hover:text-red-700"
                                                            aria-label={`Remove ${round.event} entry for ${name}`}
                                                            onClick={() => open({ kind: "remove-entry", entry })}>×</button>}
                                                    </li> : null;
                                                })}
                                            </ul>}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <button type="button" className={rosterAction} aria-label={`Edit attendee ${name}`}
                                                onClick={() => open({ kind: "edit-attendee", attendee: person })}>Edit</button>
                                            <button type="button" className={rosterAction}
                                                aria-label={approved ? `Edit scrambler approvals for ${name}` : `Approve scrambler ${name}`}
                                                onClick={() => open({ kind: "scrambler", attendee: person })}>
                                                {approved ? "Scrambler" : "Approve scrambler"}
                                            </button>
                                            <button type="button" className={rosterAction} disabled={saving} onClick={() => void change({
                                                action: "attendance", id: person.id, is_present: !person.is_present,
                                            }, person.is_present ? "Attendee marked away." : "Attendee marked present.")}>
                                                {person.is_present ? "Mark away" : "Mark present"}
                                            </button>
                                            {!startedPeople.has(person.id) && <button type="button" className={rosterAction}
                                                aria-label={`Remove attendee ${name}`} onClick={() => open({ kind: "remove-attendee", attendee: person })}>Remove</button>}
                                        </div>
                                    </div>
                                );
                            })}
                            {!data.attendees.length && <p className="py-4 text-sm text-slate-600">No one has checked in yet.</p>}
                            {data.attendees.length > 0 && !visibleRoster.length && <p className="py-4 text-sm text-slate-600">No attendees match that name.</p>}
                        </div>
                    </section>
                    <ScramblerSidebar data={data} events={events} personLabel={personLabel}
                        onEdit={attendee => open({ kind: "scrambler", attendee })} />
                    </div>
                </>
            )}

            {tab === "groups" && (!wave ? <section className={panel}>
                <p>Add a wave before generating groups.</p>
                <button type="button" className={primary + " mt-3"} onClick={() => setTab("waves")}>Go to waves</button>
            </section> : <GroupSchedule wave={wave} waves={waves} group={currentGroup} rounds={rounds} people={people}
                personLabel={personLabel} running={running} saving={saving} preparing={preparing} missingSets={missingSets} slug={slug}
                generation={generation?.wave_id === wave.id && generation.version === wave.version ? generation : undefined}
                onWave={showGroups} onGroup={setGroupId} onGenerate={() => {
                    if (wave.groups.length) open({ kind: "regenerate", wave });
                    else void change({ action: "generate", id: wave.id, version: wave.version }, "Groups generated.");
                }}
                onPrepare={() => void retryScrambles()} onReview={entry => open({ kind: "late", entry })}
                onStatus={action => {
                    if (currentGroup) open({ kind: "progress", action, group: currentGroup, wave });
                }}
                onJudge={previousAttendeeId => {
                    if (currentGroup) open({ kind: "judge", waveId: wave.id, groupId: currentGroup.id, version: wave.version, previousAttendeeId });
                }} />)}

            {dialog?.kind === "wave" && <WaveEditor {...dialogProps} data={data} wave={dialog.wave} />}
            {dialog?.kind === "add" && <AttendeeEditor {...dialogProps} data={data} />}
            {dialog?.kind === "edit-attendee" && <AttendeeEditor {...dialogProps} data={data} attendee={dialog.attendee} />}
            {dialog?.kind === "share" && <ShareCheckIn path={path} token={data.token} close={dialogProps.close} />}
            {dialog?.kind === "scrambler" && <ScramblerEditor {...dialogProps} data={data} attendee={dialog.attendee} />}
            {dialog?.kind === "late" && <LateEntryEditor {...dialogProps} data={data} entry={dialog.entry} path={path} />}
            {dialog?.kind === "regenerate" && <ConfirmGroupingChange {...dialogProps}
                title="Regenerate upcoming groups?" description={waveLabel(dialog.wave)} label="Regenerate groups"
                notice="Upcoming groups updated." destructive={false}
                action={{ action: "generate", id: dialog.wave.id, version: dialog.wave.version }}>
                <p className="text-sm">This rebuilds the upcoming groups in this wave. Running and finished groups keep their assignments.</p>
            </ConfirmGroupingChange>}
            {dialog?.kind === "progress" && <ConfirmGroupProgress {...dialogProps} group={dialog.group}
                wave={dialog.wave} progress={dialog.action} />}
            {dialog?.kind === "judge" && judgeGroup && judgeWave && <JudgeEditor
                {...dialogProps} data={data} group={judgeGroup} wave={{ ...judgeWave, version: dialog.version }}
                previousAttendeeId={dialog.previousAttendeeId} />}
            {dialog?.kind === "remove-wave" && (
                <ConfirmGroupingChange {...dialogProps} title="Remove wave?" description={waveLabel(dialog.wave)} label="Remove wave" notice="Wave removed."
                    action={{ action: "remove_wave", id: dialog.wave.id }}>
                    <p className="text-sm">This deletes the empty wave. Its event rounds are kept.</p>
                </ConfirmGroupingChange>
            )}
            {dialog?.kind === "remove-attendee" && (
                <ConfirmGroupingChange {...dialogProps} title="Remove attendee?" description={personLabel(dialog.attendee.id)}
                    label="Remove attendee" notice="Check-in removed."
                    action={{ action: "remove_attendee", id: dialog.attendee.id }}>
                    <p className="text-sm">This removes the check-in, its wave entries, and any upcoming assignments. Regenerate affected groups before starting them.</p>
                </ConfirmGroupingChange>
            )}
            {dialog?.kind === "remove-entry" && (
                <ConfirmGroupingChange {...dialogProps} title="Remove wave entry?" description={personLabel(dialog.entry.attendee_id)}
                    label="Remove entry" notice="Wave entry removed." action={{ action: "remove_entry", id: dialog.entry.id }}>
                    <p className="text-sm">The attendee stays checked in. Their upcoming solver assignment for this event is removed.</p>
                </ConfirmGroupingChange>
            )}
        </div>
    );
}

function ScramblerSidebar({ data, events, personLabel, onEdit }: {
    data: GroupingData; events: Map<number, string>; personLabel: (id: number) => string; onEdit: (attendee: Attendee) => void;
}) {
    const approvals = new Map<number, number[]>();
    const availableByEvent = new Map<number, number>();
    const present = new Set(data.attendees.filter(person => person.is_present).map(person => person.id));
    for (const approval of data.scrambler_approvals) {
        const existing = approvals.get(approval.attendee_id) ?? [];
        approvals.set(approval.attendee_id, [...existing, approval.event_id]);
        if (present.has(approval.attendee_id)) {
            availableByEvent.set(approval.event_id, (availableByEvent.get(approval.event_id) ?? 0) + 1);
        }
    }
    const trusted = data.attendees.filter(person => approvals.has(person.id));
    return (
        <aside className={panel} aria-labelledby="trusted-scramblers-heading">
            <h2 className="text-lg font-bold" id="trusted-scramblers-heading">Trusted scramblers</h2>
            {events.size > 0 && <section className="mt-2 border-b border-slate-200 pb-3" aria-label="Scrambler coverage">
                <h3 className="mb-2 text-xs font-semibold text-slate-600">Approved and present by event</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {[...events].map(([id, name]) => <div key={id} className="flex items-baseline justify-between gap-1">
                        <dt className="break-words">{name}</dt>
                        <dd className={`font-semibold tabular-nums ${availableByEvent.has(id) ? "" : "text-amber-800"}`}>{availableByEvent.get(id) ?? 0}</dd>
                    </div>)}
                </dl>
            </section>}
            {trusted.length ? <ul className="mt-3 divide-y divide-slate-200">
                {trusted.map(person => <li key={person.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                    <div className="min-w-0">
                        <p className="break-words font-semibold">{personLabel(person.id)}</p>
                        <p className="mt-1 text-xs text-slate-600">
                            {approvals.get(person.id)?.map(id => events.get(id)).filter(Boolean).join(", ")}
                            {!person.is_present && " · Away"}
                        </p>
                    </div>
                    <button type="button" className="text-xs font-semibold text-slate-700 underline"
                        aria-label={`Edit scrambler approvals for ${personLabel(person.id)}`} onClick={() => onEdit(person)}>Edit</button>
                </li>)}
            </ul> : <p className="mt-2 text-sm text-slate-600">Use Approve scrambler on an attendee to choose their events.</p>}
        </aside>
    );
}
