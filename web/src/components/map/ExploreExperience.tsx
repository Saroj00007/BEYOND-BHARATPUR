"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Compass, MapPin, X } from "lucide-react";
import { groupServicesByZone, servicePoints, tourismPlaces, tourismZones } from "@/data/bharatpurData";
import type { ServiceGroup, TourismPlace } from "@/types/tourism";
import MapFilters, { type MapFilter } from "@/components/map/MapFilters";
import MapSearch from "@/components/map/MapSearch";
import MapLegend from "@/components/map/MapLegend";
import PlaceCard from "@/components/map/PlaceCard";
import ZoneSelector from "@/components/map/ZoneSelector";

const TourismMap = dynamic(() => import("@/components/map/TourismMap"), {
  ssr: false,
  loading: () => <div className="map-loading" aria-label="Loading interactive map" />,
});

export default function ExploreExperience() {
  const [filter, setFilter] = useState<MapFilter>("all");
  const [search, setSearch] = useState("");
  const [zoneId, setZoneId] = useState("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedServiceGroupId, setSelectedServiceGroupId] = useState<string | null>(null);
  const query = search.trim().toLowerCase();

  const visiblePlaces = useMemo(() => tourismPlaces.filter((place) => {
    const matchesZone = zoneId === "all" || place.zoneId === zoneId;
    const matchesFilter = filter === "all" || filter === "places" || (filter === "popular" && place.isPopular) || (filter === "nearby" && !place.isPopular);
    const searchable = `${place.name} ${place.category} ${place.zone} ${place.ward} ${place.approximateDistance} ${place.direction} ${place.activities} ${place.secondaryPlaces.join(" ")}`;
    const matchesSearch = !query || searchable.toLowerCase().includes(query);
    return Boolean(matchesZone && matchesFilter && matchesSearch);
  }), [filter, query, zoneId]);

  const visibleServices = useMemo(() => servicePoints.filter((service) => {
    const matchesZone = zoneId === "all" || service.zoneId === zoneId;
    const matchesFilter = filter === "all" || service.types.includes(filter as "food" | "stay" | "health" | "police" | "transport");
    const matchesSearch = !query || `${service.name} ${service.types.join(" ")} ${service.zone} ${service.location} ${service.verificationNote}`.toLowerCase().includes(query);
    return Boolean(matchesZone && matchesFilter && matchesSearch);
  }), [filter, query, zoneId]);

  const selectedPlace = tourismPlaces.find((place) => place.id === selectedPlaceId) ?? null;
  const visibleServiceGroups = useMemo(() => groupServicesByZone(visibleServices), [visibleServices]);
  const selectedService = visibleServiceGroups.find((group) => group.id === selectedServiceGroupId) ?? null;
  const activeZone = tourismZones.find((zone) => zone.id === zoneId) ?? null;

  function selectPlace(place: TourismPlace) {
    setSelectedServiceGroupId(null);
    setSelectedPlaceId(place.id);
  }

  function selectService(service: ServiceGroup) {
    setSelectedPlaceId(null);
    setSelectedServiceGroupId(service.id);
  }

  function closeDetails() {
    setSelectedPlaceId(null);
    setSelectedServiceGroupId(null);
  }

  function clearFilters() {
    setFilter("all");
    setSearch("");
    setZoneId("all");
  }

  const noResults = visiblePlaces.length + visibleServices.length === 0;

  return (
    <main className="explore-page">
      <header className="explore-header">
        <div className="explore-topline">
          <Link className="explore-brand" href="/" aria-label="Back to Beyond Bharatpur home"><span className="brand-mark"><Compass size={17} /></span><span>Beyond <span className="brand-ai">Bharatpur</span></span></Link>
          <MapSearch value={search} onChange={setSearch} />
          <Link className="map-action-link" href="/" aria-label="Back to home"><ArrowLeft size={16} /><span>Home</span></Link>
        </div>
        <div className="filter-toolbar">
          <MapFilters active={filter} onChange={setFilter} />
          <ZoneSelector zones={tourismZones} value={zoneId} onChange={(id) => { setZoneId(id); closeDetails(); }} />
        </div>
      </header>
      <section className="map-stage" aria-label="Interactive map of Bharatpur">
        <div className="mock-notice"><MapPin size={12} /> Approximate zone placement · exact GPS coordinates are not in the source</div>
        <TourismMap
          places={visiblePlaces}
          serviceGroups={visibleServiceGroups}
          serviceFilter={filter}
          zones={tourismZones}
          selectedPlaceId={selectedPlaceId}
          selectedServiceGroupId={selectedServiceGroupId}
          activeZone={activeZone}
          onSelectPlace={selectPlace}
          onSelectService={selectService}
        />
        <MapLegend />
        <div className="map-count" aria-live="polite"><strong>{visiblePlaces.length}</strong> destinations <span aria-hidden="true">·</span> <strong>{visibleServices.length}</strong> service listings</div>
        {noResults && <div className="empty-results"><strong>No matches on this map</strong><p>Try another search or reset the filters.</p><button type="button" onClick={clearFilters}>Clear search & filters <X size={12} /></button></div>}
        <PlaceCard place={selectedPlace} serviceGroup={selectedService} onClose={closeDetails} />
      </section>
    </main>
  );
}
