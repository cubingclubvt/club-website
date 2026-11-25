import { adminCompetitionFetch } from "./adminCompetitionFetch";
import type { CompetitionDetails } from "../_components/CompetitionDetailsFields";
import type { SolveRound } from "./solves";

type AdminCompetition = CompetitionDetails & {
    id: number | null;
    isPublished: boolean;
    date: string;
    competitorCount: number | string;
    events: { name: string; rounds: number }[];
    availableEvents: string[];
    solveRounds: SolveRound[];
};

export async function getCompetition(slug: string): Promise<AdminCompetition> {
    if (process.env.DISABLE_BACKEND !== "false") {
        return {
            id: null, isPublished: false, name: "Competition", date: "N/A", competitorCount: 0,
            events: [], availableEvents: [], solveRounds: [],
            location: "", start_time: "", end_time: "", official: false, official_link: null,
        };
    }

    const data = await adminCompetitionFetch(encodeURIComponent(slug));
    if (!data || typeof data !== "object") {
        throw new Error("Invalid competition details");
    }

    return {
        id: data.id,
        isPublished: data.is_published === true,
        name: typeof data.name === "string" && data.name ? data.name : "Unknown competition",
        location: data.location,
        start_time: typeof data.start_time === "string" ? data.start_time.slice(0, 16) : "",
        end_time: typeof data.end_time === "string" ? data.end_time.slice(0, 16) : "",
        official: data.official,
        official_link: data.official_link,
        date: typeof data.date === "string" && data.date ? data.date : "Date not available",
        competitorCount: typeof data.num_competitors === "number" && data.num_competitors >= 0
            ? data.num_competitors
            : "Unknown",
        events: Array.isArray(data.events) ? data.events : [],
        availableEvents: Array.isArray(data.available_events) ? data.available_events : [],
        solveRounds: Array.isArray(data.solve_rounds) ? data.solve_rounds : [],
    };
}
