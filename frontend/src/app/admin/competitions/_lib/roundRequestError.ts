import { ApiError } from "@/lib/api";
import { adminRequestError, errorFields, fieldErrorMessage } from "../../_components/formErrors";

export default function roundRequestError(error: unknown, fallback: string) {
    if (!(error instanceof ApiError)) return fallback;
    if (error.status === 403 || error.status === 401) return "Sign in again to manage this round.";
    if (error.status === 404) return "This record is no longer available. Reload the round for current data.";
    const firstFieldMessage = Object.values(errorFields(error.details)).map(fieldErrorMessage).find(Boolean);
    return adminRequestError(error, firstFieldMessage ?? fallback);
}
