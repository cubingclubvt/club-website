import CompetitionView from "@/components/CompetitionView";
import { loadInitialSolves } from "@/lib/competitionView";
import type { CompetitionViewData } from "@/types/Competition";
import { redirect } from "next/navigation";
import AdminBackButton from "../../../_components/AdminBackButton";
import { adminCompetitionFetch } from "../../_lib/adminCompetitionFetch";

export const dynamic = "force-dynamic";

export default async function CompetitionPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const encodedSlug = encodeURIComponent(slug);
    const path = `preview/${encodedSlug}`;
    const competition: CompetitionViewData = await adminCompetitionFetch(path);
    if (competition.is_published) redirect(`/competitions/${encodedSlug}`);
    const initialSolves = await loadInitialSolves(competition, suffix => adminCompetitionFetch(path + suffix));

    return (
        <CompetitionView competition={competition} initialSolves={initialSolves} apiPath={`/competitions/admin/${path}`} previewBar={
            <aside className="mx-auto max-w-4xl px-5 pt-28 sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-500/60 bg-slate-950/70 px-4 py-3 text-slate-100">
                    <p className="text-sm font-semibold">
                        Public page preview
                        <span className="ml-3 font-normal text-slate-300">
                            Unpublished
                        </span>
                    </p>
                    <AdminBackButton href={`/admin/competitions/${encodedSlug}/details`} label="Back to edit competition details" />
                </div>
            </aside>
        } />
    );
}
