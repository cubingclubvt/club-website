import CompetitionAdminPage from "../../_components/CompetitionAdminPage";
import { adminCompetitionFetch } from "../../_lib/adminCompetitionFetch";
import { getCompetition } from "../../_lib/getCompetition";
import type { GroupingData } from "../groups/groupingTypes";
import ManageScrambles, { type ScrambleGroup } from "./ManageScrambles";

export default async function ManageScramblesPage({ params, searchParams }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ group?: string | string[]; from?: string }>;
}) {
    const [{ slug }, { group, from }] = await Promise.all([params, searchParams]);
    const competition = await getCompetition(slug);
    const grouping: GroupingData | null = competition.id !== null && competition.solveRounds.length
        ? await adminCompetitionFetch(`${competition.id}/grouping`) : null;
    const groups: ScrambleGroup[] = grouping?.waves.flatMap(wave => wave.groups.map(item => {
        const solverRounds = item.assignments.filter(assignment => assignment.role === "solver")
            .map(assignment => assignment.round_id);
        const roundIds = item.assignments.length ? solverRounds : wave.round_ids;
        return {
            id: item.id, number: item.number, wave_number: wave.number, wave_name: wave.name,
            roundIds: [...new Set([...roundIds, ...item.scramble_round_ids])],
        };
    })) ?? [];
    const defaultGroup = grouping?.waves.flatMap(wave => wave.groups).find(item => item.status === "active")?.id;
    const requestedGroup = typeof group === "string" ? group : undefined;
    const linkedGroup = groups.find(item => String(item.id) === requestedGroup);
    const initialGroup = linkedGroup?.id ?? defaultGroup;
    const returnToGroups = from === "groups";
    const groupPage = `/admin/competitions/${encodeURIComponent(slug)}/groups${linkedGroup ? `?group=${linkedGroup.id}` : ""}`;

    return (
        <CompetitionAdminPage title="Manage scrambles" competitionName={competition.name} slug={slug} wide
            backHref={returnToGroups ? groupPage : undefined} backLabel={returnToGroups ? "Back to grouping" : undefined}>
            {competition.id !== null && competition.solveRounds.length > 0
                ? <ManageScrambles key={initialGroup ?? "default"} competitionId={competition.id} rounds={competition.solveRounds}
                    groups={groups} initialGroup={initialGroup} />
                : <p>No rounds configured for this competition.</p>}
        </CompetitionAdminPage>
    );
}
