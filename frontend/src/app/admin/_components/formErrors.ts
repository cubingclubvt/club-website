import { ApiError } from "@/lib/api";

export function errorFields(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

export function fieldErrorMessage(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    const messages = Array.isArray(value) ? value : Object.values(errorFields(value));
    return messages.map(fieldErrorMessage).filter(Boolean).join(" ") || undefined;
}

export function adminRequestError(failure: unknown, fallback: string) {
    if (!(failure instanceof ApiError)) return fallback;
    if (failure.status === 401 || failure.status === 403) return "Sign in again and retry.";
    const details = errorFields(failure.details);
    return fieldErrorMessage(details.detail ?? details.non_field_errors)
        ?? (Array.isArray(failure.details) ? fieldErrorMessage(failure.details) : undefined)
        ?? fallback;
}
