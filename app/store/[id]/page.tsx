'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams } from 'next/navigation';
import { useCart} from '@/app/context/CartContext';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
  description: string;
}

interface Store {
  name: string;
  description: string;
}

export default function StoreFront() {
  const { id } = useParams(); // Get the store ID from the URL
  const [products, setProducts] = useState<Product[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  const handleAddToCart = (product: Product) => {
    // Make sure the object matches what your cart expects
    addToCart({
      ...product,
      SoldQuantity: 1 // Adding the required TS field we talked about earlier
    });
    alert(`${product.name} added to cart!`);
  };


  useEffect(() => {
    async function loadStoreData() {
      if (!id) return;

      // 1. Fetch Store Details
      const { data: storeData } = await supabase
        .from('stores')
        .select('name, description')
        .eq('id', id)
        .single();

      // 2. Fetch only products belonging to THIS store
      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', id);

      if (storeData) setStore(storeData);
      if (productData) setProducts(productData);
      setLoading(false);
    }

    loadStoreData();
    }, [id]);

    if (loading) {
        return <div className="p-20 text-center">Loading Store...</div>;
    }

    if (!store) {
        return <div className="p-20 text-center">Store not found.</div>;
    }

  //method of handleAddToCart



  return (
    <div className="min-h-screen bg-white">
      {/* Store Header */}
      <div className="bg-gray-900 text-white py-16 px-6 text-center">
            <h1 className="text-5xl font-black mb-4">{store.name}</h1>
            <p className="text-gray-400 max-w-2xl mx-auto">{store.description}</p>
        </div>

        {/* Product Grid */}
        <div className="max-w-6xl mx-auto p-8">
            <h2 className="text-2xl font-bold mb-8">Available Laptops</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {products.map((product) => (
                <div key={product.id} className="group border rounded-2xl overflow-hidden hover:shadow-xl transition">
                <img src={product.image_url} alt={product.name} className="w-full h-48 object-cover" />
                <div className="p-4">
                    <h3 className="font-bold text-lg">{product.name}</h3>
                    <p className="text-gray-500 text-sm mb-4 line-clamp-2">{product.description}</p>
                    <div className="flex justify-between items-center">
                    <span className="text-xl font-black">${product.price}</span>
                    <button 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevents clicking the card background
                      handleAddToCart(product);
                    }}
                    className="bg-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
                  >
                    Add to Cart
                  </button>
                    </div>
                </div>
                </div>
            ))}
            </div>
            
            {products.length === 0 && (
            <p className="text-center text-gray-400 mt-10">This store hasn't added any laptops yet.</p>
          )}
      </div>
    </div>
  );
        
}