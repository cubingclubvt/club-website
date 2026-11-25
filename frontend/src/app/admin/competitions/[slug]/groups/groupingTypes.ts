import type { OfferedRound } from "@/lib/grouping";

export type Attendee = { id: number; display_name: string; is_present: boolean };
export type Assignment = { attendee_id: number } & (
    | { role: "solver"; round_id: number; station: number | null }
    | { role: "judge"; round_id: null; station: null }
    | { role: "scrambler"; round_id: null; round_ids: number[]; station: null }
);
export type Group = {
    id: number;
    number: number;
    status: "upcoming" | "active" | "finished";
    problem: string | null;
    scramble_round_ids: number[];
    assignments: Assignment[];
};
export type Entry = { id: number; attendee_id: number; round_id: number; pending: boolean };
export type Wave = {
    id: number;
    number: number;
    name: string;
    station_count: number | null;
    scramblers_per_group: number | null;
    judges_per_group: number | null;
    version: number;
    round_ids: number[];
    entries: Entry[];
    groups: Group[];
};
export type GroupingData = {
    closed: boolean;
    token: string;
    rounds: OfferedRound[];
    attendees: Attendee[];
    scrambler_approvals: { attendee_id: number; event_id: number }[];
    waves: Wave[];
    generation?: GenerationReport;
};
export type GenerationReport = {
    wave_id: number;
    version: number;
    bottleneck: string;
    detail: string;
    suggestion?: string;
    judge_suggestion?: string;
};
export type Placement = {
    group_id: number | null;
    group_number: number;
    station: number;
    judge_id: number | null;
    judge_ids: number[];
    suggested_judges: number[];
};
export type PlacementResponse = { version: number; placements: Placement[] };
export type GroupingCommand = (payload: Record<string, unknown>, notice: string) => Promise<void>;
export type ProgressAction = "active" | "finished" | "record_finished";

export function rosterLabels(roster: Attendee[]) {
    const counts = new Map<string, number>();
    for (const person of roster) {
        const name = person.display_name.toLocaleLowerCase();
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return new Map(roster.map(person => [
        person.id, (counts.get(person.display_name.toLocaleLowerCase()) ?? 1) > 1
            ? `${person.display_name} (#${person.id})` : person.display_name,
    ]));
}

export const panel = "rounded-md border border-slate-200 bg-slate-50 p-4 text-slate-900 shadow-md shadow-black/20 sm:p-6";
export const field = "min-h-11 w-full min-w-0 rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm";
export const primary = "inline-flex min-h-10 items-center justify-center rounded-sm bg-orange-300 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-admin-button-hover disabled:opacity-60";
export const secondary = "inline-flex min-h-10 items-center justify-center rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60";
