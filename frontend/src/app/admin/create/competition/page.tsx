
//TODO: change this into a component that is imported onto the page, not just one large messy export

//TODO: make sure that if a checked event for a competitor gets removed, at the end you make sure those are cleaned up
//essentially just check to make sure that any events that a competitor is assigned to has nonzero round numbers


//TODO: make the server component pass in the list of competitor on load, not have the client components fetch everything

'use client';

import React, { useState, ChangeEvent, FormEvent, useEffect, Suspense} from 'react';
import Link from 'next/link';
import { Event } from "@/types/Event";
import { eventOptions } from '@/types/Event';
import { apiFetch, apiBodyFetch } from '@/lib/api';
import { useSearchParams } from "next/navigation";

interface EventInformation {
    "event-name": Event;
    Rounds: number;
}

interface Competitor {
    "first_name": string;
    "last_name": string;
    "school_id": string;
    "grade": number;
}

interface MinimalCompetitorInformation {
    school_id: string;
    events: Event[];
}

interface CompetitorInformation {
    competitor: Competitor;
    events: Event[];
}

interface FormData {
    name: string;
    location: string;
    start_time: string;
    end_time: string;
    official: boolean;
    events: EventInformation[];
    competitors: MinimalCompetitorInformation[];
}

interface FormErrors {
    name?: string;
    start_time?: string;
    end_time?: string;
    official?: string;
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
        events: [],
        competitors: [],
    });

    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [backendError, setBackendError] = useState("");
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const [allCompetitors, setAllCompetitors] = useState<Competitor[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [competitorDisplayList, setCompetitorDisplayList] = useState<CompetitorInformation[]>([]);

    useEffect(() => {
        async function fetchCompetitors() {
            try {
                const data = await apiFetch("/competitions/competitor/");
                console.log("Fetched competitors!", data);
                setAllCompetitors(data.competitors);
            } catch (err) {
                console.error("Error fetching competitors:", err);
            }
        }
        fetchCompetitors();
    }, []);

    const filteredCompetitors = allCompetitors.filter(c =>
        (`${c.first_name} ${c.last_name} ${c.school_id}`).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setDropdownVisible(true);
    };

    const handleSelect = (c: Competitor) => {
        setSearchTerm("");
        setDropdownVisible(false);

        const newDisplayCompetitors = [...competitorDisplayList, { competitor: c, events: [] }];
        setCompetitorDisplayList(newDisplayCompetitors);

        const newMinimalCompetitors = [...formData.competitors, { school_id: c.school_id, events: [] }];
        setFormData(prev => ({ ...prev, competitors: newMinimalCompetitors }));

        setAllCompetitors(prev => prev.filter(competitor => competitor.school_id !== c.school_id));
    };

    const handleDeleteCompetitor = (incomingCI: CompetitorInformation) => {
        setCompetitorDisplayList(prev => prev.filter(c => c.competitor.school_id !== incomingCI.competitor.school_id));
        setFormData(prev => ({
            ...prev,
            competitors: prev.competitors.filter(c => c.school_id !== incomingCI.competitor.school_id)
        }));
        setAllCompetitors(prev => {
            const foundCompetitor = prev.find(competitor => competitor.school_id === incomingCI.competitor.school_id);
            if (!foundCompetitor) {
                return [...prev, incomingCI.competitor];
            }
            return prev;
        });
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        if (formErrors[name as keyof FormErrors]) {
            setFormErrors(prev => ({ ...prev, [name]: '' }));
        }
        setBackendError("");
    };

    const handleEventRoundsChange = (eventName: Event, roundsValue: string) => {
        setFormData(prev => {
            const rounds = Number(roundsValue);
            const index = prev.events.findIndex(e => e["event-name"] === eventName);
            if (index >= 0) {
                if (rounds > 0) {
                    const updatedEvents = prev.events.map((e, i) => (
                        i === index ? { ...e, Rounds: rounds } : e
                    ));
                    return { ...prev, events: updatedEvents };
                } else {
                    const updatedEvents = prev.events.filter((e, i) => i !== index);
                    return { ...prev, events: updatedEvents };
                }
            } else {
                if (rounds > 0) {
                    const newEvent: EventInformation = { "event-name": eventName, Rounds: rounds };
                    const updatedEvents = [...prev.events, newEvent];
                    return { ...prev, events: updatedEvents };
                }
                return prev;
            }
        });
    };

    const handleCompetitorEventsChange = (id: string, event: Event, checked: boolean) => {
        const updatedDisplayCompetitors = competitorDisplayList.map((cI: CompetitorInformation) => {
            if (cI.competitor.school_id === id) {
                const updatedEventsForCompetitor = checked
                    ? [...new Set([...cI.events, event])]
                    : cI.events.filter((e: Event) => e !== event);
                return { ...cI, events: updatedEventsForCompetitor };
            }
            return cI;
        });
        setCompetitorDisplayList(updatedDisplayCompetitors);

        const updatedMinimalCompetitors = formData.competitors.map((c: MinimalCompetitorInformation) => {
            if (c.school_id === id) {
                const updatedEvents = checked
                    ? [...new Set([...c.events, event])]
                    : c.events.filter((e: Event) => e !== event);
                return { ...c, events: updatedEvents };
            }
            return c;
        });
        setFormData(prev => ({
            ...prev,
            competitors: updatedMinimalCompetitors
        }));
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
            const newCompetitionData: FormData = {
                name: formData.name,
                location: formData.location,
                official: formData.official,
                start_time: formData.start_time,
                end_time: formData.end_time,
                events: formData.events,
                competitors: formData.competitors,
            };
            try {
                let searchPath = "/competitions/create";
                if (secret != null) {
                    searchPath = searchPath + `?secret=${encodeURIComponent(secret)}`;
                }
                const result = await apiBodyFetch<FormData>(
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
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Success!</h2>
                    <p className="text-gray-600">You have successfully created a new competition: {' '}
                        <Link href={`/competitions/${formData.name.replace(/\s+/g, '-')}`} className={"text-orange-400"}>
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
                <div className="bg-white shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-300 px-8 py-6">
                        <h1 className="text-3xl font-bold text-white">Create a Competition</h1>
                    </div>
                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        <div>
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Name
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className={`w-full text-black px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            formErrors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                        }`}
                                        placeholder=""
                                    />
                                    {formErrors.name && <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Location
                                    </label>
                                    <input
                                        type="text"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleInputChange}
                                        className={`w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                                        placeholder=""
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Start Time
                                    </label>
                                    <input
                                        type="datetime-local"
                                        name="start_time"
                                        value={formData.start_time}
                                        onChange={handleInputChange}
                                        className={`w-full text-black px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            formErrors.start_time ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                        }`}
                                        placeholder=""
                                    />
                                    {formErrors.start_time && <p className="mt-1 text-sm text-red-600">{formErrors.start_time}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        End Time
                                    </label>
                                    <input
                                        type="datetime-local"
                                        name="end_time"
                                        value={formData.end_time}
                                        onChange={handleInputChange}
                                        className={`w-full text-black px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            formErrors.end_time ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                        }`}
                                        placeholder=""
                                    />
                                    {formErrors.end_time && <p className="mt-1 text-sm text-red-600">{formErrors.end_time}</p>}
                                </div>
                                <div>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            name="official"
                                            checked={formData.official}
                                            onChange={handleInputChange}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">
                                            Official Competition
                                        </span>
                                    </label>
                                    {formErrors.official && <p className="text-sm text-red-600">{formErrors.official}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Events
                                    </label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {eventOptions.map((event: Event) => {
                                            const eventInfo = formData.events.find(e => e["event-name"] === event);
                                            return (
                                                <div key={event}>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        {event}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        name={`rounds-${event}`}
                                                        value={eventInfo ? eventInfo.Rounds : ''}
                                                        min={0}
                                                        onChange={e => handleEventRoundsChange(event, e.target.value)}
                                                        className={`w-full px-4 text-black py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                                                        placeholder=""
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Competitors
                                    </label>
                                    <input
                                        type="text"
                                        name="search"
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        onFocus={() => setDropdownVisible(true)}
                                        onBlur={() => setDropdownVisible(false)}
                                        className={`block max-w-1/2 w-full mx-auto px-4 text-black py-3 my-4 border rounded-lg`}
                                        placeholder="Search competitors..."
                                        autoComplete="off"
                                    />
                                    {dropdownVisible && searchTerm && (
                                        <ul className="absolute z-10 text-black bg-white border border-gray-300 w-full max-w-1/2 mx-auto rounded-lg shadow-lg">
                                            {filteredCompetitors.slice(0, 10).map(c => (
                                                <li
                                                    key={c.school_id}
                                                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                                    onMouseDown={() => handleSelect(c)}
                                                >
                                                    {`${c.first_name} ${c.last_name} (${c.school_id})`}
                                                </li>
                                            ))}
                                            {filteredCompetitors.length === 0 && (
                                                <li className="px-4 py-2 text-gray-500">No results found</li>
                                            )}
                                        </ul>
                                    )}
                                    <table className={"max-w-xl text-black w-full bg-slate-300 min-h-80 mx-auto"}>
                                        <thead>
                                            <tr className="h-12 bg-gray-100">
                                                <th className="border border-gray-400 px-4 py-3 text-left text-gray-700">Name</th>
                                                {formData.events.map((e: EventInformation) => (
                                                    e.Rounds !== 0 && (
                                                        <th key={e["event-name"]} className="w-0 border border-gray-400 px-2 py-2 text-gray-700">{e["event-name"]}</th>
                                                    )
                                                ))}
                                                <th className="border border-gray-400"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {competitorDisplayList.map((cI: CompetitorInformation) => (
                                                <tr key={cI.competitor.school_id}>
                                                    <td className={"h-12 border border-gray-400 p-2"}>
                                                        {`${cI.competitor.first_name} ${cI.competitor.last_name} (${cI.competitor.school_id})`}
                                                    </td>
                                                    {formData.events.map((e: EventInformation) => (
                                                        e.Rounds !== 0 && (
                                                            <td key={e["event-name"]} className="h-12 border border-gray-400 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    onChange={changeEvent =>
                                                                        handleCompetitorEventsChange(cI.competitor.school_id, e["event-name"], changeEvent.target.checked)}
                                                                    checked={cI.events.includes(e["event-name"])}
                                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                                />
                                                            </td>
                                                        )
                                                    ))}
                                                    <td className="h-12 border border-gray-400 text-center">
                                                        <button
                                                            onClick={() => handleDeleteCompetitor(cI)}
                                                            className="text-red-600 hover:text-red-800 hover:bg-red-50 hover:cursor-pointer h-full w-full"
                                                            title="Delete competitor"
                                                        >
                                                            ×
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr></tr>
                                        </tbody>
                                    </table>
                                </div>
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
