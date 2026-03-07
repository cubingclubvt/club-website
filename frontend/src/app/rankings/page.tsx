
import {Event} from "@/types/Event";
import RankingsSection from "@/components/RankingsSection";
import { apiFetch } from "@/lib/api";

export default async function Rankings() {
  let eventOptions: Event[] = [];

    try {
      const { events } = await apiFetch("/competitions/rankings/");

      if (!events || events.length === 0 ) {
        throw new Error("No events returned from API");
      }

      eventOptions = events;
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }

    const initialEvent = eventOptions[0];
    const initialCalculation = "single";
    // const rankingsData: any;
    let rankingsData = [];

    if (process.env.DISABLE_BACKEND === 'false') {
      try {
        rankingsData = await apiFetch(`/competitions/rankings/${initialEvent}/${initialCalculation}`);
      } catch (error) {
        console.error("Failed to fetch rankings data:", error);
        rankingsData = []; // fallback to empty array on failure
      }
    }


    return (
        <div>

            <h1 className={"text-white text-center text-5xl mt-24 mb-12"}>
                Rankings
            </h1>

            <RankingsSection
                initialRankingsData={rankingsData}
                initialEvent={initialEvent}
                initialCalc={initialCalculation}
            />

        </div>
    )
}
