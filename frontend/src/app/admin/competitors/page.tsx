import AdminIndexHeading from "../_components/AdminIndexHeading";
import ManageCompetitors from "./ManageCompetitors";

export default function ManageCompetitorsPage() {
    return (
        <div className="min-h-[75vh] px-5 pb-20 pt-28 text-slate-100 sm:px-10 sm:pt-36">
            <div className="mx-auto max-w-4xl">
                <AdminIndexHeading title="Manage competitors" />
                <ManageCompetitors />
            </div>
        </div>
    );
}
