// src/app/api/competitions/[slug]/[eventSlug]/[roundString]/route.ts
// This file defines a Next.js API Route

import { NextResponse } from 'next/server';

// You might store your Django API base URL in an environment variable
const DJANGO_API_BASE_URL = 'http://127.0.0.1:8000';

// Define expected URL parameters from the client
interface RouteParams {
    slug: string;        // competition slug
    event: string;   // event slug (e.g., "3x3")
}

// Handle GET requests to this API route
export async function GET(
    request: Request, // The incoming request from your Next.js frontend
    { params }: { params: Promise<RouteParams> } // Dynamic segments from the URL
) {
    const { slug, event } = await params;

    try {
        // Construct the URL to your Django API
        const djangoApiUrl = `${DJANGO_API_BASE_URL}/competitions/competitor/${slug}/${event}`;
        console.log(`Proxying request to Django API: ${djangoApiUrl}`); // For debugging

        // Make the request to your Django API
        const djangoResponse = await fetch(djangoApiUrl, {
            // You can add headers here if your Django API requires them (e.g., authorization)
            // headers: {
            //   'Authorization': `Bearer ${process.env.DJANGO_API_SECRET_TOKEN}`, // Example
            // }
        });

        if (!djangoResponse.ok) {
            // If Django API returns an error, propagate it
            const errorText = await djangoResponse.text(); // Get raw error text
            console.error(`Django API error (${djangoResponse.status}): ${errorText}`);
            return NextResponse.json(
                { error: `Failed to fetch data from Django API: ${errorText}` },
                { status: djangoResponse.status }
            );
        }

        // Parse the JSON response from Django
        const data = await djangoResponse.json();

        // Return the data to the Next.js frontend
        return NextResponse.json(data);

    } catch (error) {
        console.error('Error in Next.js API Route:', error);
        return NextResponse.json(
            { error: 'Internal Server Error during proxy request' },
            { status: 500 }
        );
    }
}