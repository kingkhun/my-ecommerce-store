'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// 1. Define what a Product looks like
interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url?: string;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false); // Controls the Sidebar
  // 1. Calculate Total Price automatically
  const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);

  // 2. Fetch data from Supabase
  useEffect(() => {
    async function getProducts() {
      const { data, error } = await supabase.from('products').select('*');
      if (error) console.error('Error:', error);
      else setProducts(data || []);
      setLoading(false);
    }
    getProducts();
  }, []);

  // 3. Simple Add to Cart function
  //const addToCart = (product: Product) => {
    //setCart((prevCart) => [...prevCart, product]);
  //};

  const addToCart = (product: Product) => {
    setCart([...cart, product]);
    setIsCartOpen(true); // Open the cart automatically when adding
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1); // Removes the item at that specific position
    setCart(newCart);
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* NAVIGATION BAR */}
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">MyStore</h1>
          <button 
            onClick={() => setIsCartOpen(true)}
            className="relative bg-blue-100 px-4 py-2 rounded-full hover:bg-blue-200 transition flex items-center"
          >
            <span className="text-lg">🛒</span>
            <span className="ml-2 font-semibold text-blue-700">{cart.length} items</span>
          </button>
        </div>
      </nav>

      {/* CART SIDEBAR (Drawer) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Dark background overlay */}
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsCartOpen(false)} />
          
          {/* Sidebar Content */}
          <div className="relative w-full max-w-md bg-white h-full shadow-xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Your Cart</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-gray-500 text-2xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center mt-10">Your cart is empty.</p>
              ) : (
                cart.map((item, index) => (
                  <div key={index} className="flex justify-between items-center border-b py-4">
                    <div>
                      <h4 className="font-semibold">{item.name}</h4>
                      <p className="text-blue-600">${item.price}</p>
                    </div>
                    <button 
                      onClick={() => removeFromCart(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Checkout Section */}
            <div className="border-t pt-6 mt-4">
              <div className="flex justify-between text-xl font-bold mb-4">
                <span>Total:</span>
                <span>${totalPrice}</span>
              </div>
              <button className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition">
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT GRID */}
      <main className="max-w-6xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading products...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                {/* Placeholder for Product Image */}
                <div className="h-48 bg-gray-200 flex items-center justify-center text-gray-400">
                   Image Placeholder
                </div>
                
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-800">{product.name}</h3>
                    <span className="text-lg font-bold text-green-600">${product.price}</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-6 line-clamp-2">
                    {product.description || "No description available for this amazing product."}
                  </p>
                  
                  <button 
                    onClick={() => addToCart(product)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <span>Add to Cart</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {products.length === 0 && !loading && (
          <div className="text-center py-20">
            <p className="text-gray-500 italic">Your shop is empty. Add some products in your Supabase Dashboard!</p>
          </div>
        )}
      </main>
    </div>
  );
}