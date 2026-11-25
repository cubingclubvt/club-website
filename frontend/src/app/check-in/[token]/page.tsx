import { apiFetch, ApiError } from "@/lib/api";
import { checkInPath, type CheckInWave } from "@/lib/grouping";
import CheckInForm from "./CheckInForm";
import { notFound } from "next/navigation";

export const metadata = { title: "Competition check-in · Cubing Club at VT", robots: { index: false, follow: false } };

export default async function PublicCheckIn({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    let competition: { name: string; closed: boolean; waves: CheckInWave[] };
    try {
        competition = await apiFetch(`/competitions${checkInPath(token)}`, { cache: "no-store" });
    } catch (failure) {
        if (failure instanceof ApiError && failure.status === 404) notFound();
        throw failure;
    }
    return (
        <section className="mx-auto w-full max-w-xl px-5 pb-16 pt-28 sm:pt-36">
            <h1 className="text-3xl font-semibold text-white">Competition check-in</h1>
            <p className="mb-6 mt-2 text-orange-200">{competition.name}</p>
            {competition.closed || !competition.waves.length ? (
                <p className="rounded-md bg-slate-50 p-5 text-slate-900">
                    {competition.closed ? "Check-in has closed." : "There are no waves open for check-in. Ask an organizer for help."}
                </p>
            ) : <CheckInForm token={token} waves={competition.waves} />}
        </section>
    );
}
