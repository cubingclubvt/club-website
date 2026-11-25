import { useId, type ChangeEvent } from "react";

export type CompetitionDetails = {
    name: string;
    location: string;
    start_time: string;
    end_time: string;
    official: boolean;
    official_link: string | null;
};

export type CompetitionDetailsErrors = Partial<Record<keyof CompetitionDetails, string>>;

type Props = {
    values: CompetitionDetails;
    errors: CompetitionDetailsErrors;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

const labelClass = "mb-2 block text-sm font-medium text-gray-700";
const inputClass = "w-full min-w-0 rounded-lg border px-4 py-3 text-black transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500";

export default function CompetitionDetailsFields({ values, errors, onChange }: Props) {
    const id = useId();

    function textField(name: "name" | "location" | "start_time" | "end_time", label: string, type: string) {
        const inputId = `${id}-${name}`;
        const error = errors[name];
        return (
            <div className="min-w-0">
                <label htmlFor={inputId} className={labelClass}>{label}</label>
                <input
                    id={inputId}
                    type={type}
                    name={name}
                    value={values[name]}
                    onChange={onChange}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    aria-required="true"
                    className={`${inputClass} ${error ? "border-red-500 bg-red-50" : "border-gray-300 bg-white"}`}
                />
                {error && <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600">{error}</p>}
            </div>
        );
    }

    return (
        <>
            {textField("name", "Name", "text")}
            {textField("location", "Location", "text")}
            <div className="grid gap-6 sm:grid-cols-2">
                {textField("start_time", "Start Time", "datetime-local")}
                {textField("end_time", "End Time", "datetime-local")}
            </div>
            <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
                <label htmlFor={`${id}-official`} className="self-end text-center text-sm font-medium text-gray-700">
                    Official Comp
                </label>
                <label htmlFor={`${id}-official-link`} className="self-end text-center text-sm font-medium text-gray-700">
                    Official WCA Link
                </label>
                <input
                    id={`${id}-official`}
                    type="checkbox"
                    name="official"
                    checked={values.official}
                    onChange={onChange}
                    aria-invalid={errors.official ? true : undefined}
                    aria-describedby={errors.official ? `${id}-official-error` : undefined}
                    className="h-4 w-4 justify-self-center rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <input
                    id={`${id}-official-link`}
                    type="text"
                    name="official_link"
                    value={values.official_link ?? ""}
                    onChange={onChange}
                    disabled={!values.official}
                    aria-invalid={errors.official_link ? true : undefined}
                    aria-describedby={errors.official_link ? `${id}-official-link-error` : undefined}
                    className={`h-12 w-full min-w-0 rounded-lg border px-3 text-black transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 sm:px-4 ${errors.official_link ? "border-red-500 bg-red-50" : "border-gray-300 bg-white"}`}
                />
                {errors.official && <p id={`${id}-official-error`} className="col-span-2 text-sm text-red-600">{errors.official}</p>}
                {errors.official_link && <p id={`${id}-official-link-error`} className="col-start-2 text-sm text-red-600">{errors.official_link}</p>}
            </div>
        </>
    );
}
