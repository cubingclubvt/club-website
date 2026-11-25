import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { RecordedSolve } from "../_lib/solves";
import roundRequestError from "../_lib/roundRequestError";

export default function useRoundSolves(path: string) {
    const [solves, setSolves] = useState<RecordedSolve[] | null>(null);
    const [error, setError] = useState("");
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        let active = true;
        apiFetch(path, { cache: "no-store" })
            .then((data: RecordedSolve[]) => { if (active) setSolves(data); })
            .catch((failure: unknown) => {
                if (active) setError(roundRequestError(failure, "Could not load solves."));
            });
        return () => { active = false; };
    }, [path, revision]);

    function reload() {
        setError("");
        setSolves(null);
        setRevision(previous => previous + 1);
    }

    return { solves, setSolves, error, reload };
}
