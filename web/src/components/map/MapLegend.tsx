"use client";

import { BusFront, HeartPulse, Hotel, Info, Landmark, Shield, Utensils } from "lucide-react";
import { useState } from "react";

const items = [
  { label: "Zone anchor destination", icon: Landmark, color: "#176c55" },
  { label: "Other destination", icon: Info, color: "#e89a3d" },
  { label: "Approximate tourism zone", icon: Info, color: "#75865a" },
  { label: "Grouped service hub", icon: Info, color: "#526f68" },
  { label: "Food", icon: Utensils, color: "#db7553" },
  { label: "Stay", icon: Hotel, color: "#8069b0" },
  { label: "Health", icon: HeartPulse, color: "#d85e67" },
  { label: "Police", icon: Shield, color: "#427aa1" },
  { label: "Transport", icon: BusFront, color: "#5a8c73" },
];

export default function MapLegend() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && <section className="legend-popover" aria-label="Map legend"><h2>Map legend</h2><div className="legend-list">
        {items.map(({ label, icon: Icon, color }) => <div className="legend-row" key={label}><span className="legend-dot" style={{ background: color }}><Icon size={10} /></span>{label}</div>)}
      </div></section>}
      <button type="button" className={`map-legend${open ? " active" : ""}`} aria-label={open ? "Close map legend" : "Open map legend"} aria-expanded={open} onClick={() => setOpen(!open)}><Info size={18} /></button>
    </>
  );
}