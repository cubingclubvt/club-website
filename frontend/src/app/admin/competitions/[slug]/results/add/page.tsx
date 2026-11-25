import CompetitionAdminPage from "../../../_components/CompetitionAdminPage";
import { adminCompetitionFetch } from "../../../_lib/adminCompetitionFetch";
import { getCompetition } from "../../../_lib/getCompetition";
import type { SolveCompetitor } from "../../../_lib/solves";
import AddSolves from "./AddSolves";

export default async function AddSolvesPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const competition = await getCompetition(slug);
    const competitors: SolveCompetitor[] = competition.id !== null && competition.solveRounds.length
        ? await adminCompetitionFetch("solves/competitors")
        : [];

    return (
        <CompetitionAdminPage title="Add solves" competitionName={competition.name} slug={slug}>
            {competition.id !== null && competition.solveRounds.length > 0
                ? <AddSolves competitionId={competition.id} rounds={competition.solveRounds} competitors={competitors} />
                : <p>No rounds configured for this competition.</p>}
        </CompetitionAdminPage>
    );
}
