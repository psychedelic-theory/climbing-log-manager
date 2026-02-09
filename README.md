# Climb Log Manager - Solo Project 2
A cloud-hosted client/server web application for logging indoor and outdoor climbing sessions. Users can create, view, edit, and delete climbing records, browse paginated lists, view statistics, and persist data across devices through a backend service.

This project is a continuation of Solo Project 1, transitioning from browser-owned storage (localStorage) to a server-managed JSON datastore accessed exclusively through HTTP API routes.

## Live Application URL(s)
Frontend (Netlify): https://climbing-log-manager.netlify.app/

Backend (PythonAnywhere): https://johanz26.pythonanywhere.com/

## Tech Stack
**FRONTEND**
  - HTML
  - CSS
  - Vanilla Javascript
  - Hosted on (Netlify)

**Backend**
  - Python (Flask)
  - Hosted on (PythonAnywhere)
  - JSON file persistence

## Architecture Overview
**Client (Broswer)**
  - Renders UI
  - HTTPS requests for:
    - Create
    - Read
    - Update
    - Delete
  - Never stores the dataset locally
  - Dynamically updates UI when backend data changes

**Server (Flask API)**
  - Handles all CRUD routes
    - GET /api/logs
    - POST /api/logs
    - PUT /api/logs/<id>
    - DELETE /api/logs/<id>
  - Performs server-side validation
  - Reads/Writes JSON files
  - Computes Stats
  - Implements paging logic

## JSON Persistence
All application data is stored on the server. This can be found in the backend/data/logs.json in PythonAnywhere. On startup, the server loads the seed.json files if the log file does not exist. All changes update the logs.json dynamically. Refreshing the web application does not reset the data. Data persists across: Browser refreshes, Devices, & Sessions. This web application works in incognito/private windows. 

## LOOM DEMONSTRATION FOR SOLO PROJECT 2

----------------------------------------------------------------------------------------

# Climb Log Manager - Solo Project 1
A local-only web application for looging indoor and outdoor climbing sessions for all types of climbers. Users can create, view, edit, and delete climbing records, view statistics, and persist data acreoss page refreshes using 'localStorage'.


## Tech Stack
- HTML
- CSS
- Vanilla JavaScript
- 'localStorage' for Persistence
- XAMPP / Apache for local hosting


## Folder Placement (REQUIRED)
This project MUST be placed inside a folder named "climb-log-manager" inside XAMPP's 'htdocs' folder.
Example: 'C:\xampp\htdocs\climb-log-manager\'


## FINAL WEB URL
http://localhost/climbing-log-manager

## How to Run the Application
1. Open the XAMPP control panel
2. Start Apache
3. Open a browser
4. Navigate to http://localhost/climbing-log-manager/

## LOOM DEMO RECORDING 
URL: https://www.loom.com/share/b355e627df6f4988968f9ed648aee723
