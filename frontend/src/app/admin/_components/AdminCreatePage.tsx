import Link from "next/link";
import type { ReactNode } from "react";
import AdminHeadingRow from "./AdminHeadingRow";

export default function AdminCreatePage({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="min-h-screen px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl bg-white shadow-2xl">
                <AdminHeadingRow className="bg-gradient-to-r from-orange-500 to-orange-300 px-4 py-6 sm:px-8">
                    <h1 className="text-3xl font-bold text-white">{title}</h1>
                </AdminHeadingRow>
                {children}
            </div>
        </div>
    );
}

export function AdminCreateSuccess({ message, href, name }: { message: string; href: string; name: string }) {
    return (
        <div role="status" className="mx-auto max-w-md px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100 text-green-700">
                <svg aria-hidden="true" className="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-800">{message}</h2>
            <Link href={href} className="break-words font-semibold text-orange-800 underline">{name}</Link>
        </div>
    );
}
