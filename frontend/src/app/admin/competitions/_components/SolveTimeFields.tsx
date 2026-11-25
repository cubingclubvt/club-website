import { useId, type Ref } from "react";

export default function SolveTimeFields({ times, numbers, errors, onChange, firstInput, required = true }: {
    times: string[];
    numbers?: number[];
    errors: Record<number, string>;
    onChange: (index: number, value: string) => void;
    firstInput?: Ref<HTMLInputElement>;
    required?: boolean;
}) {
    const prefix = useId();

    return (
        <div className="space-y-3">
            <p className="text-sm text-slate-600">Use 12.34, 1:02.34, or DNF.</p>
            <div className={`grid grid-cols-2 gap-3 ${times.length > 3 ? "sm:grid-cols-5" : "sm:grid-cols-3"}`}>
                {times.map((time, index) => {
                    const id = `${prefix}-${index}`;
                    return (
                        <div key={id} className="min-w-0">
                            <label htmlFor={id} className="text-sm font-semibold">Solve {numbers?.[index] ?? index + 1}</label>
                            <input
                                id={id}
                                ref={index === 0 ? firstInput : undefined}
                                className="mt-1 w-full rounded-sm border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                                required={required}
                                maxLength={16}
                                value={time}
                                aria-invalid={errors[index] ? true : undefined}
                                aria-describedby={errors[index] ? `${id}-error` : undefined}
                                onChange={event => onChange(index, event.target.value)}
                                autoComplete="off"
                            />
                            {errors[index] && <p id={`${id}-error`} className="mt-1 text-xs text-red-700">{errors[index]}</p>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
