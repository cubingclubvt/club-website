
//TODO: change this into a component that is imported onto the page, not just one large messy export

'use client';

import React, { useState, ChangeEvent, FormEvent, Suspense} from 'react';
import Link from 'next/link';
import { apiBodyFetch } from '@/lib/api';
import { useSearchParams } from "next/navigation";

interface FormData {
    firstName: string;
    lastName: string;
    school_id: string;
    grade: string;
}

interface NewCompetitor {
  first_name: string;
  last_name: string;
  school_id: string;
  grade: number;
}

interface FormErrors {
    firstName?: string;
    lastName?: string;
    school_id?: string;
    grade?: string;
    backend?: string;
}

const SubmissionForm: React.FC = () => {
    const searchParams = useSearchParams();
    const secret = searchParams.get("secret");

    const [formData, setFormData] = useState<FormData>({
        firstName: '',
        lastName: '',
        school_id: '',
        grade: '',
    });

    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [backendError, setBackendError] = useState("");
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false); // Add this state


    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
        const { name, value } = e.target;

        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear error when user starts typing
        if (formErrors[name as keyof FormErrors]) {
            setFormErrors(prev => ({ ...prev, [name]: '' }));
        }
        setBackendError("");
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
        if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
        if (!formData.school_id.trim()) newErrors.school_id = 'ID is required';
        if (!formData.grade.trim()) newErrors.grade = 'Grade is required';

        setFormErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setIsLoading(true);

        if (validateForm()) {
             // <--- Set loading true here
            console.log('Form submitted:', formData);

            const newCompetitorData = {
                first_name: formData.firstName,
                last_name: formData.lastName,
                school_id: formData.school_id,
                grade: parseInt(formData.grade, 10),
            }
            try {
              let searchPath = "/competitions/competitor/create";

              if (secret != null){
                searchPath = searchPath + `?secret=${encodeURIComponent(secret)}`;
              }
              const result = await apiBodyFetch<NewCompetitor>(
                searchPath,
                "POST",
                newCompetitorData
              );
              console.log('Competitor created :', result);
              setIsSubmitted(true);

            } catch (error) {
              console.error("Failed to create competitor: ", error);
              setBackendError("Error creating competitor")
            }


            // Reset form after 3 seconds
            // setTimeout(() => {
            //     setIsSubmitted(false);
            //     setFormData({
            //         firstName: '',
            //         lastName: '',
            //         grade: '',
            //     });
            // }, 3000);
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
                    <p className="text-gray-600">You have successfully created a new competitor: {' '}
                        <Link href={`/competitors/${formData.school_id}`} className={"text-orange-400"}>
                             {formData.firstName} {formData.lastName}
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
                        <h1 className="text-3xl font-bold text-white">Create a Competitor</h1>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        <div>
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        className={`w-full text-black px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            formErrors.firstName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                        }`}
                                        placeholder=""
                                    />
                                    {formErrors.firstName && <p className="mt-1 text-sm text-red-600">{formErrors.firstName}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleInputChange}
                                        className={`w-full text-black px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            formErrors.lastName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                        }`}
                                        placeholder=""
                                    />
                                    {formErrors.lastName && <p className="mt-1 text-sm text-red-600">{formErrors.lastName}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        ID
                                    </label>
                                    <input
                                        type="text"
                                        name="school_id"
                                        value={formData.school_id}
                                        onChange={handleInputChange}
                                        className={`w-full text-black px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            formErrors.school_id ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                        }`}
                                        placeholder=""
                                    />
                                    {formErrors.school_id && <p className="mt-1 text-sm text-red-600">{formErrors.school_id}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Grade
                                    </label>
                                    <input
                                        type="number"
                                        name="grade"
                                        value={formData.grade}
                                        onChange={handleInputChange}
                                        className={`w-full text-black px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            formErrors.grade ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                        }`}
                                        placeholder=""
                                    />
                                    {formErrors.grade && <p className="mt-1 text-sm text-red-600">{formErrors.grade}</p>}
                                </div>

                            </div>
                        </div>


                        {/* Submit Button */}
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
