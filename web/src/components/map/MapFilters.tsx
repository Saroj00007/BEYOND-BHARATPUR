import { BusFront, HeartPulse, Hotel, MapPin, Shield, Utensils, Landmark, LocateFixed } from "lucide-react";
import type { ServiceType } from "@/types/tourism";

export type MapFilter = "all" | "places" | "popular" | "nearby" | ServiceType;

const filters: { id: MapFilter; label: string; icon?: typeof MapPin }[] = [
  { id: "all", label: "All" },
  { id: "places", label: "Places", icon: MapPin },
  { id: "popular", label: "Popular", icon: Landmark },
  { id: "nearby", label: "Nearby", icon: LocateFixed },
  { id: "food", label: "Food", icon: Utensils },
  { id: "stay", label: "Stay", icon: Hotel },
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "police", label: "Police", icon: Shield },
  { id: "transport", label: "Transport", icon: BusFront },
];

export default function MapFilters({ active, onChange }: { active: MapFilter; onChange: (filter: MapFilter) => void }) {
  return (
    <nav className="filter-row" aria-label="Map categories">
      {filters.map(({ id, label, icon: Icon }, index) => (
        <span className="filter-fragment" key={id} style={{ display: "contents" }}>
          {index === 4 && <span className="filter-divider" aria-hidden="true" />}
          <button type="button" className={`filter-chip${active === id ? " active" : ""}`} aria-pressed={active === id} onClick={() => onChange(id)}>
            {Icon && <Icon size={13} strokeWidth={2} />}{label}
          </button>
        </span>
      ))}
    </nav>
  );
}