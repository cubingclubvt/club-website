import CompetitionAdminPage from "../../../_components/CompetitionAdminPage";
import { getCompetition } from "../../../_lib/getCompetition";
import EditSolves from "./EditSolves";

export default async function EditSolvesPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const competition = await getCompetition(slug);

    return (
        <CompetitionAdminPage title="Edit solves" competitionName={competition.name} slug={slug}>
            {competition.id !== null && competition.solveRounds.length > 0
                ? <EditSolves competitionId={competition.id} rounds={competition.solveRounds} />
                : <p>No rounds configured for this competition.</p>}
        </CompetitionAdminPage>
    );
}
