import AdminHeadingRow from "./AdminHeadingRow";
import AdminIndexHeading from "./AdminIndexHeading";

type AdminPlaceholderProps = {
    title: string;
    competitionSlug?: string;
};

export default function AdminPlaceholder({ title, competitionSlug }: AdminPlaceholderProps) {
    return (
        <div className="min-h-[75vh] px-5 pb-20 pt-28 text-slate-100 sm:px-10 sm:pt-36">
            <div className="mx-auto max-w-5xl">
                {competitionSlug ? (
                    <header className="mb-8">
                        <AdminHeadingRow backHref={`/admin/competitions/${encodeURIComponent(competitionSlug)}`} backLabel="Back to competition">
                            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
                        </AdminHeadingRow>
                    </header>
                ) : (
                    <AdminIndexHeading title={title} />
                )}
                <p className="border-t border-slate-400/50 py-5 text-slate-300">Placeholder</p>
            </div>
        </div>
    );
}
