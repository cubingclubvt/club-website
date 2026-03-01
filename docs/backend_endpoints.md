# Overview
This document provides information about all the available endpoints the backend.

# GET endpoints
> Endpoints which are read-only

- `competitions/` 
    - Description: Returns a list competitions and preview info
    - Example response: 
        ```    
        [
        {
            "id": 1,
            "name": "Chapmanfurt Open",
            "date": "03/25/25",
            "official": true
        }
        ]
        ```

- `competitions/<str:competition_name>` 
    - Description: Returns the detailed information for a competition
    - Example response:
        ```
        {
            "id": 1,
            "name": "Chapmanfurt Open",
            "location": "063 Robert Skyway Apt. 099\nPort Karaberg, PR 18988",
            "events": [
                {
                    "name": "3x3",
                    "rounds": 3
                },
            ],
            "num_competitors": 21,
            "date": "03/25/25",
            "official": true
        }
        ```

- `competitons/<str:competition_name>/<str:event_name>/<int:round_number>`
    - Description: Returns the results from a round of a competition
    - Example response:
        ```
        [
            {
                "single": "13.00",
                "average": "21.67",
                "rank": 1,
                "solves": [
                    "19.00",
                    "22.00",
                    "(29.00)",
                    "(13.00)",
                    "24.00"
                ],
                "name": "Stacey Brady"
                "school_id": "Stacey_Brady_01"
            },
        ]
        ```

- `competitions/competitor` 
    - Description: Lists all competitors in the database
    - Example response:
        ```
            {
                "competitors": [
                    {
                    "first_name": "Alan",
                    "last_name": "Coleman",
                    "school_id": "Alan_Coleman_01",
                    "grade": 12
                    }
                ]
            }
        ```

- `competitons/competitor/<str:school_id>` 
    - Description: Returns detailed information about a competitor, including their PRs
    - Example response:
        ```
        {
            "first_name": "Pedro",
            "last_name": "Lyons",
            "school_id": "Pedro_Lyons_01"
            "grade": 9,
            "first_competition_date": "03/25/25",
            "num_competitions": 6,
            "total_solves": 155,
            "event_rankings": [
                {
                    "event_name": "3x3",
                    "best_single": "11.00",
                    "best_average": "18.33",
                    "single_ranking": 15,
                    "average_ranking": 4
                }
            ]
        }
        ```

- `competitons/competitor/<str:school_id>/<str:event_name>`
    - Description: Returns all solves for a competitor in a particular event
    - Example response:
        ```
        [
         {
                "competition_name": "Loriview Open",
                "round_results": [
                    {
                        "single": "22.00",
                        "average": "28.00",
                        "rank": 5,
                        "solves": [
                            "(DNF)",
                            "23.00",
                            "33.00",
                            "(22.00)",
                            "28.00"
                        ],
                        "round_number": 1
                    }
                ]
            }
        ]
        ```

- `competitons/rankings/`
    - Description: Returns a list of all valid events
    - Example response:
       ```
       {
            "events": [
                "2x2",
                "3x3",
                "4x4",
                "Pyraminx",
                "Skewb"
            ]
       }
       ``` 

- `competitons/rankings/<str:event_name>/<str:single_or_average>`
    - Description: Returns all the rankings for an event, either by single or average. The variable single_or_average expects a value of "single" or "average".
    - Example response:
        ```
        [
            {
                "competitor_name": "Cynthia Campos",
                "school_id": "Cynthia_Campos_01",
                "rank": 1,
                "competition_name": "Chapmanfurt Open",
                "result": "10.00"
            },
        ]
        ```

- `auth_status/` 
    - Description: Returns whether or not the user is authenticated for the admin panel.
    - Example response: 
        ```    
        {
            "isAuthenticated": True
        }
        ```

# POST/PATCH endpoints

- `competitions/create` 
    - Description: Creates a new competition
    - Example request:
        ```
        {
          "name": "Blacksburg Summer Open",
          "location": "123 Memory Lane\nSpringfield, VA 12345",
          "start_time": "2025-07-01T09:00:00Z",
          "end_time": "2025-07-01T17:00:00Z",
          "official": true,
          "events": [
            {
              "event-name": "3x3",
              "Rounds": 3
            },
            {
              "event-name": "2x2",
              "Rounds": 2
            }
          ],
          "competitors": [
            {
              "school_id": "Michael_Wade_01",
              "events": ["3x3", "2x2"]
            }
          ]
        }
        ```

- `competitions/competitor/create` 
    - Description: Creates a new competitor
    - Example request:
        ```
        {
            "first_name":"John",
            "last_name": "Smith",
            "school_id": "John_Smith_01",
            "grade": 12
        }
        ```

- `competitions/<str:competition_name>/<str:event_name>/<int:round_number>/update`
    - Description: Updates the results of a round. When a round is created, all the competitors are given place holder solves, and so a call to this method is required. Additionally, it can be used to update incorrect results. However, it cannot actually create solves, meaning all competitors for a round must changed elsewhere. DNFs can be inputted as "0.00" or "DNF".
        > NOTE: This endpoint requires a PATCH request
    - Example request:
        ```
            {
              "results": [
                {
                  "school_id": "John_Smith_01",
                  "solves": ["12.34", "5.12", "DNF", "8.23", "9.11"]
                },
                {
                  "competitor_name": "Jane_Smith_01",
                  "solves": ["12.34", "5.12", "0.00", "8.23", "9.11"]
                }
              ]
            }
        ```

- `login/` 
    - Description: Attempts to login to the admin panel with the given credentials. 
    - Example request:
        ```
        {
            "username": "admin",
            "password": "password123"
        }
        ```
    - Successful Response:
        ```
        {
            "isAuthenticated": True
        }
        ```
    - Error Response: 
        ```
        {
            "isAuthenticated": False
        }
        ```

- `logout/` 
    - Description: Creates a new competition
    - Example request:
        ```
        {}
        ```
    - Example response:
        ```
        {
            "detail": "Logged Out"
        }
        ```