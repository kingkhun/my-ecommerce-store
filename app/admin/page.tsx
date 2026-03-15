'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';


// 1. TYPES
interface Order {  id: string;  total_price: number;  status: string;  created_at: string;}

interface Product {  id: string;  name: string;  price: number;  image_url: string;  description: string;  stock_quantity: number;
  store_id?: string;
}



interface Store {  id: string;  name: string;  owner_id: string;  description?: string;  logo_url?: string;}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [myStoreId, setMyStoreId] = useState<string | null>(null); // Added this state
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const router = useRouter();
  
  // 1. Initial Auth & Store Check
  useEffect(() => {
    async function initializeDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // 1. Check Profile for Super Admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single();

      if (profile?.is_super_admin) {
          setIsAdmin(true);
          setIsSuperAdmin(true);
          setMyStoreId('GLOBAL'); 
          await Promise.all([fetchOrders('GLOBAL'), fetchProducts('GLOBAL')]);
          setLoading(false); // CRITICAL: Must set loading false before returning
          return;
      }

      // 2. If not Super Admin, check for Store Ownership
      const { data: store } = await supabase
        .from('stores').select('id').eq('owner_id', user.id).single();

      if (!store) {
        router.push('/setup-store');
      } else {
        setMyStoreId(store.id);
        setIsAdmin(true);
        await Promise.all([fetchOrders(store.id), fetchProducts(store.id)]);
      }
      setLoading(false);
    }
    initializeDashboard();
  }, [router]);

  async function fetchOrders(id: string) {
    let query = supabase.from('orders').select(`
      *,
      order_items (
        quantity,
        price_at_purchase,
        products (name, store_id)
      )
    `);

    if (id !== 'GLOBAL') {
      // Regular seller filter
      query = query.eq('order_items.products.store_id', id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) console.error(error);
    if (data) setOrders(data);
  }

async function fetchProducts(id: string) {
    let query = supabase.from('products').select('*');
    
    // If Super Admin, we want ALL products to calculate total inventory value
    if (id !== 'GLOBAL') {
      query = query.eq('store_id', id);
    }

    const { data } = await query.order('name');
    if (data) setProducts(data);
  }

  if (loading) return <div className="p-20 text-center">Loading Dashboard...</div>;

  //if (loading) return <div className="p-20 text-center">Verifying Store Access...</div>;
  if (!isAdmin) return null;

  // download as CSV
  const downloadCSV = () => {
    if (orders.length === 0) return;

    // 1. Define Headers
    const headers = ["Order ID", "Date", "Total Price", "Status", "Platform Fee (10%)", "Seller Net"];
    
    // 2. Map data to rows
    const rows = orders.map(o => [
      o.id,
      new Date(o.created_at).toLocaleDateString(),
      o.total_price,
      o.status,
      (o.total_price * 0.1).toFixed(2),
      (o.total_price * 0.9).toFixed(2)
    ]);

    // 3. Create CSV Content
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");

    // 4. Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `marketplace_sales_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                {isSuperAdmin ? "Super Admin Dashboard" : "Seller Dashboard"}
            </h1>
            <p className="text-gray-500 font-medium">
                {isSuperAdmin ? "Global Marketplace Overview" : "Manage your shop and track earnings."}
            </p>
          </div>

          {/* ONLY show download button to Super Admin */}
          {isSuperAdmin && (
            <button 
              onClick={downloadCSV}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition"
            >
              <span>📊</span> Download Sales CSV
            </button>
          )}
        </header>

        <DashboardStats orders={orders} products={products} isSuperAdmin={isSuperAdmin} />
        
        {/* Pass isSuperAdmin so the section knows whether to filter or not */}
        <OrderManagerSection storeId={myStoreId} isSuperAdmin={isSuperAdmin} />
        
        {/* Hide Product Manager for Super Admin if they don't have a shop */}
        {!isSuperAdmin && <ProductManagerSection storeId={myStoreId} />}
      </div>
    </div>
  );
}

function DashboardStats({ 
  orders, 
  products, 
  isSuperAdmin 
}: { 
  orders: Order[], 
  products: Product[], 
  isSuperAdmin: boolean // Add this line
}) {
  // 1. Calculate Total Revenue (only from Shipped/Delivered orders to be safe)
  const totalRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((acc, curr) => acc + curr.total_price, 0);

  // 2. Calculate Total Inventory Value (Price * Stock)
  const inventoryValue = products.reduce((acc, curr) => acc + (curr.price * curr.stock_quantity), 0);

  // 3. Low Stock Count
  const lowStockCount = products.filter(p => p.stock_quantity < 5).length;

  // 4. Calculate Total Laptops Sold (Sum of count of orders)
  //const totalSalesCount = orders.filter(o => o.status === 'delivered').length;

  // 5. Calculate Total Laptops Sold (Sum of count of orders)
  const totalSales = orders.filter(o => o.status === 'delivered').length;

  const totalGross = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((acc, curr) => acc + curr.total_price, 0);

  // Platform Fee Calculation (10%)
  const platformFee = totalGross * 0.10;
  const sellerNet = totalGross - platformFee;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Revenue</span>
        <div className="text-3xl font-black text-green-600 mt-1">${totalRevenue.toLocaleString()}</div>
        <p className="text-xs text-gray-500 mt-2">From {orders.length} orders</p>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Completed Sales</span>
        <div className="text-3xl font-black text-blue-600 mt-1">{totalSales}</div>
        <p className="text-xs text-gray-500 mt-2">Orders delivered successfully</p>
      </div>
      
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-2">Inventory Value</p>
        <h3 className="text-4xl font-black text-blue-600">${inventoryValue.toLocaleString()}</h3>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-2">Low Stock Alerts</p>
        <h3 className={`text-4xl font-black ${lowStockCount > 0 ? 'text-orange-500' : 'text-gray-300'}`}>
          {lowStockCount} Items
        </h3>
      </div>
      
      {/* Card 1: Gross Revenue */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          {isSuperAdmin ? "Global Gross Sales" : "Total Revenue"}
        </span>
        <div className="text-3xl font-black text-gray-900 mt-1">${totalGross.toLocaleString()}</div>
      </div>

      {/* Card 2: The 10% Platform Cut */}
      <div className="bg-blue-600 p-6 rounded-3xl shadow-lg transform scale-105">
        <span className="text-xs font-bold text-blue-200 uppercase tracking-widest">
          {isSuperAdmin ? "Platform Earnings (10%)" : "Platform Fee (10%)"}
        </span>
        <div className="text-3xl font-black text-white mt-1">${platformFee.toLocaleString()}</div>
        <p className="text-xs text-blue-100 mt-2">
          {isSuperAdmin ? "Total commission collected" : "Fee deducted from total"}
        </p>
      </div>

      {/* Card 3: Net Payout */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          {isSuperAdmin ? "Total Seller Payouts" : "Your Net Earnings"}
        </span>
        <div className="text-3xl font-black text-green-600 mt-1">${sellerNet.toLocaleString()}</div>
      </div>
      
    </div>
  );
}

// --- SUB-SECTION: ORDER MANAGER ---
function OrderManagerSection({ storeId, isSuperAdmin }: { storeId: string | null, isSuperAdmin: boolean }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => { 
    if (storeId) fetchOrders(); 
  }, [storeId]);
   
  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error("Update Error:", error.message);
      alert("Failed to update status: " + error.message);
    } else {
      // Refresh the local state so the UI stays correct after refresh
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      alert("Status updated to " + status);
    }
  }

  async function fetchOrders() {
    if (!storeId) return;

    let query;

    if (isSuperAdmin) {
      // Super Admin gets a clean list of all orders
      query = supabase
        .from('orders')
        .select('*') 
    } else {
      // Shop owner gets only their orders using the relationship
      query = supabase
        .from('orders')
        .select(`
          *,
          order_items!inner(
            product_id,
            products!inner(store_id)
          )
        `)
        .eq('order_items.products.store_id', storeId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch Error:", error.message);
    } else {
      // For Super Admin, we don't have nested order_items in this specific select, 
      // so we just set the data.
      setOrders(data as Order[]);
    }
  }

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
      <h2 className="text-2xl font-bold mb-6">
          {isSuperAdmin ? "Recent Orders (All Stores)" : "Your Store Orders"}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-gray-400 text-sm uppercase border-b">
            <tr>
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
                <td className="py-4 font-bold text-green-600">${order.total_price}</td>
                <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        {order.status.toUpperCase()}
                    </span>
                </td>
                <td className="py-4">
                  <select 
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className="border rounded p-1 text-sm outline-none bg-white"
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

