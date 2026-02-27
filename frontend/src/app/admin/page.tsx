'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { apiBodyFetch, apiFetchAuth} from '@/lib/api';
import LoginForm from "@/components/LoginForm";
import Link from "next/link";


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
    } else {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="grid grid-cols-2 grid-rows-2 gap-25">

                    <Link href="/admin/create/competition">
                        <div className={"bg-orange-300 w-64 h-42 p-3 flex flex-col justify-center items-center text-center" +
                            "transition-transform duration-300 hover:scale-110"}>
                            <p className={"text-sm text-black"}>Create</p>
                            <p className={"text-2xl text-black font-bold"}>Competition</p>
                        </div>
                    </Link>

                    <Link href="/admin/create/competitor">
                        <div className={"bg-orange-300 w-64 h-42 p-3 flex flex-col justify-center items-center text-center" +
                            "transition-transform duration-300 hover:scale-110"}>
                            <p className={"text-sm text-black"}>Create</p>
                            <p className={"text-2xl text-black font-bold"}>Competitor</p>
                        </div>
                    </Link>

                    <Link href="/admin/update">
                        <div className={"bg-orange-300 w-64 h-42 p-3 flex flex-col justify-center items-center text-center" +
                            "transition-transform duration-300 hover:scale-110"}>
                            <p className={"text-sm text-black"}>Update</p>
                            <p className={"text-2xl text-black font-bold"}>Solves</p>
                        </div>
                    </Link>

                    {/* <Link href="/">
                    <div className={"bg-orange-300 w-64 h-42 p-3 flex flex-col justify-center items-center text-center" +
                        "transition-transform duration-300 hover:scale-110"}>
                        <p className={"text-2xl text-black font-bold"}>logout</p>
                    </div>
                </Link> */}
                    <button
                        onClick={handleLogout}
                        className="bg-orange-300 w-64 h-42 p-3 flex flex-col justify-center items-center text-center cursor-pointer
                        transition-transform duration-300 hover:scale-110">
                        <p className="text-sm text-black">Account</p>
                        <p className="text-2xl text-black font-bold">Logout</p>
                    </button>
                </div>
            </div>
        );
    }

}


// export default SubmissionForm;
export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AdminPage />
        </Suspense>
    );
}
