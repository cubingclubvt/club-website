
'use client';

import CompetitorUpdateEntry from "@/components/CompetitorUpdateEntry";
import React, {FormEvent, useEffect, useState} from "react";
import type {Event} from "@/types/Event";
import SwitchClick from "@/components/SwitchClick";
import Link from "next/link";
import {apiFetch, apiBodyFetch } from "@/lib/api";
import { useSearchParams } from "next/navigation";



interface UpdateProps {
    slug: string;
    allEventData: EventData[];
    initialEvent: Event;
    initialRound: number;
}

interface Competitor {
    "first_name": string;
    "last_name": string;
    school_id: string;
    "grade": number;
}

type EventData = {
    name: Event;
    rounds: number;
};


interface SolveUpdateEntry {
    competitor: Competitor;
    solves: string[];
}


interface SolveUpdatePayload {
  results: {
    school_id: string;   
    solves: string[];  
  }[];
}


//TODO: separate this page into server (top part) and client components (bottom part, under separator) for better resource management

function UpdateSolvesSection({ slug, allEventData, initialEvent, initialRound }: UpdateProps){

    const searchParams = useSearchParams();
    const secret = searchParams.get("secret");

    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false); // Add this state
    const [backendError, setBackendError] = useState("");
    const [validationError, setValidationError] = useState("");

    const [event, setEvent] = useState(initialEvent);
    const [round, setRound] = useState(initialRound);
    const [numRounds, setNumRounds] = useState(allEventData.find(eventData => eventData.name === initialEvent)?.rounds || 3);

    const [solveEntries, setSolveEntries] = useState<SolveUpdateEntry[]>([]);


    // const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
    const [allCompetitors, setAllCompetitors] = useState<Competitor[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [dropdownVisible, setDropdownVisible] = useState(false);


    useEffect(() => {

      async function fetchCompetitors() {
        try {
          const data = await apiFetch("/competitions/competitor/");
          setAllCompetitors(data.competitors);
        } catch (err) {
          console.error("Error fetching competitors:", err);
        }
}

        fetchCompetitors();

    }, []);

    const filteredCompetitors = allCompetitors.filter(c =>
        (`${c.first_name} ${c.last_name} ${c.school_id}`).toLowerCase().includes(searchTerm.toLowerCase())
    );


    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setDropdownVisible(true);
        // Optionally update formData here if you want to sync the input
    };

    const handleSelect = (c: Competitor) => {
        setSearchTerm("");
        setDropdownVisible(false);
        setSolveEntries(prev => [{competitor: c, solves: ["", "", "", "", ""]}, ...prev])

        setAllCompetitors(prev => prev.filter(competitor => competitor.school_id !== c.school_id));
    };


    function handleEventClick(event: Event) {
        setNumRounds(allEventData.find(eventData => eventData.name === event)?.rounds || 3);
        setEvent(event);
    }

    function handleSolveInputChange(school_id: string, solveNumber: number, solveString: string) {
        setSolveEntries(prevEntries =>
            prevEntries.map(entry => {
                if (entry.competitor.school_id === school_id) {
                    const updatedSolves = [...entry.solves];
                    updatedSolves[solveNumber - 1] = solveString;

                    return {
                        ...entry,
                        solves: updatedSolves
                    };
                }
                return entry;
            })
        );
    }

    const handleDeleteCompetitor = (incomingC: Competitor) => {
        // Remove competitor from formData
        const updatedEntries = solveEntries.filter(
            entry => entry.competitor.school_id !== incomingC.school_id
        );
        setSolveEntries(updatedEntries);

        // Add competitor back to allCompetitors so they can be selected again
        setAllCompetitors(prev => {

            const foundCompetitor = prev.find(competitor => {
                return competitor.school_id === incomingC.school_id;
            });

            if (!foundCompetitor) {
                return [...prev, incomingC]
            }
            return prev;
        });
    };

    function validateAllSolves(): boolean {
        // Use Array.prototype.every() to check if ALL entries pass the test
        return solveEntries.every(entry => {
            // Use Array.prototype.every() again to check if ALL solves in the current entry pass the test
            return entry.solves.every(solveString => {
                const trimmedStr = solveString.trim();

                // 1. Check for "DNF" (case-insensitive for robustness, or make it exact if required)
                if (trimmedStr.toLowerCase() === 'dnf') {
                    return true;
                }

                // 2. Check if it's a valid number
                if (trimmedStr === '') {
                    return false; // Treat empty string as invalid, even if not DNF
                }
                const num = Number(trimmedStr);
                return !isNaN(num) && isFinite(num);

            });
        });
    }



    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();

        if (!validateAllSolves()) {
            setValidationError("All solve data must be valid numbers or 'DNF'");
            setBackendError("");
        } else {
            setValidationError("");
            setIsLoading(true);
            console.log('Form submitted:', solveEntries);

            const updateSolvesData: SolveUpdatePayload = {
              results: solveEntries.map(entry => ({
                school_id: entry.competitor.school_id,
                solves: entry.solves,
              })),
            };

            console.log('Data:', updateSolvesData);

            try {
              let searchPath = `/competitions/${slug}/${event}/${round}/update`;

              if (secret != null){
                searchPath = searchPath + `?secret=${encodeURIComponent(secret)}`;
              }
              const result = await apiBodyFetch<SolveUpdatePayload>(
                searchPath,
                "PATCH",
                updateSolvesData
              );

              console.log("Competition solves updated via proxy:", result);
              setIsSubmitted(true);

            } catch (error) {
              console.error("Error updating competition solves via proxy:", error);
              setBackendError("Error updating competition solves");
            } finally {
              setIsLoading(false);
            }

        }

    };

    if (isSubmitted) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl  p-8 text-center text-black max-w-md w-full">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Success!</h2>
                    <p className="text-gray-600">You have successfully updated solves in a competition: {' '}
                        <Link href={`/competitions/${slug}`} className={"text-orange-400"}>
                            {slug.replace(/-/g, ' ')}
                        </Link>
                    </p>
                </div>
            </div>
        );
    }






    //TODO: change this to be whatever the number of solves for a given event is - could be 3 like in 3blind
    const totalSolves = 5;


    return (
        <div>

            <div className={"flex justify-around max-w-5xl w-full mx-auto items-center"}>
                {/*TODO: apparently the below line of type casting is unsafe - fix in future*/}
                <SwitchClick type={"event"} events={allEventData.map(event => event.name)} initialEvent={event} changeFunction={handleEventClick} />
                <SwitchClick type={"round"} rounds={numRounds} initialRound={round} changeFunction={setRound} />
            </div>


            <form onSubmit={handleSubmit} className={"max-w-4xl mx-auto"}>

                <input
                    type="text"
                    name="search"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onFocus={() => setDropdownVisible(true)}
                    onBlur={() => setDropdownVisible(false)}
                    className={`block max-w-1/2 w-full mx-auto bg-white text-black px-4 py-3 my-4 border-4 border-slate-400 rounded-lg`}
                    placeholder="Search competitors..."
                    autoComplete="off"
                />
                {dropdownVisible && searchTerm && (
                    // TODO: fix width of the search bar
                    <ul className="absolute z-10 bg-white text-black border border-gray-300 w-full max-w-1/2 mx-auto rounded-lg shadow-lg">
                        {filteredCompetitors.slice(0, 10).map(c => (
                            <li
                                key={c.school_id}
                                className="text-black px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                onMouseDown={() => handleSelect(c)}
                            >
                                {`${c.first_name} ${c.last_name} (${c.school_id})`}
                            </li>
                        ))}
                        {filteredCompetitors.length === 0 && (
                            <li className="text-black px-4 py-2 text-gray-500">No results found</li>
                        )}
                    </ul>
                )}


                {solveEntries.map((solveEntry) => (
                    <CompetitorUpdateEntry
                        key={solveEntry.competitor.school_id}
                        solves={solveEntry.solves}
                        competitor={solveEntry.competitor}
                        solveCount={totalSolves}
                        change_handler={handleSolveInputChange}
                        delete_handler={handleDeleteCompetitor}
                    />
                ))}



                {/* Submit Button */}
                <div className="flex justify-center mb-5">
                    <button
                        type="submit"
                        className={`bg-slate-900 text-white font-semibold py-4 px-8 rounded-md
                                transform transition-all duration-200 
                                ${isLoading ? 'opacity-50 cursor-progress' : 'hover:scale-105 cursor-pointer'}`}
                        disabled={isLoading}
                    >
                        Update
                    </button>

                </div>
                <div className={"block text-center"}>
                    {backendError && <p className="my-2 text-sm text-red-600">{backendError}</p>}
                </div>
                <div className={"block text-center"}>
                    {validationError && <p className="my-2 text-sm text-red-600">{validationError}</p>}
                </div>

            </form>

        </div>
    );

}

export default UpdateSolvesSection;
