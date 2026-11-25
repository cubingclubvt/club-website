"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiBodyFetch } from "@/lib/api";

export default function PublicationButton({ competitionId, isPublished }: { competitionId: number; isPublished: boolean }) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function changePublication() {
        setSaving(true);
        setError("");
        try {
            await apiBodyFetch(`/competitions/admin/${competitionId}/publication`, "PATCH", { is_published: !isPublished });
            router.refresh();
        } catch {
            setError("Could not change competition visibility. Try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div>
            <button
                type="button"
                onClick={changePublication}
                disabled={saving}
                className={`min-h-11 rounded-sm border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 disabled:opacity-60 ${isPublished
                    ? "border-slate-300 bg-white hover:bg-slate-100"
                    : "border-transparent bg-orange-300 hover:bg-admin-button-hover"}`}
            >
                {saving ? "Saving…" : isPublished ? "Unpublish competition" : "Publish competition"}
            </button>
            {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
    );
}
