'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  category: string;
}

export default function ProductDetail() {
  const { id } = useParams(); // Grabs the 'id' from the URL
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProduct() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id) // Only get the product matching this ID
        .single();

      if (data) setProduct(data);
      setLoading(false);
    }
    if (id) fetchProduct();
  }, [id]);

  if (loading) return <div className="p-20 text-center text-2xl">Loading laptop details...</div>;
  if (!product) return <div className="p-20 text-center text-2xl">Product not found.</div>;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="text-blue-600 hover:underline mb-8 inline-block">
          ← Back to Store
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Large Image */}
          <div className="bg-gray-100 rounded-3xl overflow-hidden">
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          </div>

          {/* Text Content */}
          <div className="flex flex-col justify-center">
            <span className="text-blue-600 font-bold uppercase tracking-widest text-sm mb-2">
              {product.category}
            </span>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">{product.name}</h1>
            <p className="text-3xl font-bold text-green-600 mb-6">${product.price}</p>
            <p className="text-gray-600 text-lg leading-relaxed mb-8">
              {product.description}
            </p>
            
            <button className="bg-blue-600 text-white text-xl font-bold py-5 rounded-2xl hover:bg-blue-700 transition">
              Add to Shopping Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}