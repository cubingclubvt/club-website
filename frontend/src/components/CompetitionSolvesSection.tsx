'use client'

//TODO: maybe think about caching solve table results locally (


import SwitchClick from "@/components/SwitchClick";
import CompetitionScramblesButton from "@/components/CompetitionScramblesButton";
import type { ScrambleRound } from "@/types/Competition";
import type {Event} from "@/types/Event";
import {useEffect, useRef, useState} from "react";
import {SolveSession} from "@/types/SolveSession";
import Link from "next/link";
import { apiFetch } from "@/lib/api";


type EventData = {
    name: Event;
    rounds: number;
};


interface SolvesProps {
    slug: string,
    initialSolveData: SolveSession[];
    allEventData: EventData[];
    initialEvent: Event;
    initialRound: number;
    scrambleRounds: ScrambleRound[];
}


export default function CompetitionSolvesSection({
                                          slug, initialSolveData, allEventData, initialEvent, initialRound, scrambleRounds
                                      } : SolvesProps) {
    const [solveData, setSolveData] = useState(initialSolveData);
    const [event, setEvent] = useState(initialEvent);
    const [round, setRound] = useState(initialRound);
    const [numRounds, setNumRounds] = useState(allEventData.find(eventData => eventData.name === initialEvent)?.rounds || 3);
    const hasScrambles = scrambleRounds.some(item => item.event === event && item.round === round);

    //ismounted is here to prevent an unnecessary fetch when component mounts - just use data passed from prop on
    //initial mount! no need to refetch same data
    const isMounted = useRef(false);

    useEffect(() => {

        async function fetchSolves() {
          try {
            const competitionSolveData = await apiFetch(`/competitions/${encodeURIComponent(slug)}/${encodeURIComponent(event)}/${round}`, { cache: "no-store" });

            setSolveData(competitionSolveData);
          } catch (error) {
            console.error("Failed to fetch CompetitionSolves data", error);
          }
        }

        if (isMounted.current) {
            fetchSolves();
        } else {
            isMounted.current = true;
        }
    }, [round, event, slug]);

    function handleEventClick(event: Event) {
        setNumRounds(allEventData.find(eventData => eventData.name === event)?.rounds || 3);
        setEvent(event);
        setRound(1); 
    }

    function formatMobileName(name: string): string{
        const splitName = name.split(" ");
        return `${splitName[0]} ${splitName[splitName.length-1][0]}.`
    }


    return (
        <div>
            <div className={`mx-auto grid w-full max-w-5xl items-center justify-items-center gap-x-5 gap-y-4 px-6 pb-3 min-[420px]:grid-cols-[minmax(0,1fr)_auto] ${hasScrambles ? "lg:grid-cols-[minmax(0,1fr)_auto_auto]" : ""}`}>
                <SwitchClick type={"event"} events={allEventData.map(event => event.name)} initialEvent={event} changeFunction={handleEventClick} />
                <SwitchClick type={"round"} rounds={numRounds} initialRound={round} changeFunction={setRound} />
                {hasScrambles && (
                    <div className="min-[420px]:col-span-2 lg:col-span-1">
                        <CompetitionScramblesButton key={`${event}-${round}`} slug={slug} event={event} round={round} />
                    </div>
                )}
            </div>

            <div className="max-w-5xl w-full mx-auto px-6 pt-2 pb-10">

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-200">
                        <tr>
                            <th
                                scope="col"
                                className="w-20 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Rank
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Name
                            </th>

                            {/* This is kind of weird looking but basically the mobile/desktop order part only shows up on mobile/desktop, and
                            the other one is hidden. This effectively changes the order between solves and averages depending on device.*/}
                            {/* MOBILE ORDER */}
                            <th
                                scope="col"
                                className="md:hidden w-30 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Average
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Solves
                            </th>
                            {/* DESKTOP ORDER */}
                            <th
                                scope="col"
                                className="hidden md:table-cell w-30 px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Average
                            </th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-300">
                        {solveData.map((session: SolveSession, index: number) => (
                            <tr key={session.name} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-md text-center font-medium text-gray-700">
                                    {index + 1}
                                </td>
                                <td className="whitespace-nowrap text-lg text-gray-700">
                                    <Link
                                        href={`/competitors/${session.school_id}`}
                                        className="px-6 py-4 block w-full h-full hover:text-orange-400">
                                        {/* MOBILE VERSION (abbreviated) */}
                                        <span className="md:hidden">{formatMobileName(session.name)}</span>

                                        {/* DESKTOP VERSION */}
                                        <span className="hidden md:inline">{session.name}</span>
                                    </Link>
                                </td>

                                {/* MOBILE ORDER */}
                                <td className="md:hidden px-6 py-4 whitespace-nowrap text-center text-md text-gray-700">
                                    {session.average}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-center text-md text-gray-700">
                                    {session.solves.join(", ")}
                                </td>

                                {/* DESKTOP ORDER */}
                                <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-center text-md text-gray-700">
                                    {session.average}
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
