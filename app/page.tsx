'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart} from '@/app/context/CartContext';

interface Store {
  id: string;
  name: string;
  owner_id: string;
  description?: string;
  logo_url?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  category: string; 
  stock_quantity: number;
  store_id: string; // NEW FIELD
  stores?: Store;   // For when we join tables in a query
}

interface CartItem extends Product {
  SoldQuantity: number;
  }


// MAIN COMPONENT
export default function Home() {
  // STATE VARIABLES
  const [products, setProducts] = useState<Product[]>([]); // ALL PRODUCTS FROM SUPABASE
  //const [cart, setCart] = useState<CartItem[]>([]); // SHOPPING CART
  const [isCartOpen, setIsCartOpen] = useState(false); // CART SIDEBAR VISIBILITY
  const [mounted, setMounted] = useState(false); // TO CHECK IF COMPONENT IS MOUNTED
  const [searchQuery, setSearchQuery] = useState(''); // SEARCH QUERY
  const [activeCategory, setActiveCategory] = useState('All'); // ACTIVE CATEGORY FILTER
  const [showSuccess, setShowSuccess] = useState(false); // ORDER SUCCESS MESSAGE
  const [lastOrderId, setLastOrderId] = useState<string | null>(null); // LAST ORDER ID
  const router = useRouter();
  const { cart, addToCart, removeFromCart, totalPrice, clearCart } = useCart();
  const [user, setUser] = useState<any>(null);
  // INITIAL LOAD
  useEffect(() => {
    setMounted(true);
    // FETCH PRODUCTS
    async function getProducts() {
      const { data, error } = await supabase.from('products').select(`*, stores (name)`);
      if (error) console.error("Supabase Error:", error.message);
      if (data) setProducts(data);
    }
    getProducts();

    // AUTH LISTENER
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const categories = ['All', 'Gaming', 'Business', 'UltraBook'];
  
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Updated handleCheckout using clearCart()
  const handleCheckout = async () => {
    if (cart.length === 0) return alert("Your cart is empty!");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Please login to place an order!");
        router.push('/login');
        return;
      }

      // 1. Profile check
      const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single();
      if (!profile) await supabase.from('profiles').insert([{ id: user.id, full_name: user.email }]);

      // 2. Create Order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{ user_id: user.id, total_price: totalPrice, status: 'pending' }])
        .select().single();
      if (orderError) throw orderError;

      // 3. Insert Items
      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.id,
        quantity: item.SoldQuantity ?? 1, 
        price_at_purchase: item.price
      }));
      await supabase.from('order_items').insert(orderItems);

      // 4. Update Stock
      for (const item of cart) {
        const { data: cur } = await supabase.from('products').select('stock_quantity').eq('id', item.id).single();
        if (cur) {
          await supabase.from('products').update({ stock_quantity: cur.stock_quantity - (item.SoldQuantity || 1) }).eq('id', item.id);
        }
      }

      // SUCCESS
      setLastOrderId(orderData.id); 
      setShowSuccess(true);
      clearCart(); // <--- THIS CLEARS CONTEXT
      setIsCartOpen(false);
      
      const { data: refresh } = await supabase.from('products').select('*');
      if (refresh) setProducts(refresh);
    } catch (e: any) {
      alert("Checkout failed: " + e.message);
    }
  };

  // RENDER
  return (
    // MAIN CONTAINER
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Yoe-Yar store</h1>
          <h6 className="text-gray-600 italic">Built with TypeScript + Supabase + Next.js</h6>
          {user ? (
            <div className="flex items-center gap-4">
              <Link href="/orders" className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                My Orders
              </Link>
              <span className="text-sm text-gray-600">Hi, {user.email}</span>
              <button onClick={() => supabase.auth.signOut()} className="text-sm text-red-500">Logout</button>
            </div>
          ) : (
            <Link href="/login">Login</Link>
          )}
          
          <button 
            onClick={() => setIsCartOpen(true)}
            className="bg-blue-600 text-white px-5 py-2 rounded-full font-bold hover:bg-blue-700 transition flex items-center gap-2"
          >
            <span>🛒</span>
            <span>{mounted ? cart.length : 0} items</span>
          </button>
        </div>
      </nav>
      
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-2xl font-bold">Your Cart</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-3xl text-gray-400 hover:text-black">×</button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center mt-20">Your cart is empty.</p>
              ) : (
                cart.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="flex justify-between items-center py-4 border-b">
                    <div className="flex gap-4 items-center">
                      <img src={item.image_url} alt="" className="w-12 h-12 rounded object-cover bg-gray-100" />
                      <div>
                        <h4 className="font-semibold text-gray-800">{item.name}</h4>
                        <p className="text-blue-600 font-bold">${item.price}</p>
                        <p className="text-xs text-gray-500">Qty: {item.SoldQuantity ?? 1}</p>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(index)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t pt-6">
              <div className="flex justify-between text-2xl font-bold mb-6">
                <span>Total</span>
                <span>${totalPrice}</span>
              </div>
              <button 
                onClick={handleCheckout}
                className="w-full bg-green-600 text-white text-lg font-bold py-4 rounded-xl hover:bg-green-700 transition active:scale-95"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="max-w-6xl mx-auto px-8 mt-8">
        <div className="relative">
          <span className="absolute left-4 top-3.5 text-gray-400">🔍</span>
          <input
            type="text"
            spellCheck="false"
            autoComplete="off"
            placeholder="Search for laptops (e.g. HP, Lenovo)..."
            className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>
      {/* CATEGORY FILTER */}
      <section className="max-w-6xl mx-auto px-8 mt-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-2 rounded-full font-medium transition whitespace-nowrap ${
              activeCategory === cat 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </section>


      <main className="max-w-6xl mx-auto p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">
          {searchQuery ? `Results for "${searchQuery}"` : "Featured Gear"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition flex flex-col">
            
            {/* Top Part is a Link to Details */}
            <Link href={`/product/${product.id}`} className="group flex-1">
              <div className="h-56 w-full relative bg-gray-100 overflow-hidden">
                <img 
                  src={product.image_url} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                />
              </div>
              
              <div className="p-6">
                {product.stores && (
                  <span className="text-xs font-semibold text-orange-500 uppercase tracking-wider block mb-2">
                    💥 Sold by: {product.stores.name}
                  </span>
                )}
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {product.name}
                  </h3>
                  <span className="text-green-600 font-bold text-lg">${product.price}</span>
                </div>
                <p className="text-gray-500 text-sm line-clamp-2 mb-4">{product.description}</p>
              </div>
            </Link>

            {/* Bottom Part (Store Link & Button) is SEPARATE from the detail link */}
            <div className="px-6 pb-6 mt-auto">
              <div className="mb-4">
                <Link 
                  href={`/store/${product.store_id}`} 
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Visit Seller Store →
                </Link>
                {/* --- STOCK INDICATOR START --- */}
                <div className="flex items-center gap-1.5">
                  {product.stock_quantity > 0 ? (
                    <>
                      <span className={`w-2 h-2 rounded-full ${product.stock_quantity < 5 ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></span>
                      <span className={`text-xs font-bold ${product.stock_quantity < 5 ? 'text-orange-600' : 'text-gray-600'}`}>
                        {product.stock_quantity} in stock
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      Out of Stock
                    </span>
                  )}
                </div>
                {/* --- STOCK INDICATOR END --- */}
              </div>
              <button 
                disabled={product.stock_quantity <= 0}
                onClick={() => addToCart(product)}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition active:scale-95 disabled:bg-gray-300"
              >
                {product.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
              </button>
            </div>
          </div>
        ))}
      </div>
        
        {filteredProducts.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-xl italic">Oops! No {activeCategory !== 'All' ? activeCategory : ''} laptops found matching "{searchQuery}"</p>
          <button 
            onClick={() => {setSearchQuery(''); setActiveCategory('All');}}
            className="mt-4 text-blue-600 underline"
          >
            Clear all filters
          </button>
        </div>
        )}
      </main>
      {/* SUCCESS MODAL */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-blue-900/20 backdrop-blur-sm" onClick={() => setShowSuccess(false)} />
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center transform animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
              ✓
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Order Placed!</h2>
            <p className="text-gray-500 mb-6">
              Thank you for your purchase. Your order <span className="font-mono font-bold text-blue-600">#{lastOrderId?.slice(0, 8)}</span> is being processed.
            </p>
            
            <button 
              onClick={() => setShowSuccess(false)}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
    <div className="mt-12">
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-6xl mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-xl font-bold mb-4">Contact Us</h3>
                <p className="text-gray-300">📞 Phone: +1 (555) 123-4567</p>
                <p className="text-gray-300">✉️ Email: hdcs@sum.com</p>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-4">Follow Us</h3>
                <div className="flex space-x-4">
                  <a href="#" className="text-gray-300 hover:text-white transition">Facebook</a>
                  <a href="#" className="text-gray-300 hover:text-white transition">Twitter</a>
                  <a href="#" className="text-gray-300 hover:text-white transition">Instagram</a>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-4">Newsletter</h3>
                <p className="text-gray-300 mb-2">Subscribe for updates and offers!</p>
                {/* Simple newsletter form */}
                <input type="email" placeholder="Your email" className="w-full p-2 rounded text-black mb-2" />
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Subscribe</button>
              </div>
            </div>
            <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
              &copy; {new Date().getFullYear()} Laptop Store. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </div>
     
  );
}