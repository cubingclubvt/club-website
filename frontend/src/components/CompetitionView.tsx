import type { ReactNode } from "react";
import CompetitionSolvesSection from "@/components/CompetitionSolvesSection";
import type { CompetitionViewData } from "@/types/Competition";
import type { SolveSession } from "@/types/SolveSession";

export default function CompetitionView({ competition, initialSolves, apiPath, previewBar }: {
    competition: CompetitionViewData;
    initialSolves: SolveSession[];
    apiPath: string;
    previewBar?: ReactNode;
}) {
    const initialEvent = competition.events[0]?.name;

    return (
        <div>
            {previewBar}
            <h1 className={`text-center text-5xl text-white ${previewBar ? "mt-8" : "mt-24"}`}>
                {competition.official_link ? (
                    <a href={competition.official_link}
                        className="link link--orange items-center gap-3 hover:scale-103 !transition-transform !duration-250"
                        target="_blank"
                        rel="noopener noreferrer">
                        {competition.name}
                        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="ml-3 -mt-2 inline-block h-7 w-7">
                            <path d="M21 13v10h-21v-19h12v2h-10v15h17v-8h2zm3-12h-10.988l4.035 4-6.977 7.07 2.828 2.828 6.977-7.07 4.125 4.172v-11z" />
                        </svg>
                    </a>
                ) : competition.name}
            </h1>

            <section className="mx-auto mt-8 flex w-full max-w-4xl items-start justify-center gap-20 p-4 md:gap-40">
                <div className="flex flex-col items-center gap-3">
                    <div className="text-center text-slate-400">Date</div>
                    <div className="text-center text-xl text-slate-200">{competition.date}</div>
                </div>
                <div className="flex flex-col items-center gap-3">
                    <div className="text-center whitespace-nowrap text-slate-400">Competitors</div>
                    <div className="text-center text-xl text-slate-200">{competition.num_competitors}</div>
                </div>
            </section>

            <div className="my-separator mx-auto my-4 h-px w-9/10 bg-gray-300 md:my-16 md:w-8/10"></div>

            {initialEvent && (
                <CompetitionSolvesSection apiPath={apiPath} initialSolveData={initialSolves}
                    allEventData={competition.events} initialEvent={initialEvent} initialRound={1}
                    scrambleRounds={competition.scramble_rounds ?? []} />
            )}
        </div>
    );
}
