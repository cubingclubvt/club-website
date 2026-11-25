import CompetitionAdminPage from "../../_components/CompetitionAdminPage";
import { getCompetition } from "../../_lib/getCompetition";
import ManageScrambles from "./ManageScrambles";

export default async function ManageScramblesPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const competition = await getCompetition(slug);
    return (
        <CompetitionAdminPage title="Manage scrambles" competitionName={competition.name} slug={slug}>
            {competition.id !== null && competition.solveRounds.length > 0
                ? <ManageScrambles competitionId={competition.id} rounds={competition.solveRounds} />
                : <p>No rounds configured for this competition.</p>}
        </CompetitionAdminPage>
    );
}
