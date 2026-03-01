'use client'

import type { Event } from "@/types/Event";
import Image from "next/image";

interface EventProps {
    type: "event";
    events: Event[];
    initialEvent: Event;
    changeFunction: (event: Event) => void;
    eventLabelColor?: string;
    eventHighlightColor?: string;
}

interface RoundProps {
    type: "round";
    rounds: number;
    initialRound: number;
    changeFunction: (round: number) => void;
}

interface CalculationProps {
    type: "calculation";
    initialCalculation: string;
    changeFunction: (calculation: string) => void;
}

type MyProps = EventProps | RoundProps | CalculationProps;

export default function SwitchClick(props : MyProps) {

    const status = 
        props.type === 'event' ? props.initialEvent : 
        props.type === 'round' ? props.initialRound : 
        props.initialCalculation;

    if (props.type === 'event') {
        const eventLabelColor = props.eventLabelColor || "text-slate-300";
        const eventHighlightColor = props.eventHighlightColor || "bg-white"
        return (
            <div className={"flex flex-col md:flex-row items-center md:justify-between gap-2 md:gap-5"}>
                <div className={`${eventLabelColor} text-lg md:text-xl md:mr-4`}>
                    Event
                </div>
                <div className="flex flex-wrap justify-center gap-3 md:gap-5">
                    {Array.from(props.events, (event, index) => (
                        <button
                            key={index}
                            type="button"
                            title={event}
                            // REVISED: The `p-2` and `rounded-md` classes have been removed.
                            // The `cursor-pointer` and `transition-colors` classes are kept.
                            className={`cursor-pointer transition-colors
                                ${event === status
                                ? `${eventHighlightColor} hover:${eventHighlightColor}`
                                : 'hover:bg-slate-400'
                            }`}
                            onClick={() => {
                                props.changeFunction(event)
                            }}
                        >
                            <Image
                                src={`/event_icons/${event}.svg`}
                                height={16}
                                width={16}
                                alt={event}
                            />
                        </button>
                    ))}
                </div>
            </div>
        );
    } else if (props.type === 'round') {
        return (
            <div className={"flex flex-col md:flex-row items-center md:justify-between gap-2 md:gap-5"}>
                <div className={"text-slate-300 text-lg md:text-xl md:mr-4"}>
                    Round
                </div>
                <div className="flex flex-wrap justify-center gap-3 md:gap-5">
                    {Array.from({ length: props.rounds }, (_, index) => (
                        <button
                            key={index}
                            className={`bg-transparent border-none px-4 py-2 cursor-pointer transition-colors text-lg md:text-xl rounded-md
                                ${index + 1 === status
                                ? 'text-white hover:text-white'
                                : 'text-slate-500 hover:text-slate-400'
                            }`}
                            onClick={() => {
                                props.changeFunction(index + 1)
                            }}>
                            {index + 1}
                        </button>
                    ))}
                </div>
            </div>
        );
    } else if (props.type === 'calculation') {
        return (
            <div className={"flex flex-col md:flex-row items-center md:justify-between gap-2 md:gap-5"}>
                <div className={"text-slate-300 text-lg md:text-xl md:mr-4"}>
                    Calculation
                </div>

                <div className="flex justify-center gap-4">
                    <button
                        className={`bg-transparent border-none px-4 py-2 cursor-pointer transition-colors text-lg md:text-xl rounded-md
                            ${"single" === status
                            ? 'text-white hover:text-white'
                            : 'text-slate-500 hover:text-slate-400'
                        }`}
                        onClick={() => {
                            props.changeFunction("single")
                        }}>
                        Single
                    </button>

                    <button
                        className={`bg-transparent border-none px-4 py-2 cursor-pointer transition-colors text-lg md:text-xl rounded-md
                            ${"average" === status
                            ? 'text-white hover:text-white'
                            : 'text-slate-500 hover:text-slate-400'
                        }`}
                        onClick={() => {
                            props.changeFunction("average")
                        }}>
                        Average
                    </button>
                </div>
            </div>
        );
    }
}