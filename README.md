# Neon Type Sprint

A colorful, session-based typing speed game with WPM reporting.

## Features

1. No login required.
2. Unique temporary player ID per session.
3. Session auto-expiry and ID revocation.
4. Auto-renew near expiry while active.
5. Interactive typing UI with live WPM/accuracy.
6. End-of-round result panel with best WPM for current session.

## Session model

1. Client requests session from `POST /api/session/new`.
2. Server issues `playerId` and expiration timestamp.
3. Session expires after inactivity window (default: 20 minutes).
4. Expired session IDs are revoked and removed server-side.

## APIs

1. `POST /api/session/new` -> create session
2. `GET /api/session/:playerId` -> validate active session
3. `POST /api/session/renew` -> renew expiration
4. `GET /api/passage` -> random typing passage
5. `POST /api/score` -> store score in current session

## Run

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Notes

1. Old card-game runtime modules have been removed from active app flow.
2. Scores are in-memory for the active server process and current session.

## Deploy on Google Cloud Run

Prerequisites:

1. Install Google Cloud CLI.
2. Create or select a Google Cloud project.
3. Enable billing for the project.
4. Enable APIs: Cloud Run Admin API, Cloud Build API, Artifact Registry API.

From this project directory, run:

1. `gcloud auth login`
2. `gcloud config set project YOUR_PROJECT_ID`
3. `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com`
4. `gcloud run deploy neon-type-sprint --source . --region asia-south1 --allow-unauthenticated`

After deploy, Google Cloud will print a public HTTPS URL for the live app.
