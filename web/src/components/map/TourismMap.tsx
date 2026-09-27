"use client";

import { useEffect } from "react";
import { divIcon, type LatLngBoundsExpression, type LatLngExpression } from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { ServiceGroup, ServiceType, TourismPlace, TourismZone } from "@/types/tourism";
import { bharatpurCenter, bharatpurMapBounds } from "@/data/bharatpurData";
import type { MapFilter } from "@/components/map/MapFilters";
import "leaflet/dist/leaflet.css";

const serviceStyles: Record<ServiceType, { color: string; icon: string }> = {
  food: { color: "#db7553", icon: "🍴" },
  stay: { color: "#8069b0", icon: "🛏️" },
  health: { color: "#d85e67", icon: "🏥" },
  police: { color: "#427aa1", icon: "👮" },
  transport: { color: "#5a8c73", icon: "🚌" },
};

const mapBounds: LatLngBoundsExpression = [
  [bharatpurMapBounds.southWest.latitude, bharatpurMapBounds.southWest.longitude],
  [bharatpurMapBounds.northEast.latitude, bharatpurMapBounds.northEast.longitude],
];

function placeIcon(place: TourismPlace, selected: boolean) {
  return divIcon({
    className: "place-marker-icon",
    html: `<span class="marker-shell${place.isPopular ? " is-popular" : ""}${selected ? " is-selected" : ""}" style="--marker-color:${place.isPopular ? "#176c55" : "#e89a3d"}">${place.isPopular ? "★" : "•"}</span>`,
    iconSize: place.isPopular ? [39, 39] : [33, 33],
    iconAnchor: place.isPopular ? [20, 35] : [17, 30],
  });
}

function serviceIcon(group: ServiceGroup, filter: MapFilter, selected: boolean) {
  const types = [...new Set(group.services.flatMap((service) => service.types))];
  const type = ["food", "stay", "health", "police", "transport"].includes(filter)
    ? filter as ServiceType
    : types.length === 1 ? types[0] : null;
  const color = type ? serviceStyles[type].color : "#526f68";
  const icon = type ? serviceStyles[type].icon : "✦";
  return divIcon({
    className: "place-marker-icon",
    html: `<span class="marker-shell is-service${selected ? " is-selected" : ""}" style="--marker-color:${color}"><span>${icon}</span><small class="service-marker-count">${group.services.length}</small></span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 27],
  });
}

function ViewportController({ selected, zone }: { selected: { latitude: number; longitude: number } | null; zone: TourismZone | null }) {
  const map = useMap();
  useEffect(() => {
    if (selected) map.flyTo([selected.latitude, selected.longitude], Math.max(map.getZoom(), 12.4), { duration: 0.65 });
    else if (zone) map.flyTo([zone.center.latitude, zone.center.longitude], 12, { duration: 0.65 });
    else if (!selected && !zone) map.flyTo([bharatpurCenter.latitude, bharatpurCenter.longitude], 10.4, { duration: 0.65 });
  }, [map, selected?.latitude, selected?.longitude, zone?.id]);
  return null;
}

export default function TourismMap({
  places,
  serviceGroups,
  serviceFilter,
  zones,
  selectedPlaceId,
  selectedServiceGroupId,
  activeZone,
  onSelectPlace,
  onSelectService,
}: {
  places: TourismPlace[];
  serviceGroups: ServiceGroup[];
  serviceFilter: MapFilter;
  zones: TourismZone[];
  selectedPlaceId: string | null;
  selectedServiceGroupId: string | null;
  activeZone: TourismZone | null;
  onSelectPlace: (place: TourismPlace) => void;
  onSelectService: (service: ServiceGroup) => void;
}) {
  const selectedPlace = places.find((place) => place.id === selectedPlaceId) ?? null;
  const selectedService = serviceGroups.find((group) => group.id === selectedServiceGroupId) ?? null;
  const viewportTarget = selectedPlace ?? selectedService;
  const center: LatLngExpression = [bharatpurCenter.latitude, bharatpurCenter.longitude];

  return (
    <MapContainer className="tourism-map" center={center} zoom={10.4} minZoom={9.5} maxZoom={18} maxBounds={mapBounds} maxBoundsViscosity={1} zoomControl scrollWheelZoom>
      <ViewportController selected={viewportTarget} zone={activeZone} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {zones.map((zone) => (
        <Circle
          key={zone.id}
          center={[zone.center.latitude, zone.center.longitude]}
          radius={zone.radiusMeters}
          interactive={false}
          pathOptions={{ color: zone.color, weight: activeZone?.id === zone.id ? 2 : 1, fillColor: zone.color, fillOpacity: activeZone?.id === zone.id ? 0.16 : 0.07, opacity: activeZone && activeZone.id !== zone.id ? 0.35 : 0.72 }}
        />
      ))}
      {places.map((place) => (
        <Marker key={place.id} position={[place.latitude, place.longitude]} icon={placeIcon(place, selectedPlaceId === place.id)} eventHandlers={{ click: () => onSelectPlace(place) }} title={`${place.name} (approximate source position)`}>
          {place.isPopular && <Tooltip className="place-tooltip" direction="top" offset={[0, -26]} permanent>{place.name}</Tooltip>}
        </Marker>
      ))}
      {serviceGroups.map((group) => (
        <Marker key={group.id} position={[group.latitude, group.longitude]} icon={serviceIcon(group, serviceFilter, selectedServiceGroupId === group.id)} eventHandlers={{ click: () => onSelectService(group) }} title={`${group.zone} service hub, ${group.services.length} directory entries`} />
      ))}
    </MapContainer>
  );
}