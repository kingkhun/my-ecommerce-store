'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function StoreSetup() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCreateStore(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // 1. Get the current logged-in user's ID
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("Please login first!");
      router.push('/login');
      return;
    }

    // 2. Insert the new store linked to this user
    const { error } = await supabase.from('stores').insert([
      { 
        name, 
        description, 
        owner_id: user.id 
      }
    ]);

    if (error) {
      alert(error.message);
    } else {
      alert("Store created successfully!");
      router.push('/admin'); // Send them to their dashboard
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <h1 className="text-3xl font-black mb-2">Open Your Shop</h1>
        <p className="text-gray-500 mb-8">Give your store a name and start selling laptops today.</p>

        <form onSubmit={handleCreateStore} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1 text-gray-700">Store Name</label>
            <input 
              type="text" 
              className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Yangon Tech Hub"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1 text-gray-700">Description</label>
            <textarea 
              className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What do you specialize in?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all disabled:bg-gray-400"
          >
            {loading ? 'Creating Store...' : 'Launch My Store'}
          </button>
        </form>
      </div>
    </div>
  );
}