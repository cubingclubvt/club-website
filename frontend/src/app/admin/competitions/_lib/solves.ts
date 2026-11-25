import { ApiError } from "@/lib/api";

export type SolveRound = { id: number; event: string; number: number; attempt_limit: number };
export type SolveCompetitor = { id: number; first_name: string; last_name: string; school_id: string };
export type RecordedSolve = {
    id: number;
    competitor: SolveCompetitor;
    solve_number: number;
    time: string;
    updated_at: string;
};

export function competitorName(competitor: SolveCompetitor) {
    return `${competitor.first_name} ${competitor.last_name}`.trim();
}

export function roundSolvesPath(competitionId: number, roundId: number) {
    return `/competitions/admin/${competitionId}/rounds/${roundId}/solves`;
}

export function solveTimeErrors(error: unknown) {
    const details = error instanceof ApiError ? error.details as { times?: unknown } | undefined : undefined;
    const issues = details?.times;
    if (!issues || typeof issues !== "object" || Array.isArray(issues)) return {};
    return Object.fromEntries(Object.entries(issues).map(
        ([number, messages]) => [number, Array.isArray(messages) ? messages.join(" ") : String(messages)],
    ));
}
