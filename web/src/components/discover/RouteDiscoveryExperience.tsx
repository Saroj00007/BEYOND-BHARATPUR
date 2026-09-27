"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  ExternalLink,
  Globe2,
  Leaf,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  Search,
  Sparkles,
  TriangleAlert,
  Clock3,
} from "lucide-react";
import { bharatpurMeghauliServices, type BharatpurMeghauliService } from "@/data/bharatpurMeghauliServices";
import { mainTourismPlaces, type MainTourismPlace } from "@/data/bharatpurMeghauliTourism";

type TravelStyle = "slow" | "balanced" | "adventurous";
type Detour = "short" | "moderate" | "flexible";

type FormState = {
  origin: string;
  destination: string;
  interests: string[];
  travelStyle: TravelStyle;
  detour: Detour;
};

type Recommendation = {
  id: string;
  latitude: number;
  longitude: number;
  category: string;
  name: string;
  type: string;
  whyItFits: string;
  practicalTip: string;
  detour: string;
  distanceFromRouteKm: number;
  distanceAlongRouteKm: number;
  distanceFromOriginKm: number;
  distanceToDestinationKm: number;
  detourKm: number;
  driveMinutesVia: number;
  sourceUrl?: string;
  sourceLabel?: string;
};

type DiscoveryResult = {
  origin: string;
  destination: string;
  resolvedOrigin: string;
  resolvedDestination: string;
  route: {
    distanceKm: number;
    durationMinutes: number;
    provider: string;
    geometry?: {
      type: "LineString";
      coordinates: Array<[number, number]>;
    };
  };
  overview: string;
  routeCharacter: string;
  recommendations: Recommendation[];
  tips: string[];
  sources: Array<{ title: string; url: string }>;
  searchMode: "live-route+tavily+openai" | "live-route+tavily" | "live-route";
  notice?: string;
};

const interestOptions = ["Nature", "Wildlife", "Birdwatching", "Culture", "Local food", "Photography"];

const initialForm: FormState = {
  origin: "Bharatpur Airport",
  destination: "Meghauli",
  interests: ["Nature", "Wildlife"],
  travelStyle: "balanced",
  detour: "moderate",
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function modeLabel(mode: DiscoveryResult["searchMode"]): string {
  if (mode === "live-route+tavily+openai") return "Live route + web + AI brief";
  if (mode === "live-route+tavily") return "Live route + Tavily sources";
  return "Live route + map data";
}

function isAirportToMeghauliDemo(result: DiscoveryResult): boolean {
  const origin = result.origin.toLocaleLowerCase();
  const destination = result.destination.toLocaleLowerCase();
  return /(airport|chaubiskothi|chaubiskoti)/.test(origin) && destination.includes("meghauli");
}

export default function RouteDiscoveryExperience() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleInterest(interest: string) {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }));
  }

  async function evaluateRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setResult(null);
    setErrorMessage("");

    try {
      const response = await fetch(`${apiUrl}/api/discover-route`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json() as DiscoveryResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The route could not be evaluated.");
      setResult(payload);
      setStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not reach the YatraAI server.");
      setStatus("error");
    }
  }

  return (
    <main className="discover-page">
      <header className="discover-header">
        <div className="discover-header-inner">
          <Link className="explore-brand" href="/" aria-label="Back to YatraAI home">
            <span className="brand-mark"><Compass size={17} /></span>
            <span>Yatra<span className="brand-ai">AI</span></span>
          </Link>
          <div className="discover-header-title"><Sparkles size={14} /> Route-aware discovery</div>
          <Link className="map-action-link" href="/explore" aria-label="Open the tourism map">
            <MapPin size={15} /><span>Open map</span><ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <div className="discover-shell">
        <section className="discover-intro">
          <Link className="back-link" href="/"><ArrowLeft size={14} /> Home</Link>
          <p className="section-kicker"><span className="eyebrow-dot" /> DISCOVER BHARATPUR WITH A LITTLE MORE CURIOSITY</p>
          <h1>Find the good stops <span>between here and there.</span></h1>
          <p>Tell the route engine where you are starting and ending. It will look beyond the headline attractions and surface lower-key places worth a detour.</p>
        </section>

        <div className="discover-layout">
          <form className="route-form" onSubmit={evaluateRoute}>
            <div className="route-form-heading">
              <div>
                <span className="form-step">01 / ROUTE</span>
                <h2>Set your route</h2>
              </div>
              <Route size={20} />
            </div>

            <div className="route-input-grid">
              <label className="route-field">
                <span><span className="field-dot field-dot-origin" /> Origin</span>
                <input value={form.origin} onChange={(event) => updateField("origin", event.target.value)} placeholder="e.g. Bharatpur Airport" required />
              </label>
              <label className="route-field">
                <span><span className="field-dot field-dot-destination" /> Destination</span>
                <input value={form.destination} onChange={(event) => updateField("destination", event.target.value)} placeholder="e.g. Meghauli" required />
              </label>
            </div>

            <div className="form-section">
              <span className="form-step">02 / MOOD</span>
              <h3>What sounds right?</h3>
              <div className="choice-grid">
                {(["slow", "balanced", "adventurous"] as TravelStyle[]).map((style) => (
                  <button className={`choice-button ${form.travelStyle === style ? "is-selected" : ""}`} key={style} type="button" onClick={() => updateField("travelStyle", style)}>
                    {form.travelStyle === style && <Check size={13} />}
                    <span>{style === "slow" ? "Slow & scenic" : style === "balanced" ? "A bit of everything" : "Off the beaten path"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <span className="form-step">03 / INTERESTS</span>
              <h3>Give the engine a hint <small>optional</small></h3>
              <div className="interest-list">
                {interestOptions.map((interest) => (
                  <button className={`interest-chip ${form.interests.includes(interest) ? "is-selected" : ""}`} key={interest} type="button" onClick={() => toggleInterest(interest)}>
                    {form.interests.includes(interest) && <Check size={12} />}{interest}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section detour-section">
              <label className="detour-label" htmlFor="detour"><span><span className="form-step">04 / DETOUR</span><strong>How far can we wander?</strong></span><Navigation size={16} /></label>
              <select id="detour" value={form.detour} onChange={(event) => updateField("detour", event.target.value as Detour)}>
                <option value="short">Keep it close</option>
                <option value="moderate">A reasonable detour</option>
                <option value="flexible">Take the scenic way</option>
              </select>
            </div>

            <button className="evaluate-button" type="submit" disabled={status === "loading"}>
              {status === "loading" ? <><RefreshCw className="spin-icon" size={17} /> Searching the route...</> : <><Sparkles size={17} /> Find route discoveries <ArrowRight size={17} /></>}
            </button>
            {status === "error" && <div className="route-error" role="alert"><TriangleAlert size={16} /><span>{errorMessage}<small>Make sure the API is running with <code>npm run dev</code> from the project root.</small></span></div>}
          </form>

          <section className={`discovery-results ${result ? "has-result" : ""}`} aria-live="polite">
            {!result && status !== "loading" && (
              <div className="results-empty">
                <div className="empty-orbit"><Globe2 size={29} /><span /><span /><span /></div>
                <p className="section-kicker">YOUR ROUTE, RECONSIDERED</p>
                <h2>Somewhere between the obvious and the unforgettable.</h2>
                <p>Places will appear here with a reason to stop, a practical note, and a source when live search is enabled.</p>
                <div className="empty-note"><Leaf size={15} /> Designed for Bharatpur&apos;s quieter corners</div>
              </div>
            )}

            {status === "loading" && <div className="results-loading"><div className="loading-pulse" /><p>Reading the route...</p><span>Checking for places worth your time</span></div>}

            {result && <ResultView result={result} />}
          </section>
        </div>
      </div>
    </main>
  );
}

function ResultView({ result }: { result: DiscoveryResult }) {
  const showCorridorShowcase = isAirportToMeghauliDemo(result);
  const showcaseServices = showCorridorShowcase
    ? [...bharatpurMeghauliServices].sort((a, b) => a.routeOrder - b.routeOrder || a.name.localeCompare(b.name))
    : [];

  return (
    <div className="result-content">
      <div className="result-heading-row">
        <div>
          <p className="section-kicker"><span className="result-live-dot" /> {modeLabel(result.searchMode)}</p>
          <h2>{result.origin} <span>→</span> {result.destination}</h2>
        </div>
        <span className="route-status"><Sparkles size={12} /> AI route brief</span>
      </div>
      {result.notice && <div className="result-notice"><TriangleAlert size={14} /> {result.notice}</div>}
      <p className="resolved-route">Matched locations: <strong>{result.resolvedOrigin}</strong> → <strong>{result.resolvedDestination}</strong></p>
      <div className="route-metrics" aria-label="Measured route metrics">
        <div><strong>{result.route.distanceKm.toFixed(1)} km</strong><span>road distance</span></div>
        <div><strong>{Math.round(result.route.durationMinutes)} min</strong><span>estimated drive</span></div>
        <div><strong>{showCorridorShowcase ? mainTourismPlaces.length : result.recommendations.length}</strong><span>{showCorridorShowcase ? "tourism places" : "verified stops"}</span></div>
      </div>
      <p className="result-overview">{result.overview}</p>
      <div className="route-character"><Route size={16} /><span>{result.routeCharacter}</span></div>

      <RoutePreview route={result.route.geometry?.coordinates} origin={result.origin} destination={result.destination} />

      {showCorridorShowcase && <CorridorServiceShowcase services={showcaseServices} />}

      {!showCorridorShowcase && <>
      <div className="recommendation-heading"><span className="form-step">YOUR STOPS</span><span>{result.recommendations.length} ideas</span></div>
      {result.recommendations.length > 0 ? <div className="recommendation-list">
        {result.recommendations.map((place, index) => (
          <article className="recommendation-card" key={`${place.name}-${index}`}>
            <div className="recommendation-number">0{index + 1}</div>
            <div className="recommendation-body">
              <div className="recommendation-meta"><span>{place.type}</span><span>{place.detour}</span></div>
              <h3>{place.name}</h3>
              <p>{place.whyItFits}</p>
              <div className="recommendation-metrics"><span>{place.distanceFromOriginKm.toFixed(1)} km from origin</span><span>{place.distanceToDestinationKm.toFixed(1)} km to destination</span><span>{place.driveMinutesVia.toFixed(0)} min via stop</span></div>
              <div className="practical-tip"><Leaf size={13} /><span><strong>Good to know</strong> {place.practicalTip}</span></div>
              {place.sourceUrl && <a className="source-link" href={place.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} /> {place.sourceLabel ?? "Read source"}</a>}
            </div>
          </article>
        ))}
      </div> : <div className="no-stops-message"><MapPin size={18} /><strong>No measured stops fit this setting.</strong><span>Try “A reasonable detour” or “Take the scenic way” to widen the live route corridor.</span></div>}
      </>}

      <div className="result-bottom-grid">
        <div>
          <div className="recommendation-heading"><span className="form-step">KEEP IN MIND</span></div>
          <ul className="tips-list">{result.tips.map((tip) => <li key={tip}><Check size={13} />{tip}</li>)}</ul>
        </div>
        {result.sources.length > 0 && <div className="sources-block"><div className="recommendation-heading"><span className="form-step">SOURCES</span><span>{result.sources.length} links</span></div><div className="sources-list">{result.sources.slice(0, 4).map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}><Search size={12} /><span>{source.title}</span><ExternalLink size={11} /></a>)}</div></div>}
      </div>
    </div>
  );
}

function RoutePreview({ route, origin, destination }: { route?: Array<[number, number]>; origin: string; destination: string }) {
  const hasLiveGeometry = Boolean(route && route.length >= 2);
  const previewRoute = hasLiveGeometry
    ? route!
    : [[0, 0], [0.34, 0.08], [0.67, -0.04], [1, 0]] as Array<[number, number]>;
  const longitudes = previewRoute.map(([longitude]) => longitude);
  const latitudes = previewRoute.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeRange = Math.max(maxLongitude - minLongitude, 0.0001);
  const latitudeRange = Math.max(maxLatitude - minLatitude, 0.0001);
  const project = ([longitude, latitude]: [number, number]) => [
    4 + ((longitude - minLongitude) / longitudeRange) * 92,
    4 + (1 - (latitude - minLatitude) / latitudeRange) * 48,
  ] as [number, number];
  const sampleStep = Math.max(1, Math.ceil(previewRoute.length / 180));
  const sampledRoute = previewRoute.filter((_, index) => index === 0 || index === previewRoute.length - 1 || index % sampleStep === 0);
  const points = sampledRoute.map(project);
  const path = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const start = project(previewRoute[0]);
  const end = project(previewRoute[previewRoute.length - 1]);

  return (
    <section className="route-preview-card" aria-label={`Light route preview from ${origin} to ${destination}`}>
      <div className="route-preview-heading">
        <span className="form-step">{hasLiveGeometry ? "ROUTE PREVIEW" : "ROUTE OVERVIEW"}</span>
        <span>{origin} <strong>→</strong> {destination}</span>
      </div>
      <svg className="route-preview-svg" viewBox="0 0 100 56" role="img" aria-hidden="true" preserveAspectRatio="none">
        <path className="route-preview-shadow" d={path} />
        <path className="route-preview-line" d={path} />
        <circle className="route-preview-start" cx={start[0]} cy={start[1]} r="2.2" />
        <circle className="route-preview-end" cx={end[0]} cy={end[1]} r="2.2" />
      </svg>
      <div className="route-preview-labels"><span><i className="route-preview-dot route-preview-dot-start" />Origin</span><span>Destination<i className="route-preview-dot route-preview-dot-end" /></span></div>
    </section>
  );
}

function CorridorServiceShowcase({ services }: { services: BharatpurMeghauliService[] }) {
  const [activeTab, setActiveTab] = useState<"tourism" | "hotels" | "other">("tourism");
  const hotels = services.filter((service) => /stay/i.test(service.category));
  const otherServices = services.filter((service) => !/stay/i.test(service.category));
  const listCount = activeTab === "tourism" ? mainTourismPlaces.length : activeTab === "hotels" ? hotels.length : otherServices.length;

  return (
    <section className="corridor-showcase" aria-labelledby="corridor-showcase-title">
      <div className="corridor-showcase-heading">
        <div>
          <div className="recommendation-heading"><span className="form-step">DEMO DIRECTORY</span><span>{listCount} {activeTab === "tourism" ? "places" : "listings"}</span></div>
          <h3 id="corridor-showcase-title">Places along the Bharatpur Airport → Meghauli corridor</h3>
          <p>The main list is limited to selected tourism places. Hotels and secondary services are available as optional showcase tabs.</p>
        </div>
      </div>
      <div className="showcase-tabs" role="tablist" aria-label="Corridor showcase categories">
        <button className={activeTab === "tourism" ? "is-active" : ""} type="button" role="tab" aria-selected={activeTab === "tourism"} onClick={() => setActiveTab("tourism")}>Tourism places <span>{mainTourismPlaces.length}</span></button>
        <button className={activeTab === "hotels" ? "is-active" : ""} type="button" role="tab" aria-selected={activeTab === "hotels"} onClick={() => setActiveTab("hotels")}>Hotels & stays <span>{hotels.length}</span></button>
        <button className={activeTab === "other" ? "is-active" : ""} type="button" role="tab" aria-selected={activeTab === "other"} onClick={() => setActiveTab("other")}>Other services <span>{otherServices.length}</span></button>
      </div>

      {activeTab === "tourism" ? <TourismPlaceList places={mainTourismPlaces} /> : <div className="corridor-service-list">
        {(activeTab === "hotels" ? hotels : otherServices).map((service) => <ServiceDirectoryCard key={`${service.routeOrder}-${service.name}`} service={service} />)}
      </div>}
    </section>
  );
}

function TourismPlaceList({ places }: { places: MainTourismPlace[] }) {
  return <div className="corridor-service-list">
    {places.map((place, index) => {
      const mapQuery = encodeURIComponent(place.address ? `${place.name}, ${place.address}` : place.name);
      return (
        <article className="corridor-service-card tourism-place-card" key={place.name}>
          <div className="corridor-service-order">{String(index + 1).padStart(2, "0")}</div>
          <div className="corridor-service-body">
            <div className="recommendation-meta"><span>{place.category}</span><span>{place.routeArea}</span></div>
            <h4>{place.name}</h4>
            <p>{place.description}</p>
            <div className="corridor-service-footer">
              <small>{place.address || "Location details will be connected in the map phase."}</small>
              <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer">Search map <ExternalLink size={11} /></a>
            </div>
          </div>
        </article>
      );
    })}
  </div>;
}

function ServiceDirectoryCard({ service }: { service: BharatpurMeghauliService }) {
  const mapQuery = encodeURIComponent(`${service.name}, ${service.address}`);
  return (
    <article className="corridor-service-card" key={`${service.routeOrder}-${service.name}`}>
      <div className="corridor-service-order">{String(service.routeOrder).padStart(2, "0")}</div>
      <div className="corridor-service-body">
        <div className="recommendation-meta"><span>{service.category}</span><span>{service.routeArea}</span></div>
        <h4>{service.name}</h4>
        <p>{service.address}</p>
        <div className="corridor-service-details">
          {service.phone && <span><Phone size={11} />{service.phone}</span>}
          {service.hours && <span><Clock3 size={11} />{service.hours}</span>}
        </div>
        <div className="corridor-service-footer">
          <small>{service.sourceNote}</small>
          <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer">Search map <ExternalLink size={11} /></a>
        </div>
      </div>
    </article>
  );
}
