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
  stock_quantity: number;
  store_id?: string;
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
  const [form, setForm] = useState({ name: '', price: '', stock_quantity: 0, description: '', image_url: '', store_id: '' });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  }

  async function handleAdd(e: React.FormEvent) {

    e.preventDefault();
    setUploading(true);
    let publicUrl = '';

      try {
        if (selectedFile) {
          // 1. Upload file to Supabase Storage
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `laptops/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, selectedFile);

          if (uploadError) throw uploadError;

          // 2. Get the Public URL
          const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);
          
          publicUrl = urlData.publicUrl;
        }

        // 3. Save Product to Database
        const { error } = await supabase.from('products').insert([
          { ...form, price: parseFloat(form.price), image_url: publicUrl }
        ]);

        if (!error) {
          setForm({ name: '', price: '', stock_quantity: 0, description: '', image_url: '', store_id: '' });
          setSelectedFile(null);
          fetchProducts();
        }
      } catch (err: any) {
        alert(err.message);
      } finally {
        setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (confirm("Delete this product?")) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (!error) fetchProducts();
    }
  }

  // NEW: Load product data into the form to start editing
  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      price: product.price.toString(),
      stock_quantity: product.stock_quantity,
      description: product.description,
      image_url: product.image_url,
      store_id: product.store_id || '',
    });
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    let finalImageUrl = form.image_url;

    try {
      // 1. Handle Image Upload only if a new file is selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `laptops/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, selectedFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
        finalImageUrl = urlData.publicUrl;
      }

      const productData = { 
        ...form, 
        price: parseFloat(form.price), 
        image_url: finalImageUrl 
      };

      if (editingId) {
        // UPDATE EXISTING
        const { error } = await supabase.from('products').update(productData).eq('id', editingId);
        if (error) throw error;
      } else {
        // INSERT NEW
        const { error } = await supabase.from('products').insert([productData]);
        if (error) throw error;
      }

      // Reset everything
      setForm({ name: '', price: '', stock_quantity: 0, description: '', image_url: '', store_id: '' });
      setSelectedFile(null);
      setEditingId(null);
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
      <h2 className="text-2xl font-bold mb-2">Inventory Management</h2>
      <p className="text-gray-500 mb-6 text-sm">{editingId ? "Currently Editing a Product" : "Add a New Laptop"}</p>
      
      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-gray-50 p-6 rounded-2xl">
        <input type="text" placeholder="Name" className="p-2 border rounded" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
        <input type="number" placeholder="Price" className="p-2 border rounded" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
        <input type="number" placeholder="Stock Quantity" className="p-2 border rounded" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: parseInt(e.target.value) || 0})} required />
        <input type="text" placeholder="Description" className="p-2 border rounded" value={form.description} onChange={e => setForm({...form, description: e.target.value})} required />
        

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-500 mb-1">Laptop Photo (Leave empty to keep current)</label>
          <input type="file" accept="image/*" className="w-full p-2 border border-dashed rounded-xl bg-white"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
        </div>

        <div className="md:col-span-2 flex gap-2">
           <button type="submit" disabled={uploading} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold disabled:bg-gray-400">
            {uploading ? 'Processing...' : editingId ? 'Update Product' : 'Add Laptop with Photo'}
          </button>
          
          {editingId && (
            <button type="button" onClick={() => {setEditingId(null); setForm({ name: '', price: '', stock_quantity: 0, description: '', image_url: '', store_id: '' });}} className="px-6 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-4">
        {products.map(p => (
          <div key={p.id} className="flex justify-between items-center p-3 bg-white border rounded-xl hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <img src={p.image_url} className="w-12 h-12 object-cover rounded-lg" alt="" />
              <div>
                <p className="font-bold text-gray-800">{p.name}</p>
                <p className="text-sm text-blue-600">${p.price} • {p.stock_quantity} in stock</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => startEdit(p)} className="text-blue-500 font-medium hover:underline text-sm">Edit</button>
              <button onClick={() => handleDelete(p.id)} className="text-red-500 font-medium hover:underline text-sm">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

