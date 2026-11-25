const selectStyles = "mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2.5 text-slate-900";

export default function CompetitionRoundPicker({ rounds, event, roundId, onEventChange, onRoundChange }: {
    rounds: { id: number; event: string; number: number }[];
    event: string;
    roundId: number | null;
    onEventChange: (event: string) => void;
    onRoundChange: (roundId: number | null) => void;
}) {
    const events = [...new Set(rounds.map(round => round.event))];
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
                Event
                <select required className={selectStyles} value={event} onChange={change => onEventChange(change.target.value)}>
                    <option value="" disabled>Choose an event</option>
                    {events.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
            </label>
            <label className="text-sm font-semibold">
                Round
                <select required disabled={!event} className={selectStyles} value={roundId ?? ""} onChange={change => onRoundChange(Number(change.target.value) || null)}>
                    <option value="" disabled>Choose a round</option>
                    {rounds.filter(round => round.event === event).map(round => (
                        <option key={round.id} value={round.id}>Round {round.number}</option>
                    ))}
                </select>
            </label>
        </div>
    );
}
