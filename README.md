# YatraAI — Discover Bharatpur

YatraAI is a lightweight, mobile-first tourism experience for Bharatpur, Nepal. It includes the existing map plus an AI route discovery prototype that finds quieter tourism places around a traveller's origin and destination.

## Workspace layout

- `web`: Next.js App Router PWA shell with Tailwind CSS and Leaflet dependencies installed.
- `server`: Express API with a LangGraph route workflow, Tavily web search integration and an optional OpenAI synthesis step.

## Getting started

```bash
npm install
cp server/.env.example server/.env
cp web/.env.example web/.env.local
npm run dev
```

- Web app: http://localhost:3000
- API health check: http://localhost:4000/health

## AI route discovery

Open http://localhost:3000/discover or use the `AI route finder` button on the home page. Enter an origin and destination, choose a travel mood, and the route engine will return only named places found in the live route corridor.

- Geocoding uses Nominatim, road distance/time uses OSRM, and candidate attractions come from OpenStreetMap via Overpass.
- Every recommendation is filtered by its distance from the actual route and its measured extra road distance through the stop. No place is returned when a road distance cannot be measured.
- `TAVILY_API_KEY` is optional enrichment for source links and current visitor context; it cannot create coordinates or distances.
- `OPENAI_API_KEY` is optional and only rewrites the route narrative through LangGraph; verified place names and measured numbers remain unchanged.
- The response includes the resolved geocoded origin/destination, route distance, estimated drive time, stop coordinates, and OSM source links for map integration.
