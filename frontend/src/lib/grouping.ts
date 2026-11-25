export type OfferedRound = { id: number; event: string; event_id: number; number: number };
export type CheckInWave = { id: number; number: number; name: string; pending: boolean; rounds: OfferedRound[] };
export type CheckInEntry = { wave_id: number; round_id: number };

export function waveLabel(wave: { number: number; name: string }) {
    return wave.name ? `Wave ${wave.number} · ${wave.name}` : `Wave ${wave.number}`;
}

export function roundLabel(round: OfferedRound) {
    return `${round.event} · Round ${round.number}`;
}

export function checkInPath(token: string) {
    return `/check-in/${encodeURIComponent(token)}`;
}
