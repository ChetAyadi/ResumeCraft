# ResumeCraft AI

An AI-powered resume builder with an ATS (Applicant Tracking System) scorer. Build a clean resume, check how well it matches a job description, and get help from an AI assistant.

## Features

- **Resume Builder**: create and edit resumes with custom sections and accent colors
- **ATS Scorer**: check how ATS-friendly your resume is and get improvement tips
- **AI Chatbot**: career and resume help powered by Groq
- **Google Login**: quick sign-in with Google OAuth
- **Dashboard and Profile**: manage all your saved resumes in one place

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React, Vite                         |
| Backend  | Django, Django REST Framework       |
| Database | PostgreSQL                          |
| AI       | Groq API                            |
| Auth     | Google OAuth                        |

## Project Structure

```
resume-builder-ats/
├── backend/          # Django API
└── frontend-react/   # React (Vite) app
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL
- A free [Groq API key](https://console.groq.com/)
- A Google OAuth Client ID from Google Cloud Console

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
```

Copy the example env file and fill in your own values:

```bash
copy .env.example .env       # Windows
# cp .env.example .env       # macOS / Linux
```

Then run:

```bash
python manage.py migrate
python manage.py runserver
```

The API runs at `http://127.0.0.1:8000`.

### 2. Frontend

```bash
cd frontend-react
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Environment Variables

Set these in `backend/.env` (see `.env.example`):

| Variable           | Description                      |
|--------------------|----------------------------------|
| `SECRET_KEY`       | Django secret key                |
| `DEBUG`            | `True` for development           |
| `ALLOWED_HOSTS`    | Allowed hosts, comma separated   |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | PostgreSQL settings |
| `GROQ_API_KEY`     | Your Groq API key                |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID      |

> Never commit your real `.env` file. It is already in `.gitignore`.

## Author

Made by Vivek.
