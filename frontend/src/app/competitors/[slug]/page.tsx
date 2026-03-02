import { apiFetch } from "@/lib/api";
import type { Event } from "@/types/Event";
import CompletedSolvesSection from "@/components/CompletedSolvesSection";
import {EventRankingData} from "@/types/EventRankingData";

interface CompetitorProps {
    params: Promise<{
        slug: string;
    }>;
}

async function CompetitorDetail({ params } : CompetitorProps) {
    const { slug } = await params;
    const initialEvent: Event = "3x3";

    let firstname = "";
    let lastname = "";
    let school_id = "";
    let grade = 0;
    let first_comp_date = "";
    let num_competitions = 0;
    let total_solves = 0;
    let event_rankings = [];
    let initialCompletedSolvesData = [];

    if (process.env.DISABLE_BACKEND === 'false') {
        try {
            const competitorData = await apiFetch(`/competitions/competitor/${slug}`);
            firstname = competitorData.first_name;
            lastname = competitorData.last_name;
            school_id = competitorData.school_id;
            grade = competitorData.grade;
            first_comp_date = competitorData.first_competition_date;
            num_competitions = competitorData.num_competitions;
            total_solves = competitorData.total_solves;
            event_rankings = competitorData.event_rankings;
            initialCompletedSolvesData = await apiFetch(`/competitions/competitor/${slug}/${initialEvent}`);
        } catch (error) {
            console.error("Failed to fetch competitor data:", error);
        }
    }

    //TODO: change initial event to actually be a valid event in their history

    return (
        <div className="mt-40 mb-10 max-w-5xl mx-auto p-4 sm:p-6 bg-white">
            <div className="text-center mb-8">
                <div className={"mb-6"}>
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">{`${firstname} ${lastname}`}</h1>
                    <h3 className={"p-2 text-sm text-slate-300"}>{school_id}</h3>
                </div>

                {/* MOBILE-FRIENDLY CHANGE: Use a two-column grid on mobile (sm:grid-cols-2) and a four-column grid on larger screens (md:grid-cols-4). */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-center">
                    <div>
                        <div className="text-sm text-gray-600 mb-1">Year</div>
                        <div className="text-lg font-semibold text-gray-800">{`${grade}`}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 mb-1">Competing since</div>
                        <div className="text-lg font-semibold text-gray-800">{`${first_comp_date}`}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 mb-1">Comps attended</div>
                        <div className="text-lg font-semibold text-gray-800">{`${num_competitions}`}</div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 mb-1">Total solves</div>
                        <div className="text-lg font-semibold text-gray-800">{`${total_solves}`}</div>
                    </div>
                </div>
            </div>

            <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">Personal Records</h2>
                {/* Ensure table is scrollable on small screens */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-400">
                        <thead>
                        <tr className="bg-gray-100">
                            {/* MOBILE-FRIENDLY CHANGE: Use smaller padding (px-2) on mobile for tighter columns */}
                            <th className="border border-gray-400 px-2 sm:px-4 py-3 text-left text-gray-700 font-medium text-xs sm:text-base">Event</th>
                            <th className="border border-gray-400 px-2 sm:px-4 py-3 text-center text-gray-700 font-medium text-xs sm:text-base">CR</th>
                            <th className="border border-gray-400 px-2 sm:px-4 py-3 text-center text-gray-700 font-medium text-xs sm:text-base">AR</th>
                            <th className="border border-gray-400 px-2 sm:px-4 py-3 text-center text-gray-700 font-medium text-xs sm:text-base">Single</th>
                            <th className="border border-gray-400 px-2 sm:px-4 py-3 text-center text-gray-700 font-medium text-xs sm:text-base">Average</th>
                            <th className="border border-gray-400 px-2 sm:px-4 py-3 text-center text-gray-700 font-medium text-xs sm:text-base">AR</th>
                            <th className="border border-gray-400 px-2 sm:px-4 py-3 text-center text-gray-700 font-medium text-xs sm:text-base">CR</th>
                        </tr>
                        </thead>
                        <tbody>
                        {event_rankings.map((eventRanking: EventRankingData) => (
                            <tr key={eventRanking.event_name} className={"hover:bg-gray-50"}>
                                <td className={"border border-gray-400 px-2 sm:px-4 py-3 font-medium text-gray-800 text-xs sm:text-base"}>
                                    {eventRanking.event_name ?? "N/A"}</td>
                                <td className={"border border-gray-400 px-2 sm:px-4 py-3 text-center text-gray-700 text-xs sm:text-base"}>
                                  {eventRanking.current_single_ranking ?? "N/A"}</td>
                                <td className={"border border-gray-400 px-2 sm:px-4 py-3 text-center text-gray-700 text-xs sm:text-base"}>
                                    {eventRanking.single_ranking ?? "N/A"}</td>
                                <td className={"border border-gray-400 px-2 sm:px-4 py-3 text-center font-semibold text-gray-800 text-xs sm:text-base"}>
                                    {eventRanking.best_single ?? "N/A"}</td>
                                <td className={"border border-gray-400 px-2 sm:px-4 py-3 text-center font-semibold text-gray-800 text-xs sm:text-base"}>
                                    {eventRanking.best_average ?? "N/A"}</td>
                                <td className={"border border-gray-400 px-2 sm:px-4 py-3 text-center text-gray-700 text-xs sm:text-base"}>
                                    {eventRanking.average_ranking ?? "N/A"}</td>
                                <td className={"border border-gray-400 px-2 sm:px-4 py-3 text-center text-gray-700 text-xs sm:text-base"}>
                                    {eventRanking.current_average_ranking ?? "N/A"}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <CompletedSolvesSection
                slug={slug}
                event_rankings={event_rankings}
                initialSolveData={initialCompletedSolvesData}
                initialEvent={initialEvent}
            />
        </div>
    );
}

export default CompetitorDetail;
