import CompetitionView from "@/components/CompetitionView";
import { ApiError, apiFetch } from "@/lib/api";
import { loadInitialSolves } from "@/lib/competitionView";
import type { CompetitionViewData } from "@/types/Competition";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CompetitionDetail({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const apiPath = `/competitions/${encodeURIComponent(slug)}`;

    if (process.env.DISABLE_BACKEND !== "false") {
        return <CompetitionView apiPath={apiPath} initialSolves={[]} competition={{
            name: "Null", date: "N/A", num_competitors: 0, official_link: null, is_published: false, events: [],
        }} />;
    }

    try {
        const competition: CompetitionViewData = await apiFetch(apiPath, { cache: "no-store" });
        const initialSolves = await loadInitialSolves(competition, suffix => apiFetch(apiPath + suffix, { cache: "no-store" }));
        return <CompetitionView competition={competition} initialSolves={initialSolves} apiPath={apiPath} />;
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) notFound();
        throw error;
    }
}
