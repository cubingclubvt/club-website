import type { ReactNode } from "react";
import AdminBackButton from "./AdminBackButton";

type AdminHeadingRowProps = {
    children: ReactNode;
    backHref?: string;
    backLabel?: string;
    className?: string;
};

export default function AdminHeadingRow({ children, backHref, backLabel, className = "" }: AdminHeadingRowProps) {
    return (
        <div className={`relative flex items-center gap-3 sm:gap-5 xl:block ${className}`}>
            <div className="shrink-0 xl:absolute xl:right-full xl:top-1/2 xl:mr-4 xl:-translate-y-1/2">
                <AdminBackButton href={backHref} label={backLabel} />
            </div>
            {children}
        </div>
    );
}
