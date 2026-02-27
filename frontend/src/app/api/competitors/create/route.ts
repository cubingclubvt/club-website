// src/app/api/competitors/create/route.ts
// This file defines a Next.js API Route for creating a new competitor

import { NextResponse } from 'next/server';

// You might store your Django API base URL in an environment variable
const DJANGO_API_BASE_URL = 'http://127.0.0.1:8000';

// Handle POST requests to this API route
export async function POST(request: Request) {
    try {
        // 1. Read the request body from the Next.js frontend
        // The frontend will send JSON data (first_name, last_name, grade)
        const requestBody = await request.json();
        console.log('Received POST request body from frontend:', requestBody);

        // 2. Construct the URL to your Django API's create endpoint
        const djangoApiUrl = `${DJANGO_API_BASE_URL}/competitions/competitor/create`;
        console.log(`Proxying POST request to Django API: ${djangoApiUrl}`);

        // 3. Make the POST request to your Django API
        const djangoResponse = await fetch(djangoApiUrl, {
            method: 'POST', // Specify the HTTP method
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
                { error: `Failed to create competitor in Django API`, details: errorData },
                { status: djangoResponse.status }
            );
        }

        // 5. Parse the JSON response from Django (e.g., the created competitor data)
        const data = await djangoResponse.json();
        console.log('Successfully created competitor in Django:', data);

        // 6. Return the data to the Next.js frontend with a 201 Created status
        return NextResponse.json(data, { status: 201 });

    } catch (error) {
        console.error('Error in Next.js API Route (POST /api/competitors/create):', error);
        // Handle cases where request.json() fails or other unexpected errors
        return NextResponse.json(
            { error: 'Internal Server Error during proxy POST request', details: (error as Error).message },
            { status: 500 }
        );
    }
}

// You can also define other HTTP methods if needed, e.g., GET for listing all competitors
// export async function GET(request: Request) { ... }