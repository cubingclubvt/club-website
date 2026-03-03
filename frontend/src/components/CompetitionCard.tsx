import Link from "next/link";
import Image from "next/image";
import { Competition } from "@/types/Competition";

interface CompetitionProps {
    competition: Competition,
    update?: boolean,
}

export default function CompetitionCard({ competition, update = false }: CompetitionProps) {

    const slug = competition.name.replace(/ /g, "-")

    return (

        <div className={"flex flex-col items-center justify-center w-full"}>
            <Link href={update ? `/admin/update/${slug}` : `/competitions/${slug}`} className={"w-full"}>
                {/*BIG SCREEN / DESKTOP*/}
                <div className={"hidden md:flex w-full"}>
                    <div className={"bg-orange-300 border border-4 border-r-0 border-black " +
                        "w-full p-5 text-xl text-center text-black flex items-center justify-center relative"}>
                        {competition.official ? (
                            <div className="absolute left-5">
                                <Image
                                    src={"/wca-icon.svg"}
                                    height={45}
                                    width={45}
                                    alt="Official WCA Competition"
                                    className="drop-shadow-[0_0_4px_rgba(0,0,0,0.3)]"
                                />
                            </div>
                        ) : null}
                        <span className="text-center">{competition.name}</span>
                    </div>
                    <div className={
                        "flex items-center text-center text-black bg-orange-300 p-5 " +
                        "border border-4 border-black whitespace-nowrap"
                    }>
                        {competition.date}
                    </div>
                </div>
                {/*SMALL SCREEN / MOBILE*/}
                <div className={"md:hidden block w-full"}>
                    <div className={"bg-orange-300 border border-4 border-black h-15 " +
                        "w-full p-5 text-xl text-center text-black flex items-center justify-center relative"}>
                        {competition.name}
                    </div>

                    <div className={"flex items-center text-center text-black bg-orange-300 border border-4 border-t-0 border-black h-15"}>
                        <div className="flex-5 p-2">
                            <span>Took place on {competition.date}</span>
                        </div>

                        {competition.official && (
                            <div className="flex-1 flex justify-center items-center py-2 px-3 border-l-4 border-black">
                                <Image
                                    src={"/wca-icon.svg"}
                                    height={40}
                                    width={40}
                                    alt="Official WCA Competition"
                                    className="drop-shadow-[0_0_4px_rgba(0,0,0,0.3)]"
                                />

                            </div>
                        )}

                    </div>
                </div>
            </Link>
        </div>

    );

}

