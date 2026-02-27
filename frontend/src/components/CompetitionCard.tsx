import Link from "next/link";
import {Competition} from "@/types/Competition";

interface CompetitionProps {
    competition: Competition,
    update?: boolean,
}

export default function CompetitionCard({ competition, update = false } : CompetitionProps){

    const slug = competition.name.replace(/ /g,"-")

    return (

        <div className={"flex flex-col items-center justify-center w-full"}>
            {competition.official ? (
                <div className={"text-white text-sm"}>Official WCA Competition</div>) : null}
            <Link href={update ? `/admin/update/${slug}` : `/competitions/${slug}`} className={"w-full"}>
                <div className={"flex w-full"} key={competition.id}>
                    <div className={"bg-orange-300 border border-4 border-r-0 border-black " +
                        "w-full p-5 text-xl text-center text-black"}>
                        {competition.name}
                    </div>
                    <div className={
                        "flex items-center text-center text-black bg-orange-300 p-5 " +
                        "border border-4 border-black whitespace-nowrap"
                    }>
                        {competition.date}
                    </div>
                </div>
            </Link>
        </div>

    );

}

