export type TourismPlace = {
  id: string;
  name: string;
  category: string;
  zone: string;
  zoneId: string;
  latitude: number;
  longitude: number;
  description: string;
  activities: string;
  ward: string;
  approximateDistance: string;
  direction: string;
  coordinateSource: "distance-direction" | "zone-area";
  stayOptions: string;
  foodOptions: string;
  healthOptions: string;
  securityOptions: string;
  nearbyServiceHubs: string;
  photos: string[];
  isPopular: boolean;
  secondaryPlaces: string[];
  sourceNote: string;
};

export type ServiceType = "food" | "stay" | "health" | "police" | "transport";

export type ServicePoint = {
  id: string;
  name: string;
  types: ServiceType[];
  latitude: number;
  longitude: number;
  zone: string;
  zoneId: string;
  location: string;
  verificationNote: string;
  sourceKind: "directory" | "transport-reference";
};

export type ServiceGroup = {
  id: string;
  zone: string;
  zoneId: string;
  latitude: number;
  longitude: number;
  services: ServicePoint[];
};

export type TourismZone = {
  id: string;
  name: string;
  description?: string;
  center: { latitude: number; longitude: number };
  radiusMeters: number;
  color: string;
  placeIds: string[];
};