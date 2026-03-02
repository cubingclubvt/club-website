
import CompetitionSolvesSection from "@/components/CompetitionSolvesSection";
import { SolveSession } from "@/types/SolveSession";
import { apiFetch } from "@/lib/api";
import Image from "next/image";

interface CompetitionDetailProps {
    params: Promise<{
        slug: string;
    }>;
}


async function CompetitionDetail({ params }: CompetitionDetailProps) {

    const { slug } = await params;

    // TODO: need to think about this double fetching performance-wise - maybe include competition metadata in
    // solve results as well? but this also adds some small overhead and feels a bit unnecessary, i think i prefer current strategy

    let competitionName = "Null";
    let competitionDate = "N/A";
    let competitionNumCompetitors = 0;
    let competitionEventData = [];
    let competitionLink = null;

    let competitionSolveData: SolveSession[] = [];


    if (process.env.DISABLE_BACKEND === 'false') {
        try {
            const competitionMetadata = await apiFetch(`/competitions/${slug}`);
            competitionName = competitionMetadata.name;
            competitionDate = competitionMetadata.date;
            competitionNumCompetitors = competitionMetadata.num_competitors;
            competitionEventData = competitionMetadata.events;
            competitionLink = competitionMetadata.official_link;

            competitionSolveData = await apiFetch(`/competitions/${slug}/3x3/1`);


        } catch (error) {
            console.error("Failed to fetch competition metadata:", error);
        }




    }


    return (
        <div>
            <h1 className={"text-white text-center text-5xl mt-24"}>
                {competitionName}
            </h1>
            <section className={"flex justify-center gap-40 items-center max-w-4xl mt-8 w-full mx-auto p-4"}>
                <div className={"flex flex-col gap-3 items-center"}>
                    <div className={"text-slate-400 text-center"}>
                        Date
                    </div>
                    <div className={"text-slate-200 text-center text-xl"}>
                        {competitionDate}
                    </div>
                </div>
                <div className={"flex flex-col gap-3 items-center"}>
                    <div className={"text-slate-400 text-center"}>
                        # Competitors
                    </div>
                    <div className={"text-slate-200 text-center text-xl"}>
                        {competitionNumCompetitors}
                    </div>
                </div>
                {competitionLink != null &&
                    <a href={competitionLink}
                        className="transition hover:scale-105 shrink-0 text-blue-400 underline hover:text-blue-300"
                        target="_blank"
                        rel="noopener noreferrer">
                        <div className="flex items-center">
                            <Image
                                src={"/wca-icon.svg"}
                                height={50}
                                width={50}
                                alt="WCA Competition Link"
                                className="drop-shadow-[0_0_4px_rgba(0,0,0,0.3)]"
                            />
                            <p className="p-3 text-xl">WCA Link</p>
                        </div>
                    </a>
                }
            </section>

            <div className={"my-separator mx-auto h-px w-8/10 bg-gray-300 my-16"}></div>

            {/*TODO: make sure initialEvent is actually an event in the comp - so just pull first event you see in db*/}
            <CompetitionSolvesSection
                slug={slug} initialSolveData={competitionSolveData}
                allEventData={competitionEventData} initialEvent={"3x3"} initialRound={1}
            />

        </div>
    );

}

export default CompetitionDetail;
