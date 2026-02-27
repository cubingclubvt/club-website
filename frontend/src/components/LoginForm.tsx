
//TODO: change this into a component that is imported onto the page, not just one large messy export

'use client';

import React, { useState, ChangeEvent, FormEvent} from 'react';
import { apiBodyFetch } from '@/lib/api';

interface FormData {
    username: string;
    password: string;
}

interface LoginInfo {
    username: string;
    password: string;
}

interface FormErrors {
    username?: string;
    password?: string;
    backend?: string;
}

interface LoginFormProps {
    // this function is called when the user successfully logs in, then the page will change to the logged
    // in version where they can logout and such. 
    loginSuccess: () => void; 
}

export default function LoginForm({ loginSuccess }: LoginFormProps) {
    const [formData, setFormData] = useState<FormData>({
        username: '',
        password: '',
    });

    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [backendError, setBackendError] = useState("");
    //const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false); 

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
 
        if (!formData.username.trim()) newErrors.username = 'username is required';
        if (!formData.password.trim()) newErrors.password = 'password is required';

        setFormErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        setIsLoading(true);

        if (validateForm()) {
             // <--- Set loading true here
            console.log('Form submitted:', formData);

            try {
                const result = await apiBodyFetch<LoginInfo>("/login/", "POST", formData);
                console.log(result);
                //setIsSubmitted(true);
                loginSuccess(); 

            } catch (error) {
                console.error("Login error: ", error);
                setBackendError("Incorrect username or password")
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

    // if (isSubmitted) {
    //     return (
    //         <div className="min-h-screen flex items-center justify-center p-4">
    //             <div className="bg-white rounded-xl shadow-2xl p-8 text-center max-w-md w-full">
    //                 <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
    //                     <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
    //                     </svg>
    //                 </div>
    //                 <h2 className="text-2xl font-bold text-gray-800 mb-2">Success!</h2>
    //                 <p className="text-gray-600">You have successfully logged in.</p>
    //             </div>
    //         </div>
    //     );
    // }

    return (
        <div className="min-h-screen py-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white shadow-2xl overflow-hidden">

                    <div className="bg-gradient-to-r from-orange-500 to-orange-300 px-8 py-6">
                        <h1 className="text-3xl font-bold text-white">Login to Admin panel</h1>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        <div>
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Username
                                    </label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleInputChange}
                                        className={`w-full text-black px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            formErrors.username ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                        }`}
                                        placeholder=""
                                    />
                                    {formErrors.username && <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        className={`w-full text-black px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                                            formErrors.password ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                        }`}
                                        placeholder=""
                                    />
                                    {formErrors.password && <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>}
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
                                Submit
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
}

// // export default SubmissionForm;
// export default function Page() {
//     return (
//         <Suspense fallback={<div>Loading...</div>}>
//             <SubmissionForm />
//         </Suspense>
//     );
// }
