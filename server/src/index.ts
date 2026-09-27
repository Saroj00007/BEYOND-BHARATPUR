import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const userAgent = process.env.HTTP_USER_AGENT ?? "YatraAI/0.2 (Bharatpur tourism prototype)";

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("Origin is not allowed by WEB_ORIGIN"));
  },
}));
app.use(express.json({ limit: "32kb" }));

const routeRequestSchema = z.object({
  origin: z.string().trim().min(2).max(120),
  destination: z.string().trim().min(2).max(120),
  interests: z.array(z.string().trim().min(1).max(40)).max(6).default([]),
  travelStyle: z.enum(["slow", "balanced", "adventurous"]).default("balanced"),
  detour: z.enum(["short", "moderate", "flexible"]).default("moderate"),
});

type RouteRequest = z.infer<typeof routeRequestSchema>;
type Coordinate = { latitude: number; longitude: number };
type GeoJsonLine = { type: "LineString"; coordinates: Array<[number, number]> };

type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
};

type GeocodedPlace = Coordinate & {
  label: string;
  displayName: string;
  osmType?: string;
  osmId?: number;
  resolution: "live" | "dataset-area";
};

type LocalDestination = {
  main_place_block: string;
  approx_distance_from_bharatpur_reference_point: string;
  direction: string;
  secondary_places_attractions: string;
};

type LocalAlias = {
  alias: string;
  coordinate: Coordinate;
  parent: string;
};

type RoadRoute = {
  distanceKm: number;
  durationMinutes: number;
  geometry: GeoJsonLine;
  provider: "OSRM";
};

type OSMElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type PlaceCandidate = Coordinate & {
  id: string;
  name: string;
  category: string;
  sourceUrl: string;
  tags: Record<string, string>;
  distanceFromRouteKm: number;
  distanceAlongRouteKm: number;
};

type MeasuredPlace = PlaceCandidate & {
  distanceFromOriginKm: number;
  distanceToDestinationKm: number;
  detourKm: number;
  driveMinutesVia: number;
};

const narrativeSchema = z.object({
  overview: z.string().min(1),
  routeCharacter: z.string().min(1),
  tips: z.array(z.string().min(1)).max(6),
});

type Narrative = z.infer<typeof narrativeSchema>;

type DiscoveryRecommendation = MeasuredPlace & {
  type: string;
  whyItFits: string;
  practicalTip: string;
  detour: string;
  sourceUrl?: string;
  sourceLabel?: string;
};

type DiscoveryPlan = Narrative & {
  recommendations: DiscoveryRecommendation[];
};

type RouteDiscoveryResponse = DiscoveryPlan & {
  origin: string;
  destination: string;
  resolvedOrigin: string;
  resolvedDestination: string;
  route: RoadRoute;
  searchMode: "live-route+tavily+openai" | "live-route+tavily" | "live-route";
  generatedAt: string;
  sources: Array<{ title: string; url: string }>;
  locationResolution: {
    origin: GeocodedPlace["resolution"];
    destination: GeocodedPlace["resolution"];
  };
  notice?: string;
};

class RouteDataError extends Error {
  constructor(message: string, public readonly statusCode = 503) {
    super(message);
    this.name = "RouteDataError";
  }
}

type RequestJsonOptions = {
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

function requestJson<T>(urlString: string, options: RequestJsonOptions = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const request = https.request({
      hostname: url.hostname,
      port: url.port ? Number(url.port) : 443,
      path: `${url.pathname}${url.search}`,
      method: options.method ?? "GET",
      family: 4,
      headers: {
        accept: "application/json",
        "user-agent": userAgent,
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
      timeout: options.timeoutMs ?? 18000,
    }, (response) => {
      let payload = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { payload += chunk; });
      response.on("end", () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`External request failed with status ${response.statusCode ?? "unknown"}`));
          return;
        }
        try {
          resolve(JSON.parse(payload) as T);
        } catch {
          reject(new Error("External request returned invalid JSON"));
        }
      });
    });

    request.on("timeout", () => request.destroy(new Error("External request timed out")));
    request.on("error", reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatKm(value: number): string {
  return `${value < 10 ? value.toFixed(1) : value.toFixed(0)} km`;
}

function formatMinutes(value: number): string {
  return `${Math.max(1, Math.round(value))} min`;
}

function buildTavilyQuery(request: RouteRequest, places: MeasuredPlace[]): string {
  const names = places.map((place) => `"${place.name}"`).join(", ");
  return [
    `verify these named tourism places near the driving route from ${request.origin} to ${request.destination} in Bharatpur, Chitwan, Nepal: ${names}`,
    `interests: ${request.interests.join(", ") || "nature, culture, wildlife and local food"}`,
    "Return useful current visitor information only for the named places; do not add other places or distances.",
  ].join(". ");
}

async function searchWithTavily(request: RouteRequest, places: MeasuredPlace[]): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || !places.length) return [];

  try {
    const response = await requestJson<{ results?: TavilyResult[] }>("https://api.tavily.com/search", {
      method: "POST",
      body: JSON.stringify({
        api_key: apiKey,
        query: buildTavilyQuery(request, places),
        search_depth: "advanced",
        topic: "general",
        max_results: 8,
        include_answer: false,
        include_raw_content: false,
      }),
    });

    return (response.results ?? [])
      .filter((result) => result.title && result.url && result.content)
      .slice(0, 8);
  } catch (error) {
    console.warn("Tavily enrichment was unavailable; keeping map-verified results.", error);
    return [];
  }
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, " ").trim();
}

const bharatpurReferencePoint: Coordinate = { latitude: 27.6833, longitude: 84.4333 };

function parseApproxDistanceKm(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(?:[–—-]\s*(\d+(?:\.\d+)?))?\s*km/i);
  if (!match) return null;
  const first = Number(match[1]);
  const second = match[2] ? Number(match[2]) : first;
  return Number.isFinite(first) && Number.isFinite(second) ? (first + second) / 2 : null;
}

function bearingFromDirection(value: string): number | null {
  const text = normalizeText(value);
  const north = text.includes("north") || text.includes("उत्तर");
  const south = text.includes("south") || text.includes("दक्षिण");
  const east = text.includes("east") || text.includes("पूर्व");
  const west = text.includes("west") || text.includes("पश्चिम");
  if (north && east) return 45;
  if (north && west) return 315;
  if (south && east) return 135;
  if (south && west) return 225;
  if (north) return 0;
  if (east) return 90;
  if (south) return 180;
  if (west) return 270;
  return null;
}

function offsetFromReferencePoint(distanceKm: number, bearingDegrees: number): Coordinate {
  const bearing = (bearingDegrees * Math.PI) / 180;
  const latitudeRadians = (bharatpurReferencePoint.latitude * Math.PI) / 180;
  return {
    latitude: bharatpurReferencePoint.latitude + (distanceKm * Math.cos(bearing)) / 110.54,
    longitude: bharatpurReferencePoint.longitude + (distanceKm * Math.sin(bearing)) / (110.54 * Math.cos(latitudeRadians)),
  };
}

function aliasesFromText(value: string): string[] {
  const withoutParenthetical = value.replace(/\(([^)]+)\)/g, ";$1;");
  return withoutParenthetical
    .split(/[;/；]/)
    .map((part) => part.replace(/\bblock\b/gi, "").trim())
    .filter((part) => part.length >= 3);
}

function loadLocalAliases(): LocalAlias[] {
  const datasetPaths = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/src/data/Bharatpur_AI_Discover_Dataset.json"),
    path.resolve(process.cwd(), "web/src/data/Bharatpur_AI_Discover_Dataset.json"),
  ];
  let parsed: { destinations?: LocalDestination[] } | null = null;
  for (const datasetPath of datasetPaths) {
    if (!existsSync(datasetPath)) continue;
    try {
      parsed = JSON.parse(readFileSync(datasetPath, "utf8")) as { destinations?: LocalDestination[] };
      break;
    } catch (error) {
      console.warn(`Could not read local tourism dataset: ${datasetPath}`, error);
    }
  }

  return (parsed?.destinations ?? []).flatMap((destination) => {
    const distanceKm = parseApproxDistanceKm(destination.approx_distance_from_bharatpur_reference_point);
    const bearing = bearingFromDirection(destination.direction);
    if (distanceKm === null || bearing === null) return [];
    const coordinate = offsetFromReferencePoint(distanceKm, bearing);
    const mainAliases = aliasesFromText(destination.main_place_block);
    const secondaryAliases = destination.secondary_places_attractions
      .split(/[;；]/)
      .map((value) => value.trim())
      .filter((value) => value.length >= 3);
    const aliases = [...new Set([...mainAliases, ...secondaryAliases])];
    const parent = mainAliases[0] ?? destination.main_place_block;
    return aliases.map((alias) => ({ alias, coordinate, parent }));
  });
}

const localAliases = loadLocalAliases();

function findLocalAlias(query: string): LocalAlias | undefined {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length < 4) return undefined;
  return localAliases
    .filter((entry) => {
      const alias = normalizeText(entry.alias);
      return alias.length >= 4 && (alias === normalizedQuery || alias.includes(normalizedQuery) || normalizedQuery.includes(alias));
    })
    .sort((a, b) => normalizeText(a.alias).length - normalizeText(b.alias).length)[0];
}

function findSourceForPlace(place: MeasuredPlace, results: TavilyResult[]): TavilyResult | undefined {
  const name = normalizeText(place.name);
  if (!name) return undefined;
  return results.find((result) => normalizeText(`${result.title} ${result.content}`).includes(name));
}

async function geocodeWithPhoton(query: string): Promise<GeocodedPlace | null> {
  const url = new URL(process.env.PHOTON_URL ?? "https://photon.komoot.io/api/");
  url.searchParams.set("q", `${query}, Nepal`);
  url.searchParams.set("limit", "8");

  type PhotonFeature = {
    geometry?: { coordinates?: [number, number] };
    properties?: Record<string, string | number | undefined>;
  };

  const response = await requestJson<{ features?: PhotonFeature[] }>(url.toString());
  const queryText = normalizeText(query);
  const candidates = (response.features ?? []).filter((feature) => {
    const properties = feature.properties ?? {};
    const text = normalizeText(Object.values(properties).filter((value) => value !== undefined).join(" "));
    const country = String(properties.countrycode ?? "").toLowerCase();
    return country === "np" && /bharatpur|chitwan|meghauli|patihani|kasara|devghat/.test(text)
      && (text.includes(queryText) || /airport|meghauli|bharatpur/.test(queryText));
  });
  const selected = candidates.find((feature) => feature.geometry?.coordinates?.length === 2);
  if (!selected?.geometry?.coordinates) return null;

  const properties = selected.properties ?? {};
  const name = String(properties.name ?? query);
  const displayKeys = ["name", "locality", "district", "city", "county", "state", "country", "postcode"];
  const area = displayKeys
    .map((key) => properties[key])
    .filter((value) => value !== undefined && String(value).length > 0)
    .map(String)
    .join(", ");
  return {
    latitude: selected.geometry.coordinates[1],
    longitude: selected.geometry.coordinates[0],
    label: name,
    displayName: area || name,
    osmType: String(properties.osm_type ?? "") || undefined,
    osmId: typeof properties.osm_id === "number" ? properties.osm_id : undefined,
    resolution: "live",
  };
}

async function geocodePlace(query: string): Promise<GeocodedPlace> {
  const endpoint = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org/search";
  const url = new URL(endpoint);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "8");
  url.searchParams.set("countrycodes", "np");
  url.searchParams.set("addressdetails", "1");

  try {
    type NominatimResult = {
      lat: string;
      lon: string;
      display_name: string;
      name?: string;
      importance?: number;
      osm_type?: string;
      osm_id?: number;
      address?: Record<string, string>;
    };
    const localAlias = findLocalAlias(query);
    const spellingVariants = [
      query,
      query.replace(/chaubiskoti/gi, "chaubiskothi"),
      query.replace(/chowk/gi, "chok"),
      `${query} Bharatpur Chitwan`,
      `${query} Chitwan`,
    ].map((value) => /\bnepal\b/i.test(value) ? value : `${value}, Nepal`);
    let results: NominatimResult[] = [];
    try {
      for (const spellingVariant of [...new Set(spellingVariants)]) {
        url.searchParams.set("q", spellingVariant);
        results = await requestJson<NominatimResult[]>(url.toString());
        if (results.length) break;
      }
    } catch (error) {
      console.warn("Nominatim geocoding was unavailable; trying Photon.", error);
    }

    const queryText = normalizeText(query);
    const bharatpurResults = results.filter((result) => {
      const text = normalizeText(`${result.name ?? ""} ${result.display_name} ${Object.values(result.address ?? {}).join(" ")}`);
      return /bharatpur|chitwan|meghauli|patihani|kasara/.test(text);
    });
    const crossBoundaryResults = /devghat/i.test(query)
      ? results.filter((result) => normalizeText(`${result.name ?? ""} ${result.display_name}`).includes("devghat"))
      : [];
    const usableResults = bharatpurResults.length ? bharatpurResults : crossBoundaryResults;
    const selected = usableResults
      .filter((result) => Number.isFinite(Number(result.lat)) && Number.isFinite(Number(result.lon)))
      .sort((a, b) => {
        const aText = normalizeText(`${a.name ?? ""} ${a.display_name}`);
        const bText = normalizeText(`${b.name ?? ""} ${b.display_name}`);
        const score = (text: string, item: typeof a) => (
          (text.includes(queryText) ? 6 : 0)
          + (text.includes("bharatpur") ? 4 : 0)
          + (text.includes("chitwan") ? 3 : 0)
          + (item.address?.country_code === "np" ? 2 : 0)
          + (item.importance ?? 0)
        );
        return score(bText, b) - score(aText, a);
      })[0];

    if (selected) {
      return {
        latitude: Number(selected.lat),
        longitude: Number(selected.lon),
        label: selected.name?.trim() || query,
        displayName: selected.display_name,
        osmType: selected.osm_type,
        osmId: selected.osm_id,
        resolution: "live",
      };
    }

    try {
      const photonResult = await geocodeWithPhoton(query);
      if (photonResult) return photonResult;
    } catch (error) {
      console.warn("Photon geocoding was unavailable.", error);
    }

    if (localAlias) {
      return {
        ...localAlias.coordinate,
        label: localAlias.alias,
        displayName: `${localAlias.alias} · ${localAlias.parent} (Bharatpur tourism dataset area)`,
        resolution: "dataset-area",
      };
    }

    throw new RouteDataError(`Could not find a precise Nepal location for “${query}”.`, 422);
  } catch (error) {
    if (error instanceof RouteDataError) throw error;
    throw new RouteDataError(`Location lookup failed for “${query}”. Please use a more specific place name.`, 422);
  }
}

async function routeWithOsrm(origin: Coordinate, destination: Coordinate): Promise<RoadRoute> {
  const endpoints = [process.env.ROUTING_URL ?? "https://router.project-osrm.org", "https://routing.openstreetmap.de/routed-car"];
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;

  for (const endpoint of [...new Set(endpoints)]) {
    const url = `${endpoint.replace(/\/$/, "")}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false&alternatives=false`;
    try {
      const result = await requestJson<{
        code?: string;
        routes?: Array<{ distance: number; duration: number; geometry?: GeoJsonLine }>;
      }>(url);
      const route = result.routes?.[0];
      if (result.code !== "Ok" || !route?.geometry?.coordinates?.length) continue;
      return {
        distanceKm: round(route.distance / 1000),
        durationMinutes: round(route.duration / 60),
        geometry: route.geometry,
        provider: "OSRM",
      };
    } catch (error) {
      console.warn(`Road routing endpoint unavailable: ${endpoint}`, error);
    }
  }

  throw new RouteDataError("Live road routing is unavailable right now, so no route-based places were shown.");
}

function corridorLimits(detour: RouteRequest["detour"]): { radiusKm: number; maxDetourKm: number; maxStops: number } {
  if (detour === "short") return { radiusKm: 2.5, maxDetourKm: 3, maxStops: 4 };
  if (detour === "flexible") return { radiusKm: 8, maxDetourKm: 15, maxStops: 6 };
  return { radiusKm: 5, maxDetourKm: 8, maxStops: 5 };
}

function distanceBetween(a: Coordinate, b: Coordinate): number {
  const earthRadius = 6371000;
  const latitudeDelta = ((b.latitude - a.latitude) * Math.PI) / 180;
  const longitudeDelta = ((b.longitude - a.longitude) * Math.PI) / 180;
  const latitudeA = (a.latitude * Math.PI) / 180;
  const latitudeB = (b.latitude * Math.PI) / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.sin(longitudeDelta / 2) ** 2 * Math.cos(latitudeA) * Math.cos(latitudeB);
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function pointToSegment(point: Coordinate, start: Coordinate, end: Coordinate): { distanceMetres: number; fraction: number } {
  const latitudeScale = Math.cos((point.latitude * Math.PI) / 180) * 111320;
  const toXY = (value: Coordinate) => ({
    x: (value.longitude - start.longitude) * latitudeScale,
    y: (value.latitude - start.latitude) * 110540,
  });
  const p = toXY(point);
  const a = { x: 0, y: 0 };
  const b = toXY(end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (p.x * dx + p.y * dy) / lengthSquared));
  const projected = { x: dx * fraction, y: dy * fraction };
  return { distanceMetres: Math.hypot(p.x - projected.x, p.y - projected.y), fraction };
}

function projectOntoRoute(point: Coordinate, geometry: GeoJsonLine): { distanceMetres: number; alongMetres: number } {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestAlong = 0;
  let along = 0;
  for (let index = 0; index < geometry.coordinates.length - 1; index += 1) {
    const start: Coordinate = { latitude: geometry.coordinates[index][1], longitude: geometry.coordinates[index][0] };
    const end: Coordinate = { latitude: geometry.coordinates[index + 1][1], longitude: geometry.coordinates[index + 1][0] };
    const segmentLength = distanceBetween(start, end);
    const projection = pointToSegment(point, start, end);
    if (projection.distanceMetres < bestDistance) {
      bestDistance = projection.distanceMetres;
      bestAlong = along + segmentLength * projection.fraction;
    }
    along += segmentLength;
  }
  return { distanceMetres: bestDistance, alongMetres: bestAlong };
}

function routeBoundingBox(geometry: GeoJsonLine, radiusKm: number): { south: number; west: number; north: number; east: number } {
  const latitudes = geometry.coordinates.map((coordinate) => coordinate[1]);
  const longitudes = geometry.coordinates.map((coordinate) => coordinate[0]);
  const latitudePadding = radiusKm / 110.54;
  const longitudePadding = radiusKm / (110.54 * Math.max(0.5, Math.cos((Math.min(...latitudes) * Math.PI) / 180)));
  return {
    south: Math.min(...latitudes) - latitudePadding,
    west: Math.min(...longitudes) - longitudePadding,
    north: Math.max(...latitudes) + latitudePadding,
    east: Math.max(...longitudes) + longitudePadding,
  };
}

function bboxText(bbox: ReturnType<typeof routeBoundingBox>): string {
  return [bbox.south, bbox.west, bbox.north, bbox.east].map((value) => value.toFixed(5)).join(",");
}

function elementCoordinate(element: OSMElement): Coordinate | null {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (latitude === undefined || longitude === undefined) return null;
  return { latitude, longitude };
}

function placeCategory(tags: Record<string, string>): string | null {
  const tourism = tags.tourism?.toLowerCase();
  const leisure = tags.leisure?.toLowerCase();
  const natural = tags.natural?.toLowerCase();
  if (tourism === "attraction") return "Attraction";
  if (tourism === "viewpoint") return "Viewpoint";
  if (tourism === "picnic_site") return "Picnic site";
  if (tourism === "museum") return "Museum";
  if (tourism === "gallery") return "Gallery";
  if (tourism === "zoo") return "Wildlife";
  if (leisure === "park") return "Park";
  if (leisure === "nature_reserve") return "Nature reserve";
  if (natural === "water" || natural === "wetland") return "Wetland / water";
  if (tags.historic) return tags.historic.replace(/_/g, " ");
  return null;
}

function isUsablePlace(element: OSMElement): boolean {
  const tags = element.tags ?? {};
  const name = tags["name:en"] || tags.name || tags["name:ne"];
  if (!name || name.trim().length < 2) return false;
  const category = placeCategory(tags);
  if (!category) return false;
  const lowerName = name.toLowerCase();
  if (/(swimming\s+pool|fish\s+pond|school|clinic|office|market|shop|restaurant|chowk|\bground\b|(^|\s)(home|house|hostel|hotel|lodge|resort|room|girls?|camp)(\s|$))/i.test(lowerName)) return false;
  if (/^(pond|pokhari|lake|water body|open space)$/i.test(lowerName.trim())) return false;
  return true;
}

function candidateFromElement(element: OSMElement, route: RoadRoute, radiusKm: number): PlaceCandidate | null {
  if (!isUsablePlace(element)) return null;
  const coordinate = elementCoordinate(element);
  const tags = element.tags ?? {};
  const name = tags["name:en"] || tags.name || tags["name:ne"];
  const category = placeCategory(tags);
  if (!coordinate || !name || !category) return null;
  const projection = projectOntoRoute(coordinate, route.geometry);
  const distanceFromRouteKm = projection.distanceMetres / 1000;
  if (distanceFromRouteKm > radiusKm) return null;
  return {
    ...coordinate,
    id: `${element.type}-${element.id}`,
    name: name.trim(),
    category,
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    tags,
    distanceFromRouteKm: round(distanceFromRouteKm),
    distanceAlongRouteKm: round(projection.alongMetres / 1000),
  };
}

async function findPlacesNearRoute(route: RoadRoute, detour: RouteRequest["detour"]): Promise<PlaceCandidate[]> {
  const limits = corridorLimits(detour);
  const bbox = routeBoundingBox(route.geometry, limits.radiusKm);
  const query = `[out:json][timeout:25];(${[
    `nwr["tourism"](${bboxText(bbox)});`,
    `nwr["historic"]["name"](${bboxText(bbox)});`,
    `nwr["leisure"~"park|nature_reserve"]["name"](${bboxText(bbox)});`,
    `nwr["natural"~"water|wetland"]["name"](${bboxText(bbox)});`,
  ].join("")});out center tags;`;
  const endpoint = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
  const url = new URL(endpoint);
  url.searchParams.set("data", query);

  try {
    const result = await requestJson<{ elements?: OSMElement[] }>(url.toString());
    const seenNames = new Set<string>();
    const candidates = (result.elements ?? [])
      .map((element) => candidateFromElement(element, route, limits.radiusKm))
      .filter((candidate): candidate is PlaceCandidate => candidate !== null)
      .sort((a, b) => a.distanceAlongRouteKm - b.distanceAlongRouteKm || a.distanceFromRouteKm - b.distanceFromRouteKm)
      .filter((candidate) => {
        const key = normalizeText(candidate.name);
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      });
    return candidates;
  } catch (error) {
    console.warn("OpenStreetMap place lookup failed; continuing with route metrics and verified frontend directory data.", error);
    return [];
  }
}

type OsrmTable = {
  code?: string;
  distances?: Array<Array<number | null>>;
  durations?: Array<Array<number | null>>;
};

async function measurePlaces(
  origin: Coordinate,
  destination: Coordinate,
  route: RoadRoute,
  places: PlaceCandidate[],
  detour: RouteRequest["detour"],
): Promise<MeasuredPlace[]> {
  const limits = corridorLimits(detour);
  if (!places.length) return [];
  const allCoordinates = [origin, ...places, destination];
  const coordinateText = allCoordinates.map((coordinate) => `${coordinate.longitude},${coordinate.latitude}`).join(";");
  const endpoints = [process.env.ROUTING_URL ?? "https://router.project-osrm.org", "https://routing.openstreetmap.de/routed-car"];
  let table: OsrmTable | null = null;

  for (const endpoint of [...new Set(endpoints)]) {
    try {
      const url = `${endpoint.replace(/\/$/, "")}/table/v1/driving/${coordinateText}?annotations=distance,duration`;
      const result = await requestJson<OsrmTable>(url);
      if (result.code === "Ok" && result.distances && result.durations) {
        table = result;
        break;
      }
    } catch (error) {
      console.warn(`Road distance table unavailable: ${endpoint}`, error);
    }
  }

  if (!table?.distances || !table.durations) {
    throw new RouteDataError("Live road distances are unavailable right now, so no places were shown.");
  }

  const destinationIndex = allCoordinates.length - 1;
  return places
    .map((place, index) => {
      const placeIndex = index + 1;
      const fromMetres = table.distances![0]?.[placeIndex];
      const toMetres = table.distances![placeIndex]?.[destinationIndex];
      const fromSeconds = table.durations![0]?.[placeIndex];
      const toSeconds = table.durations![placeIndex]?.[destinationIndex];
      if (fromMetres === null || fromMetres === undefined || toMetres === null || toMetres === undefined || fromSeconds === null || fromSeconds === undefined || toSeconds === null || toSeconds === undefined) return null;
      const viaMetres = fromMetres + toMetres;
      const detourKm = Math.max(0, (viaMetres - route.distanceKm * 1000) / 1000);
      if (detourKm > limits.maxDetourKm) return null;
      return {
        ...place,
        distanceFromOriginKm: round(fromMetres / 1000),
        distanceToDestinationKm: round(toMetres / 1000),
        detourKm: round(detourKm),
        driveMinutesVia: round((fromSeconds + toSeconds) / 60),
      };
    })
    .filter((place): place is MeasuredPlace => place !== null)
    .sort((a, b) => a.distanceAlongRouteKm - b.distanceAlongRouteKm)
    .filter((place, index, measured) => {
      const previous = measured[index - 1];
      return !previous || place.distanceAlongRouteKm - previous.distanceAlongRouteKm >= 0.7 || place.category !== previous.category;
    })
    .slice(0, limits.maxStops);
}

function interestScore(place: MeasuredPlace, interests: string[]): number {
  const text = normalizeText(`${place.name} ${place.category} ${place.tags.description ?? ""}`);
  return interests.reduce((score, interest) => score + (text.includes(normalizeText(interest)) ? 3 : 0), 0);
}

function deterministicNarrative(request: RouteRequest, route: RoadRoute, places: MeasuredPlace[]): Narrative {
  const limits = corridorLimits(request.detour);
  return {
    overview: places.length
      ? `The live road route is ${formatKm(route.distanceKm)} and about ${formatMinutes(route.durationMinutes)}. These ${places.length} named places are mapped within ${limits.radiusKm} km of that route and each adds no more than ${limits.maxDetourKm} km of driving.`
      : `The live road route is ${formatKm(route.distanceKm)} and about ${formatMinutes(route.durationMinutes)}. No named tourism places with a measured road detour fit the selected ${request.detour} detour, so no speculative stops are shown.`,
    routeCharacter: `${formatKm(route.distanceKm)} by road · ${formatMinutes(route.durationMinutes)} without stops · ${route.provider} routing`,
    tips: [
      "Distances are driving distances from the live road router, not straight-line estimates.",
      "Place names and coordinates come from OpenStreetMap; check access and opening hours before visiting.",
      ...(places.length ? ["Stops are listed in order from the origin and are filtered by their measured extra driving distance."] : ["Try a larger detour setting only if you are happy to travel farther from the direct route."]),
    ],
  };
}

async function aiNarrative(request: RouteRequest, route: RoadRoute, places: MeasuredPlace[], fallback: Narrative): Promise<Narrative> {
  if (!process.env.OPENAI_API_KEY) return fallback;
  try {
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0,
    }).withStructuredOutput(narrativeSchema);
    return await model.invoke(`
Write a concise route brief for Bharatpur, Nepal.
Use only the verified facts below. Do not create, remove or rename places. Do not change any distance, duration or detour number.
The place list is already filtered by live road routing; your output only rewrites the overview, routeCharacter and tips.

Origin: ${request.origin}
Destination: ${request.destination}
Driving route: ${route.distanceKm} km, ${route.durationMinutes} minutes
Measured places: ${JSON.stringify(places.map((place) => ({ name: place.name, category: place.category, distanceFromOriginKm: place.distanceFromOriginKm, detourKm: place.detourKm })))}
    `);
  } catch (error) {
    console.warn("AI narrative was unavailable; keeping measured route facts.", error);
    return fallback;
  }
}

function buildRecommendations(request: RouteRequest, places: MeasuredPlace[], webResults: TavilyResult[]): DiscoveryRecommendation[] {
  return [...places]
    .sort((a, b) => interestScore(b, request.interests) - interestScore(a, request.interests) || a.distanceAlongRouteKm - b.distanceAlongRouteKm)
    .map((place) => {
      const source = findSourceForPlace(place, webResults);
      const sourceUrl = source?.url ?? place.sourceUrl;
      return {
        ...place,
        type: place.category,
        whyItFits: `${place.category} mapped as “${place.name}”, ${formatKm(place.distanceFromRouteKm)} from the route corridor. It is listed because its location and road detour were measured for this route.`,
        practicalTip: `${formatKm(place.distanceFromOriginKm)} from the origin, ${formatKm(place.distanceToDestinationKm)} to the destination, and ${place.detourKm === 0 ? "no measurable" : `about ${formatKm(place.detourKm)}`} extra driving via this stop. Confirm local access before setting out.`,
        detour: place.detourKm === 0 ? "On the measured route" : `+${formatKm(place.detourKm)} detour`,
        sourceUrl,
        sourceLabel: source ? "Read live source" : "OpenStreetMap record",
      };
    });
}

function sourcePack(route: RoadRoute, places: DiscoveryRecommendation[], webResults: TavilyResult[]): Array<{ title: string; url: string }> {
  const sources = [
    { title: "OpenStreetMap place data", url: "https://www.openstreetmap.org/" },
    { title: "OSRM road routing", url: "https://project-osrm.org/" },
    ...places.map((place) => ({ title: `${place.name} · OpenStreetMap`, url: place.sourceUrl })),
    ...webResults.map((result) => ({ title: result.title, url: result.url })),
  ];
  return [...new Map(sources.map((source) => [source.url, source])).values()].slice(0, 12);
}

type RouteGraphState = {
  request: RouteRequest;
  origin: GeocodedPlace | null;
  destination: GeocodedPlace | null;
  route: RoadRoute | null;
  places: MeasuredPlace[];
  webResults: TavilyResult[];
  plan: DiscoveryPlan | null;
};

const RouteState = Annotation.Root({
  request: Annotation<RouteRequest>,
  origin: Annotation<GeocodedPlace | null>({ reducer: (_previous, next) => next, default: () => null }),
  destination: Annotation<GeocodedPlace | null>({ reducer: (_previous, next) => next, default: () => null }),
  route: Annotation<RoadRoute | null>({ reducer: (_previous, next) => next, default: () => null }),
  places: Annotation<MeasuredPlace[]>({ reducer: (_previous, next) => next, default: () => [] }),
  webResults: Annotation<TavilyResult[]>({ reducer: (_previous, next) => next, default: () => [] }),
  plan: Annotation<DiscoveryPlan | null>({ reducer: (_previous, next) => next, default: () => null }),
});

const routeGraph = new StateGraph(RouteState)
  .addNode("resolve_route", async (state: RouteGraphState) => {
    const [origin, destination] = await Promise.all([
      geocodePlace(state.request.origin),
      geocodePlace(state.request.destination),
    ]);
    const route = await routeWithOsrm(origin, destination);
    return { origin, destination, route };
  })
  .addNode("discover_places", async (state: RouteGraphState) => {
    if (!state.route || !state.origin || !state.destination) throw new RouteDataError("Route coordinates were not resolved.");
    const candidates = await findPlacesNearRoute(state.route, state.request.detour);
    const places = await measurePlaces(state.origin, state.destination, state.route, candidates, state.request.detour);
    return { places };
  })
  .addNode("enrich_plan", async (state: RouteGraphState) => {
    if (!state.route) throw new RouteDataError("Route metrics were not resolved.");
    const webResults = await searchWithTavily(state.request, state.places);
    const fallback = deterministicNarrative(state.request, state.route, state.places);
    const narrative = await aiNarrative(state.request, state.route, state.places, fallback);
    return {
      webResults,
      plan: {
        ...narrative,
        recommendations: buildRecommendations(state.request, state.places, webResults),
      },
    };
  })
  .addEdge(START, "resolve_route")
  .addEdge("resolve_route", "discover_places")
  .addEdge("discover_places", "enrich_plan")
  .addEdge("enrich_plan", END)
  .compile();

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "yatraai-server" });
});

app.post("/api/discover-route", async (request, response) => {
  const parsed = routeRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Please provide an origin, destination and valid route preferences." });
    return;
  }

  try {
    const graphResult = await routeGraph.invoke({ request: parsed.data });
    if (!graphResult.route || !graphResult.origin || !graphResult.destination) throw new RouteDataError("The route could not be resolved.");
    const plan = graphResult.plan ?? {
      ...deterministicNarrative(parsed.data, graphResult.route, graphResult.places),
      recommendations: buildRecommendations(parsed.data, graphResult.places, graphResult.webResults),
    };
    const searchMode = process.env.TAVILY_API_KEY
      ? process.env.OPENAI_API_KEY ? "live-route+tavily+openai" : "live-route+tavily"
      : "live-route";

    const usedAreaResolution = graphResult.origin.resolution === "dataset-area"
      || graphResult.destination.resolution === "dataset-area";
    const notice = usedAreaResolution
      ? "One endpoint matched the Bharatpur tourism dataset at area level because no exact map point was available. Route distances involving that endpoint are estimates; named stop distances remain measured by the live road router."
      : plan.recommendations.length === 0
        ? "No named tourism places matched this route and detour setting, so no speculative recommendations were added."
        : process.env.OPENAI_API_KEY
          ? undefined
          : "Place coordinates and distances are live map/routing data. Add OPENAI_API_KEY only if you want an AI-written route brief.";

    const payload: RouteDiscoveryResponse = {
      ...plan,
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      resolvedOrigin: graphResult.origin.displayName,
      resolvedDestination: graphResult.destination.displayName,
      route: graphResult.route,
      searchMode,
      generatedAt: new Date().toISOString(),
      sources: sourcePack(graphResult.route, plan.recommendations, graphResult.webResults),
      locationResolution: {
        origin: graphResult.origin.resolution,
        destination: graphResult.destination.resolution,
      },
      ...(notice ? { notice } : {}),
    };
    response.json(payload);
  } catch (error) {
    const statusCode = error instanceof RouteDataError ? error.statusCode : 500;
    const message = error instanceof RouteDataError ? error.message : "The route could not be evaluated right now.";
    console.error("Route discovery failed", error);
    response.status(statusCode).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`YatraAI API listening on http://localhost:${port}`);
});
