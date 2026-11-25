import { useId } from "react";
import { roundLabel, waveLabel, type CheckInWave } from "@/lib/grouping";

export default function CheckInWaveFields({ waves, selections, onChange }: {
    waves: CheckInWave[];
    selections: Record<number, string>;
    onChange: (next: Record<number, string>) => void;
}) {
    const prefix = useId();
    if (!waves.length) return null;
    return (
        <fieldset className="grid min-w-0 gap-3">
            <legend className="mb-2 text-sm font-semibold">Events by wave</legend>
            {waves.map(wave => {
                const id = `${prefix}-${wave.id}`;
                return <div className="grid min-w-0 gap-1 text-sm" key={wave.id}>
                    <label htmlFor={id}>{waveLabel(wave)}</label>
                    <select id={id} aria-describedby={wave.pending ? `${id}-hint` : undefined}
                        value={selections[wave.id] ?? ""} onChange={event => {
                        onChange({ ...selections, [wave.id]: event.target.value });
                    }} className="min-h-11 w-full rounded-sm border border-slate-300 bg-white px-3 py-2">
                        <option value="">Skip this wave</option>
                        {wave.rounds.map(round => (
                            <option key={round.id} value={round.id}>
                                {wave.rounds.filter(item => item.event_id === round.event_id).length > 1 ? roundLabel(round) : round.event}
                            </option>
                        ))}
                    </select>
                    {wave.pending && <span id={`${id}-hint`} className="text-xs text-slate-600">Late entries need admin approval.</span>}
                </div>;
            })}
        </fieldset>
    );
}
