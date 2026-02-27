
// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

// this commented out section is vibe coded, probably not going to use it but im saving it for now
// const getBaseUrl = () => {
//   // 1. If an environment variable is explicitly set, use it (overrides everything)
//   if (process.env.NEXT_PUBLIC_API_BASE_URL) {
//     return process.env.NEXT_PUBLIC_API_BASE_URL;
//   }

//   // 2. If running in the browser, match the current hostname
//   if (typeof window !== "undefined") {
//     const host = window.location.hostname;
//     console.log(`HOST ${host}`);
//     // If we are on localhost or 127.0.0.1, assume backend is on port 8000
//     if (host === 'localhost' || host === '127.0.0.1') {
//         return `http://${host}:8000`;
//     }
//   }

//   // 3. Server-side fallback (or default)
//   return "http://127.0.0.1:8000";
// };

// const API_BASE_URL = getBaseUrl();
// console.log("URL:", API_BASE_URL);

export async function apiFetch(path: string) {
  // const res = await fetch(`${API_BASE_URL}${path}`, {credentials: "include"});
  //

  const start = performance.now();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    next: { revalidate: 3600 },
  });


  const duration = performance.now() - start;
  console.log(`[apiFetch] ${path} took ${duration.toFixed(2)}ms`);

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function apiFetchAuth(path: string) {
  const start = performance.now();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    cache: "no-store"
  });


  const duration = performance.now() - start;
  console.log(`[apiFetch] ${path} took ${duration.toFixed(2)}ms`);

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

// POST/PUT/DELETE helper
export async function apiBodyFetch<T>(path: string, method: string, body: T) {
  const csrfCookie = getCookie("csrftoken"); // check for cross site request forgery cookie 

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json", 
      ...(csrfCookie ? { "X-CSRFToken": csrfCookie} : {}), // this just adds the cookie to the header if present, omits it otherwise 
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

// Returns the cookie corresponding to the name, returns null if it doesn't exist 
function getCookie(name: string) {
  let desiredCookie = null; 
  const cookies = document.cookie;
  if (cookies && cookies !== "") { 
    const cookieList = document.cookie.split(";"); 
    for (let cookie of cookieList) {
      cookie = cookie.trim();
      if (cookie.startsWith(`${name}=`)) {
        desiredCookie = decodeURIComponent(cookie.substring(name.length + 1)); // strip out "name="
        break; 
      }
    }
  }
  return desiredCookie; 
}
