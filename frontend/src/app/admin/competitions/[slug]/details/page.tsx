import AdminHeadingRow from "../../../_components/AdminHeadingRow";
import Link from "next/link";
import { getCompetition } from "../../_lib/getCompetition";
import PublicationButton from "./PublicationButton";
import EditCompetitionForm from "./EditCompetitionForm";
import DeleteCompetition from "./DeleteCompetition";

export default async function EditCompetitionDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const competition = await getCompetition(slug);

    return (
        <div className="min-h-[75vh] px-5 pb-20 pt-28 text-slate-100 sm:px-10 sm:pt-36">
            <div className="mx-auto max-w-5xl">
                <AdminHeadingRow backHref={`/admin/competitions/${encodeURIComponent(slug)}`} backLabel="Back to competition">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Edit competition details</h1>
                </AdminHeadingRow>
                <p className="mb-8 mt-3 text-lg text-orange-200">{competition.name}</p>
                {competition.id !== null && (
                    <>
                        <EditCompetitionForm
                            competitionId={competition.id}
                            slug={slug}
                            events={competition.events}
                            availableEvents={competition.availableEvents}
                            initialValues={{
                                name: competition.name,
                                location: competition.location,
                                start_time: competition.start_time,
                                end_time: competition.end_time,
                                official: competition.official,
                                official_link: competition.official_link,
                            }}
                        />
                        <section aria-labelledby="publication-heading" className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-5 py-5 text-neutral-900 shadow-md shadow-black/20 sm:px-8">
                            <div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h2 id="publication-heading" className="text-lg font-bold">Visibility</h2>
                                    <span className={`rounded-sm px-2 py-1 text-xs font-semibold ${competition.isPublished ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-800"}`}>
                                        {competition.isPublished ? "Published" : "Unpublished"}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-slate-600">
                                    {competition.isPublished ? "Visible on the public competitions page." : "Only visible to admins."}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-start gap-3">
                                {!competition.isPublished && (
                                    <Link
                                        href={`/admin/competitions/${encodeURIComponent(slug)}/preview`}
                                        className="inline-flex min-h-11 items-center rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
                                    >
                                        Preview public page
                                    </Link>
                                )}
                                <PublicationButton competitionId={competition.id} isPublished={competition.isPublished} />
                            </div>
                        </section>
                        <DeleteCompetition competitionId={competition.id} />
                    </>
                )}
            </div>
        </div>
    );
}
