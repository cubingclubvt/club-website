import type { CompetitionViewData } from "@/types/Competition";
import type { SolveSession } from "@/types/SolveSession";

export function competitionRoundPath(base: string, event: string, round: number) {
    return `${base}/${encodeURIComponent(event)}/${round}`;
}

export async function loadInitialSolves(competition: CompetitionViewData, fetchRound: (suffix: string) => Promise<unknown>) {
    const event = competition.events[0]?.name;
    return event ? await fetchRound(competitionRoundPath("", event, 1)) as SolveSession[] : [];
}
