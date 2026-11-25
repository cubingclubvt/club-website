import CompetitionAdminPage from "../../_components/CompetitionAdminPage";
import { adminCompetitionFetch } from "../../_lib/adminCompetitionFetch";
import { getCompetition } from "../../_lib/getCompetition";
import ManageGroups from "./ManageGroups";

export default async function CheckInAndGroupsPage({ params, searchParams }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ group?: string }>;
}) {
    const [{ slug }, { group }] = await Promise.all([params, searchParams]);
    const competition = await getCompetition(slug);
    const initial = competition.id === null ? null : await adminCompetitionFetch(`${competition.id}/grouping`);
    return (
        <CompetitionAdminPage title="Check-in & Groups" competitionName={competition.name} slug={slug} wide>
            {competition.id !== null && initial ? (
                <ManageGroups key={group} competitionId={competition.id} slug={slug} initial={initial} requestedGroup={group} />
            ) : <p>Competition data is unavailable.</p>}
        </CompetitionAdminPage>
    );
}
