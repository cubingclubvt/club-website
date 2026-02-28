# Env vars

Enviornment variables are used in both the frontend and backend apps. These variables contain crucial information needed to make the applications run in the correct mode (i.e debug/user) and connect to each other correctly. 

Here are the expected schemea's for each

## Backend
SECRET_KEY=super-secret-key-for-production

DEBUG=False

DATABASE_URL=postgresql://postgres:password@mainline.proxy.rlwy.net:40561/railway

ALLOWED_HOSTS=localhost,127.0.0.1,domain.example.com

ALLOWED_ORIGINS=https://cubingclub-vt-deploy-test-frontend.vercel.app,http://localhost:3000,http://127.0.0.1:3000

TIME_ZONE=America/New_York


## Frontend

NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
DISABLE_BACKEND=false

