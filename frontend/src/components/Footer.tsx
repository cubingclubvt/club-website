import Image from "next/image";
export default function Footer() {
    return (
        <div className="bg-slate-900 p-2 flex items-center justify-center gap-4">
            <p className="text-white text-xs flex items-center">
                <span className={"text-lg relative -top-[1px] mr-1"}>&copy;</span> {
                    new Date().getFullYear()} Cubing Club at Virginia Tech. All rights reserved.

            </p>
            <a href="https://www.instagram.com/vt.cubingclub/" 
            className="transition hover:scale-120 shrink-0" 
            target="_blank" 
            rel="noopener noreferrer">
                <Image
                    src={"/instagram-icon.svg"}
                    height={28}
                    width={28}
                    alt="Instagram Link"
                />
            </a>
            <a href="https://discord.gg/gMZQsqgxua" 
            className="transition hover:scale-120 shrink-0" 
            target="_blank" 
            rel="noopener noreferrer">
                <Image
                    src={"/discord-icon.svg"}
                    height={25}
                    width={25}
                    alt="Discord Link"
                /></a>
        </div>
    )
}




