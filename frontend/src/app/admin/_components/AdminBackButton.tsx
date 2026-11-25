import Link from "next/link";

export default function AdminBackButton({ href = "/admin", label = "Back to admin" }: { href?: string; label?: string }) {
    return (
        <Link href={href} aria-label={label} className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-orange-300 px-3 py-2 text-xs font-semibold text-neutral-900 shadow-md shadow-black/25 transition-colors hover:bg-admin-button-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300 sm:px-4 sm:text-sm">
            <span aria-hidden="true">←</span>
            Back
        </Link>
    );
}
