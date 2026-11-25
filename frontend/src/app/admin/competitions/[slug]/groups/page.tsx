import AdminPlaceholder from "../../../_components/AdminPlaceholder";

export default async function CheckInAndGroupsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    return <AdminPlaceholder title="Check-in & Groups" competitionSlug={slug} />;
}
