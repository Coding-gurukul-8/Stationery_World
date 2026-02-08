import React from 'react';

export default function Hero({ featured }) {
  return (
    <section className="shop-hero">
      <div className="hero-left">
        <h1>Discover stationery delights</h1>
        <p className="muted">Curated picks, trending products and limited offers — just for you.</p>
        <div className="hero-ctas">
          <button className="btn primary">Shop now</button>
          <button className="btn outline" style={{ marginLeft: 8 }}>Explore categories</button>
        </div>
      </div>
      <div className="hero-right">
        {featured && (
          <div className="hero-card">
            <img src={featured.image} alt={featured.name} />
            <div className="hc-info">
              <div className="hc-name">{featured.name}</div>
              <div className="hc-price">₹{featured.price.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
