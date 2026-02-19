'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  const [cart, setCart] = useState<CartItem[]>([]); // SHOPPING CART
  const [isCartOpen, setIsCartOpen] = useState(false); // CART SIDEBAR VISIBILITY
  const [mounted, setMounted] = useState(false); // TO CHECK IF COMPONENT IS MOUNTED
  const [searchQuery, setSearchQuery] = useState(''); // SEARCH QUERY
  const [activeCategory, setActiveCategory] = useState('All'); // ACTIVE CATEGORY FILTER
  const [showSuccess, setShowSuccess] = useState(false); // ORDER SUCCESS MESSAGE
  const [lastOrderId, setLastOrderId] = useState<string | null>(null); // LAST ORDER ID
  const router = useRouter();
  // INITIAL LOAD
  useEffect(() => {
    setMounted(true);
    const savedCart = localStorage.getItem('my_ecommerce_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to parse cart", e);
      }
    }
    // FETCH PRODUCTS FROM SUPABASE
    async function getProducts() {
      const { data, error } = await supabase.from('products').select(`
      *, stores (name) `);
      if (error) console.error("Supabase Error:", error.message);
      if (data) setProducts(data);
    }
    getProducts();
  }, []);
  // SYNC CART TO LOCALSTORAGE
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('my_ecommerce_cart', JSON.stringify(cart));
    }
  }, [cart, mounted]);

  
  // TOTAL PRICE CALCULATION
  const totalPrice = cart.reduce((sum, item) => sum + item.price * (item.SoldQuantity ?? 1), 0);
  // ADD TO CART
  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      
      if (existingItem) {
        // SAFETY: Check if they are trying to buy more than we have
        if ((existingItem.SoldQuantity ?? 0) + 1 > product.stock_quantity) {
          alert(`Only ${product.stock_quantity} units available in stock!`);
          return prevCart;
        }

        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, SoldQuantity: (item.SoldQuantity ?? 0) + 1 }
            : item
        );
      } else {
        return [...prevCart, { ...product, SoldQuantity: 1 }];
      }
    });
    setIsCartOpen(true);
      
  };
  // REMOVE FROM CART BY INDEX
  const removeFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index); // A cleaner way to remove by index
    setCart(newCart);
  };

  // USER AUTH STATE
  const [user, setUser] = useState<any>(null);
  // AUTH STATE LISTENER
  useEffect(() => {
    // Check current user session
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    // Listen for login/logout changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);


  // CATEGORIES
  const categories = ['All', 'Gaming', 'Business', 'UltraBook'];
  // FILTERED PRODUCTS BASED ON SEARCH AND CATEGORY
  const filteredProducts = products.filter((product) => {
  const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
  const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
  return matchesSearch && matchesCategory;
  });


  const handleCheckout = async () => {
    if (cart.length === 0) return alert("Your cart is empty!");

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert("Please login to place an order!");
        router.push('/login');
        return;
      }

      // 1. Profile Verification
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        await supabase.from('profiles').insert([{ id: user.id, full_name: user.email }]);
      }

      // 2. Insert Order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{ 
          user_id: user.id, 
          total_price: totalPrice, 
          status: 'pending' 
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 3. Prepare and Insert Order Items
      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.id,
        quantity: item.SoldQuantity ?? 1, 
        price_at_purchase: item.price
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // 4. DEDUCT STOCK
      for (const item of cart) {
        // 1. Get the latest stock directly from the database to be safe
        const { data: currentProduct } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.id)
          .single();

        if (currentProduct) {
          const amountBought = item.SoldQuantity || 1;
          const newStockLevel = currentProduct.stock_quantity - amountBought;

          // 2. Update with the calculated number
          const { error: stockError } = await supabase
            .from('products')
            .update({ stock_quantity: newStockLevel })
            .eq('id', item.id);
            
          if (stockError) {
            console.error(`Error updating ${item.name}:`, stockError.message);
          } else {
            console.log(`Successfully updated ${item.name} to ${newStockLevel}`);
          }
        }
      }
      // 5. Success UI
      setLastOrderId(orderData.id); 
      setShowSuccess(true);         
      setCart([]);                  
      setIsCartOpen(false);         
      localStorage.removeItem('my_ecommerce_cart');
      // Refresh product list so the UI shows the new stock counts immediately
      const { data: refreshedProducts } = await supabase.from('products').select('*');
      if (refreshedProducts) setProducts(refreshedProducts);

    } catch (error: any) {
      console.error("Checkout failed:", error.message);
      alert("Something went wrong with your order.");    
    }
  };

  // RENDER
  return (
    // MAIN CONTAINER
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Geek's store</h1>
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
              
              {/* 1. Wrap the Image and Info in a Link */}
              <Link href={`/product/${product.id}`} className="flex-1 flex flex-col group">
                
                {/* Inside your product mapping */}
                  
                {/* IMAGE SECTION */}
                <div className="h-56 w-full relative bg-gray-100 overflow-hidden">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 italic">No image found</div>
                  )}
                </div>
                <div className="flex flex-col">
                    {product.stores && (
                      <span className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-1">
                        📍 Sold by: {product.stores.name}
                      </span>
                    )}
                    
                  </div>
                
                
                {/* TEXT CONTENT */}
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-md font-bold ${
                      product.stock_quantity > 0 ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-600'
                    }`
                    }>
                      {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of Stock'}
                    </span>
                    <span className="text-green-600 font-bold text-lg">${product.price}</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-6 leading-relaxed line-clamp-2">
                    {product.description}
                  </p>
                </div>
              </Link>

              {/* 2. Keep the Button OUTSIDE the Link */}
              <div className="px-6 pb-6">
                <button 
                  disabled={product.stock_quantity <= 0}
                  onClick={() => addToCart(product)}
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition active:scale-95"
                >
                  Add to Cart
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
            <p className="text-gray-300">✉️ Email: support@laptopstore.com</p>
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