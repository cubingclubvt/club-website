'use client'

import SwitchClick from "@/components/SwitchClick";
import {EventRankingData} from "@/types/EventRankingData";
import {Event} from "@/types/Event";
import {useEffect, useRef, useState} from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface CompletedSolvesProps {
    slug: string;
    event_rankings: EventRankingData[];
    initialSolveData: SingularCompetitionSolveData[];
    initialEvent: Event;
}

interface CompletedSolvesData {
    single: string;
    average: string;
    rank: number;
    solves: string[];
    round_number: number;
}

interface SingularCompetitionSolveData {
    competition_name: string;
    round_results: CompletedSolvesData[];
}

export default function CompletedSolvesSection({ slug, event_rankings, initialSolveData, initialEvent } : CompletedSolvesProps) {

    const [event, setEvent] = useState(initialEvent);
    const [solveData, setSolveData] = useState(initialSolveData);

    const isMounted = useRef(false);

    useEffect(() => {
        async function fetchSolves() {
            try {
                const completedSolvesData = await apiFetch(`/competitions/competitor/${slug}/${event}`);
                setSolveData(completedSolvesData);
            } catch (error) {
                console.error("Failed to fetch CompetitionSolves data", error);
            }
        }

        if (isMounted.current) {
            fetchSolves();
        } else {
            isMounted.current = true;
        }
    }, [event, slug]);

    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">Completed Solves</h2>
            {/* MOBILE-FRIENDLY CHANGE: The container is now full width on mobile (w-full) and a third of the width on medium screens and up (md:w-1/3) */}
            <div className={"mx-auto w-full md:w-1/3"}>
                <SwitchClick
                    type={"event"}
                    events={event_rankings.map((eventRanking: EventRankingData) => eventRanking.event_name)}
                    initialEvent={event}
                    changeFunction={setEvent}
                />
            </div>

            <div className="text-center text-gray-600 mt-6 overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-400">
                    <thead>
                    <tr className="bg-gray-100">
                        {/* MOBILE-FRIENDLY CHANGE: Use smaller font size and padding for table headers */}
                        <th className="border border-gray-400 px-2 py-3 text-left text-gray-700 font-medium text-xs sm:text-base">Competition</th>
                        <th className="border border-gray-400 px-2 py-3 text-center text-gray-700 font-medium text-xs sm:text-base">Rd</th>
                        <th className="border border-gray-400 px-2 py-3 text-center text-gray-700 font-medium text-xs sm:text-base">Rank</th>
                        <th className="border border-gray-400 px-2 py-3 text-center text-gray-700 font-medium text-xs sm:text-base">Single</th>
                        <th className="border border-gray-400 px-2 py-3 text-center text-gray-700 font-medium text-xs sm:text-base">Average</th>
                        <th className="border border-gray-400 px-2 py-3 text-center text-gray-700 font-medium text-xs sm:text-base">Solves</th>
                    </tr>
                    </thead>

                    <tbody>
                    {solveData.map((singularComp: SingularCompetitionSolveData) => (
                        singularComp.round_results.map((singularSolve: CompletedSolvesData, index) => (
                            <tr key={`${singularComp.competition_name}-${singularSolve.round_number}`} className={"hover:bg-gray-50"}>
                                {index === 0 && (
                                    <td
                                        className="border-l border-t border-b border-gray-400 text-left text-gray-800 align-top text-xs sm:text-base"
                                        rowSpan={singularComp.round_results.length}
                                    >
                                        <Link
                                            href={`/competitions/${singularComp.competition_name.replace(/\s+/g, '-')}`}
                                            className="px-2 sm:px-4 py-3 block w-full h-full hover:text-orange-400">
                                            <span className="">{singularComp.competition_name}</span>
                                        </Link>
                                    </td>
                                )}
                                <td className={"border border-gray-400 px-2 py-3 text-center text-gray-700 text-xs sm:text-base"}>
                                    {singularSolve.round_number}</td>
                                <td className={"border border-gray-400 px-2 py-3 text-center text-gray-700 text-xs sm:text-base"}>
                                    {singularSolve.rank}</td>
                                <td className={"border border-gray-400 px-2 py-3 text-center font-semibold text-gray-800 text-xs sm:text-base"}>
                                    {singularSolve.single}</td>
                                <td className={"border border-gray-400 px-2 py-3 text-center font-semibold text-gray-800 text-xs sm:text-base"}>
                                    {singularSolve.average}</td>
                                <td className={"border border-gray-400 px-2 py-3 text-center text-gray-700 text-xs sm:text-base"}>
                                    {singularSolve.solves.join(", ")}</td>
                            </tr>
                        ))
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}