'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { apiBodyFetch, apiFetchAuth} from '@/lib/api';
import LoginForm from "@/components/LoginForm";
import Link from "next/link";

const actionClass = "flex min-h-38 flex-col items-center justify-center gap-1 rounded-md bg-orange-300 px-4 py-5 text-center text-neutral-900 shadow-md shadow-black/25 transition-colors hover:bg-admin-button-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300 sm:min-h-44";

function AdminPage() {
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

    // check if user is logged in, then display page accordingly 
    useEffect(() => {
        console.log("CHECK AUTH");
        checkAuth();
    }, []);

    async function checkAuth() {
        try {
            const response = await apiFetchAuth("/auth_status/");

            if (response.isAuthenticated) {
                setIsLoggedIn(true);
                console.log("AUTHENTICATED");
            } else {
                setIsLoggedIn(false);
                console.log("NOT AUTHENTICATED");
            }

        } catch (error) {
            console.log("NOT AUTHENTICATED -", error);
            setIsLoggedIn(false);
        } finally {
            setIsLoadingAuth(false);
        }
    }

    async function handleLogin() {
      setIsLoadingAuth(true);
      await checkAuth();
    }
    async function handleLogout() {
        try {
            await apiBodyFetch('/logout/', 'POST', {});
            setIsLoggedIn(false);
            console.log("LOGGED OUT");
        } catch (error) {
            console.error("Logout failed", error);
        }
    }

    // placeholder while it is doing the api call to figure out whether or not the user is logged in 
    if (isLoadingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Checking authentication...</p>
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <Suspense fallback={<div>Loading...</div>}>
                <LoginForm loginSuccess={handleLogin} />
            </Suspense>)
    }

    return (
        <div className="min-h-[75vh] px-5 pb-26 pt-34 text-slate-100 sm:px-10 sm:pb-30 sm:pt-42">
            <div className="mx-auto max-w-5xl">
                <div className="mb-14 flex items-center justify-between gap-4 sm:mb-18">
                    <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">Admin</h1>
                    <button type="button" onClick={handleLogout} className="min-h-11 shrink-0 cursor-pointer rounded-sm border border-orange-300 bg-orange-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-admin-button-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300">
                        Log out
                    </button>
                </div>

                <nav aria-label="Admin navigation" className="relative grid gap-12 sm:grid-cols-2 sm:gap-20 sm:before:absolute sm:before:-inset-y-4 sm:before:left-1/2 sm:before:w-1 sm:before:-translate-x-1/2 sm:before:bg-slate-800/25 lg:gap-24">
                    <section aria-labelledby="admin-competitions" className="min-w-0">
                        <h2 id="admin-competitions" className="mb-6 text-center text-2xl font-semibold tracking-tight text-white">Competitions</h2>
                        <div className="grid gap-6 sm:gap-7">
                            <Link href="/admin/competitions/new" className={actionClass}>
                                <span className="text-sm">Create</span>{" "}
                                <span className="text-2xl font-bold">Competition</span>
                            </Link>
                            <Link href="/admin/competitions" className={actionClass}>
                                <span className="text-sm">Manage</span>{" "}
                                <span className="text-2xl font-bold">Competitions</span>
                            </Link>
                        </div>
                    </section>

                    <section aria-labelledby="admin-competitors" className="min-w-0">
                        <h2 id="admin-competitors" className="mb-6 text-center text-2xl font-semibold tracking-tight text-white">Competitors</h2>
                        <div className="grid gap-6 sm:gap-7">
                            <Link href="/admin/competitors/new" className={actionClass}>
                                <span className="text-sm">Create</span>{" "}
                                <span className="text-2xl font-bold">Competitor</span>
                            </Link>
                            <Link href="/admin/competitors" className={actionClass}>
                                <span className="text-sm">Manage</span>{" "}
                                <span className="text-2xl font-bold">Competitors</span>
                            </Link>
                        </div>
                    </section>
                </nav>
            </div>
        </div>
    );
}


// export default SubmissionForm;
export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AdminPage />
        </Suspense>
    );
}
