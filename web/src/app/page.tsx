import Link from "next/link";
import { ArrowRight, Compass, MapPin, Navigation, Search, Sparkles } from "lucide-react";

const features = [
  { icon: Compass, title: "Discover places", detail: "Find the landmarks that make a place feel like itself." },
  { icon: Navigation, title: "Go a little further", detail: "See nearby stops around every main attraction." },
  { icon: MapPin, title: "Find what you need", detail: "Spot food, stays, health, police and transport." },
  { icon: Search, title: "Explore your way", detail: "Search, filter and wander at your own pace." },
];

export default function HomePage() {
  return (
    <main className="home-page">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="YatraAI home">
          <span className="brand-mark"><Compass size={20} strokeWidth={2.2} /></span>
          <span>yatra<span className="brand-ai">ai</span></span>
        </Link>
        <Link className="header-link" href="/explore">Open map <ArrowRight size={15} /></Link>
      </header>

      <section className="home-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> A NEW WAY TO WANDER</div>
          <h1>Discover Bharatpur.<br /><span>Explore More.</span></h1>
          <p className="hero-description">A little more curious, a little less planned. Explore places, find what’s nearby, and make Bharatpur yours.</p>
          <Link className="primary-cta" href="/explore">Explore Bharatpur <ArrowRight size={18} /></Link>
          <p className="hero-footnote"><Sparkles size={14} /> Your map. Your pace. Your next favourite place.</p>
        </div>
        <div className="hero-art" aria-label="Illustrated map preview of Bharatpur">
          <div className="map-preview">
            <div className="map-grid" />
            <div className="map-river" />
            <div className="map-road map-road-one" />
            <div className="map-road map-road-two" />
            <div className="map-label map-label-one">BHARATPUR</div>
            <div className="map-label map-label-two">CHITWAN</div>
            <span className="preview-pin preview-pin-one"><MapPin size={17} fill="currentColor" /></span>
            <span className="preview-pin preview-pin-two"><MapPin size={15} fill="currentColor" /></span>
            <span className="preview-pin preview-pin-three"><MapPin size={15} fill="currentColor" /></span>
            <div className="map-note"><span className="map-note-dot" /><span><strong>Bharatpur, Nepal</strong><small>There’s more around the corner</small></span></div>
            <div className="map-scale">27° 40′ N&nbsp;&nbsp; 84° 26′ E</div>
          </div>
          <div className="hero-stamp"><span>TAKE<br />THE<br />SCENIC<br />ROUTE</span><ArrowRight size={19} /></div>
        </div>
      </section>

      <section className="feature-section" aria-labelledby="feature-heading">
        <div className="feature-heading-row">
          <div><p className="section-kicker">THE GOOD STUFF, CLOSE BY</p><h2 id="feature-heading">A better way to find your way.</h2></div>
          <Link className="text-link" href="/explore">Start exploring <ArrowRight size={16} /></Link>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, detail }, index) => (
            <article className="feature-item" key={title}>
              <span className={`feature-icon feature-icon-${index + 1}`}><Icon size={19} strokeWidth={1.8} /></span>
              <h3>{title}</h3><p>{detail}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className="home-footer"><span>YatraAI <span className="footer-separator">/</span> Bharatpur, Nepal</span><span>Made for curious travellers</span></footer>
    </main>
  );
}
