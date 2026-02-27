// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define the feature flags
const FEATURES: Record<string, boolean> = {
    "/competitions": false,
    "/rankings": false,
    "/competitors": false,
    "/admin": false,
};

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Get the environment variable and convert it to a boolean.
    // Remember that environment variables are always strings,
    // so explicitly check if it's 'true'.
    const disableBackend = process.env.DISABLE_BACKEND === 'true';

    console.log('🔍 Middleware running for:', pathname);
    // console.log('⚙️ DISABLE_BACKEND is set to:', disableBackend);
    console.log('⚙️ DISABLE_BACKEND is set to:', process.env.DISABLE_BACKEND);

    // Only proceed with feature flag checks if DISABLE_BACKEND is true
    if (disableBackend) {
        console.log('🚫 Backend disabled. Applying feature flag checks.');
        // Check if the pathname starts with any disabled feature path
        for (const [featurePath, enabled] of Object.entries(FEATURES)) {
            if (pathname.startsWith(featurePath) && !enabled) {
                console.log('🔄 Redirecting to coming soon for:', pathname);
                return NextResponse.rewrite(new URL('/coming-soon', request.url));
            }
        }
    } else {
        console.log('✅ Backend is enabled. Skipping feature flag redirects.');
    }
    // redirect to login if user is not logged in and tries to access admin
    //if (pathname.startsWith("/admin") && pathname != "/admin/login") {
    if (pathname.startsWith("/admin/")) {
        const session = request.cookies.get("sessionid");
        if (!session) {
            console.log("NOT LOGGED IN, REDIRECT TO LOGIN PAGE"); 
            return NextResponse.redirect(new URL("/admin", request.url));
        }
    }

    console.log('✅ Allowing request to proceed for:', pathname);
    return NextResponse.next();
}

export const config = {
    matcher: [
        '/competitions/:path*',
        '/rankings/:path*',
        '/competitors/:path*',
        '/admin/:path*',
    ],
};
