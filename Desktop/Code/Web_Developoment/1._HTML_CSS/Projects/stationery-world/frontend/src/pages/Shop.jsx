import { useMemo, useState } from 'react';
import Hero from '../components/shop/Hero';
import CategoryStrip from '../components/shop/CategoryStrip';
import ProductGrid from '../components/shop/ProductGrid';
import '../../Style/shop.css';

function sampleProducts() {
  const imgs = [
    'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=900&q=60',
    'https://images.unsplash.com/photo-1522845008411-1a51d1c7b22e?w=900&q=60',
    'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=900&q=60',
    'https://images.unsplash.com/photo-1493666438817-866a91353ca9?w=900&q=60',
    'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=900&q=60',
    'https://images.unsplash.com/photo-1503602642458-232111445657?w=900&q=60'
  ];

  return Array.from({ length: 12 }).map((_, i) => ({
    id: i + 1,
    name: ['Classic Pen','Graphite Set','Sketchbook','Sticky Notes','Glue Stick','Marker'][i % 6] + ` ${i+1}`,
    price: (Math.random() * 500) + 50,
    rating: (Math.random() * 2 + 3).toFixed(1),
    category: ['Pens','Books','Art','Office'][i % 4],
    image: imgs[i % imgs.length]
  }));
}

export default function Shop(){
  const [products] = useState(sampleProducts());
  const [filter, setFilter] = useState(null);
  const [search, setSearch] = useState('');

  const categories = useMemo(() => ['All','Pens','Books','Art','Office'], []);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (filter && filter !== 'All' && p.category !== filter) return false;
      if (!search) return true;
      const q = search.trim().toLowerCase();
      return p.name.toLowerCase().includes(q);
    });
  }, [products, filter, search]);

  const featured = filtered[0];

  function handleAddToCart(p){ alert('Add to cart: ' + p.name); }
  function handleToggleWishlist(p){ alert('Toggle wishlist: ' + p.name); }

  return (
    <div className="shop-page">
      <Hero featured={featured} />

      <div className="card">
        <div className="shop-toolbar">
          <CategoryStrip categories={categories} onSelect={setFilter} />

          <div className="search-wrap">
            <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <ProductGrid products={filtered} onAddToCart={handleAddToCart} onToggleWishlist={handleToggleWishlist} />

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button className="btn outline">Load more</button>
        </div>
      </div>
    </div>
  );
}
