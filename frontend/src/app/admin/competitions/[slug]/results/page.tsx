import { redirect } from "next/navigation";

export default async function CompetitionResultsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    redirect(`/admin/competitions/${encodeURIComponent(slug)}/results/edit`);
}
