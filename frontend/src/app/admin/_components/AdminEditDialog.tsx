"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

type Props = {
    title: string;
    description?: string;
    children: ReactNode;
    onClose: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    saving: boolean;
    disabled?: boolean;
    error?: string;
    size?: "compact" | "medium" | "wide";
    destructive?: boolean;
    submitLabel?: string;
    savingLabel?: string;
};

const dialogWidths = {
    compact: "max-w-md",
    medium: "max-w-xl",
    wide: "max-w-3xl",
};

export default function AdminEditDialog({
    title, description, children, onClose, onSubmit, saving, disabled, error, size = "compact", destructive,
    submitLabel = "Save changes", savingLabel = "Saving…",
}: Props) {
    const dialog = useRef<HTMLDialogElement>(null);
    const id = useId();

    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);

    return (
        <dialog
            ref={dialog}
            aria-labelledby={`${id}-title`}
            aria-describedby={description ? `${id}-description` : undefined}
            onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
            className={`m-auto w-11/12 rounded-md border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/65 sm:p-7 ${dialogWidths[size]}`}
        >
            <form onSubmit={onSubmit} className={size === "medium" ? "space-y-6" : "space-y-4"}>
                <header>
                    <h2 id={`${id}-title`} className="text-xl font-bold">{title}</h2>
                    {description && <p id={`${id}-description`} className="mt-2 break-words text-sm text-slate-600">{description}</p>}
                </header>
                <fieldset disabled={saving} className="min-w-0">{children}</fieldset>
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <div className="flex justify-end gap-3">
                    <button type="button" disabled={saving} onClick={onClose} className="min-h-11 rounded-sm border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60">
                        Cancel
                    </button>
                    <button type="submit" disabled={saving || disabled} className={`min-h-11 rounded-sm px-4 text-sm font-semibold disabled:opacity-60 ${destructive ? "bg-red-700 text-white hover:bg-red-800" : "bg-orange-300 hover:bg-admin-button-hover"}`}>
                        {saving ? savingLabel : submitLabel}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
