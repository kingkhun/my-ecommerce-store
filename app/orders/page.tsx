// This is the page where users can view their past orders and click on them to see details. It uses a modal to show the items in each order without navigating away from the list.
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

interface Order {
  id: string;
  total_price: number;
  status: string;
  created_at: string;
}

// 1. Add these interfaces
interface OrderItem {
  id: string;
  quantity: number;
  price_at_purchase: number;
  products: {
    name: string;
    image_url: string;
  };
}

// 2. Add these states inside the component

export default function MyOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);


  useEffect(() => {
    async function fetchOrders() {
      // 1. Get the current user
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // 2. Fetch only orders belonging to this user
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }); // Newest first

        if (data) setOrders(data);
      }
      setLoading(false);
    }
    fetchOrders();
    }, []);
    const viewOrderDetails = async (orderId: string) => {
    setIsModalOpen(true);
    setSelectedOrderItems([]); 

    const { data, error } = await supabase
        .from('order_items')
        .select(`
        id,
        quantity,
        price_at_purchase,
        products (
            name,
            image_url
        )
        `)
        .eq('order_id', orderId);

    if (error) {
        console.error("Supabase Error:", error.message); // Look at your browser console!
    } else {
        console.log("Fetched Items:", data);
        setSelectedOrderItems(data as any);
    }
    };

  if (loading) return <div className="p-20 text-center">Loading your history...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-600 hover:underline mb-6 inline-block">← Back to Store</Link>
        <h1 className="text-3xl font-bold mb-8">My Order History</h1>

        {/* 1. ORDER LIST SECTION (Always visible if orders exist) */}
        {orders.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl shadow-sm">
            <p className="text-gray-500">You haven't placed any orders yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div 
                key={order.id} 
                onClick={() => viewOrderDetails(order.id)}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:border-blue-300 transition"
              >
                <div>
                  <p className="text-sm text-gray-400 font-mono">Order #{order.id.slice(0, 8)}</p>
                  <p className="text-lg font-bold text-gray-800">${order.total_price}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <span className={`px-4 py-1 rounded-full text-xs font-bold tracking-widest ${
                    order.status === 'pending' 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {order.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-blue-600 font-semibold underline">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. MODAL SECTION (Only appears when isModalOpen is true) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Order Items</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black text-2xl">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 pr-2">
              {/* Check if we are actually waiting for data or if it came back empty */}
                {selectedOrderItems === null ? (
                    <p className="text-center py-10 italic text-gray-400">Loading items...</p>
                ) : selectedOrderItems.length === 0 ? (
                    <p className="text-center py-10 text-gray-500">No items found for this order.</p>
                ) : (
                    <div className="space-y-4">
                  {selectedOrderItems.map((item) => (
                    <div key={item.id} className="flex gap-4 items-center bg-gray-50 p-4 rounded-xl">
                      <img 
                        src={item.products?.image_url} 
                        alt={item.products?.name} 
                        className="w-16 h-16 object-cover rounded-lg bg-gray-200" 
                      />
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 leading-tight">{item.products?.name || "Product Info Unavailable"}</p>
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-bold text-blue-600">${item.price_at_purchase}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsModalOpen(false)}
              className="mt-6 w-full bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-black transition"
            >
              Close
            </button>
          </div>
        </div>
        )}
      </div>
    );
  }