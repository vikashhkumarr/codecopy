/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, FormEvent } from 'react';
import { 
  Copy, ExternalLink, Check, Flame, Tag, Search, 
  Plus, X, Lock, Unlock, Key, LogOut, Trash2, Edit2, 
  ChevronRight, LayoutGrid, Filter, AlertCircle, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  db, auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, 
  serverTimestamp, Timestamp, handleFirestoreError, OperationType, User 
} from './firebase';

// Types
interface Deal {
  id: string;
  name: string;
  price: string;
  code: string;
  link: string;
  category: string;
  icon: string;
  description: string;
  createdAt: Timestamp;
  authorUid: string;
}

type Page = 'public' | 'login' | 'dashboard';

// Error Boundary Component
function ErrorBoundary({ error, onReset }: { error: string; onReset: () => void }) {
  let displayError = error;
  try {
    const parsed = JSON.parse(error);
    if (parsed.error) displayError = parsed.error;
  } catch (e) {
    // Not JSON
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-red-500/10 border border-red-500/20 rounded-3xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-red-400/80 text-sm mb-6">{displayError}</p>
        <button 
          onClick={onReset}
          className="px-6 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-400 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('public');
  const [user, setUser] = useState<User | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user && currentPage === 'login') {
        setCurrentPage('dashboard');
      }
    });
    return () => unsubscribe();
  }, [currentPage]);

  // Firestore Listener
  useEffect(() => {
    const q = query(collection(db, 'deals'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dealsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Deal[];
      setDeals(dealsData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'deals');
      setError(err.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(deals.map(d => d.category));
    return ['All', ...Array.from(cats)];
  }, [deals]);

  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const matchesSearch = deal.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           deal.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || deal.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [deals, searchQuery, selectedCategory]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setCurrentPage('dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentPage('public');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (error) return <ErrorBoundary error={error} onReset={() => setError(null)} />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-emerald-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setCurrentPage('public')}
          >
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
              <Flame className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="font-bold text-xl tracking-tight">DealsHub</span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setCurrentPage('dashboard')}
                  className={`text-sm font-medium transition-colors ${currentPage === 'dashboard' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setCurrentPage('login')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-all"
              >
                <Lock className="w-4 h-4" />
                Admin
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-zinc-500">
            <Loader2 className="w-12 h-12 animate-spin mb-4 text-emerald-500" />
            <p>Loading the best deals...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {currentPage === 'public' && (
              <PublicPage 
                deals={filteredDeals} 
                categories={categories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
            {currentPage === 'login' && <LoginPage onLogin={handleLogin} />}
            {currentPage === 'dashboard' && user && (
              <DashboardPage 
                deals={deals} 
                user={user} 
                onLogout={handleLogout} 
              />
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto text-center mt-12 pb-12 text-zinc-500 text-sm">
        <p>© {new Date().getFullYear()} DealsHub • Built with ✨ for the community</p>
      </footer>
    </div>
  );
}

// --- Pages ---

function PublicPage({ 
  deals, categories, selectedCategory, setSelectedCategory, searchQuery, setSearchQuery 
}: { 
  deals: Deal[]; categories: string[]; selectedCategory: string; setSelectedCategory: (c: string) => void; searchQuery: string; setSearchQuery: (s: string) => void;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-7xl mx-auto"
    >
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
          Save Big on Top Tools
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
          Handpicked referral links and exclusive coupon codes for developers, designers, and creators.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-12 space-y-6">
        <div className="relative max-w-2xl mx-auto group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
          <input
            type="text"
            placeholder="Search tools, services, or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all backdrop-blur-xl"
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {deals.map((deal, index) => (
            <DealCard key={deal.id} deal={deal} index={index} />
          ))}
        </AnimatePresence>
      </div>

      {deals.length === 0 && (
        <div className="text-center py-20 text-zinc-500">
          <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-xl">No deals found matching your search.</p>
        </div>
      )}
    </motion.div>
  );
}

function LoginPage({ onLogin }: { onLogin: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-md mx-auto py-20 text-center"
    >
      <div className="glass-card rounded-3xl p-12 border border-white/10">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-emerald-500/20">
          <Lock className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Admin Access</h2>
        <p className="text-zinc-400 mb-8">
          Please sign in with your admin account to manage deals and content.
        </p>
        <button 
          onClick={onLogin}
          className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-3"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Sign in with Google
        </button>
      </div>
    </motion.div>
  );
}

function DashboardPage({ deals, user, onLogout }: { deals: Deal[]; user: User; onLogout: () => void }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this deal?')) return;
    try {
      await deleteDoc(doc(db, 'deals', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `deals/${id}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto"
    >
      <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-zinc-400">Welcome back, {user.displayName || user.email}</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-5 h-5" />
          Add New Deal
        </button>
      </div>

      <div className="glass-card rounded-3xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Deal</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Category</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Code</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Created</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deals.map(deal => (
                <tr key={deal.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{deal.icon}</span>
                      <div>
                        <div className="font-bold">{deal.name}</div>
                        <div className="text-xs text-zinc-500">{deal.price}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-md bg-white/5 text-xs text-zinc-400 border border-white/5">
                      {deal.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-emerald-400 font-mono text-sm">{deal.code}</code>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">
                    {deal.createdAt?.toDate().toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setEditingDeal(deal)}
                        className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(deal.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {(showAddModal || editingDeal) && (
          <DealModal 
            deal={editingDeal} 
            onClose={() => { setShowAddModal(false); setEditingDeal(null); }} 
            user={user}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Components ---

function DealCard({ deal, index }: { deal: Deal; index: number; key?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deal.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="glass-card rounded-2xl p-6 flex flex-col h-full group relative overflow-hidden"
    >
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[80px] group-hover:bg-emerald-500/20 transition-colors duration-500" />
      
      <div className="flex items-start justify-between mb-4">
        <div className="text-4xl">{deal.icon}</div>
        <div className="flex flex-col items-end gap-2">
          <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            {deal.price}
          </div>
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
            {deal.category}
          </span>
        </div>
      </div>

      <h3 className="text-xl font-bold mb-2 group-hover:text-emerald-400 transition-colors">
        {deal.name}
      </h3>
      
      <p className="text-zinc-400 text-sm mb-6 flex-grow">
        {deal.description}
      </p>

      <div className="space-y-3">
        <div className="relative">
          <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 group-hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center">
              <Tag className="w-4 h-4 text-zinc-500 mr-2" />
              <code className="font-mono font-bold text-emerald-400 tracking-wider">
                {deal.code}
              </code>
            </div>
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors relative"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div key="check" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
                    <Check className="w-4 h-4 text-emerald-400" />
                  </motion.div>
                ) : (
                  <motion.div key="copy" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
                    <Copy className="w-4 h-4 text-zinc-400" />
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {copied && (
                  <motion.span
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: -30 }}
                    exit={{ opacity: 0 }}
                    className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-400 uppercase tracking-tighter"
                  >
                    Copied!
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        <a
          href={deal.link}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-center justify-center w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold transition-all duration-300 shadow-lg shadow-emerald-500/20 group/btn"
        >
          Get Deal
          <ExternalLink className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
        </a>
      </div>
    </motion.div>
  );
}

function DealModal({ deal, onClose, user }: { deal: Deal | null; onClose: () => void; user: User }) {
  const [formData, setFormData] = useState({
    name: deal?.name || '',
    price: deal?.price || '',
    category: deal?.category || 'Tools',
    code: deal?.code || '',
    link: deal?.link || '',
    icon: deal?.icon || '💰',
    description: deal?.description || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...formData,
        authorUid: user.uid,
        createdAt: deal ? deal.createdAt : serverTimestamp()
      };

      if (deal) {
        await updateDoc(doc(db, 'deals', deal.id), data);
      } else {
        await addDoc(collection(db, 'deals'), data);
      }
      onClose();
    } catch (err) {
      handleFirestoreError(err, deal ? OperationType.UPDATE : OperationType.CREATE, deal ? `deals/${deal.id}` : 'deals');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-lg bg-[#151515] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold flex items-center">
            {deal ? <Edit2 className="w-6 h-6 mr-2 text-emerald-400" /> : <Plus className="w-6 h-6 mr-2 text-emerald-400" />}
            {deal ? 'Edit Deal' : 'Add New Deal'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-6 h-6 text-zinc-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Tool Name</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Icon (Emoji)</label>
              <input required value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Price Display</label>
              <input required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50" placeholder="e.g. $20 OFF" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Category</label>
              <input required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50" placeholder="e.g. Hosting" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Coupon Code</label>
            <input required value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50 font-mono" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Referral Link</label>
            <input required type="url" value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Description</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50 h-20 resize-none" />
          </div>

          <button 
            type="submit" 
            disabled={saving}
            className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 mt-4 disabled:opacity-50"
          >
            {saving ? 'Saving...' : deal ? 'Update Deal' : 'Add Deal'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
