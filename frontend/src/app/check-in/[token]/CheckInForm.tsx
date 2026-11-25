"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import CheckInWaveFields from "@/components/CheckInWaveFields";
import { checkInPath, type CheckInEntry, type CheckInWave } from "@/lib/grouping";

type Receipt = { name: string; pending_waves: number[] };

function submissionKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

function errorText(value: unknown): string {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") return Object.values(value).map(errorText).filter(Boolean).join(" ");
    return "";
}

export default function CheckInForm({ token, waves }: { token: string; waves: CheckInWave[] }) {
    const [name, setName] = useState("");
    const [selections, setSelections] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [receipt, setReceipt] = useState<Receipt | null>(null);
    const [ready, setReady] = useState(false);
    const key = useRef<string | null>(null);

    useEffect(() => setReady(true), []);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        const entries: CheckInEntry[] = waves.flatMap(wave => selections[wave.id]
            ? [{ wave_id: wave.id, round_id: Number(selections[wave.id]) }] : []);
        if (!name.trim() || !entries.length) {
            setError("Enter your name and choose an event in at least one wave.");
            return;
        }
        if (new Set(entries.map(entry => entry.round_id)).size !== entries.length) {
            setError("Choose each event round only once.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            key.current ??= submissionKey();
            const response = await fetch(`/api${checkInPath(token)}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), entries, check_in_key: key.current }),
            });
            const result = await response.json();
            if (!response.ok) {
                if (response.status < 500) key.current = null;
                setError(response.status < 500 ? errorText(result) || "Check your choices and try again." : "Could not check in. Try again.");
                return;
            }
            setReceipt(result);
        } catch {
            setError("Could not confirm check-in. Try submitting again.");
        } finally {
            setSaving(false);
        }
    }

    if (receipt) return (
        <section className="rounded-md bg-slate-50 p-5 text-slate-900" role="status">
            <h2 className="text-lg font-bold">Checked in as {receipt.name}</h2>
            {receipt.pending_waves.length > 0 && (
                <p className="mt-2 text-sm">
                    {receipt.pending_waves.length === 1 ? "Wave" : "Waves"} {receipt.pending_waves.join(", ")} pending admin approval.
                </p>
            )}
        </section>
    );

    return (
        <form method="post" onSubmit={submit} className="rounded-md bg-slate-50 p-5 text-slate-900 shadow-lg sm:p-7">
            <fieldset disabled={!ready || saving} className="grid min-w-0 gap-5">
                <label className="grid gap-1 text-sm font-semibold">
                    Name
                    <input name="name" autoComplete="name" required maxLength={511} value={name}
                        onChange={event => setName(event.target.value)}
                        className="min-h-11 rounded-sm border border-slate-300 bg-white px-3 py-2" />
                </label>
                <CheckInWaveFields waves={waves} selections={selections} onChange={setSelections} />
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <button type="submit" className="min-h-11 rounded-sm bg-orange-300 px-5 text-sm font-semibold hover:bg-admin-button-hover disabled:opacity-60">
                    {saving ? "Checking in…" : "Check in"}
                </button>
            </fieldset>
        </form>
    );
}
