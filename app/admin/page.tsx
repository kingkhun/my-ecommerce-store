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

interface Store {
  id: string;
  name: string;
  owner_id: string;
  description?: string;
  logo_url?: string;
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [myStoreId, setMyStoreId] = useState<string | null>(null); // Added this state
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkVendorStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // We check if this specific user owns a store in the 'stores' table
      const { data: store, error } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (error || !store) {
        // No store found? Send them to create one!
        router.push('/setup-store');
      } else {
        // Store found! They are allowed in.
        setIsAdmin(true);
        setMyStoreId(store.id); 
      }
      setLoading(false);
    }
    
    checkVendorStatus();
  }, [router]);

  if (loading) return <div className="p-20 text-center">Verifying Store Access...</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">
        <h1 className="text-4xl font-black text-gray-900">Admin Control Center</h1>
        
        <OrderManagerSection storeId={myStoreId} />
        <ProductManagerSection storeId={myStoreId} />
      </div>
    </div>
  );
}

// --- SUB-SECTION: ORDER MANAGER ---
function OrderManagerSection({ storeId }: { storeId: string | null }) {
  const [orders, setOrders] = useState<Order[]>([]);

  //useEffect(() => { fetchOrders(); }, []);
  // Inside OrderManagerSection
  useEffect(() => { 
    if (storeId) {
      fetchOrders(); 
    }
  }, [storeId]); // <--- Add storeId as a dependency!
  {/* }
  async function fetchOrders() {
  // We need to join with order_items to find orders that contain THIS store's products
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, 
      total_price, 
      status, 
      created_at,
      order_items!inner(product_id, products!inner(store_id))
    `)
    .eq('order_items.products.store_id', storeId) // Filter for THIS shop only
    .order('created_at', { ascending: false });

  if (data) setOrders(data);
  */}  
  async function fetchOrders() {
    if (!storeId) return;

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items!inner(
          product_id,
          products!inner(store_id)
        )
      `)
      .eq('order_items.products.store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Order Fetch Error:", error.message);
      return;
    }
    
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
function ProductManagerSection({ storeId }: { storeId: string | null }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: '', price: '', stock_quantity: 0, description: '', image_url: '', store_id: '' });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  

  useEffect(() => { fetchProducts(); }, []);

  // Inside ProductManagerSection
async function fetchProducts() {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId) // ONLY get products for this shop!
    .order('name');
  if (data) setProducts(data);
  }  

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) {
      alert("Store ID missing. Please refresh.");
      return;
    }
    
    setUploading(true);
    let finalImageUrl = form.image_url;

    try {
      // 1. Image Upload Logic
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `laptops/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, selectedFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
        finalImageUrl = urlData.publicUrl;
      }

      // 2. Prepare Data (Clean and Explicit)
      const productData = { 
        name: form.name,
        description: form.description,
        price: parseFloat(form.price), 
        stock_quantity: form.stock_quantity,
        image_url: finalImageUrl,
        store_id: storeId // Use the storeId passed from the parent component
      };

      if (editingId) {
        const { error } = await supabase.from('products').update(productData).eq('id', editingId);
        if (error) throw error;
        alert("Product updated!");
      } else {
        const { error } = await supabase.from('products').insert([productData]);
        if (error) throw error;
        alert("Product added!");
      }

      // 3. SUCCESS HOUSEKEEPING
      setEditingId(null);
      setForm({ name: '', price: '', stock_quantity: 0, description: '', image_url: '', store_id: '' });
      setSelectedFile(null);
      fetchProducts(); // Refresh the list so the new item appears!

    } catch (err: any) {
      console.error("Save Error:", err);
      alert(err.message);
    } finally {
      setUploading(true); // Small tip: set to false to re-enable button
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

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
      <h2 className="text-2xl font-bold mb-2">Inventory Management</h2>
      <p className="text-gray-500 mb-6 text-sm">{editingId ? "Currently Editing a Product" : "Add a New Laptop"}</p>
      
      {!storeId ? (
        <div className="p-10 text-center bg-gray-50 rounded-2xl">Loading Store Data...</div>
      ) : (
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-gray-50 p-6 rounded-2xl">
          <input type="text" placeholder="Laptop Name" className="p-3 border rounded-xl" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <input type="number" placeholder="Price ($)" className="p-3 border rounded-xl" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
          <input type="number" placeholder="Stock Amount" className="p-3 border rounded-xl" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: parseInt(e.target.value) || 0})} required />
          
          {/* RECOMMENDED: Add Category field so it shows up in your 'Gaming/Business' filters */}
          <select 
            className="p-3 border rounded-xl bg-white"
            value={(form as any).category || 'Business'} 
            onChange={e => setForm({...form, [ 'category' as any]: e.target.value})}
          >
            <option value="Gaming">Gaming</option>
            <option value="Business">Business</option>
            <option value="UltraBook">UltraBook</option>
          </select>

          <textarea 
            placeholder="Description" 
            className="p-3 border rounded-xl md:col-span-2" 
            value={form.description} 
            onChange={e => setForm({...form, description: e.target.value})} 
            required 
          />

          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-600 mb-2">Product Photo</label>
            <input type="file" accept="image/*" className="w-full p-2 border border-dashed border-blue-300 rounded-xl bg-white"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
          </div>

          <div className="md:col-span-2 flex gap-2">
            <button type="submit" disabled={uploading} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-gray-400">
              {uploading ? 'Uploading...' : editingId ? 'Save Changes' : 'List Laptop for Sale'}
            </button>
            
            {editingId && (
              <button type="button" onClick={() => {setEditingId(null); setForm({ name: '', price: '', stock_quantity: 0, description: '', image_url: '', store_id: '' });}} className="px-8 bg-gray-200 text-gray-700 py-4 rounded-xl font-bold">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {/* Product List below remains the same but ensure fetchProducts is called */}
      
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

