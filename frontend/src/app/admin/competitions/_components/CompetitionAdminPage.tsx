import type { ReactNode } from "react";
import AdminHeadingRow from "../../_components/AdminHeadingRow";

export default function CompetitionAdminPage({ title, competitionName, slug, children, wide = false, backHref, backLabel = "Back to competition" }: {
    title: string;
    competitionName: string;
    slug: string;
    children: ReactNode;
    wide?: boolean;
    backHref?: string;
    backLabel?: string;
}) {
    return (
        <div className={`min-h-[75vh] px-5 pb-20 pt-28 text-slate-100 sm:px-10 sm:pt-36 ${wide ? "xl:px-32" : ""}`}>
            <div className={`mx-auto ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
                <AdminHeadingRow backHref={backHref ?? `/admin/competitions/${encodeURIComponent(slug)}`} backLabel={backLabel}>
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
                </AdminHeadingRow>
                <p className="mb-7 mt-3 text-lg text-orange-200">{competitionName}</p>
                {children}
            </div>
        </div>
    );
}
