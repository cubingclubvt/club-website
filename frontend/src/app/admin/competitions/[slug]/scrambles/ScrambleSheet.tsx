"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { scrambleEventCode } from "@/lib/scrambleEvents";

type ScrambleSheetProps = {
    event: string;
    title: string;
    subtitle: string;
    scrambles: string[];
    extras: string[];
    showDiagrams: boolean;
    actions: ReactNode;
};

export default function ScrambleSheet({ event, title, subtitle, scrambles, extras, showDiagrams, actions }: ScrambleSheetProps) {
    const sheetRef = useRef<HTMLElement>(null);
    const presentationRef = useRef<HTMLDialogElement>(null);
    const fullscreenButton = useRef<HTMLButtonElement>(null);
    const [fullscreen, setFullscreen] = useState(false);
    const [presentation, setPresentation] = useState(false);
    const [notationOverride, setNotationOverride] = useState<boolean | null>(null);
    const eventCode = scrambleEventCode(event);
    const longNotation = [...scrambles, ...extras].some(moves => moves.length > 200 || moves.split("\n").length > 5);
    const showPresentationNotation = notationOverride ?? !longNotation;

    useEffect(() => {
        function updateFullscreen() {
            setFullscreen(document.fullscreenElement === sheetRef.current);
        }
        document.addEventListener("fullscreenchange", updateFullscreen);
        return () => document.removeEventListener("fullscreenchange", updateFullscreen);
    }, []);

    useEffect(() => {
        if (!presentation) return;
        const style = document.documentElement.style;
        const previous = style.overflow;
        style.overflow = "hidden";
        presentationRef.current?.showModal();
        return () => { style.overflow = previous; };
    }, [presentation]);

    async function openFullscreen() {
        try {
            if (sheetRef.current?.requestFullscreen) {
                await sheetRef.current.requestFullscreen();
                return;
            }
        } catch {
            // Some embedded browsers block native fullscreen.
        }
        setPresentation(true);
    }

    const sheetLabel = `${title} scramble sheet`;
    const surface = "group rounded-sm border border-slate-200 bg-white p-3 text-slate-900 sm:p-4";

    function renderSheet(presenting: boolean, close: () => void) {
        const showNotation = !presenting || !eventCode || showPresentationNotation;
        return <>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div>
                    <h2 className="text-lg font-bold group-data-[presenting=true]:text-2xl">{title}</h2>
                    <p className="text-sm text-slate-600">{subtitle}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {!presenting && actions}
                    {presenting && eventCode && <button type="button"
                        className="min-h-10 rounded-sm border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-100"
                        onClick={() => setNotationOverride(!showNotation)}>
                        {showNotation ? "Hide notation" : "Show notation"}
                    </button>}
                    {showDiagrams && <button type="button" ref={presenting ? undefined : fullscreenButton}
                        onClick={presenting ? close : () => void openFullscreen()}
                        className="min-h-10 rounded-sm bg-orange-300 px-3 text-sm font-semibold hover:bg-admin-button-hover">
                        {presenting ? "Exit fullscreen" : "Fullscreen"}
                    </button>}
                </div>
            </header>
            {showDiagrams && !eventCode && <p className="mt-2 text-xs text-slate-600">Diagrams are unavailable for this event.</p>}
            <div className={`mt-3 grid gap-5 ${showDiagrams && extras.length
                ? "lg:grid-cols-[minmax(0,3.5fr)_minmax(0,1fr)] lg:gap-4" : ""}`}>
                <ScrambleSection title="Main scrambles" scrambles={scrambles} showNotation={showNotation}
                    showDiagrams={showDiagrams} eventCode={eventCode} />
                {extras.length > 0 && <ScrambleSection title="Extra scrambles" scrambles={extras} showNotation={showNotation}
                    showDiagrams={showDiagrams} eventCode={eventCode} extras />}
            </div>
        </>;
    }

    return (
        <>
            <section ref={sheetRef} className={surface + " [&:fullscreen]:overflow-y-auto"}
                aria-label={sheetLabel} data-presenting={fullscreen}>
                {renderSheet(fullscreen, () => void document.exitFullscreen())}
            </section>
            {presentation && <dialog ref={presentationRef} aria-label={sheetLabel} data-presenting
                className={surface + " fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto"}
                onClose={() => {
                    setPresentation(false);
                    fullscreenButton.current?.focus();
                }}>
                {renderSheet(true, () => presentationRef.current?.close())}
            </dialog>}
        </>
    );
}

function ScrambleSection({ title, scrambles, showNotation, showDiagrams, eventCode, extras = false }: {
    title: string;
    scrambles: string[];
    showNotation: boolean;
    showDiagrams: boolean;
    eventCode: string | undefined;
    extras?: boolean;
}) {
    const sectionStyle = extras && showDiagrams
        ? "border-t border-orange-200 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0" : "";
    const listStyle = showDiagrams
        ? `grid grid-cols-1 gap-2 sm:grid-cols-2 ${extras ? "lg:grid-cols-1" : "md:grid-cols-3"}` : "space-y-1";
    return <section aria-label={title} className={sectionStyle}>
        <h3 className={`mb-2 text-sm font-bold ${extras ? "text-orange-900" : "text-slate-700"}`}>{title}</h3>
        <ol className={listStyle}>
            {scrambles.map((moves, index) => {
                const label = `${extras ? "Extra" : "Attempt"} ${index + 1}`;
                return <li key={label} className={`min-w-0 ${showDiagrams
                    ? `flex flex-col rounded-sm border p-2 ${extras ? "border-orange-200 bg-orange-50/60" : "border-slate-200"}`
                    : "grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-2 px-1 py-1"}`}>
                    <h4 className={`text-xs font-bold ${extras ? "text-orange-900" : "text-slate-700"}`}>{label}</h4>
                    {showDiagrams && eventCode && <ScrambleDiagram key={`${eventCode}/${moves}`} eventCode={eventCode} moves={moves} label={label} />}
                    {showNotation && <p className="whitespace-pre-wrap break-words font-mono text-xs leading-4 text-slate-900">{moves}</p>}
                </li>;
            })}
        </ol>
    </section>;
}

function ScrambleDiagram({ eventCode, moves, label }: { eventCode: string; moves: string; label: string }) {
    const hostRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
        let active = true;

        async function draw() {
            try {
                const [{ ExperimentalSVGAnimator }, { eventInfo, puzzles }] = await Promise.all([
                    import("cubing/twisty"),
                    import("cubing/puzzles"),
                ]);
                const info = eventInfo(eventCode);
                const puzzle = info && puzzles[info.puzzleID];
                if (!puzzle) throw new Error("Unsupported puzzle");

                const [kpuzzle, svgSource] = await Promise.all([puzzle.kpuzzle(), puzzle.svg()]);
                if (!active) return;
                const pattern = kpuzzle.defaultPattern().applyAlg(moves);
                const diagram = new ExperimentalSVGAnimator(kpuzzle, svgSource);
                diagram.drawPattern(pattern);
                const svg = diagram.svgElement;
                svg.style.display = "block";
                svg.style.width = "100%";
                svg.style.height = "100%";
                svg.setAttribute("aria-hidden", "true");
                root.replaceChildren(svg);
                setStatus("ready");
            } catch {
                if (active) setStatus("failed");
            }
        }

        void draw();
        return () => {
            active = false;
            root.replaceChildren();
        };
    }, [eventCode, moves]);

    return (
        <div className="relative my-1 h-[clamp(6rem,19dvh,12rem)] group-data-[presenting=true]:h-[clamp(6rem,29dvh,27rem)]">
            <div ref={hostRef} className="h-full w-full" role={status === "ready" ? "img" : undefined}
                aria-label={status === "ready" ? `Scrambled puzzle state for ${label.toLowerCase()}` : undefined} />
            {status !== "ready" && <p className="absolute inset-0 grid place-items-center text-xs text-slate-600">
                {status === "failed" ? "Diagram unavailable" : "Drawing…"}
            </p>}
        </div>
    );
}
