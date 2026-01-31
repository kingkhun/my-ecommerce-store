'use client'; // This tells Next.js this page is interactive
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    // This function goes to the database and gets data
    async function getProducts() {
      const { data } = await supabase.from('products').select('*');
      if (data) setProducts(data);
    }
    getProducts();
  }, []);

  return (
    <main>
      <h1>My Store</h1>
      <div className="grid">
        {products.map((product) => (
          <div key={product.id}>
            <h3>{product.name}</h3>
            <p>${product.price}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
