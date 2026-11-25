"use client";

import { useId, useState } from "react";

export default function CompetitorSearch({ query, onSearch, onReload }: {
    query: string;
    onSearch: (query: string) => void;
    onReload: () => void;
}) {
    const id = useId();
    const [draft, setDraft] = useState(query);

    return (
        <form onSubmit={event => { event.preventDefault(); onSearch(draft.trim()); }} className="mb-5">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm font-semibold">
                <label htmlFor={id}>Search competitors</label>
                <button type="button" onClick={onReload} className="text-slate-700 underline">Reload</button>
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                <input id={id} type="search" placeholder="Name or school ID" value={draft}
                    onChange={event => setDraft(event.target.value)}
                    className="w-full min-w-0 rounded-sm border border-slate-300 bg-white px-3 py-2.5 text-slate-900" />
                <button type="submit" className="min-h-11 rounded-sm bg-orange-300 px-4 text-sm font-semibold hover:bg-admin-button-hover">
                    Search
                </button>
                {(query || draft) && <button type="button" onClick={() => { setDraft(""); onSearch(""); }}
                    className="min-h-11 rounded-sm px-3 text-sm font-semibold hover:bg-slate-200">Clear</button>}
            </div>
        </form>
    );
}
