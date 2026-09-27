import { MapPin, Sparkles, X } from "lucide-react";
import type { ServiceGroup, TourismPlace } from "@/types/tourism";

const serviceMeta = {
  food: { label: "Food", icon: "🍴", color: "#fff0e8" },
  stay: { label: "Stay", icon: "🛏️", color: "#f0ebf8" },
  health: { label: "Health post", icon: "🏥", color: "#fbe9e9" },
  police: { label: "Police office", icon: "👮", color: "#e8f0f7" },
  transport: { label: "Transport", icon: "🚌", color: "#e8f2eb" },
};

export default function PlaceCard({
  place,
  serviceGroup,
  onClose,
}: {
  place: TourismPlace | null;
  serviceGroup: ServiceGroup | null;
  onClose: () => void;
}) {
  if (!place && !serviceGroup) return null;

  return (
    <section className="details-panel" aria-label={place ? `${place.name} details` : `${serviceGroup?.zone} service hub`}>
      <button className="details-close" type="button" aria-label="Close details" onClick={onClose}><X size={18} /></button>
      {place ? (
        <>
          <div className="detail-photo-placeholder">
            <MapPin size={25} />
            <strong>{place.category}</strong>
            <span>No photo supplied in the dataset</span>
          </div>
          <div className="detail-content">
            <div className="detail-eyebrow"><span className="category-label"><MapPin size={12} />{place.category}</span>{place.isPopular && <span className="popular-label"><Sparkles size={11} />Zone anchor</span>}</div>
            <h2>{place.name}</h2>
            <div className="detail-location"><MapPin size={13} />{place.zone}</div>
            <p className="detail-description">{place.activities}</p>
            <div className="detail-meta">
              <span className="meta-pill">Ward {place.ward}</span>
              <span className="meta-pill">{place.approximateDistance}</span>
              <span className="meta-pill">{place.direction}</span>
            </div>
            {place.secondaryPlaces.length ? <div className="nearby-block"><h3>Secondary places in this block</h3><ul className="secondary-place-list">
              {place.secondaryPlaces.map((name) => <li key={name}>{name}</li>)}
            </ul></div> : null}
            <div className="nearby-block"><h3>Food & stays</h3><p className="source-detail-row"><strong>Food</strong>{place.foodOptions}</p><p className="source-detail-row"><strong>Stay</strong>{place.stayOptions}</p></div>
            <div className="nearby-block"><h3>Health & security</h3><p className="source-detail-row"><strong>Health</strong>{place.healthOptions}</p><p className="source-detail-row"><strong>Police</strong>{place.securityOptions}</p></div>
            <div className="nearby-block"><h3>Nearby service hubs</h3><p className="source-detail-row">{place.nearbyServiceHubs}</p></div>
            <span className="source-data-badge">Approximate map position · {place.coordinateSource === "zone-area" ? "zone area only" : "source distance and direction"}</span>
            <p className="source-note">{place.sourceNote}</p>
          </div>
        </>
      ) : serviceGroup ? (
        <div className="detail-content service-detail-content">
          <div className="service-icon" style={{ background: "#e8f2eb" }}>✦</div>
          <span className="service-type">Service directory · grouped by approximate hub</span>
          <h2>{serviceGroup.zone}</h2>
          <p className="detail-description">{serviceGroup.services.length} service references from the supplied dataset. Pins show the tourism zone, not an individual business address.</p>
          <div className="service-record-list">
            {serviceGroup.services.map((service) => (
              <article className="service-record" key={service.id}>
                <div className="service-record-categories">
                  {service.types.map((type) => <span className="service-record-category" key={type} style={{ background: serviceMeta[type].color }}>{serviceMeta[type].icon} {serviceMeta[type].label}</span>)}
                </div>
                <h3>{service.name}</h3>
                <p>{service.location}</p>
                <small>{service.verificationNote}</small>
                {service.sourceKind === "transport-reference" && <small>Transport reference · not a verified stop</small>}
              </article>
            ))}
          </div>
          <span className="source-data-badge">Approximate hub placement · no business coordinates supplied</span>
        </div>
      ) : null}
    </section>
  );
}