/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { 
  Copy, ExternalLink, Check, Flame, Tag, Search, Share2,
  Plus, X, Lock, Unlock, Key, LogOut, Trash2, Edit2, 
  ChevronRight, LayoutGrid, Filter, AlertCircle, Loader2, Settings, Folder
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  db, auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, 
  serverTimestamp, Timestamp, handleFirestoreError, OperationType, User, limit
} from './firebase';

// Types
// Constants
const ADMIN_EMAIL = 'socailmediaon@gmail.com';
const SUGGESTED_CATEGORIES = [
  'AI Tools',
  'Extensions',
  'Prompts',
  'Ebooks',
  'Software',
  'Hosting',
  'Design',
  'Marketing',
  'Courses'
];

interface Deal {
  id: string;
  name: string;
  price: string;
  code: string;
  link: string;
  category: string;
  icon: string;
  description: string;
  featured: boolean;
  createdAt: Timestamp;
  authorUid: string;
}

interface Category {
  id: string;
  name: string;
  icon?: string;
  createdAt: Timestamp;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // URL Listener for hidden admin access
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#admin') {
        setCurrentPage('login');
        // Clear hash so it doesn't stay in URL if they refresh
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        if (user.email === ADMIN_EMAIL) {
          setCurrentPage(prev => prev === 'login' ? 'dashboard' : prev);
        } else {
          signOut(auth);
          setError('Unauthorized: Only the real admin can access the dashboard.');
          setCurrentPage('public');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listeners
  useEffect(() => {
    // Limit initial fetch to 100 deals for performance
    const dealsQuery = query(collection(db, 'deals'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribeDeals = onSnapshot(dealsQuery, (snapshot) => {
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

    const categoriesQuery = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(categoriesData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'categories');
      setError(err.message);
      setLoading(false);
    });

    return () => {
      unsubscribeDeals();
      unsubscribeCategories();
    };
  }, []);

  const categoryOptions = useMemo(() => {
    return ['All', ...categories.map(c => c.name)];
  }, [categories]);

  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      const name = deal.name?.toLowerCase() || '';
      const description = deal.description?.toLowerCase() || '';
      const search = searchQuery.toLowerCase();
      
      const matchesSearch = name.includes(search) || description.includes(search);
      const matchesCategory = selectedCategory === 'All' || deal.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [deals, searchQuery, selectedCategory]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email === ADMIN_EMAIL) {
        setCurrentPage('dashboard');
      } else {
        await signOut(auth);
        setError('Unauthorized: Only the real admin can access the dashboard.');
        setCurrentPage('public');
      }
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
            {user && user.email === ADMIN_EMAIL && (
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
          <AnimatePresence>
            {currentPage === 'public' && (
              <PublicPage 
                deals={filteredDeals} 
                categories={categoryOptions}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
            {currentPage === 'login' && <LoginPage onLogin={handleLogin} />}
            {currentPage === 'dashboard' && user && user.email === ADMIN_EMAIL && (
              <DashboardPage 
                deals={deals} 
                user={user} 
                onLogout={handleLogout} 
                categories={categories}
                categoryOptions={categoryOptions}
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

const PublicPage = React.memo(({ 
  deals, categories, selectedCategory, setSelectedCategory, searchQuery, setSearchQuery 
}: { 
  deals: Deal[]; categories: string[]; selectedCategory: string; setSelectedCategory: (c: string) => void; searchQuery: string; setSearchQuery: (s: string) => void;
}) => {
  const featuredDeals = useMemo(() => deals.filter(d => d.featured), [deals]);
  const otherDeals = useMemo(() => deals.filter(d => !d.featured), [deals]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
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

      {/* Featured Section */}
      {featuredDeals.length > 0 && (
        <div className="mb-16">
          <div className="flex items-center gap-2 mb-8">
            <Flame className="w-6 h-6 text-emerald-400" />
            <h2 className="text-2xl font-bold uppercase tracking-widest text-emerald-400">Featured Deals</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {featuredDeals.map((deal, index) => (
                <DealCard key={deal.id} deal={deal} index={index} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Grid */}
      <div>
        {featuredDeals.length > 0 && otherDeals.length > 0 && (
          <div className="flex items-center gap-2 mb-8">
            <LayoutGrid className="w-6 h-6 text-zinc-500" />
            <h2 className="text-2xl font-bold uppercase tracking-widest text-zinc-500">All Deals</h2>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {otherDeals.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} index={index} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {deals.length === 0 && (
        <div className="text-center py-20 text-zinc-500">
          <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-xl">No deals found matching your search.</p>
        </div>
      )}
    </motion.div>
  );
});

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

function CategoryManager({ 
  categories, 
  onClose,
  deals 
}: { 
  categories: Category[]; 
  onClose: () => void;
  deals: Deal[];
}) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📁');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim(),
        icon: newCategoryIcon,
        createdAt: Timestamp.now()
      });
      setNewCategoryName('');
      setNewCategoryIcon('📁');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'categories');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !newCategoryName.trim()) return;
    setIsSubmitting(true);
    try {
      const oldName = editingCategory.name;
      const newName = newCategoryName.trim();
      
      // Update the category itself
      await updateDoc(doc(db, 'categories', editingCategory.id), {
        name: newName,
        icon: newCategoryIcon
      });

      // Update all deals with this category
      const dealsToUpdate = deals.filter(d => d.category === oldName);
      for (const deal of dealsToUpdate) {
        await updateDoc(doc(db, 'deals', deal.id), {
          category: newName
        });
      }

      setEditingCategory(null);
      setNewCategoryName('');
      setNewCategoryIcon('📁');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `categories/${editingCategory?.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    setDeletingCategory(null);
    const associatedDeals = deals.filter(d => d.category === category.name);
    
    try {
      // Move deals to General
      for (const deal of associatedDeals) {
        await updateDoc(doc(db, 'deals', deal.id), {
          category: 'General'
        });
      }

      // Ensure "General" category exists if we moved deals to it
      if (associatedDeals.length > 0 && !categories.find(c => c.name === 'General')) {
        await addDoc(collection(db, 'categories'), {
          name: 'General',
          icon: '📁',
          createdAt: Timestamp.now()
        });
      }

      await deleteDoc(doc(db, 'categories', category.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `categories/${category.id}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold">Manage Categories</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Form */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </h3>
            <form onSubmit={editingCategory ? handleUpdateCategory : handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Category Name</label>
                <input 
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. AI Tools"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Icon (Emoji)</label>
                <input 
                  type="text"
                  value={newCategoryIcon}
                  onChange={(e) => setNewCategoryIcon(e.target.value)}
                  placeholder="📁"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors text-2xl"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Update' : 'Add Category'}
                </button>
                {editingCategory && (
                  <button 
                    type="button"
                    onClick={() => {
                      setEditingCategory(null);
                      setNewCategoryName('');
                      setNewCategoryIcon('📁');
                    }}
                    className="px-4 py-3 bg-white/5 text-zinc-400 font-bold rounded-xl hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto pr-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">Existing Categories</h3>
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 group">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat.icon}</span>
                    <span className="font-medium">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingCategory(cat);
                        setNewCategoryName(cat.name);
                        setNewCategoryIcon(cat.icon || '📁');
                      }}
                      className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setDeletingCategory(cat)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Category Delete Confirmation */}
      <AnimatePresence>
        {deletingCategory && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <Folder className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Delete Category?</h3>
              <p className="text-zinc-400 mb-4 text-sm">
                Are you sure you want to delete "{deletingCategory.name}"?
              </p>
              {deals.filter(d => d.category === deletingCategory.name).length > 0 && (
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 mb-8 text-xs text-emerald-400/80">
                  Note: {deals.filter(d => d.category === deletingCategory.name).length} deals will be moved to "General".
                </div>
              )}
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingCategory(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-zinc-300 font-bold hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteCategory(deletingCategory)}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-400 transition-colors shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DashboardPage({ 
  deals, 
  user, 
  onLogout, 
  categories,
  categoryOptions 
}: { 
  deals: Deal[]; 
  user: User; 
  onLogout: () => void; 
  categories: Category[];
  categoryOptions: string[];
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (user.email !== ADMIN_EMAIL) return null;

  const handleDelete = async (id: string) => {
    setDeletingId(null);
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
        <div className="flex gap-3">
          <button 
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-300 font-bold hover:bg-white/10 transition-all"
          >
            <Settings className="w-5 h-5" />
            Manage Categories
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5" />
            Add New Deal
          </button>
        </div>
      </div>

      <div className="glass-card rounded-3xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Deal</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Category</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Featured</th>
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
                    {deal.featured ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold uppercase">
                        <Flame className="w-3 h-3" /> Featured
                      </span>
                    ) : (
                      <span className="text-zinc-600 text-xs uppercase">No</span>
                    )}
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
                        onClick={() => setDeletingId(deal.id)}
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

      {/* Custom Delete Confirmation */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Delete Deal?</h3>
              <p className="text-zinc-400 mb-8 text-sm">This action cannot be undone. Are you sure you want to remove this deal?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-zinc-300 font-bold hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(deletingId)}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-400 transition-colors shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(showAddModal || editingDeal) && (
          <DealModal 
            deal={editingDeal} 
            onClose={() => { setShowAddModal(false); setEditingDeal(null); }} 
            user={user}
            existingCategories={categoryOptions}
          />
        )}
        {showCategoryManager && (
          <CategoryManager 
            categories={categories} 
            onClose={() => setShowCategoryManager(false)}
            deals={deals}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Components ---

const DealCard = React.memo(({ deal, index }: { deal: Deal; index: number; key?: string }) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deal.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(deal.link);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch (err) {
      console.error('Failed to copy link: ', err);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ 
        scale: 1.02, 
        y: -5,
        transition: { duration: 0.2 }
      }}
      className={`glass-card rounded-2xl p-6 flex flex-col h-full group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 ${
        deal.featured ? 'border-emerald-500/50 bg-emerald-500/[0.03]' : ''
      }`}
    >
      {deal.featured && (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
      )}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[80px] group-hover:bg-emerald-500/20 transition-colors duration-500" />
      
      {deal.featured && (
        <div className="absolute top-0 right-0">
          <div className="bg-emerald-500 text-black text-[10px] font-black uppercase px-4 py-1 rotate-45 translate-x-4 translate-y-2 shadow-lg">
            Featured
          </div>
        </div>
      )}

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

        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="flex items-center justify-center p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative group/share"
            title="Share Deal Link"
          >
            <AnimatePresence mode="wait">
              {shared ? (
                <motion.div key="check" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
                  <Check className="w-4 h-4 text-emerald-400" />
                </motion.div>
              ) : (
                <motion.div key="share" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
                  <Share2 className="w-4 h-4" />
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {shared && (
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: -35 }}
                  exit={{ opacity: 0 }}
                  className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-400 uppercase tracking-tighter whitespace-nowrap"
                >
                  Link Copied!
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <motion.a
            href={deal.link}
            target="_blank"
            rel="noopener noreferrer nofollow"
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center flex-grow py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 group/btn"
          >
            Get Deal
            <ExternalLink className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
          </motion.a>
        </div>
      </div>
    </motion.div>
  );
});

function DealModal({ deal, onClose, user, existingCategories }: { deal: Deal | null; onClose: () => void; user: User; existingCategories: string[] }) {
  const [formData, setFormData] = useState({
    name: deal?.name || '',
    price: deal?.price || '',
    category: deal?.category || 'AI Tools',
    code: deal?.code || '',
    link: deal?.link || '',
    icon: deal?.icon || '💰',
    description: deal?.description || '',
    featured: deal?.featured || false
  });
  const [saving, setSaving] = useState(false);

  const allSuggestions = useMemo(() => {
    const combined = new Set([...SUGGESTED_CATEGORIES, ...existingCategories]);
    combined.delete('All');
    return Array.from(combined).sort();
  }, [existingCategories]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...formData,
        authorUid: user.uid,
        createdAt: deal ? deal.createdAt : Timestamp.now()
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
              <input 
                required 
                list="category-suggestions"
                value={formData.category} 
                onChange={e => setFormData({...formData, category: e.target.value})} 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50" 
                placeholder="e.g. AI Tools" 
              />
              <datalist id="category-suggestions">
                {allSuggestions.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
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

          <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
            <input 
              type="checkbox" 
              id="featured"
              checked={formData.featured} 
              onChange={e => setFormData({...formData, featured: e.target.checked})}
              className="w-5 h-5 rounded-lg accent-emerald-500"
            />
            <label htmlFor="featured" className="text-sm font-bold text-zinc-300 cursor-pointer flex items-center gap-2">
              <Flame className="w-4 h-4 text-emerald-400" />
              Mark as Featured Deal
            </label>
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
