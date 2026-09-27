import { ChevronDown, Layers3 } from "lucide-react";
import type { TourismZone } from "@/types/tourism";

export default function ZoneSelector({ zones, value, onChange }: { zones: TourismZone[]; value: string; onChange: (zoneId: string) => void }) {
  return (
    <label className="zone-select-wrap">
      <Layers3 size={14} aria-hidden="true" />
      <select className="zone-select" aria-label="Select tourism zone" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All zones</option>
        {zones.map((zone) => <option value={zone.id} key={zone.id}>{zone.name}</option>)}
      </select>
      <ChevronDown className="zone-chevron" size={13} aria-hidden="true" />
    </label>
  );
}