
//TODO: change this into a component that is imported onto the page, not just one large messy export

'use client';

import React, { useState, ChangeEvent, FormEvent, useEffect, Suspense} from 'react';
import Link from 'next/link';
import { Event } from "@/types/Event";
import { apiFetch, apiBodyFetch } from '@/lib/api';
import { useSearchParams } from "next/navigation";
import AdminHeadingRow from "../../_components/AdminHeadingRow";
import CompetitionDetailsFields, {
    type CompetitionDetails,
    type CompetitionDetailsErrors,
} from "../_components/CompetitionDetailsFields";

interface EventInformation {
    "event-name": Event;
    Rounds: number;
}

interface FormData extends CompetitionDetails {
    events: EventInformation[];
}

interface FormErrors extends CompetitionDetailsErrors {
    events?: string;
}

const SubmissionForm: React.FC = () => {
    const searchParams = useSearchParams();
    const secret = searchParams.get("secret");

    const [formData, setFormData] = useState<FormData>({
        name: "",
        location: "",
        start_time: "",
        end_time: "",
        official: false,
        official_link: "",
        events: [],
    });

    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [backendError, setBackendError] = useState("");
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const [eventOptions, setEventOptions] = useState<Event[]>([]);

    useEffect(() => {
      async function fetchEvents() {
        try {
          const data = await apiFetch("/competitions/rankings/");
          setEventOptions(data.events);
        } catch (err) {
          console.error("Error fetching events:", err);
        }
      }
      fetchEvents();
    }, []);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
        if (formErrors[name as keyof FormErrors]) {
            setFormErrors(prev => ({ ...prev, [name]: '' }));
        }
        setBackendError("");
    };

    const handleEventRoundsChange = (eventName: Event, roundsValue: string) => {
        const rounds = Number(roundsValue);
        setFormData(prev => {
            const matchesEvent = (event: EventInformation) => event["event-name"] === eventName;
            if (!(rounds > 0)) {
                return { ...prev, events: prev.events.filter(event => !matchesEvent(event)) };
            }

            const updatedEvent = { "event-name": eventName, Rounds: rounds };
            const events = prev.events.some(matchesEvent)
                ? prev.events.map(event => matchesEvent(event) ? updatedEvent : event)
                : [...prev.events, updatedEvent];
            return { ...prev, events };
        });
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};
        if (!formData.name.trim()) newErrors.name = 'Name is required';
        if (!formData.start_time.trim()) newErrors.start_time = 'Start Time is required';
        if (!formData.end_time.trim()) newErrors.end_time = 'End Time is required';
        if (formData.events.length === 0) newErrors.events = 'An event is required';
        setFormErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setIsLoading(true);

        if (validateForm()) {
            console.log('Form submitted:', formData);
            const newCompetitionData = {
                name: formData.name,
                location: formData.location,
                official: formData.official,
                official_link: formData.official_link == "" || !formData.official ? null : formData.official_link,
                start_time: formData.start_time,
                end_time: formData.end_time,
                events: formData.events,
                competitors: [],
            };
            try {
                let searchPath = "/competitions/create";
                if (secret != null) {
                    searchPath = searchPath + `?secret=${encodeURIComponent(secret)}`;
                }
                const result = await apiBodyFetch(
                    searchPath,
                    "POST",
                    newCompetitionData
                );
                console.log("Competition created via proxy:", result);
                setIsSubmitted(true);
            } catch (error) {
                console.error("Error creating competition via proxy:", error);
                setBackendError("Error creating competition");
            }
        }
        setIsLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl p-8 text-center max-w-md w-full">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                    <AdminHeadingRow className="mb-2">
                        <h2 className="flex-1 text-2xl font-bold text-gray-800">Success!</h2>
                    </AdminHeadingRow>
                    <p className="text-gray-600">You have successfully created a new competition: {' '}
                        <Link href={`/admin/competitions/${encodeURIComponent(formData.name.replace(/ /g, '-'))}`} className={"text-orange-400"}>
                            {formData.name}
                        </Link>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white shadow-2xl">
                    <AdminHeadingRow className="bg-gradient-to-r from-orange-500 to-orange-300 px-4 py-6 sm:px-8">
                        <h1 className="text-3xl font-bold text-white">Create a Competition</h1>
                    </AdminHeadingRow>
                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        <div>
                            <div className="grid grid-cols-1 gap-6">
                                <CompetitionDetailsFields values={formData} errors={formErrors} onChange={handleInputChange} />
                                <fieldset className="min-w-0">
                                    <legend className="mx-auto mb-2 text-center text-sm font-medium text-gray-700">
                                        Events (# of rounds)
                                    </legend>
                                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                        {eventOptions.map((event: Event) => {
                                            const eventInfo = formData.events.find(e => e["event-name"] === event);
                                            return (
                                                <div key={event}>
                                                    <label htmlFor={`rounds-${event}`} className="block text-sm font-medium text-gray-700 mb-2 text-center">
                                                        {event}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        id={`rounds-${event}`}
                                                        name={`rounds-${event}`}
                                                        value={eventInfo ? eventInfo.Rounds : ''}
                                                        min={0}
                                                        onChange={e => handleEventRoundsChange(event, e.target.value)}
                                                        className="w-full px-4 text-black py-3 border rounded-lg focus:ring focus:ring-blue-500 focus:border-transparent transition-all"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </fieldset>
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <button
                                type="submit"
                                className={`bg-slate-900 text-white font-semibold py-4 px-8 rounded-md
                                transform transition-all duration-200 
                                ${isLoading ? 'opacity-50 cursor-progress' : 'hover:scale-105 cursor-pointer'}`}
                                disabled={isLoading}
                            >
                                Create
                            </button>
                        </div>
                        <div className={"text-center"}>
                            {backendError && <p className="mt-1 text-sm text-red-600">{backendError}</p>}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// export default SubmissionForm;
export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SubmissionForm />
        </Suspense>
    );
}
