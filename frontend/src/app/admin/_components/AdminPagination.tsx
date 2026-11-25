export default function AdminPagination({ page, totalPages, onPageChange }: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}) {
    if (totalPages < 2) return null;
    const button = "min-h-10 rounded-sm border border-slate-300 bg-white px-3 text-sm font-semibold enabled:hover:bg-orange-100 disabled:opacity-50";

    return (
        <nav aria-label="Pagination" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <button type="button" className={button} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
            <p className="text-sm text-slate-700">Page {page} of {totalPages}</p>
            <button type="button" className={button} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
        </nav>
    );
}
