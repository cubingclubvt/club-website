

import React from "react";
import UpdateSolvesSection from "@/components/UpdateSolvesSection";
// import {notFound} from "next/navigation";
import { apiFetch } from "@/lib/api";



interface CompetitionDetailProps {
    params: Promise<{
        slug: string;
    }>;
}


//TODO: separate this page into server (top part) and client components (bottom part, under separator) for better resource management

async function CompetitionDetail({ params }: CompetitionDetailProps){

    const { slug } = await params;

    let competitionName = 'Loading Competition...';
    let competitionDate = 'N/A';
    let competitionNumCompetitors = 0;
    let competitionEventData = [];

    if (process.env.DISABLE_BACKEND === 'false') {

        try {
            // 1. Attempt the fetch request
            // const competitionMetadataResponse = await apiFetch(`/competitions/${slug}`);
            const data = await apiFetch(`/competitions/${slug}`);
            //
            //
            // // 2. Check if the HTTP response was successful (status code 200-299)
            // if (!competitionMetadataResponse.ok) {
            //     // Log the specific error status and message for server-side debugging
            //     console.error(
            //         `Failed to fetch competition data for slug '${slug}': ` +
            //         `Status ${competitionMetadataResponse.status} - ${competitionMetadataResponse.statusText}`
            //     );
            //     // Handle specific HTTP error codes
            //     if (competitionMetadataResponse.status === 404) {
            //         // If the resource is not found, use Next.js's notFound() to render a 404 page
            //         notFound();
            //     }
            //     // For other non-2xx statuses, throw a generic error to be caught by error.js
            //     throw new Error(`API returned status ${competitionMetadataResponse.status}`);
            // }
            //
            // // 3. Attempt to parse the JSON response
            // const data = await competitionMetadataResponse.json();

            // 4. Basic validation of the expected data structure
            if (!data || typeof data !== 'object') {
                console.error(`Invalid or empty JSON response for /competitions/${slug}:`, data);
                throw new Error('Received invalid data format from API.');
            }

            // 5. Assign data to variables after successful parsing and basic validation

            // Optional: More specific validation for critical fields.
            // Assign defaults if properties are missing or have unexpected types.
            competitionName = typeof data.name === 'string' && data.name ? data.name : 'Unknown Competition';
            competitionDate = typeof data.date === 'string' && data.date ? data.date : 'Date Not Available';
            competitionNumCompetitors = typeof data.num_competitors === 'number' && data.num_competitors >= 0
                ? data.num_competitors
                : 'Unknown';
            competitionEventData = Array.isArray(data.events) ? data.events : [];

        } catch (error) {
            console.error(`Error in AdminUpdatePage for slug '${slug}':`, error);

            let errorMessage = 'Unknown error';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            throw new Error(`Failed to load competition details: ${errorMessage}`);
        }

    }


    return (
        <div>
            <h1 className={"text-white text-center text-5xl mt-24"}>
                {competitionName}
            </h1>
            <section className={"flex justify-center gap-40 items-center max-w-4xl mt-8 w-full mx-auto"}>
                <div className={"flex flex-col gap-3 items-center"}>
                    <div className={"text-slate-400 text-center"}>
                        Date
                    </div>
                    <div className={"text-slate-200 text-center text-xl"}>
                        {competitionDate}
                    </div>
                </div>
                <div className={"flex flex-col gap-3 items-center"}>
                    <div className={"text-slate-400 text-center"}>
                        # Competitors
                    </div>
                    <div className={"text-slate-200 text-center text-xl"}>
                        {competitionNumCompetitors}
                    </div>
                </div>
            </section>

            <div className={"my-separator mx-auto h-px w-8/10 bg-gray-300 my-16"}></div>


            <UpdateSolvesSection
                slug={slug} allEventData={competitionEventData} initialEvent={"3x3"} initialRound={1}
            />

        </div>
    );

}

export default CompetitionDetail;
