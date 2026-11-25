"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiBodyFetch, apiFetch } from "@/lib/api";
import AdminEditDialog from "../../../_components/AdminEditDialog";
import CompetitionRoundPicker from "../../_components/CompetitionRoundPicker";
import roundRequestError from "../../_lib/roundRequestError";
import type { SolveRound } from "../../_lib/solves";
import ScrambleSheet from "./ScrambleSheet";

type Group = { id: number; number: number; wave_number: number; wave_name: string };
export type ScrambleGroup = Group & { roundIds: number[] };
type ScrambleSet = {
    id: number;
    number: number;
    group_id: number | null;
    group_label: string;
    scrambles: string[];
    extra_scrambles: string[];
    version: string;
};
type ScrambleData = { groups: Group[]; sets: ScrambleSet[] };
type Action = { kind: "add" } | { kind: "edit" | "remove"; set: ScrambleSet };

const selectClass = "mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2.5 text-slate-900";
const secondaryButton = "min-h-10 rounded-sm border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-100";

function groupLabel(group: Group) {
    return `Wave ${group.wave_number}${group.wave_name ? ` (${group.wave_name})` : ""} · Group ${group.number}`;
}

function assignmentLabel(set: ScrambleSet, groups: Group[]) {
    if (set.group_id === null) return set.group_label || "Round only";
    const group = groups.find(option => option.id === set.group_id);
    return group ? groupLabel(group) : `Group ID ${set.group_id}`;
}

function assignmentFilter(set: ScrambleSet) {
    if (set.group_id !== null) return String(set.group_id);
    return set.group_label ? `custom-${set.id}` : "round";
}

export default function ManageScrambles({ competitionId, rounds, groups, initialGroup }: {
    competitionId: number; rounds: SolveRound[]; groups: ScrambleGroup[]; initialGroup?: number;
}) {
    const [groupId, setGroupId] = useState<number | null>(initialGroup ?? groups[0]?.id ?? null);
    const group = groups.find(option => option.id === groupId);
    const waves = [...new Map(groups.map(option => [option.wave_number, option.wave_name]))];
    return (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-900 shadow-md shadow-black/20">
            {groups.length > 0 && <div className="grid gap-3 border-b border-slate-200 px-4 py-4 sm:grid-cols-2 sm:px-6">
                <label className="block min-w-0 text-sm font-semibold">
                    Wave
                    <select className={selectClass} value={group?.wave_number ?? "manual"}
                        onChange={event => setGroupId(groups.find(option => String(option.wave_number) === event.target.value)?.id ?? null)}>
                        {waves.map(([number, name]) => (
                            <option key={number} value={number}>Wave {number}{name ? ` · ${name}` : ""}</option>
                        ))}
                        <option value="manual">Round-only or custom sets</option>
                    </select>
                </label>
                {group && <label className="block min-w-0 text-sm font-semibold">
                    Group
                    <select className={selectClass} value={group.id} onChange={event => setGroupId(Number(event.target.value))}>
                        {groups.filter(option => option.wave_number === group.wave_number).map(option => (
                            <option key={option.id} value={option.id}>Group {option.number}</option>
                        ))}
                    </select>
                </label>}
            </div>}
            {group ? <GroupScrambles key={group.id} competitionId={competitionId}
                rounds={rounds.filter(round => group.roundIds.includes(round.id))} group={group} />
                : <ManualScrambles competitionId={competitionId} rounds={rounds} />}
        </div>
    );
}

function GroupScrambles({ competitionId, rounds, group }: { competitionId: number; rounds: SolveRound[]; group: Group }) {
    const [roundId, setRoundId] = useState(rounds[0]?.id);
    const round = rounds.find(option => option.id === roundId) ?? rounds[0];
    if (!round) return <p className="px-4 py-5 text-sm text-slate-600 sm:px-6">This group has no events.</p>;

    return (
        <>
            {rounds.length > 1 && <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
                <label className="block max-w-md text-sm font-semibold">
                    Event in this group
                    <select className={selectClass} value={round.id} onChange={event => setRoundId(Number(event.target.value))}>
                        {rounds.map(option => <option key={option.id} value={option.id}>
                            {option.event} · Round {option.number}
                        </option>)}
                    </select>
                </label>
            </div>}
            <RoundScrambles key={round.id} round={round} group={group}
                path={`/competitions/admin/${competitionId}/rounds/${round.id}/scrambles`} />
        </>
    );
}

function ManualScrambles({ competitionId, rounds }: { competitionId: number; rounds: SolveRound[] }) {
    const [event, setEvent] = useState(rounds[0].event);
    const [roundId, setRoundId] = useState<number | null>(rounds[0].id);
    const round = rounds.find(option => option.id === roundId);
    return (
        <>
            <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                <CompetitionRoundPicker rounds={rounds} event={event} roundId={roundId}
                    onEventChange={name => {
                        setEvent(name);
                        setRoundId(rounds.find(option => option.event === name)?.id ?? null);
                    }} onRoundChange={setRoundId} />
            </div>
            {round && (
                <RoundScrambles key={round.id} round={round}
                    path={`/competitions/admin/${competitionId}/rounds/${round.id}/scrambles`} />
            )}
        </>
    );
}

function RoundScrambles({ path, round, group }: { path: string; round: SolveRound; group?: Group }) {
    const [data, setData] = useState<ScrambleData | null>(null);
    const [filter, setFilter] = useState("all");
    const [action, setAction] = useState<Action | null>(null);
    const [revision, setRevision] = useState(0);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        let active = true;
        apiFetch(path, { cache: "no-store" }).then((value: ScrambleData) => {
            if (active) setData(value);
        }).catch((failure: unknown) => {
            if (active) setError(roundRequestError(failure, "Could not load scramble sets."));
        });
        return () => { active = false; };
    }, [path, revision]);

    function reload() {
        setError("");
        setNotice("");
        setData(null);
        setRevision(previous => previous + 1);
    }

    const manualSets = data?.sets.filter(set => set.group_id === null) ?? [];
    const customSets = manualSets.filter(set => set.group_label);
    const selectedCustom = customSets.some(set => assignmentFilter(set) === filter);
    const activeFilter = filter === "round" || selectedCustom ? filter : "all";
    const visible = group ? data?.sets.filter(set => set.group_id === group.id)
        : manualSets.filter(set => activeFilter === "all" || assignmentFilter(set) === activeFilter);
    const groupHasSet = !!group && !!visible?.length;

    function finish(saved?: ScrambleSet) {
        const previousSet = action && action.kind !== "add" ? action.set : undefined;
        setData(previous => {
            if (!previous) return previous;
            const sets = previous.sets.filter(set => set.id !== previousSet?.id);
            if (saved) sets.push(saved);
            return { ...previous, sets: sets.sort((a, b) => a.number - b.number) };
        });
        if (!group && saved && activeFilter !== "all") setFilter(assignmentFilter(saved));
        setNotice(saved ? "Scramble set saved." : "Scramble set removed.");
        setAction(null);
    }

    return (
        <div className="space-y-3 px-4 py-4 sm:px-6">
            {(!group || (data && !groupHasSet) || error) && <div className="flex flex-wrap items-end gap-3">
                {!group && customSets.length > 0 && (
                    <label className="min-w-0 flex-1 text-sm font-semibold">
                        Show sets for
                        <select className={selectClass} value={activeFilter}
                            onChange={event => { setFilter(event.target.value); setNotice(""); }}>
                            <option value="all">All sets</option>
                            <option value="round">Round only (no group)</option>
                            {customSets.map(set => <option key={set.id} value={assignmentFilter(set)}>{set.group_label}</option>)}
                        </select>
                    </label>
                )}
                {(!group || error) && <button type="button" onClick={reload} className={`${secondaryButton} ml-auto`}>{error ? "Retry" : "Reload"}</button>}
                <button type="button" onClick={() => setAction({ kind: "add" })} disabled={!data || !!groupHasSet}
                    className="min-h-10 rounded-sm bg-orange-300 px-4 text-sm font-semibold enabled:hover:bg-admin-button-hover disabled:opacity-50">
                    Add scramble set
                </button>
            </div>}
            {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {!data && !error && <p role="status" className="text-sm text-slate-600">Loading scramble sets…</p>}
            {data && visible?.length === 0 && <p className="text-sm text-slate-600">
                {group ? `No ${round.event} scramble set for this group yet.` : "No scramble sets in this view."}
            </p>}
            {data && (
                <div className="space-y-4">
                    {visible?.map(set => (
                        <ScrambleSheet key={set.id} event={round.event}
                            title={group ? round.event : assignmentLabel(set, data.groups)}
                            subtitle={group ? `${groupLabel(group)} · Round ${round.number}` : `Set ${set.number} · ${round.event} · Round ${round.number}`}
                            scrambles={set.scrambles} extras={set.extra_scrambles} showDiagrams={!!group || visible.length === 1}
                            actions={<>
                                    {group && <button type="button" className={secondaryButton} onClick={reload}>Reload</button>}
                                    <button type="button" className={secondaryButton} aria-label={`Edit set ${set.number}`}
                                        onClick={() => setAction({ kind: "edit", set })}>Edit</button>
                                    <button type="button" className="min-h-10 rounded-sm px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                                        aria-label={`Remove set ${set.number}`} onClick={() => setAction({ kind: "remove", set })}>Remove set</button>
                            </>} />
                    ))}
                </div>
            )}
            {action && data && (
                <ScrambleDialog action={action} path={path} data={data} round={round}
                    initialGroup={group?.id ?? null} onClose={() => setAction(null)} onSaved={finish} />
            )}
        </div>
    );
}

function ScrambleDialog({ action, path, data, round, initialGroup, onClose, onSaved }: {
    action: Action;
    path: string;
    data: ScrambleData;
    round: SolveRound;
    initialGroup: number | null;
    onClose: () => void;
    onSaved: (saved?: ScrambleSet) => void;
}) {
    const set = action.kind === "add" ? undefined : action.set;
    const removing = action.kind === "remove";
    const savedGroup = set ? set.group_id : initialGroup;
    const [assignment, setAssignment] = useState(
        savedGroup !== null ? String(savedGroup) : set?.group_label ? "custom" : "",
    );
    const [customLabel, setCustomLabel] = useState(set?.group_label ?? "");
    const groupId = assignment && assignment !== "custom" ? Number(assignment) : null;
    const [scrambles, setScrambles] = useState(() => set?.scrambles ?? [""]);
    const [extras, setExtras] = useState(() => set?.extra_scrambles ?? []);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const unavailableGroups = new Set(data.sets.filter(item => item.id !== set?.id).map(item => item.group_id));

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        setError("");
        const endpoint = set ? `${path}/${set.id}` : path;
        try {
            if (removing && set) {
                await apiBodyFetch(endpoint, "DELETE", { version: set.version });
                onSaved();
            } else {
                const saved: ScrambleSet = await apiBodyFetch(endpoint, set ? "PATCH" : "POST", {
                    group_id: groupId,
                    group_label: assignment === "custom" ? customLabel.trim() : "",
                    scrambles: scrambles.map(line => line.trim()),
                    extra_scrambles: extras.map(line => line.trim()),
                    ...(set ? { version: set.version } : {}),
                });
                onSaved(saved);
            }
        } catch (failure) {
            setError(roundRequestError(failure, "Could not save this change. Reload the round before trying again."));
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminEditDialog title={removing ? "Remove scramble set?" : set ? `Edit set ${set.number}` : "Add scramble set"}
            description={`${round.event} · Round ${round.number}${set ? ` · ${assignmentLabel(set, data.groups)}` : ""}`}
            onClose={onClose} onSubmit={submit} saving={saving} error={error}
            disabled={!removing && (
                !scrambles.length || [...scrambles, ...extras].some(line => !line.trim()) ||
                (assignment === "custom" && !customLabel.trim())
            )}
            size={removing ? "compact" : "wide"} destructive={removing}
            submitLabel={removing ? "Remove set" : set ? "Save changes" : "Add set"} savingLabel={removing ? "Removing…" : undefined}>
            {removing ? (
                <p className="text-sm">This removes all scrambles and extra scrambles in Set {set?.number}.</p>
            ) : (
                <div className="max-h-[55dvh] space-y-5 overflow-y-auto pr-2">
                    <label className="block text-sm font-semibold">
                        Group assignment
                        <select className={selectClass} value={assignment} onChange={event => {
                            setAssignment(event.target.value);
                            setError("");
                        }}>
                            <option value="">Round only (no group)</option>
                            <option value="custom">Custom group label</option>
                            {groupId !== null && !data.groups.some(group => group.id === groupId) && (
                                <option value={groupId}>Group ID {groupId}</option>
                            )}
                            {data.groups.map(group => (
                                <option key={group.id} value={group.id} disabled={unavailableGroups.has(group.id)}>
                                    {groupLabel(group)}{unavailableGroups.has(group.id) ? " (set assigned)" : ""}
                                </option>
                            ))}
                        </select>
                    </label>
                    {assignment === "custom" && (
                        <label className="block text-sm font-semibold">
                            Group label
                            <input type="text" className={selectClass} value={customLabel} maxLength={100}
                                placeholder="Group A" required onChange={event => {
                                    setCustomLabel(event.target.value);
                                    setError("");
                                }} />
                        </label>
                    )}
                    <ScrambleFields label="Scrambles" singular="scramble" lines={scrambles}
                        onChange={lines => { setScrambles(lines); setError(""); }} />
                    <ScrambleFields label="Extra scrambles" singular="extra scramble" lines={extras}
                        onChange={lines => { setExtras(lines); setError(""); }} />
                </div>
            )}
        </AdminEditDialog>
    );
}

function ScrambleFields({ label, singular, lines, onChange }: {
    label: string;
    singular: string;
    lines: string[];
    onChange: (lines: string[]) => void;
}) {
    return (
        <fieldset className="space-y-3 border-t border-slate-200 pt-3">
            <legend className="pr-2 text-sm font-bold">{label}</legend>
            {lines.map((line, index) => (
                <div key={index} className="flex items-end gap-2">
                    <label className="min-w-0 flex-1 text-sm font-semibold">
                        {singular[0].toUpperCase() + singular.slice(1)} {index + 1}
                        <textarea value={line} rows={2} maxLength={4096} required
                            className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
                            onChange={event => onChange(lines.map((item, position) => position === index ? event.target.value : item))} />
                    </label>
                    <button type="button" onClick={() => onChange(lines.filter((_, position) => position !== index))}
                        aria-label={`Remove ${singular} ${index + 1}`}
                        className="min-h-10 rounded-sm px-2 text-sm font-semibold text-red-700 hover:bg-red-50">Remove</button>
                </div>
            ))}
            <button type="button" className={secondaryButton} onClick={() => onChange([...lines, ""])}>Add {singular}</button>
        </fieldset>
    );
}
