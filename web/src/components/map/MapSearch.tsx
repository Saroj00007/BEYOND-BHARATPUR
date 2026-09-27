import { Search, X } from "lucide-react";

export default function MapSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="search-wrap">
      <Search size={17} aria-hidden="true" />
      <input
        className="search-input"
        type="search"
        aria-label="Search places, categories, or zones"
        placeholder="Search places in Bharatpur..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => onChange("")}><X size={16} /></button>}
    </div>
  );
}