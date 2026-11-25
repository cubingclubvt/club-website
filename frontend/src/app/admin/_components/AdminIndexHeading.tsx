import AdminHeadingRow from "./AdminHeadingRow";

export default function AdminIndexHeading({ title }: { title: string }) {
    return (
        <header className="mb-8">
            <AdminHeadingRow>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold tracking-tight sm:text-3xl lg:text-5xl">{title}</h1>
            </AdminHeadingRow>
        </header>
    );
}
