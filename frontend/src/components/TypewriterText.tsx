'use client';

import {useState, useEffect} from "react";

interface TypewriterTextProps {
    text: string;
    speed?: number;
}

export default function TypewriterText({text, speed = 30}: TypewriterTextProps) {
    const [displayedText, setDisplayedText] = useState("");

    useEffect(() => {
        let iteration = 0;
        const splitText = text.split("");
        const interval = setInterval(() => {
            setDisplayedText(splitText.map((char, index) => {

                if (index < iteration) { // revealed characters
                    return splitText[index];
                } else {
                    return '';
                }
            }).join(""));

            if (iteration > text.length) {
                clearInterval(interval);
            }
            iteration++; 
        }, speed);
    return () => clearInterval(interval);
    },[text, speed]);

    return (<span>{displayedText}</span>);
}

