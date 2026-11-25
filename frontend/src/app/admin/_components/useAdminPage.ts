import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";

type Page<T> = { results: T[]; page: number; total_pages: number; count: number };

export default function useAdminPage<T>(path: string, fallbackError: string) {
    const [revision, setRevision] = useState(0);
    const key = JSON.stringify([path, revision]);
    const [state, setState] = useState<{ key: string; data?: Page<T>; error?: string }>();

    useEffect(() => {
        let active = true;
        apiFetch(path, { cache: "no-store" })
            .then((data: Page<T>) => { if (active) setState({ key, data }); })
            .catch((failure: unknown) => {
                if (!active) return;
                const signedOut = failure instanceof ApiError && (failure.status === 401 || failure.status === 403);
                setState({ key, error: signedOut ? "Sign in again to access this page." : fallbackError });
            });
        return () => { active = false; };
    }, [key, path, fallbackError]);

    return {
        data: state?.key === key ? state.data : undefined,
        error: state?.key === key ? state.error : undefined,
        reload: () => setRevision(previous => previous + 1),
    };
}
