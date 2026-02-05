'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

// 1. TYPES
interface Order {
  id: string;
  total_price: number;
  status: string;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
  description: string;
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const ADMIN_EMAIL = "maungbamar55@gmail.com"; // CHANGE THIS

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.email !== ADMIN_EMAIL) {
        router.push('/');
      } else {
        setIsAdmin(true);
      }
      setLoading(false);
    }
    checkUser();
  }, [router]);

  if (loading) return <div className="p-20 text-center text-xl font-bold">Verifying Admin Status...</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">
        <h1 className="text-4xl font-black text-gray-900">Admin Control Center</h1>
        
        {/* We call our two sections here */}
        <OrderManagerSection />
        <ProductManagerSection />
      </div>
    </div>
  );
}

// --- SUB-SECTION: ORDER MANAGER ---
function OrderManagerSection() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (!error) setOrders(orders.map(o => o.id === id ? { ...o, status } : o));
  }

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
      <h2 className="text-2xl font-bold mb-6">Global Orders</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-gray-400 text-sm uppercase border-b">
              <th className="pb-4">Order ID</th>
              <th className="pb-4">Total</th>
              <th className="pb-4">Status</th>
              <th className="pb-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map(order => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="py-4 font-mono text-xs">{order.id.slice(0,8)}...</td>
                <td className="py-4 font-bold">${order.total_price}</td>
                <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        {order.status.toUpperCase()}
                    </span>
                </td>
                <td className="py-4">
                  <select 
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className="border rounded p-1 text-sm outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancel Order</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- SUB-SECTION: PRODUCT MANAGER ---
function ProductManagerSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: '', price: '', image_url: '', description: '' });

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('products').insert([{ ...form, price: parseFloat(form.price) }]);
    if (!error) {
      setForm({ name: '', price: '', image_url: '', description: '' });
      fetchProducts();
    }
  }

  async function handleDelete(id: string) {
    if (confirm("Delete this product?")) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (!error) fetchProducts();
    }
  }

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
      <h2 className="text-2xl font-bold mb-6">Inventory Management</h2>
      <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <input type="text" placeholder="Name" className="p-2 border rounded" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
        <input type="number" placeholder="Price" className="p-2 border rounded" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
        <input type="text" placeholder="Image URL" className="p-2 border rounded md:col-span-2" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} required />
        <button type="submit" className="md:col-span-2 bg-black text-white py-3 rounded-xl font-bold">Add Laptop</button>
      </form>

      <div className="grid gap-4">
        {products.map(p => (
          <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              <img src={p.image_url} className="w-10 h-10 object-cover rounded" alt="" />
              <p className="font-semibold">{p.name} - ${p.price}</p>
            </div>
            <button onClick={() => handleDelete(p.id)} className="text-red-500 text-sm">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}