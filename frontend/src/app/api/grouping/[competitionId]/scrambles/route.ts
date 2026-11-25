import { randomScrambleForEvent } from "cubing/scramble";
import { type NextRequest } from "next/server";
import { scrambleEventCode } from "@/lib/scrambleEvents";
import appPackage from "../../../../../../package.json";

export const runtime = "nodejs";
export const maxDuration = 60;

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type SetRequest = { group_id: number; round_id: number; event: string; attempts: number; extras: number };
type ScrambleJobs = { created?: number; missing: SetRequest[] };
type GeneratedSet = Pick<SetRequest, "group_id" | "round_id"> & { scrambles: string[]; extra_scrambles: string[] };

function eventCode(event: string) {
    const code = scrambleEventCode(event);
    // Multi-blind needs a separate scramble for each cube being attempted.
    return code === "333mbf" ? undefined : code;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ competitionId: string }> }) {
    const { competitionId } = await params;
    const session = request.cookies.get("sessionid")?.value;
    const csrftoken = request.cookies.get("csrftoken")?.value;
    if (!session || !csrftoken) return Response.json({ detail: "Sign in again to generate scrambles." }, { status: 403 });
    if (!/^[1-9]\d*$/.test(competitionId)) return Response.json({ detail: "Competition not found." }, { status: 404 });
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!host || !origin || (origin !== `https://${host}` && origin !== `http://${host}`)) {
        return Response.json({ detail: "Open the admin page to generate scrambles." }, { status: 403 });
    }

    const headers = {
        Cookie: `sessionid=${session}; csrftoken=${csrftoken}`, Origin: origin,
        "X-CSRFToken": csrftoken, "Content-Type": "application/json", Accept: "application/json",
    };
    const path = `${apiBase}/competitions/admin/${competitionId}/grouping/scrambles`;
    const started = Date.now();
    try {
        const jobs = await fetch(path, { cache: "no-store", headers });
        if (!jobs.ok) return Response.json(await jobs.json(), { status: jobs.status });
        const { missing }: ScrambleJobs = await jobs.json();
        const supported = missing.flatMap(item => {
            const code = eventCode(item.event);
            return code ? [{ item, code }] : [];
        });
        const errors: string[] = [];
        const sets: GeneratedSet[] = [];
        for (const { item, code } of supported.slice(0, 4)) {
            try {
                const moves = [];
                for (let index = 0; index < item.attempts + item.extras; index++) {
                    moves.push((await randomScrambleForEvent(code)).toString());
                }
                sets.push({
                    group_id: item.group_id, round_id: item.round_id,
                    scrambles: moves.slice(0, item.attempts), extra_scrambles: moves.slice(item.attempts),
                });
            } catch (error) {
                console.error(`Scramble generation failed for ${code}`, error);
                errors.push(item.event);
            }
            if (Date.now() - started > 40000) break;
        }
        let result: ScrambleJobs = { created: 0, missing };
        if (sets.length) {
            const saved = await fetch(path, {
                method: "POST", cache: "no-store", headers,
                body: JSON.stringify({ sets, version: appPackage.dependencies.cubing }),
            });
            if (!saved.ok) return Response.json(await saved.json(), { status: saved.status });
            result = await saved.json();
        }
        return Response.json({
            created: result.created ?? 0,
            remaining: result.missing.some(item => eventCode(item.event)),
            unsupported: [...new Set(result.missing.filter(item => !eventCode(item.event)).map(item => item.event))],
            failed: [...new Set(errors)],
        });
    } catch (error) {
        console.error("Could not prepare group scrambles", error);
        return Response.json({ detail: "Could not generate scrambles. Retry from the groups page." }, { status: 502 });
    }
}
