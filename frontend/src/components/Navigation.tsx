'use client';
import Link from "next/link";
import { useState } from "react";

//<Image width={28} height={28} src={"/event_icons/3x3.svg"} alt={"globe"} className="sm:w-[32px] sm:h-[32px] transition hover:invert hover:brightness-10 hover:scale-120" />
export default function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const closeMenu = () => setIsMenuOpen(false);
    return (
        <nav className="fixed top-0 left-0 w-full backdrop-blur-sm z-50 py-4 px-4 sm:py-6 sm:px-10 flex justify-between items-center">
            <div className="flex justify-between items-center w-full">
                <Link href="/">
                    <svg viewBox="0 0 500 500" fill="currentColor" className="w-8 h-8 text-white hover:text-blue-400 transition hover:scale-120">
                        <path d="M29 29h116v116H29zM191 29h116v116H191zM354 29h116v116H354zM29 191h116v116H29zM192 191h116v116H192zM354 
                     191h116v116H354zM29 354h116v116H29zM192 354h116v116H192zM354 354h116v116H354z"/>
                    </svg>
                </Link>
                <div className="hidden md:flex space-x-4 sm:space-x-10 text-sm sm:text-lg font-medium">
                    <Link href={"/competitions"} className="text-white hover:text-blue-400 transition">Competitions</Link>
                    <span className="border-r border-white h-auto" />
                    <Link href={"/rankings"} className="text-white hover:text-blue-400 transition">Rankings</Link>
                    <span className="border-r border-white h-auto" />
                    <Link href={"/calendar"} className="text-white hover:text-blue-400 transition">Calendar</Link>
                    <span className="border-r border-white h-auto" />
                    <Link href={"/about-us"} className="text-white hover:text-blue-400 transition">About Us</Link>
                </div>
                <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                    <svg className="w-8 h-8 scale-125 hover:scale-145 hover:text-blue-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isMenuOpen ? (
                            <path strokeWidth={3} d="M6 18L18 6M6 6l12 12" />) 
                            : (<path strokeWidth={3} d="M4 6h16M4 12h16M4 18h16" />)}
                    </svg>
                </button>
            </div>
            {/*this is the menu, it renders if isMenuOpen == true*/}
            {isMenuOpen && (
                <div className="md:hidden absolute top-full left-0 w-full bg-gray-800 border-b border-gray-800 backdrop-blur-md pb-4 shadow-xl">
                    <div className="flex flex-col space-y-4 pt-4 items-center text-lg font-medium">
                        <Link href={"/competitions"} onClick={closeMenu} className="text-white hover:text-blue-400 transition w-full text-center py-2">Competitions</Link>
                        <Link href={"/rankings"} onClick={closeMenu} className="text-white hover:text-blue-400 transition w-full text-center py-2">Rankings</Link>
                        <Link href={"/calendar"} onClick={closeMenu} className="text-white hover:text-blue-400 transition w-full text-center py-2">Calendar</Link>
                        <Link href={"/about-us"} onClick={closeMenu} className="text-white hover:text-blue-400 transition w-full text-center py-2">About Us</Link>
                    </div>
                </div>
            )}
        </nav>
    );
}
