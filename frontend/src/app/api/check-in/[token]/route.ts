import { checkInPath } from "@/lib/grouping";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
    try {
        const response = await fetch(`${base}/competitions${checkInPath(token)}`, {
            method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: await request.text(),
        });
        return Response.json(await response.json(), { status: response.status, headers: { "Cache-Control": "no-store" } });
    } catch {
        return Response.json({ detail: "Could not reach check-in." }, { status: 502 });
    }
}
