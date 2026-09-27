import sourceData from "@/data/Bharatpur_AI_Discover_Dataset.json";
import type { ServiceGroup, ServicePoint, ServiceType, TourismPlace, TourismZone } from "@/types/tourism";

export const bharatpurCenter = { latitude: 27.6833, longitude: 84.4333 };

const zoneDefinitions = [
  {
    id: "north-river-heritage",
    name: "North · River & Heritage",
    description: "Devghat, riverfront, hill and heritage destinations.",
    center: { latitude: 27.758, longitude: 84.414 },
    radiusMeters: 10500,
    color: "#477f9d",
  },
  {
    id: "central-city-culture",
    name: "Central · City & Culture",
    description: "Urban nature stops, city culture and health-service hubs.",
    center: bharatpurCenter,
    radiusMeters: 5400,
    color: "#d47c57",
  },
  {
    id: "east-lakes-wetlands",
    name: "East · Lakes & Wetlands",
    description: "Wetlands, lakes and birdwatching destinations.",
    center: { latitude: 27.632, longitude: 84.498 },
    radiusMeters: 7200,
    color: "#4b9276",
  },
  {
    id: "south-wildlife-river",
    name: "South · Wildlife & River",
    description: "Patihani, Kasara and southern wildlife destinations.",
    center: { latitude: 27.548, longitude: 84.425 },
    radiusMeters: 10500,
    color: "#cc8c3d",
  },
  {
    id: "west-meghauli-community",
    name: "West · Meghauli & Community",
    description: "Meghauli, community forests and western village experiences.",
    center: { latitude: 27.669, longitude: 84.232 },
    radiusMeters: 16000,
    color: "#75865a",
  },
] as const;

const destinationZones: Record<number, string> = {
  1: "west-meghauli-community",
  2: "south-wildlife-river",
  3: "north-river-heritage",
  4: "east-lakes-wetlands",
  5: "west-meghauli-community",
  6: "north-river-heritage",
  7: "north-river-heritage",
  8: "south-wildlife-river",
  9: "south-wildlife-river",
  10: "south-wildlife-river",
  11: "north-river-heritage",
  12: "central-city-culture",
  13: "east-lakes-wetlands",
  14: "west-meghauli-community",
  15: "north-river-heritage",
  16: "west-meghauli-community",
  17: "west-meghauli-community",
  18: "west-meghauli-community",
  19: "west-meghauli-community",
  20: "west-meghauli-community",
  21: "central-city-culture",
};

const zoneById = new Map<string, (typeof zoneDefinitions)[number]>(zoneDefinitions.map((zone) => [zone.id, zone]));
const popularDestinationIds = new Set([1, 2, 3, 4, 12]);
const earthRadiusKm = 6371;

function distanceFromSource(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)(?:\s*[–—-]\s*(\d+(?:\.\d+)?))?\s*km/i);
  if (!match) return null;
  const start = Number(match[1]);
  return match[2] ? (start + Number(match[2])) / 2 : start;
}

function bearingFromSource(value: string): number | null {
  const north = value.includes("उत्तर");
  const south = value.includes("दक्षिण");
  const east = value.includes("पूर्व");
  const west = value.includes("पश्चिम");
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

function offsetFromReference(distanceKm: number, bearingDegrees: number) {
  const bearing = (bearingDegrees * Math.PI) / 180;
  const latitude = (bharatpurCenter.latitude * Math.PI) / 180;
  const angularDistance = distanceKm / earthRadiusKm;
  const destinationLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const destinationLongitude =
    ((bharatpurCenter.longitude * Math.PI) / 180) +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(destinationLatitude),
    );

  return {
    latitude: (destinationLatitude * 180) / Math.PI,
    longitude: (((destinationLongitude * 180) / Math.PI + 540) % 360) - 180,
  };
}

function destinationCategory(id: number, text: string): string {
  if (id === 20) return "Community";
  if (id === 21) return "Health";
  if ([4, 13].includes(id)) return "Wetlands";
  if (/pilgrimage|temple|religious|monastery|\u092e\u0928\u094d\u0926\u093f\u0930|\u0917\u0941\u092e\u094d\u092c\u093e|\u0906\u0936\u094d\u0930\u092e/i.test(text)) return "Culture";
  if (/wildlife|safari|forest|\u091c\u0919\u094d\u0917\u0932|\u0935\u0928\u094d\u092f\u091c\u0928\u094d\u0924\u0941/i.test(text)) return "Wildlife";
  return "Nature";
}

function splitSecondaryPlaces(value: string): string[] {
  return value.split(/[;；]/).map((item) => item.trim()).filter(Boolean);
}

export const tourismZones: TourismZone[] = zoneDefinitions.map((zone) => ({
  ...zone,
  placeIds: sourceData.destinations
    .filter((destination) => destinationZones[destination.id] === zone.id)
    .map((destination) => `destination-${destination.id}`),
}));

export const tourismPlaces: TourismPlace[] = sourceData.destinations.map((destination) => {
  const zoneId = destinationZones[destination.id];
  const zone = zoneById.get(zoneId)!;
  const distance = distanceFromSource(destination.approx_distance_from_bharatpur_reference_point);
  const bearing = bearingFromSource(destination.direction);
  const position = distance !== null && bearing !== null
    ? offsetFromReference(distance, bearing)
    : zone.center;

  return {
    id: `destination-${destination.id}`,
    name: destination.main_place_block,
    category: destinationCategory(destination.id, `${destination.main_place_block} ${destination.activities_experience} ${destination.secondary_places_attractions}`),
    zone: zone.name,
    zoneId,
    latitude: position.latitude,
    longitude: position.longitude,
    description: destination.data_note,
    activities: destination.activities_experience,
    ward: destination.ward,
    approximateDistance: destination.approx_distance_from_bharatpur_reference_point,
    direction: destination.direction,
    coordinateSource: distance !== null && bearing !== null ? "distance-direction" : "zone-area",
    stayOptions: destination.stay_hotel_options,
    foodOptions: destination.food_restaurant_options,
    healthOptions: destination.health_medical_hospital,
    securityOptions: destination.security_police,
    nearbyServiceHubs: destination.nearby_service_hubs_facilities,
    photos: [],
    isPopular: popularDestinationIds.has(destination.id),
    secondaryPlaces: splitSecondaryPlaces(destination.secondary_places_attractions),
    sourceNote: destination.data_note,
  };
});

function serviceTypes(category: string): ServiceType[] {
  const normalized = category.toLowerCase();
  if (normalized.includes("security")) return ["police"];
  if (normalized.includes("health")) return ["health"];
  if (normalized.includes("food") && normalized.includes("stay")) return ["food", "stay"];
  if (normalized.includes("food")) return ["food"];
  if (normalized.includes("stay")) return ["stay"];
  return [];
}

function serviceZoneId(hub: string): string {
  const normalized = hub.toLowerCase();
  if (normalized.includes("meghauli") || normalized.includes("western corridor")) return "west-meghauli-community";
  if (normalized.includes("patihani") || normalized.includes("kasara")) return "south-wildlife-river";
  if (normalized.includes("devghat") || normalized.includes("chaukidanda") || normalized.includes("kabilas")) return "north-river-heritage";
  return "central-city-culture";
}

export const servicePoints: ServicePoint[] = sourceData.service_directory.flatMap((record, index) => {
  const types = serviceTypes(record.category);
  if (!types.length) return [];
  const zoneId = serviceZoneId(record.service_hub_area);
  const zone = zoneById.get(zoneId)!;
  return [{
    id: `service-${index + 1}`,
    name: record.name,
    types,
    latitude: zone.center.latitude,
    longitude: zone.center.longitude,
    zone: zone.name,
    zoneId,
    location: record.location,
    verificationNote: record.verification_note,
    sourceKind: "directory" as const,
  }];
});

const transportReferences: ServicePoint[] = sourceData.destinations.flatMap((destination) => {
  const zoneId = destinationZones[destination.id];
  const zone = zoneById.get(zoneId)!;
  const references = destination.nearby_service_hubs_facilities
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => /airport|transport|highway/i.test(item));

  return references.map((name, index) => ({
    id: `transport-reference-${destination.id}-${index + 1}`,
    name,
    types: ["transport"],
    latitude: zone.center.latitude,
    longitude: zone.center.longitude,
    zone: zone.name,
    zoneId,
    location: zone.name,
    verificationNote: "Transport reference transcribed from the destination data; exact stop coordinates are not supplied.",
    sourceKind: "transport-reference",
  }));
});

export const serviceDirectoryCount = sourceData.service_directory.length;
export const transportReferenceCount = transportReferences.length;
servicePoints.push(...transportReferences);

export function groupServicesByZone(services: ServicePoint[]): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup>();
  for (const service of services) {
    const group = groups.get(service.zoneId);
    if (group) group.services.push(service);
    else groups.set(service.zoneId, {
      id: `services-${service.zoneId}`,
      zone: service.zone,
      zoneId: service.zoneId,
      latitude: service.latitude,
      longitude: service.longitude,
      services: [service],
    });
  }
  return [...groups.values()];
}

export const tourismCircuits = sourceData.tourism_circuits;

export const bharatpurMapBounds = {
  southWest: { latitude: 27.42, longitude: 84.08 },
  northEast: { latitude: 27.93, longitude: 84.62 },
};