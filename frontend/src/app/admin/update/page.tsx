import {Competition} from "@/types/Competition";
import CompetitionCard from "@/components/CompetitionCard";
import { apiFetch } from "@/lib/api";

async function Competitions() {

    let competitions: Competition[] = [];

    if (process.env.DISABLE_BACKEND === 'false') {

        try {
          competitions = await apiFetch("/competitions");
        } catch (error) {
          console.error("Failed to fetch competitons data:", error);
        }
    }


    return (
        <div>
            <div className={"flex flex-col gap-5 items-center max-w-4xl w-full mx-auto my-28"}>
                <h2 className={"text-white text-3xl"}>Select a Competition to Update</h2>
                <div className={"flex flex-col justify-center items-center w-full gap-5 p-5 m-5"}>
                    {competitions.map(competition => (
                        <CompetitionCard key={competition.id} competition={competition} update={true}/>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Competitions;
