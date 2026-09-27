# YatraAI — Discover Bharatpur

YatraAI is a lightweight, mobile-first tourism map for Bharatpur, Nepal. This phase only sets up the workspace; feature implementation is intentionally deferred.

## Workspace layout

- `web`: Next.js App Router PWA shell with Tailwind CSS and Leaflet dependencies installed.
- `server`: Express API shell with LangChain/LangGraph dependencies installed for the next phase.

## Getting started

```bash
npm install
cp server/.env.example server/.env
npm run dev
```

- Web app: http://localhost:3000
- API health check: http://localhost:4000/health

No tourism UI or AI workflow is implemented yet. The app is ready for that work to begin in the next phase.
