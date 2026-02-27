
# Overview
This is the backend application, created with Django

# Getting started
1. Create a virtual python environment: `python -m venv .venv` 
2. Run the virtual environment:
    - Windows: `.venv\Scripts\activate`
    - Linux: `source .venv/bin/activate`
3. Install requirements: `pip install -r requirements.txt`
> Note: Vercel requries psycopg2-binary, while local machines requrie regular "psycogp2". Comment out "psycogp2-binary" from requirements, and manually run `pip install psycopg2`
5. Migrate the DB: `python manage.py migrate`
6. (Optional) Create fake data: `python manage.py seed`

# How to run
1. Run the server: `python manage.py runserver`
2. Open [http:/localhost:8000](http:/localhost:8000) in your browser

# Data management
1. Generate fake data with: `python manage.py seed`
2. To clear previous fake data, run `python manage.py flush`
3. To access admin controls, create an admin account: `python manage.py createsuperuser`. Set the username and password to be "admin" for consistency. On the admin page, you can manually create data for the database. Note that this can also be done through the python shell (`python manage.py shell`) but may be more cumbersome.
