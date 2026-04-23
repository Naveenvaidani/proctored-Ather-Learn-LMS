# Real-Time Proctored Adaptive Learning Platform

**A privacy-first, real-time adaptive learning system that combines on-device computer vision, audio signal processing, browser behavior telemetry, and policy-driven enforcement to keep learning honest, focused, and measurable.**

This project is designed for modern educational environments where passive video consumption is not enough. The platform validates learner presence and attention while content is being consumed, computes a live engagement score, and reacts immediately when policy violations are detected. Unlike cloud-heavy proctoring products, the system processes camera and microphone data locally and stores only derived events and analytics, which makes it substantially better aligned with privacy, latency, and operational-cost requirements.

Repository: https://github.com/Naveenvaidani/proctored-Ather-Learn-LMS

## What This Platform Does

The system turns online learning into an active feedback loop. It continuously checks whether the learner is actually present, visually engaged, listening, and behaving in a policy-compliant way. The platform monitors face presence, eye gaze, head pose, voice activity, background noise, tab switching, and inactivity. These signals are fused into a dynamic Health Points (HP) model that reflects the quality of the learning session over time.

When the score drops or specific violations persist, the system can warn the learner, pause playback, and record structured anomaly metadata for later review. This creates a stronger integrity model than ordinary LMS platforms, because the system reacts during the session instead of merely reporting after the session ends.

## Why This Project Stands Out

Most learning platforms focus on content delivery and quiz completion. This platform adds a live validation layer on top of content delivery. The result is a more trustworthy experience for certification, corporate training, remote assessment preparation, and high-integrity learning workflows.

The architecture was intentionally designed around edge processing. Camera and microphone inputs are analyzed in the browser with workers so the UI remains responsive and raw media does not have to travel to the backend. Only derived metrics, alerts, and aggregated session outcomes are stored. This gives the system a strong privacy posture while still allowing meaningful analytics and auditability.

## Key Features

### Real-Time Learning Validation

The platform watches for learner presence and attention continuously rather than relying on end-of-session reporting. It can detect when a face is missing, when multiple faces appear, when the learner looks away, when the head angle changes significantly, or when the browser becomes inactive. These signals are interpreted in context, so a short transient event does not automatically trigger a severe penalty.

### Computer Vision Based Proctoring

The frontend uses MediaPipe-based face tracking to extract landmarks and derive gaze and head pose behavior. This is significantly more useful than simple bounding-box detection because the system needs geometry, not just face location. Landmark-level information enables richer policy logic and more accurate attention estimation.

### Audio Intelligence

The platform analyzes microphone input locally to distinguish speech activity from background noise. A hybrid strategy is used: fast voice activity detection provides low-latency classification, while deeper inference logic improves robustness where signal quality is imperfect. This makes the system more reliable than a single-rule audio threshold model.

### Behavior Monitoring

The browser itself is a signal source. The app uses visibility, focus, blur, and idle-time tracking to detect tab switching and inactivity. This is essential because camera and microphone signals alone cannot tell whether the learner left the page or minimized the session.

### HP-Based Engagement Control

All validated signals are combined into a single adaptive control model. The HP score is not just a dashboard metric; it drives enforcement logic, session state, and recovery behavior. This creates a measurable engagement loop that can be analyzed over time.

### Privacy-First Design

Raw video and audio are not stored in the backend. Only derived metadata such as violations, scores, and session summaries are persisted. That design choice reduces sensitivity, simplifies compliance, and lowers the long-term storage burden.

### Modular Backend

The backend is organized around domain modules such as auth, users, courses, quizzes, notifications, anomalies, settings, genAI, and ejection policy. That structure makes it easier to extend the platform without creating a single monolithic code path.

## Architecture Overview

The system is split into three major layers. The frontend is the experience layer and the validation layer. It renders the learning interface, captures client-side sensor data, and runs the workers that process camera and microphone streams. The backend is the service and persistence layer. It exposes APIs, records anomalies, generates OpenAPI documentation, and manages domain-specific services through dependency injection. MongoDB is used as the primary data store because the system produces event-style documents that evolve over time and fit document-based modeling better than rigid relational schemas.

The runtime flow is intentionally closed-loop. The frontend measures signals, the fusion engine computes state, the control layer decides what to do, and the backend stores only the derived result. This is the right shape for a system that must be both responsive and privacy-preserving.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, TypeScript, React Router, TanStack Query, Zustand, Motion |
| Computer Vision | MediaPipe Face Mesh, MediaPipe Face Detection, Web Workers |
| Audio Processing | Browser Audio APIs, Web Workers, hybrid VAD pipeline, ONNX runtime support |
| Backend | Node.js, Express, routing-controllers, InversifyJS, TypeScript |
| Data | MongoDB |
| Observability | Sentry, structured logging, OpenAPI/Scalar |
| Dev Workflow | pnpm workspace, concurrent frontend/backend dev scripts |

## Project Structure

```text
.
├── backend/                # Node.js API, domain modules, jobs, and shared services
├── frontend/               # React/Vite application, UI, validation hooks, workers, and services
├── scripts/                # Setup helpers and local development utilities
├── run-all.cmd             # Windows one-command startup script
├── SETUP_COMMANDS.md       # Local setup and run instructions
├── README.md               # Main project landing page
└── Real_Time_Proctored_Adaptive_Learning_Platform_Report.md  # Detailed architecture/report documentation
```

## Backend Highlights

The backend is built around Express and routing-controllers, with dependency injection handled by Inversify. Each domain module owns its controllers, services, validators, and container bindings. This keeps auth, courses, quizzes, users, notifications, settings, anomaly handling, and adaptive policy logic isolated enough to evolve independently.

The backend also generates OpenAPI documentation and exposes it at a `/reference` endpoint through Scalar. That makes the API easier to inspect, integrate, and test during development and review.

## Frontend Highlights

The frontend is designed as a high-interaction single-page application. It includes route-based pages for authentication, course consumption, proctoring, and analytics. The learning flow is not just decorative UI; it is connected directly to the validation engine and to the backend anomaly APIs.

The app uses workers for face tracking, voice analysis, and engagement fusion so intensive processing does not block the interface. This is one of the major reasons the product feels responsive even while continuously analyzing live session signals.

## Getting Started

### Prerequisites

You will need Node.js, pnpm, and a local MongoDB instance or access to a MongoDB URI. If you are running the system on Windows, the included `run-all.cmd` file provides the simplest startup path.

### Install Dependencies

From the repository root:

```powershell
pnpm install
```

### Configure Environment

Create or edit `backend/.env` and set a valid database URL. A local example looks like this:

```env
DB_URL="mongodb://127.0.0.1:27017"
DB_NAME="vibe"
APP_PORT=8080
NODE_ENV=development
```

Depending on which features you enable, you may also need Firebase, Sentry, SMTP, storage, or AI service keys in the backend environment file.

### Start the Full Stack

On Windows, the recommended command is:

```powershell
.\run-all.cmd
```

If you prefer running the workspace command directly:

```powershell
pnpm dev
```

## Available URLs

When the app starts successfully, the frontend is usually available on a local Vite port such as `http://localhost:5173` or `http://localhost:5175` if the default port is busy. The backend typically listens on `http://localhost:8080`.

The backend also exposes:

- `GET /health` for a simple health check
- `/reference` for API documentation

## Useful Scripts

### Root Workspace

- `pnpm dev` launches backend and frontend together.
- `pnpm install` installs workspace dependencies.
- `pnpm binaries` prepares the local MongoDB binary helper used by the project.

### Backend

- `pnpm --dir backend dev` runs the backend in watch mode.
- `pnpm --dir backend build` compiles TypeScript into the build directory.
- `pnpm --dir backend test` runs backend tests in Vitest UI mode.

### Frontend

- `pnpm --dir frontend dev` starts the Vite frontend.
- `pnpm --dir frontend build` creates a production build.
- `pnpm --dir frontend copy` generates OpenAPI schema artifacts from the backend.

## Documentation and Design Notes

This repository includes deeper supporting documentation for people who want to understand the architecture rather than just run the app. The detailed system report explains the validation engine, fusion logic, analytics model, privacy boundaries, backend modularization, and deployment reasoning. If you are evaluating the system for academic, research, or enterprise use, that report is the right place to start after this README.

## Why the System Uses This Design

The project does not use a single cloud ML model for everything because that would increase latency, cost, and privacy risk. Instead, it uses browser-side processing for the most sensitive high-frequency tasks and sends only derived metadata to the backend. This gives the system better responsiveness and much better control over sensitive media handling.

It also avoids a flat “one endpoint for everything” backend. The modular design keeps feature areas isolated, makes testing easier, and reduces the chance that changes in one domain will break unrelated behavior. For a system that combines educational content, authentication, audio analysis, vision tracking, analytics, and enforcement, that separation matters.

## Deployment Notes

The project has both container-oriented and local development workflows. The backend source is compiled and served from the build output in production-like flows, while the frontend uses Vite for development and optimized bundling for production. The repository also includes Windows-friendly startup scripts to reduce setup friction.

If you are preparing a production deployment, make sure to review the environment variables and storage/AI integrations before exposing the system publicly. The platform is designed to be extensible, but the security and compliance posture should be validated before deployment to a real institution.

## Known Setup Requirements

The backend expects a valid MongoDB connection string. If that is missing, the server will not start correctly. Some advanced features also rely on optional environment variables for Firebase authentication, Sentry error tracking, SMTP, cloud storage, and generative AI support. Not every deployment needs every integration, but the environment should match the features you intend to use.

## Contributing

Contributions are welcome. If you plan to extend the system, the cleanest approach is to add new backend capabilities as isolated modules and keep frontend feature logic in dedicated hooks, services, and pages. That pattern is already used throughout the codebase and is the safest way to maintain scalability.

If you are preparing a pull request, please include a concise explanation of the architectural change, the behavior change, and any testing you performed. For changes that affect validation policy or data storage, include the reasoning behind the change and any compatibility impact.
## Summary

Real-Time Proctored Adaptive Learning Platform is an edge-first, privacy-preserving learning integrity system built for real-world educational and enterprise scenarios. It combines computer vision, audio intelligence, behavior telemetry, adaptive enforcement, and analytics into one coherent control loop. The result is a platform that is more actionable than a traditional LMS and more privacy-conscious than cloud-heavy proctoring tools.

If you are looking for a project that shows serious work in real-time ML systems, browser-based signal processing, and modular full-stack architecture, this repository is designed to make that clear from the first page.

