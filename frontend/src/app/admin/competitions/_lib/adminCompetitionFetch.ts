import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";

export async function adminCompetitionFetch(path: string) {
    const session = (await cookies()).get("sessionid");
    if (!session) redirect("/admin");

    try {
        return await apiFetch(`/competitions/admin/${path}`, {
            cache: "no-store",
            headers: { Cookie: `sessionid=${session.value}` },
        });
    } catch (error) {
        if (error instanceof ApiError) {
            if (error.status === 401 || error.status === 403) redirect("/admin");
            if (error.status === 404) notFound();
        }
        throw error;
    }
}
