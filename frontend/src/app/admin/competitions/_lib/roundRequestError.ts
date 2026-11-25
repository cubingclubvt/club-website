import { ApiError } from "@/lib/api";

export default function roundRequestError(error: unknown, fallback: string) {
    if (!(error instanceof ApiError)) return fallback;
    if (error.status === 403 || error.status === 401) return "Sign in again to manage this round.";
    if (error.status === 404) return "This record is no longer available. Reload the round for current data.";
    if (!error.details || typeof error.details !== "object") return fallback;
    for (const value of Object.values(error.details)) {
        if (typeof value === "string") return value;
        if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
    return fallback;
}
