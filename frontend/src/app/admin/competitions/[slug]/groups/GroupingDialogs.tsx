"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import CheckInWaveFields from "@/components/CheckInWaveFields";
import { ApiError, apiBodyFetch, apiFetch } from "@/lib/api";
import { checkInPath, roundLabel, waveLabel, type CheckInWave } from "@/lib/grouping";
import AdminEditDialog from "../../../_components/AdminEditDialog";
import { adminRequestError, fieldErrorMessage } from "../../../_components/formErrors";
import { field, rosterLabels, secondary, type Attendee, type Entry, type Group, type GroupingCommand, type GroupingData, type PlacementResponse, type ProgressAction, type Wave } from "./groupingTypes";

type DialogProps = { close: () => void; change: GroupingCommand; saving: boolean; error: string };

export function groupingError(failure: unknown, fallback: string) {
    const validation = failure instanceof ApiError && failure.status === 400 ? fieldErrorMessage(failure.details) : undefined;
    return adminRequestError(failure, validation ?? fallback);
}

export function ConfirmGroupingChange({ title, description, label, notice, action, children, close, change, saving, error,
    destructive = true }: DialogProps & {
    title: string; description?: string; label: string; notice: string; action: Record<string, unknown>; children: ReactNode;
    destructive?: boolean;
}) {
    return (
        <AdminEditDialog title={title} description={description} onClose={close} destructive={destructive}
            submitLabel={label} saving={saving} error={error}
            onSubmit={event => { event.preventDefault(); void change(action, notice); }}>
            {children}
        </AdminEditDialog>
    );
}

export function ConfirmGroupProgress({ group, wave, progress, ...dialogProps }: DialogProps & {
    group: Group; wave: Wave; progress: ProgressAction;
}) {
    const starting = progress === "active";
    const recordFinished = progress === "record_finished";
    const label = starting ? "Start group" : recordFinished ? "Record as finished" : "Finish group";
    const action = recordFinished ? { action: progress } : { action: "group_status", status: progress };
    return <ConfirmGroupingChange {...dialogProps}
        title={`${label}?`} description={`${waveLabel(wave)} · Group ${group.number}`}
        label={label} notice={`Group ${group.number} ${starting ? "started" : "finished"}.`}
        action={{ ...action, id: group.id, version: wave.version }} destructive={false}>
        <p className="text-sm">{starting ? "Start when the solvers and staff are ready. The schedule will lock this group’s assignments."
            : "Continue once everyone in this group has finished. These solvers will be kept out of regenerated groups for this wave."}</p>
    </ConfirmGroupingChange>;
}

export function WaveEditor({ data, wave, close, change, saving, error }: DialogProps & { data: GroupingData; wave?: Wave }) {
    const [name, setName] = useState(wave?.name ?? "");
    const [number, setNumber] = useState(String(wave?.number ?? Math.max(0, ...data.waves.map(item => item.number)) + 1));
    const [stations, setStations] = useState(String(wave?.station_count ?? 4));
    const [scramblers, setScramblers] = useState(String(wave?.scramblers_per_group ?? 1));
    const [judgeMode, setJudgeMode] = useState(wave?.judges_per_group == null ? "auto" : "fixed");
    const [judges, setJudges] = useState(String(wave?.judges_per_group ?? 1));
    const [rounds, setRounds] = useState(wave?.round_ids ?? []);
    const locked = wave?.groups.some(group => group.status !== "upcoming") ?? false;
    const events = [...new Map(data.rounds.map(round => [round.event_id, round.event]))];
    const roundById = new Map(data.rounds.map(round => [round.id, round]));
    const selectedEvents = new Set(rounds.map(id => roundById.get(id)?.event_id));

    function selectRound(eventId: number, roundId?: number) {
        const others = rounds.filter(id => roundById.get(id)?.event_id !== eventId);
        setRounds(roundId === undefined ? others : [...others, roundId]);
    }

    function defaultRound(eventId: number) {
        const earlier = data.waves.filter(item => item.id !== wave?.id && item.number < Number(number))
            .flatMap(item => item.round_ids)
            .map(id => roundById.get(id))
            .filter(round => round?.event_id === eventId);
        const used = Math.max(0, ...earlier.map(round => round?.number ?? 0));
        const choices = data.rounds.filter(round => round.event_id === eventId);
        return (choices.find(round => round.number > used) ?? choices.at(-1))?.id;
    }
    return (
        <AdminEditDialog title={wave ? "Edit wave" : "Add wave"} onClose={close} size="medium" saving={saving} error={error}
            disabled={!rounds.length} submitLabel={wave ? "Save wave" : "Add wave"}
            onSubmit={event => {
                event.preventDefault();
                void change({
                    action: "save_wave", id: wave?.id, version: wave?.version, number: Number(number), name,
                    station_count: Number(stations), scramblers_per_group: Number(scramblers),
                    judges_per_group: judgeMode === "auto" ? null : Number(judges), round_ids: rounds,
                }, wave ? "Wave saved." : "Wave added.");
            }}>
            <div className="grid gap-4">
                <label className="grid gap-1 text-sm">Wave name <span className="text-xs text-slate-500">Optional</span>
                    <input className={field} value={name} maxLength={255} onChange={event => setName(event.target.value)} />
                </label>
                <fieldset disabled={locked} className="grid gap-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <label className="grid gap-1 text-sm">Wave number
                            <input className={field} type="number" min={1} max={32767} value={number} required onChange={event => setNumber(event.target.value)} />
                        </label>
                        <label className="grid gap-1 text-sm">Stations
                            <input className={field} type="number" min={1} max={100} value={stations} required onChange={event => setStations(event.target.value)} />
                        </label>
                        <label className="grid gap-1 text-sm">Target scramblers / group
                            <input className={field} type="number" min={0} max={50} value={scramblers} required onChange={event => setScramblers(event.target.value)} />
                        </label>
                    </div>
                    {rounds.length > 1 && Number(scramblers) > 0 && <p className="text-sm text-slate-600">
                        An approved scrambler can cover more than one event. The scheduler can assign extra scramblers when that helps run fewer groups.
                    </p>}
                    <div className={`grid gap-3 ${judgeMode === "fixed" ? "sm:grid-cols-2" : ""}`}>
                        <label className="grid gap-1 text-sm">Judges per group
                            <select className={field} value={judgeMode} onChange={event => setJudgeMode(event.target.value)}>
                                <option value="auto">Same number as solvers</option>
                                <option value="fixed">Fixed count</option>
                            </select>
                        </label>
                        {judgeMode === "fixed" && <label className="grid gap-1 text-sm">Judge count
                            <input className={field} type="number" min={0} max={100} required value={judges}
                                onChange={event => setJudges(event.target.value)} />
                        </label>}
                    </div>
                    <fieldset className="grid min-w-0 gap-1">
                        <legend className="mb-2 text-sm font-semibold">Events</legend>
                        <div className="grid max-h-52 gap-x-3 overflow-y-auto sm:grid-cols-2">
                            {events.map(([eventId, eventName]) => (
                                <label key={eventId} className="flex min-h-9 items-center gap-2 text-sm">
                                    <input type="checkbox" checked={selectedEvents.has(eventId)}
                                        onChange={event => selectRound(eventId, event.target.checked ? defaultRound(eventId) : undefined)} />
                                    {eventName}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    {events.some(([eventId]) => selectedEvents.has(eventId)
                        && data.rounds.filter(round => round.event_id === eventId).length > 1) && (
                        <details>
                            <summary className="text-sm font-semibold text-slate-700">Scored round settings</summary>
                            <p className="mt-2 text-xs text-slate-600">Repeated events default to the next round. Choose the same round to split it across waves.</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {events.flatMap(([eventId, eventName]) => {
                                    const choices = data.rounds.filter(round => round.event_id === eventId);
                                    if (!selectedEvents.has(eventId) || choices.length < 2) return [];
                                    return [<label key={eventId} className="grid gap-1 text-sm">{eventName} scored round
                                        <select className={field} value={choices.find(round => rounds.includes(round.id))?.id}
                                            onChange={event => selectRound(eventId, Number(event.target.value))}>
                                            {choices.map(round => <option key={round.id} value={round.id}>Round {round.number}</option>)}
                                        </select>
                                    </label>];
                                })}
                            </div>
                        </details>
                    )}
                </fieldset>
                {locked && <p className="text-sm text-slate-600">Staffing and rounds are locked after a group starts.</p>}
            </div>
        </AdminEditDialog>
    );
}

export function AttendeeEditor({ data, attendee, close, change, saving, error }: DialogProps & { data: GroupingData; attendee?: Attendee }) {
    const [name, setName] = useState(attendee?.display_name ?? "");
    const [selections, setSelections] = useState<Record<number, string>>({});
    const waves: CheckInWave[] = data.waves
        .filter(wave => (!wave.groups.length || wave.groups.some(group => group.status !== "finished"))
            && !wave.entries.some(entry => entry.attendee_id === attendee?.id))
        .map(wave => ({
            id: wave.id, name: wave.name, number: wave.number, pending: wave.groups.length > 0,
            rounds: data.rounds.filter(round => wave.round_ids.includes(round.id)),
        }));
    return (
        <AdminEditDialog title={attendee ? "Edit attendee" : "Add attendee"}
            description={attendee ? "Select another wave to add an entry." : "Leave the waves blank to check in a judge or scrambler."}
            onClose={close} saving={saving} error={error} submitLabel={attendee ? "Save attendee" : "Add attendee"}
            onSubmit={event => {
                event.preventDefault();
                const entries = waves.flatMap(wave => selections[wave.id]
                    ? [{ wave_id: wave.id, round_id: Number(selections[wave.id]) }] : []);
                void change({ action: attendee ? "edit_attendee" : "add_attendee", id: attendee?.id, name: name.trim(), entries },
                    attendee ? "Attendee updated." : "Attendee added.");
            }}>
            <div className="grid gap-4">
                <label className="grid gap-1 text-sm font-semibold">Name
                    <input className={field} required maxLength={511} value={name} onChange={event => setName(event.target.value)} />
                </label>
                <CheckInWaveFields waves={waves} selections={selections} onChange={setSelections} />
            </div>
        </AdminEditDialog>
    );
}

export function ScramblerEditor({ data, attendee, close, change, saving, error }: DialogProps & { data: GroupingData; attendee: Attendee }) {
    const [events, setEvents] = useState(data.scrambler_approvals.filter(item => item.attendee_id === attendee.id).map(item => item.event_id));
    const available = [...new Map(data.rounds.map(round => [round.event_id, round.event]))];
    return (
        <AdminEditDialog title="Scrambler approvals" description={attendee.display_name} onClose={close} saving={saving} error={error}
            onSubmit={event => {
                event.preventDefault();
                void change({ action: "scrambler_approvals", attendee_id: attendee.id, event_ids: events }, "Scrambler approvals saved.");
            }}>
            <fieldset className="grid gap-1">
                <legend className="mb-2 text-sm font-semibold">Trusted to scramble</legend>
                {available.map(([id, label]) => (
                    <label className="flex min-h-10 items-center gap-3 text-sm" key={id}>
                        <input type="checkbox" checked={events.includes(id)} onChange={event => {
                            setEvents(event.target.checked ? [...events, id] : events.filter(current => current !== id));
                        }} />
                        {label}
                    </label>
                ))}
                {!available.length && <p className="text-sm text-slate-600">Add an event round to this competition first.</p>}
            </fieldset>
        </AdminEditDialog>
    );
}

function JudgeOptions({ attendees, selected, eligible, preferred, onSelect }: {
    attendees: Attendee[]; selected: number | null; eligible: Set<number>; preferred?: Set<number>;
    onSelect: (id: number) => void;
}) {
    const [search, setSearch] = useState("");
    const labels = rosterLabels(attendees);
    const query = search.trim().toLocaleLowerCase();
    const visible = attendees.filter(person => labels.get(person.id)?.toLocaleLowerCase().includes(query));
    const sorted = [...visible].sort((left, right) =>
        Number(eligible.has(right.id)) - Number(eligible.has(left.id))
        || Number(preferred?.has(right.id) ?? false) - Number(preferred?.has(left.id) ?? false));
    return (
        <div className="grid gap-2">
            <label className="grid gap-1 text-sm font-semibold">Find a judge
                <input className={field} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search checked-in names" />
            </label>
            <div className="grid max-h-48 gap-1 overflow-y-auto">
                {sorted.map(person => (
                    <button key={person.id} type="button" aria-pressed={person.id === selected} disabled={!eligible.has(person.id)}
                        onClick={() => onSelect(person.id)}
                        className={`${secondary} !justify-start text-left aria-pressed:border-orange-600 aria-pressed:bg-orange-100`}>
                        {labels.get(person.id)}
                        {!eligible.has(person.id) ? <span className="ml-2 text-xs">· {person.is_present ? "Unavailable" : "Away"}</span>
                            : preferred?.has(person.id) ? <span className="ml-2 text-xs text-slate-600">· Same event</span> : null}
                    </button>
                ))}
                {!sorted.length && <p className="text-sm text-slate-600">No attendees match that name.</p>}
            </div>
        </div>
    );
}

export function JudgeEditor({ data, wave, group, previousAttendeeId, close, change, saving, error }: DialogProps & {
    data: GroupingData; wave: Wave; group: Group; previousAttendeeId: number;
}) {
    const judge = group.assignments.find(item => item.role === "judge" && item.attendee_id === previousAttendeeId);
    const [selected, setSelected] = useState(judge?.attendee_id ?? null);
    const busy = new Set(group.assignments.filter(item => item !== judge).map(item => item.attendee_id));
    const eligible = new Set(data.attendees.filter(person => person.is_present && !busy.has(person.id)).map(person => person.id));
    const groupRounds = new Set(group.assignments.filter(item => item.role === "solver").map(item => item.round_id));
    const groupEvents = new Set(data.rounds.filter(item => groupRounds.has(item.id)).map(item => item.event_id));
    const eventRoundIds = new Set(data.rounds.filter(item => groupEvents.has(item.event_id)).map(item => item.id));
    const preferred = new Set(data.waves.flatMap(item =>
        item.entries.filter(entry => !entry.pending && eventRoundIds.has(entry.round_id)).map(entry => entry.attendee_id),
    ));
    return (
        <AdminEditDialog title="Change judge" description={`${waveLabel(wave)} · Group ${group.number}`}
            onClose={close} saving={saving} error={error} size="medium"
            disabled={selected === null || selected === judge?.attendee_id || !eligible.has(selected)}
            onSubmit={event => {
                event.preventDefault();
                if (selected !== null) void change({
                    action: "judge", id: group.id, version: wave.version, previous_attendee_id: previousAttendeeId, attendee_id: selected,
                }, "Judge assignment updated.");
            }}>
            <JudgeOptions attendees={data.attendees} selected={selected} eligible={eligible} preferred={preferred} onSelect={setSelected} />
        </AdminEditDialog>
    );
}

export function LateEntryEditor({ path, data, entry, close, change, saving, error }: DialogProps & {
    path: string; data: GroupingData; entry: Entry;
}) {
    const [options, setOptions] = useState<PlacementResponse | null>(null);
    const [loadError, setLoadError] = useState("");
    const [retry, setRetry] = useState(0);
    const [selection, setSelection] = useState(0);
    const [judge, setJudge] = useState<number | null>(null);
    const [changingJudge, setChangingJudge] = useState(false);
    const [declining, setDeclining] = useState(false);
    const [rebalancing, setRebalancing] = useState(false);
    const selected = options?.placements[selection];
    const judgeId = judge ?? selected?.judge_id;
    const judgePool = selected?.suggested_judges ?? [];
    const round = data.rounds.find(item => item.id === entry.round_id);
    const labels = rosterLabels(data.attendees);
    useEffect(() => {
        let current = true;
        apiFetch(`${path}/placements/${entry.id}`, { cache: "no-store" }).then((result: PlacementResponse) => {
            if (current) setOptions(result);
        }).catch(failure => {
            if (current) setLoadError(groupingError(failure, "Could not check available groups."));
        });
        return () => { current = false; };
    }, [path, entry.id, retry]);

    function reload() {
        setLoadError("");
        setOptions(null);
        setSelection(0);
        setJudge(null);
        setRetry(value => value + 1);
    }

    return (
        <AdminEditDialog title={declining ? "Decline late entry?" : rebalancing ? "Approve and rebalance?" : "Review late entry"} size="medium"
            description={`${labels.get(entry.attendee_id) ?? "Attendee"}${round ? ` · ${roundLabel(round)}` : ""}`}
            onClose={close} saving={saving} error={error} destructive={declining}
            submitLabel={declining ? "Decline entry" : rebalancing ? "Approve & rebalance" : "Approve & assign"}
            disabled={!declining && (rebalancing ? !options : !selected)}
            onSubmit={event => {
                event.preventDefault();
                if (declining) void change({ action: "reject_entry", id: entry.id }, "Late entry declined.");
                else if (rebalancing && options) void change({
                    action: "approve_rebalance", id: entry.id, version: options.version,
                }, "Entry approved and upcoming groups updated.");
                else if (selected && options) void change({
                    action: "approve_entry", id: entry.id, version: options.version, group_id: selected.group_id, judge_id: judgeId ?? undefined,
                }, `Entry approved and assigned to Group ${selected.group_number}.`);
            }}>
            {declining ? <p className="text-sm">This removes the pending entry. The attendee stays checked in.</p> : rebalancing ? (
                <div className="grid gap-3">
                    <p className="text-sm">Upcoming assignments may change. Running and finished groups stay locked.</p>
                    <div><button type="button" className={secondary} onClick={() => { setRebalancing(false); reload(); }}>Review placement options</button></div>
                </div>
            ) : (
                <div className="grid gap-4">
                    {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
                    {!options && !loadError && <p role="status" className="text-sm">Checking stations and staffing…</p>}
                    {options && !selected && (
                        <p className="text-sm">No group can take this entry with the current staffing and station limits.</p>
                    )}
                    {selected && (
                        <>
                            <label className="grid gap-1 text-sm">Assign to
                                <select className={field} value={selection} onChange={event => {
                                    setSelection(Number(event.target.value)); setJudge(null); setChangingJudge(false);
                                }}>
                                    {options?.placements.map((item, index) => (
                                        <option key={item.group_id ?? "new"} value={index}>
                                            {item.group_id === null ? "New group" : "Group"} {item.group_number} · Station {item.station}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {judge !== null ? <p className="text-sm">Preferred judge · {labels.get(judge)}</p>
                                : judgePool.length > 0 && <p className="text-sm">Judges · {judgePool.map(id => labels.get(id)).join(", ")}</p>}
                            {selected.judge_ids.length > 0 && (changingJudge ? <JudgeOptions attendees={data.attendees} selected={judgeId ?? null}
                                eligible={new Set(selected.judge_ids)} onSelect={id => { setJudge(id); setChangingJudge(false); }} />
                                : <div><button type="button" className={secondary} onClick={() => setChangingJudge(true)}>Choose an additional judge</button></div>)}
                        </>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className={secondary} onClick={reload}>Refresh options</button>
                        {options && <button type="button" className={secondary} onClick={() => setRebalancing(true)}>Rebalance upcoming groups</button>}
                        <button type="button" className={secondary} onClick={() => setDeclining(true)}>Decline entry</button>
                    </div>
                </div>
            )}
        </AdminEditDialog>
    );
}

export function ShareCheckIn({ path, token, close }: { path: string; token: string; close: () => void }) {
    const [share, setShare] = useState<{ url: string; png: string } | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [retry, setRetry] = useState(0);
    const urlInput = useRef<HTMLInputElement>(null);
    const url = share?.url ?? (typeof window === "undefined" ? "" : new URL(checkInPath(token), window.location.origin).href);
    useEffect(() => {
        let current = true;
        apiBodyFetch(`${path}/qr`, "POST", { origin: window.location.origin }).then((result: { url: string; png: string }) => {
            if (current) setShare(result);
        }).catch(failure => {
            if (current) setError(groupingError(failure, "Could not generate the QR code."));
        });
        return () => { current = false; };
    }, [path, retry]);

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(url);
            setNotice("Link copied.");
        } catch {
            urlInput.current?.select();
            setNotice("Copy the selected link to share it.");
        }
    }

    async function copyImage() {
        if (!share) return;
        try {
            const bytes = Uint8Array.from(atob(share.png), character => character.charCodeAt(0));
            await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([bytes], { type: "image/png" }) })]);
            setNotice("QR image copied.");
        } catch {
            setNotice("Use Download QR to save the image.");
        }
    }

    const image = share && `data:image/png;base64,${share.png}`;
    return (
        <AdminEditDialog title="Share check-in" onClose={close} saving={false} error={error} size="medium" submitLabel="Done"
            onSubmit={event => { event.preventDefault(); close(); }}>
            <div className="grid gap-4">
                <label className="grid gap-1 text-sm">Check-in link
                    <input ref={urlInput} value={url} className={field} readOnly />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                    <button className={secondary} type="button" onClick={copyLink}>Copy link</button>
                    {image && <>
                        <button className={secondary} type="button" onClick={copyImage}>Copy QR image</button>
                        <a className={secondary} download="competition-check-in.png" href={image}>Download QR</a>
                    </>}
                </div>
                {image ? <Image src={image} width={200} height={200} unoptimized alt="Scan to open competition check-in" className="mx-auto" />
                    : error ? <div><button type="button" className={secondary} onClick={() => { setError(""); setRetry(value => value + 1); }}>Retry QR code</button></div>
                    : <p role="status" className="text-sm">Generating QR code…</p>}
                {notice && <p role="status" className="text-sm text-slate-700">{notice}</p>}
            </div>
        </AdminEditDialog>
    );
}
