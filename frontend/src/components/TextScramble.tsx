'use client';

import {useState, useEffect} from "react";

interface TextScrambleProps {
    text: string;
    speed?: number;
    scrambleTime?: number; // higher is faster
    delay?: number; // how long before it unscrambles 
}

export default function TextScramble({text, speed = 30, scrambleTime = .3, delay = 300}: TextScrambleProps) {
    const [displayedText, setDisplayedText] = useState("");
    const [hasStarted, setHasStarted] = useState(false);
    
    useEffect(() => {
        const startTimeout = setTimeout(() => {
            setHasStarted(true);
        }, delay);

        let iteration = 0;
        const splitText = text.split("");
        const interval = setInterval(() => {
            setDisplayedText(splitText.map((char, index) => {
                // don't scramble spaces
                if (char == ' ') return ' ';
                // revealed characters
                if (index < iteration && hasStarted) {
                    return splitText[index];
                } else { // scrambled characters
                    return randomChar();
                }
            }).join(""));

            if (iteration > text.length) {
                clearInterval(interval);
            }
            // only iterate once it has actually started 
            if (hasStarted) iteration += scrambleTime;
        }, speed);
        
        return () => {
            clearTimeout(startTimeout)
            clearInterval(interval);
        }
        },[text, speed, scrambleTime, hasStarted, delay]);

    return (<span>{displayedText}</span>);
}

function randomChar(): string {
    //const SCRAMBLE_CHARACTERS = "123457890";
    //return SCRAMBLE_CHARACTERS[Math.floor(Math.random() * SCRAMBLE_CHARACTERS.length)];
    return String.fromCharCode(
        Math.floor(Math.random() * (126 - 33)) + 33
    );
}