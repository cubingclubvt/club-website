'use client';

import {useState, useEffect} from "react";

interface TextScrambleProps {
    text: string;
    speed?: number;
    scrambleTime?: number; // higher is faster
}

export default function TextScramble({text, speed = 30, scrambleTime = .3}: TextScrambleProps) {
    const [displayedText, setDisplayedText] = useState("");

    useEffect(() => {
        let iteration = 0;
        const splitText = text.split("");
        const interval = setInterval(() => {
            setDisplayedText(splitText.map((char, index) => {
                // don't scramble spaces
                if (char == ' ') return ' ';
                
                // revealed characters
                if (index < iteration) {
                    return splitText[index];
                } else { // scrambled characters
                    return randomChar();
                }
            }).join(""));

            if (iteration > text.length) {
                clearInterval(interval);
            }
            iteration += scrambleTime;
        }, speed);
    return () => clearInterval(interval);
    },[text, speed, scrambleTime]);

    return (<span>{displayedText}</span>);
}

function randomChar(): string {
    //const SCRAMBLE_CHARACTERS = "123457890";
    //return SCRAMBLE_CHARACTERS[Math.floor(Math.random() * SCRAMBLE_CHARACTERS.length)];
    return String.fromCharCode(
        Math.floor(Math.random() * (126 - 33)) + 33
    );
}