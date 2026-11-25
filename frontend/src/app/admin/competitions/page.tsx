import {Competition} from "@/types/Competition";
import CompetitionCard from "@/components/CompetitionCard";
import AdminIndexHeading from "../_components/AdminIndexHeading";
import { adminCompetitionFetch } from "./_lib/adminCompetitionFetch";
import Link from "next/link";

const views = [
    { status: "unpublished", label: "Unpublished", href: "/admin/competitions" },
    { status: "published", label: "Published", href: "/admin/competitions?status=published" },
] as const;

async function Competitions({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
    const { status } = await searchParams;
    const activeStatus = status === "published" ? "published" : "unpublished";
    const competitions: Competition[] = process.env.DISABLE_BACKEND === 'false' ? await adminCompetitionFetch("") : [];
    const visibleCompetitions = competitions.filter(
        competition => (competition.is_published === true) === (activeStatus === "published"),
    );


    return (
        <div className="min-h-[75vh] px-5 pb-20 pt-28 text-slate-100 sm:px-10 sm:pt-36">
            <div className="mx-auto max-w-4xl">
                <AdminIndexHeading title="Manage competitions" />
                <nav aria-label="Competition visibility" className="mb-5 flex flex-wrap gap-2">
                    {views.map(({ status, label, href }) => (
                        <Link
                            key={status}
                            href={href}
                            aria-current={activeStatus === status ? "page" : undefined}
                            className={activeStatus === status
                                ? "rounded-sm bg-orange-300 px-3 py-2 text-sm text-neutral-900"
                                : "rounded-sm border border-slate-400/50 px-3 py-2 text-sm hover:border-orange-300"}
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
                <div className="grid gap-4">
                    {visibleCompetitions.length === 0 && <p className="border-t border-slate-400/50 py-5 text-slate-300">No {activeStatus} competitions.</p>}
                    {visibleCompetitions.map(competition => (
                        <CompetitionCard key={competition.id} competition={competition} update />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Competitions;
