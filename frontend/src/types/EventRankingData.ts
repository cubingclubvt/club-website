import type {Event} from "@/types/Event";

export type EventRankingData = {
    event_name: Event;
    best_single: number;
    best_average: number;
    single_ranking: number;
    average_ranking: number;
};