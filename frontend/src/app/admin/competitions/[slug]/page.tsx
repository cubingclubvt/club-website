import Link from "next/link";
import AdminHeadingRow from "../../_components/AdminHeadingRow";
import { getCompetition } from "../_lib/getCompetition";

export default async function CompetitionPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const competition = await getCompetition(slug);
    const basePath = `/admin/competitions/${encodeURIComponent(slug)}`;
    const actions = [
        { label: "Edit competition details", href: `${basePath}/details` },
        { label: "Add solves", href: `${basePath}/results/add` },
        { label: "Edit solves", href: `${basePath}/results/edit` },
        { label: "Manage scrambles", href: `${basePath}/scrambles` },
        { label: "Check-in & Groups", href: `${basePath}/groups` },
    ];

    return (
        <div className="min-h-[75vh] px-5 pb-20 pt-28 text-slate-100 sm:px-10 sm:pt-36">
            <div className="mx-auto max-w-5xl">
                <AdminHeadingRow
                    backHref={competition.isPublished ? "/admin/competitions?status=published" : "/admin/competitions"}
                    backLabel="Back to competitions"
                >
                    <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight sm:text-5xl">{competition.name}</h1>
                </AdminHeadingRow>
                <dl className="mb-8 mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-300">
                    <div><dt>Visibility</dt><dd className="text-white">{competition.isPublished ? "Published" : "Draft"}</dd></div>
                    <div><dt>Date</dt><dd className="text-white">{competition.date}</dd></div>
                    <div><dt>Competitors</dt><dd className="text-white">{competition.competitorCount}</dd></div>
                </dl>
                <nav aria-label="Manage competition" className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
                    {actions.map(({ label, href }) => (
                        <Link key={label} href={href} className="flex aspect-[4/3] min-h-28 max-h-52 items-center justify-center rounded-md bg-orange-300 px-3 py-4 text-center text-sm font-bold text-neutral-900 shadow-md shadow-black/25 transition-colors hover:bg-admin-button-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300 sm:px-6 sm:text-xl">
                            {label}
                        </Link>
                    ))}
                </nav>
            </div>
        </div>
    );
}
