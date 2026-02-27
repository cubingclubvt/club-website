// src/app/api/competitions/[slug]/[event]/[round]/route.ts
// This file defines a Next.js API Route for PATCH requests

import { NextResponse } from 'next/server';

// You might store your Django API base URL in an environment variable
const DJANGO_API_BASE_URL = 'http://127.0.0.1:8000';

// Define expected URL parameters from the client
interface RouteParams {
    slug: string;        // competition slug
    event: string;   // event slug (e.g., "3x3")
    round: string; // round string (e.g., "First")
}

// Handle PATCH requests to this API route
export async function PATCH(
    request: Request, // The incoming request from your Next.js frontend
    { params }: { params: Promise<RouteParams> } // Dynamic segments from the URL
) {
    const { slug, event, round } = await params; // Destructure params correctly
    console.log("HIIIIIIIIIIIIIIIIIIII");
    console.log(`${DJANGO_API_BASE_URL}/competitions/${slug}/${event}/${round}/update`);

    try {
        // 1. Read the request body from the Next.js frontend
        // The frontend will send JSON data (e.g., partial update for solves)
        const requestBody = await request.json();
        console.log('Received PATCH request body from frontend:', requestBody);


        // 2. Construct the URL to your Django API's update endpoint
        // Ensure this URL matches your Django backend's PATCH endpoint for updates
        const djangoApiUrl = `${DJANGO_API_BASE_URL}/competitions/${slug}/${event}/${round}/update`;
        console.log(`Proxying PATCH request to Django API: ${djangoApiUrl}`);

        // 3. Make the PATCH request to your Django API
        const djangoResponse = await fetch(djangoApiUrl, {
            method: 'PATCH', // Changed to PATCH
            headers: {
                'Content-Type': 'application/json', // Crucial: tell Django we're sending JSON
                // You might need to forward other headers from the client,
                // e.g., Authorization if you implement authentication later
                // 'Authorization': request.headers.get('Authorization') || '',
            },
            body: JSON.stringify(requestBody), // Convert the received JS object back to JSON string for Django
        });

        // 4. Handle the response from Django
        if (!djangoResponse.ok) {
            // If Django API returns an error (e.g., 400 Bad Request, 500 Internal Server Error)
            const errorData = await djangoResponse.json(); // Assuming Django errors are JSON
            console.error(`Django API error (${djangoResponse.status}):`, errorData);

            // Propagate the error message and status back to the Next.js frontend
            return NextResponse.json(
                { error: `Failed to update solves in Django API`, details: errorData },
                { status: djangoResponse.status }
            );
        }

        // 5. Parse the JSON response from Django (e.g., the updated data)
        const data = await djangoResponse.json();
        console.log('Successfully updated solves in Django:', data);

        // 6. Return the data to the Next.js frontend with a 200 OK status
        // PATCH typically returns 200 OK if content is returned, or 204 No Content if no content.
        return NextResponse.json(data, { status: 200 }); // Changed status to 200 OK

    } catch (error) {
        console.error(`Error in Next.js API Route (PATCH /api/competitions/${slug}/${event}/${round}):`, error);
        // Handle cases where request.json() fails or other unexpected errors
        return NextResponse.json(
            { error: 'Internal Server Error during proxy PATCH request', details: (error as Error).message },
            { status: 500 }
        );
    }
}
