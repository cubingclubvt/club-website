
'use client';

import Link from "next/link";
import SwitchClick from "@/components/SwitchClick";
import {useEffect, useRef, useState} from "react";
import type {Event} from "@/types/Event";
import { apiFetch } from "@/lib/api";




type SingularRankingData = {
    competitor_name: string;
    school_id: string;
    rank: number;
    competition_name: string;
    result: string;
};

interface RankingsProps {
    initialRankingsData: SingularRankingData[];
    initialEvent: Event;
    initialCalc: string;
}



export default function RankingsSection({initialRankingsData, initialEvent, initialCalc} : RankingsProps) {

    const [rankingsData, setRankingsData] = useState(initialRankingsData);
    const [event, setEvent] = useState(initialEvent);
    const [calculation, setCalculation] = useState(initialCalc);

    const isMounted = useRef(false);

    useEffect(() => {

        async function fetchRankings() {
            try {
                const rankingsData = await apiFetch(`/competitions/rankings/${event}/${calculation}`);
                setRankingsData(rankingsData);
            } catch (error) {
                console.error("Failed to fetch rankings data:", error);
            }
        }

        if (isMounted.current) {
            fetchRankings();
        } else {
            isMounted.current = true;
        }
    }, [event, calculation]);





    return (
        <div>
            {/* MOBILE-FRIENDLY CHANGE:
            Use flex-col to stack items on mobile, then md:flex-row to return to a row layout on medium-sized screens and up.
            Also, add gap-4 for spacing.
            */}
            <div className={"flex flex-col md:flex-row justify-around max-w-5xl w-full mx-auto items-center gap-4"}>
                {/* Add a max-width to the SwitchClick container to prevent it from stretching too wide on smaller screens.
                Use mx-auto to center it.
                */}
                <div className="max-w-sm mx-auto">
                    <SwitchClick
                        type={"event"}
                        events={["3x3", "2x2", "4x4", "Clock", "Pyraminx", "Skewb"]}
                        initialEvent={event}
                        changeFunction={setEvent}
                    />
                </div>
                <div className="max-w-sm mx-auto">
                    <SwitchClick
                        type={"calculation"}
                        initialCalculation={calculation}
                        changeFunction={setCalculation}
                    />
                </div>
            </div>

            <div className="max-w-5xl w-full mx-auto px-2 sm:px-6 pt-2 pb-10">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-200">
                        <tr>
                            {/* Use responsive width for columns. w-16 on mobile, w-20 on medium screens */}
                            <th scope="col" className="w-16 md:w-20 px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rank
                            </th>
                            <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name
                            </th>
                            <th scope="col" className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Result
                            </th>
                            <th scope="col" className="w-24 md:w-30 px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Competition
                            </th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-300">
                        {rankingsData.map((singularRanking: SingularRankingData) => (
                            <tr key={`${singularRanking.competitor_name}-${singularRanking.rank}`} className="hover:bg-gray-50">
                                {/* Use smaller padding on mobile for tighter table columns */}
                                <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-md text-center font-medium text-gray-700">
                                    {singularRanking.rank}
                                </td>
                                <td className="whitespace-nowrap text-lg text-gray-700">
                                    <Link
                                        href={`/competitors/${singularRanking.school_id}`}
                                        className="px-4 sm:px-6 py-4 block w-full h-full hover:text-orange-400">
                                        <span className="">{singularRanking.competitor_name}</span>
                                    </Link>
                                </td>
                                <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-center text-md text-gray-700">
                                    {singularRanking.result}
                                </td>
                                <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-center text-md text-gray-700">
                                    <Link
                                        href={`/competitions/${singularRanking.competition_name.replace(/\s+/g, '-')}`}
                                        className="px-4 sm:px-6 py-4 block w-full h-full hover:text-orange-400">
                                        <span className="">{singularRanking.competition_name}</span>
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

}
