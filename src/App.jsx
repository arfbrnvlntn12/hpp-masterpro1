import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Plus, Trash2, Calculator, TrendingUp, Target,
  Save, FileText, LayoutDashboard, Database, X,
  Loader2, LogOut, Sun, Moon, ChevronDown, Package,
  DollarSign, Percent, ShoppingCart, AlertCircle, CheckCircle,
  Printer, ToggleLeft, ToggleRight, Edit2, BarChart2, Zap, Copy, Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

// ─── UTILS ───────────────────────────────────────────────
const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);
const fmtShort = (v) => {
  if (v >= 1000000) return `Rp ${(v / 1000000).toFixed(1)}Jt`;
  if (v >= 1000) return `Rp ${(v / 1000).toFixed(0)}Rb`;
  return `Rp ${Math.round(v || 0)}`;
};

const calcMetrics = (p) => {
  if (!p) return { 
    matTotal: 0, fixedTotal: 0, hppUnit: 0, sellPrice: 0, profitUnit: 0, 
    profitMonthly: 0, profitAnnual: 0, margin: 0, bepDaily: 0, roi: 0, roiYearly: 0, 
    paybackDays: 0, unitsToGoal: [], risk: { level: 'N/A', score: 0, advice: '' },
    recommendation: { price: 0, target: 0, margin: 0 } 
  };
  const margin = Number(p.targetMargin) || 0;
  const fee = Number(p.marketplaceFee) || 0;
  const vol = Math.max(1, Number(p.expectedSalesVolume) || 1);

  const matTotal = (p.materials || []).reduce((s, m) => {
    const price = Number(m.packPrice) || 0;
    const size = Math.max(0.001, Number(m.packSize) || 1);
    const qty = Number(m.qty) || 0;
    const waste = Number(m.waste) || 0;
    const cost = (price / size) * qty;
    return s + cost * (1 + waste / 100);
  }, 0);

  const fixedTotal = (p.fixedCosts || [])
    .filter(f => f.isActive !== false)
    .reduce((s, f) => s + (Number(f.amount) || 0), 0);

  const hppUnit = matTotal + fixedTotal / vol;
  const multiplier = 1 - margin / 100 - fee / 100;
  const sellPrice = multiplier > 0 ? hppUnit / multiplier : hppUnit * 2;
  const profitUnit = sellPrice - hppUnit - sellPrice * (fee / 100);
  const bep = profitUnit > 0 ? Math.ceil((fixedTotal / profitUnit) / 30) : 0;

  // Recommendation Engine Refined
  const recommendedMargin = 40;
  const suggestedPrice = Math.round(hppUnit / (1 - (recommendedMargin / 100) - (fee / 100)));
  const suggestedTarget = Math.ceil(bep * 1.5); // BEP + 50% buffer
  
  // Specific targets
  const profitGoals = [5000000, 10000000]; // Target 5jt & 10jt
  const unitsToGoal = profitGoals.map(goal => ({
    goal,
    units: profitUnit > 0 ? Math.ceil(goal / profitUnit) : 0
  }));

  // Risk Assessment
  const riskScore = hppUnit > 0 ? (matTotal / hppUnit) : 0; // High matTotal ratio = high sensitivity
  let riskLevel = 'Rendah';
  let riskAdvice = 'Bisnis stabil terhadap fluktuasi harga bahan.';
  if (riskScore > 0.7) {
    riskLevel = 'Tinggi';
    riskAdvice = 'Sangat sensitif! Kenaikan harga bahan baku 10% bisa memicu kerugian.';
  } else if (riskScore > 0.5) {
    riskLevel = 'Sedang';
    riskAdvice = 'Cukup terpengaruh kenaikan bahan. Pastikan stok aman.';
  }

  return {
    matTotal: Math.round(matTotal),
    fixedTotal: Math.round(fixedTotal),
    hppUnit: Math.round(hppUnit),
    sellPrice: Math.round(sellPrice),
    profitUnit: Math.round(profitUnit),
    profitMonthly: Math.round(profitUnit * vol),
    profitAnnual: Math.round(profitUnit * vol * 12),
    margin: sellPrice > 0 ? Math.round((profitUnit / sellPrice) * 100) : 0,
    bepDaily: bep,
    roi: hppUnit > 0 ? Math.round((profitUnit / hppUnit) * 100) : 0,
    roiYearly: hppUnit > 0 ? Math.round(((profitUnit * vol * 12) / (matTotal * vol + fixedTotal)) * 100) : 0,
    paybackDays: profitUnit > 0 ? Math.ceil((matTotal * vol + fixedTotal) / (profitUnit * (vol/30))) : 0,
    unitsToGoal,
    risk: { level: riskLevel, score: Math.round(riskScore * 100), advice: riskAdvice },
    recommendation: {
      price: suggestedPrice,
      target: suggestedTarget,
      margin: recommendedMargin
    }
  };
};

// ─── SUB-COMPONENTS ──────────────────────────────────────
const Label = ({ children }) => (
  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{children}</p>
);

const Input = ({ label, type = 'text', prefix, suffix, ...props }) => (
  <div>
    {label && <Label>{label}</Label>}
    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-400 transition-all">
      {prefix && <span className="text-slate-400 text-xs shrink-0">{prefix}</span>}
      <input
        type={type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        className="flex-1 bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 outline-none min-w-0 placeholder:text-slate-300"
        value={props.value === 0 ? '' : props.value}
        onFocus={(e) => e.target.select()}
        {...props}
      />
      {suffix && <span className="text-slate-400 text-xs shrink-0">{suffix}</span>}
    </div>
  </div>
);

const Stat = ({ label, value, sub, accent = false, small = false, tip = null }) => (
  <div className={`rounded-xl p-4 border relative group ${accent ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-700/60'}`}>
    <div className="flex items-center gap-1.5 mb-1">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      {tip && (
        <div className="relative inline-block cursor-help transition-opacity opacity-40 hover:opacity-100">
           <AlertCircle className="w-3 h-3 text-slate-400" />
           <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-[10px] text-white rounded-lg invisible group-hover:visible z-[100] shadow-2xl leading-relaxed">
             {tip}
             <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
           </div>
        </div>
      )}
    </div>
    <p className={`font-bold leading-tight ${accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'} ${small ? 'text-base' : 'text-xl'}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
  </div>
);

const Badge = ({ children, color = 'slate' }) => {
  const colors = {
    slate: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    green: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400',
    red: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
    blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400',
  };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[color]}`}>{children}</span>;
};

// ─── LOGIN PAGE ───────────────────────────────────────────
const LoginPage = ({ onLogin, isDark, toggleDark }) => (
  <div className={`min-h-screen flex items-center justify-center p-6 ${isDark ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
    <div className="w-full max-w-sm">
      <button onClick={toggleDark} className="absolute top-6 right-6 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">HPP Master</h1>
            <p className="text-xs text-slate-400 font-medium">Asisten Penentu Harga & Profit UMKM</p>
          </div>
        </div>
        <div className="space-y-3 mb-6">
          <div>
            <Label>Username</Label>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200">admin</div>
          </div>
          <div>
            <Label>Password</Label>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-400">••••••••</div>
          </div>
        </div>
        <button onClick={onLogin} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors active:scale-[0.98]">
          Masuk
        </button>
        <p className="text-xs text-slate-400 text-center mt-4">Demo mode — klik masuk untuk lanjut</p>
      </div>
    </div>
  </div>
);

// ─── TABS ─────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'materials', label: 'Bahan Baku', icon: Database },
  { id: 'costs', label: 'Biaya Tetap', icon: DollarSign },
  { id: 'strategy', label: 'Harga Jual', icon: TrendingUp },
  { id: 'report', label: 'Laporan', icon: FileText },
];

// ─── MAIN APP ─────────────────────────────────────────────
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [businessProfile, setBusinessProfile] = useState({ name: 'Usaha Saya', owner: 'Owner' });

  const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const [lastSaved, setLastSaved] = useState(null);

  const defaultProduct = (n = 1) => ({
    id: 'p-' + Date.now(),
    name: `Produk ${n}`,
    targetMargin: 40,
    expectedSalesVolume: 100,
    marketplaceFee: 0,
    actualSales: 0,
    materials: [],
    fixedCosts: [],
    snapshots: [], // Store pricing history
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/products`);
        if (res.data?.length) { setProducts(res.data); setActiveId(res.data[0].id); return; }
      } catch {}
      try {
        const stored = localStorage.getItem('hpp_v2');
        if (stored) { 
          const p = JSON.parse(stored); 
          if (Array.isArray(p)) { setProducts(p); setActiveId(p[0].id); return; }
        }
      } catch (e) { localStorage.removeItem('hpp_v2'); }
      const init = defaultProduct(1);
      setProducts([init]);
      setActiveId(init.id);
    };
    load();
  }, []);

  const active = useMemo(() => products.find(p => p.id === activeId) || products[0], [products, activeId]);
  const m = useMemo(() => calcMetrics(active), [active]);

  // Hybrid Auto-Save System
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (products.length === 0) return;
      setIsSaving(true);
      
      // Save to LocalStorage (Instant)
      localStorage.setItem('hpp_v2', JSON.stringify(products));
      
      // Sync to Cloud (Debounced)
      try {
        if (active?.id) {
          await axios.post(`${API}/products/${active.id}`, active);
        }
      } catch (err) { console.warn("Cloud sync failed, data saved locally."); }
      
      setLastSaved(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setIsSaving(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [products, active]);

  const resetData = () => {
    if (window.confirm('Hapus semua data dan mulai dari awal?')) {
      localStorage.removeItem('hpp_v2');
      window.location.reload();
    }
  };

  const update = (field, val) => setProducts(prev => prev.map(p => p.id === activeId ? { ...p, [field]: val } : p));
  const updateMat = (mid, field, val) => update('materials', active.materials.map(m => m.id === mid ? { ...m, [field]: val } : m));
  const updateCost = (fid, field, val) => update('fixedCosts', active.fixedCosts.map(f => f.id === fid ? { ...f, [field]: val } : f));

  const addMaterial = () => update('materials', [...(active.materials || []), { id: 'm-' + Date.now(), name: 'Bahan Baru', packPrice: 0, packSize: 1, qty: 1, waste: 0 }]);
  const delMaterial = (mid) => update('materials', active.materials.filter(m => m.id !== mid));
  const addCost = () => update('fixedCosts', [...(active.fixedCosts || []), { id: 'f-' + Date.now(), name: 'Biaya Baru', amount: 0, isActive: true }]);
  const delCost = (fid) => update('fixedCosts', active.fixedCosts.filter(f => f.id !== fid));

  const addProduct = () => {
    const p = defaultProduct(products.length + 1);
    setProducts(prev => [...prev, p]);
    setActiveId(p.id);
  };
  const delProduct = (id, e) => {
    e.stopPropagation();
    if (products.length <= 1) return;
    const next = products.filter(p => p.id !== id);
    setProducts(next);
    if (activeId === id) setActiveId(next[0].id);
  };
  const duplicateProduct = () => {
    const p = { ...active, id: 'p-' + Date.now(), name: active.name + ' (Copy)' };
    setProducts(prev => [...prev, p]);
    setActiveId(p.id);
  };



  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} isDark={isDark} toggleDark={() => setIsDark(d => !d)} />;

  // Chart data
  const chartData = [50, 100, 150, 200, 250, 300].map(u => ({
    unit: `${u}`,
    laba: Math.max(0, Math.round(m.profitUnit * u - (u < 100 ? m.fixedTotal * (1 - u / 100) : 0))),
  }));

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-inter">

        {/* ── SIDEBAR ── */}
        <aside className="hidden md:flex w-56 flex-col bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 shrink-0 sticky top-0 h-screen">
          {/* Logo */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Calculator className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100">HPP Master</span>
            </div>
            <input 
              value={businessProfile.name} 
              onChange={e => setBusinessProfile(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-emerald-500 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 outline-none transition-colors"
              placeholder="Nama Usaha"
            />
          </div>

          {/* Product List */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">Produk</p>
            <div className="space-y-0.5 max-h-44 overflow-y-auto no-scrollbar">
              {products.map(p => {
                const metrics = calcMetrics(p);
                return (
                  <button key={p.id} onClick={() => setActiveId(p.id)}
                    className={`w-full flex flex-col items-start px-3 py-2.5 rounded-xl text-xs font-medium transition-all group border ${p.id === activeId ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' : 'text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="truncate max-w-[100px] font-bold">{p.name}</span>
                      {products.length > 1 && (
                        <X onClick={e => delProduct(p.id, e)} className="w-3 h-3 opacity-0 group-hover:opacity-60 hover:opacity-100 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 opacity-70">
                      <span className="text-[9px] px-1 bg-slate-100 dark:bg-slate-800 rounded">{metrics.margin}%</span>
                      <span className="text-[9px]">{fmtShort(metrics.sellPrice)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={addProduct} className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors mt-1">
              <Plus className="w-3 h-3" /> Tambah produk
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto no-scrollbar">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${activeTab === id ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
            <button onClick={() => setIsDark(d => !d)} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {isDark ? 'Mode Terang' : 'Mode Gelap'}
            </button>
            <button onClick={resetData} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
              <X className="w-3.5 h-3.5" /> Reset Semua Data
            </button>
            <button onClick={() => {
              const data = JSON.stringify(products);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `hpp_master_backup_${new Date().toISOString().split('T')[0]}.json`;
              a.click();
            }} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
              <Save className="w-3.5 h-3.5" /> Download Backup
            </button>
            <button onClick={() => setIsLoggedIn(false)} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </aside>

        {/* ── CONTENT ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Mobile Header */}
          <header className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowMobileMenu(true)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Menu className="w-5 h-5" />
              </button>
              <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter leading-none mb-0.5">Produk Aktif</span>
                <select value={activeId} onChange={e => setActiveId(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-800 dark:text-slate-100 outline-none max-w-[120px] truncate leading-none">
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className={`text-[9px] font-bold ${isSaving ? 'text-amber-500 animate-pulse' : 'text-emerald-500'} leading-none`}>
                  {isSaving ? 'Menyimpan...' : 'Sinkron'}
                </span>
                {lastSaved && <span className="text-[7px] text-slate-400 opacity-60 mt-0.5">Pukul {lastSaved}</span>}
              </div>
              <button onClick={() => setIsDark(d => !d)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </header>

          {/* Mobile Drawer */}
          <AnimatePresence>
            {showMobileMenu && (
              <div className="fixed inset-0 z-[60] md:hidden">
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMobileMenu(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                 <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                       <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
                            <Calculator className="w-4 h-4 text-white" />
                          </div>
                          <span className="font-bold text-sm">Menu HPP</span>
                       </div>
                       <button onClick={() => setShowMobileMenu(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                          <X className="w-4 h-4" />
                       </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                       <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-2">Daftar Produk</p>
                          <div className="space-y-1">
                             {products.map(p => {
                               const metrics = calcMetrics(p);
                               return (
                                 <button key={p.id} onClick={() => { setActiveId(p.id); setShowMobileMenu(false); }} className={`w-full text-left p-3 rounded-xl transition-all border ${activeId === p.id ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <p className="text-xs font-bold truncate leading-none mb-1">{p.name}</p>
                                    <p className="text-[9px] opacity-60">Margin {metrics.margin}% · {fmtShort(metrics.sellPrice)}</p>
                                 </button>
                               )
                             })}
                          </div>
                          <button onClick={() => { addProduct(); setShowMobileMenu(false); }} className="w-full flex items-center gap-2 mt-2 p-3 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors">
                             <Plus className="w-3 h-3" /> Tambah Produk Baru
                          </button>
                          <button onClick={() => { duplicateProduct(); setShowMobileMenu(false); }} className="w-full flex items-center gap-2 p-3 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
                             <Copy className="w-3 h-3" /> Salin Produk Aktif
                          </button>
                       </div>
                    </div>

                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
                       <button onClick={() => { resetData(); setShowMobileMenu(false); }} className="w-full flex items-center gap-2.5 p-3 rounded-xl text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Reset Semua Data
                       </button>
                       <button onClick={() => setIsLoggedIn(false)} className="w-full flex items-center gap-2.5 p-3 rounded-xl text-xs text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <LogOut className="w-3.5 h-3.5" /> Keluar
                       </button>
                    </div>
                 </motion.aside>
              </div>
            )}
          </AnimatePresence>

          {/* Desktop Header */}
          <header className="hidden md:flex bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-4 items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {NAV.find(n => n.id === activeTab)?.label}
              </h2>
              <p className="text-xs text-slate-400">
                {active?.name} · {products.length} produk
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400 font-medium">
                  <span className={`w-1.5 h-1.5 rounded-full ${isSaving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {isSaving ? 'Menyimpan perubahan...' : 'Sinkronisasi Otomatis Aktif'}
                </div>
                {lastSaved && <p className="text-[10px] text-slate-400 mt-0.5 opacity-60">Terakhir disimpan: {lastSaved}</p>}
              </div>
              <button onClick={duplicateProduct} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mr-2">
                <Edit2 className="w-3 h-3" /> Salin
              </button>
            </div>
          </header>

          {/* PAGE CONTENT */}
          <main className="flex-1 overflow-y-auto scrollbar-thin pb-28 md:pb-8">
            <div className="max-w-3xl mx-auto p-4 md:p-8">

              {/* Product Name Edit */}
              <div className="mb-5">
                <input value={active?.name || ''} onChange={e => update('name', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="text-lg font-bold bg-transparent outline-none text-slate-800 dark:text-slate-100 border-b-2 border-transparent focus:border-emerald-400 transition-colors w-full"
                  placeholder="Nama Produk"
                />
              </div>

              <AnimatePresence mode="wait">

                {/* ── DASHBOARD ── */}
                {activeTab === 'dashboard' && (
                  <motion.div key="dash" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    
                    {/* Portfolio Summary (If multiple products) */}
                    {products.length > 1 && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 overflow-hidden relative group">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ringkasan Portofolio ({products.length} Produk)</p>
                          <BarChart2 className="w-4 h-4 text-emerald-500 opacity-50" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/30">
                            <p className="text-[8px] text-slate-400 mb-0.5 uppercase font-bold">Total Laba</p>
                            <p className="text-sm font-bold text-emerald-600 truncate">{fmtShort(products.reduce((s, p) => s + calcMetrics(p).profitMonthly, 0))}/bln</p>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/30">
                            <p className="text-[8px] text-slate-400 mb-0.5 uppercase font-bold">Top Produk</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                              {[...products].sort((a, b) => calcMetrics(b).profitUnit - calcMetrics(a).profitUnit)[0]?.name}
                            </p>
                          </div>
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/30">
                            <p className="text-[8px] text-slate-400 mb-0.5 uppercase font-bold">Rata Margin</p>
                            <p className="text-sm font-bold text-blue-600">
                              {Math.round(products.reduce((s, p) => s + calcMetrics(p).margin, 0) / products.length)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Smart Recommendation Engine - Direct Decision */}
                    <div className="bg-emerald-600 dark:bg-emerald-500 rounded-2xl p-6 shadow-xl shadow-emerald-500/20 text-white overflow-hidden relative">
                      <Zap className="absolute -right-8 -bottom-8 w-32 h-32 text-white/10 rotate-12" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100 flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 shadow-sm" /> Smart Decision
                          </p>
                          <Badge color="green">Saran Ahli</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] text-emerald-100 opacity-80 mb-1 leading-none">Harga Jual Optimal</p>
                              <p className="text-3xl font-black tracking-tight">{fmt(m.recommendation.price)}</p>
                            </div>
                            <div className="flex items-center gap-4 border-t border-white/10 pt-4">
                              <div>
                                <p className="text-[9px] text-emerald-100 opacity-70 mb-0.5">Target Penjualan</p>
                                <p className="text-base font-bold text-white leading-none">{m.bepDaily} <span className="text-[10px] font-medium opacity-80">unit/hari</span></p>
                              </div>
                              <div className="w-[1px] h-8 bg-white/10" />
                              <div>
                                <p className="text-[9px] text-emerald-100 opacity-70 mb-0.5">Balik Modal</p>
                                <p className="text-base font-bold text-white leading-none">{m.paybackDays} <span className="text-[10px] font-medium opacity-80">Hari</span></p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                              <Calculator className="w-3.5 h-3.5" /> Rencana Laba Spesifik
                            </p>
                            <div className="space-y-2">
                              {m.unitsToGoal.map(g => (
                                <div key={g.goal} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-xs">
                                  <span>Target <span className="font-bold">{fmtShort(g.goal)}</span></span>
                                  <span className="font-bold">Jual {g.units} unit</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Risk & Health Indicator */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`rounded-2xl p-5 border shadow-sm ${m.risk.level === 'Tinggi' ? 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50' : m.risk.level === 'Sedang' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40'}`}>
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 italic">
                             <AlertCircle className={`w-4 h-4 ${m.risk.level === 'Tinggi' ? 'text-red-500' : m.risk.level === 'Sedang' ? 'text-amber-500' : 'text-emerald-500'}`} />
                             <span className="text-xs font-bold uppercase tracking-wider">Indikator Risiko</span>
                           </div>
                           <Badge color={m.risk.level === 'Tinggi' ? 'red' : m.risk.level === 'Sedang' ? 'amber' : 'green'}>{m.risk.level}</Badge>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
                          {m.risk.advice} <span className="font-bold opacity-80">(Sensitivitas: {m.risk.score}%)</span>
                        </p>
                      </div>

                      <div className="bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-2xl p-5 flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Time to Payback</p>
                            <p className="text-xl font-black text-slate-800 dark:text-slate-100">{m.paybackDays} Hari <span className="text-[10px] font-normal text-slate-400">Kerja</span></p>
                          </div>
                          <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center">
                             <TrendingUp className="w-5 h-5 text-emerald-500" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tracking Realization vs Prediction */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tracking Realisasi Penjualan</p>
                        <Badge color={active.actualSales >= (active.expectedSalesVolume / 30) ? 'green' : 'amber'}>Live Tracker</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1">
                          <Input label="Penjualan Hari Ini" type="number" value={active.actualSales} onChange={e => update('actualSales', Number(e.target.value))} suffix="unit" />
                        </div>
                        <div className="md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-700/40">
                          <div className="flex-1">
                            <p className="text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-tighter text-left">Status vs Target Harian</p>
                            <div className="flex items-end gap-2 text-left">
                              <p className={`text-lg font-extrabold ${active.actualSales >= m.bepDaily ? 'text-emerald-500' : 'text-amber-500'} leading-tight`}>
                                {active.actualSales >= m.bepDaily ? 'Target Terlampaui!' : `${m.bepDaily - active.actualSales} unit lagi penuhi BEP`}
                              </p>
                            </div>
                          </div>
                          <div className="w-full sm:w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                             <div className="h-full bg-emerald-500 transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${Math.min(100, (active.actualSales / Math.max(1, m.bepDaily)) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Educational Insight Card */}
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Edu-Insight</p>
                        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed italic">
                          {m.margin < 30 ? "Margin Anda di bawah 30%. Untuk UMKM makanan/minuman, idealnya di angka 40-50% agar aman dari biaya operasional." : "ROI Tahunan Anda di atas 100%. Ini menandakan bisnis yang sangat efisien dalam memutar modal!"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Stat label="HPP per Unit" value={fmtShort(m.hppUnit)} sub="Biaya pokok" accent tip="Modal dasar untuk memproduksi 1 unit, termasuk bahan baku dan porsi biaya tetap operasional." />
                      <Stat label="Harga Jual" value={fmtShort(m.sellPrice)} sub="Rekomendasi" tip="Harga jual ideal agar target keuntungan Anda tercapai setelah dipotong biaya admin marketplace." />
                      <Stat label="Laba per Unit" value={fmtShort(m.profitUnit)} sub={`Margin ${m.margin}%`} tip="Keuntungan bersih yang Anda dapatkan dari setiap 1 unit produk yang terjual." />
                      <Stat label="Laba Bulanan" value={fmtShort(m.profitMonthly)} sub={`${active?.expectedSalesVolume} unit/bln`} tip="Estimasi total keuntungan bersih dalam sebulan berdasarkan target volume penjualan Anda." />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Stat label="BEP Harian" value={`${m.bepDaily} unit/hari`} sub="Titik balik modal" small tip="Jumlah minimum produk yang HARUS terjual setiap hari agar bisnis Anda tidak rugi (impas)." />
                      <Stat label="ROI Tahunan" value={`${m.roiYearly}%`} sub="Return on Investment" small tip="Persentase keuntungan tahunan dibanding modal yang Anda putar. Semakin tinggi, semakin cepat modal kembali." />
                    </div>

                    {/* Health check */}
                    <div className="bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                        <BarChart2 className="w-3.5 h-3.5" /> Kesehatan Bisnis
                      </p>
                      <div className="space-y-2.5">
                        {[
                          { label: 'Margin keuntungan', val: m.margin, unit: '%', good: m.margin >= 30, tip: m.margin >= 30 ? 'Sangat kompetitif untuk skala UMKM' : 'Sangat tipis, harga Anda terancam rugi jika ada biaya tak terduga' },
                          { label: 'Biaya bahan baku', val: m.hppUnit > 0 ? Math.round((m.matTotal / m.hppUnit) * 100) : 0, unit: '% dari HPP', good: true, tip: 'Proporsi modal bahan baku terhadap total biaya produksi' },
                        ].map(item => (
                          <div key={item.label} className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.val}{item.unit}</span>
                              <Badge color={item.good ? 'green' : 'red'}>{item.tip}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-4">Proyeksi Laba vs Volume Penjualan</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="grd" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="2 4" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="unit" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtShort(v)} />
                          <Tooltip formatter={v => [fmtShort(v), 'Laba']} contentStyle={{ fontSize: 11, borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', background: isDark ? '#1e293b' : '#fff' }} />
                          <Area type="monotone" dataKey="laba" stroke="#10b981" strokeWidth={2} fill="url(#grd)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                )}

                {/* ── MATERIALS ── */}
                {activeTab === 'materials' && (
                  <motion.div key="mat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Total biaya bahan: <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(m.matTotal)}</span></p>
                      </div>
                      <button onClick={addMaterial} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-3 py-1.5 rounded-lg transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Tambah Bahan
                      </button>
                    </div>

                    {active?.materials?.length === 0 && (
                      <div className="text-center py-12 text-slate-400">
                        <Package className="w-8 h-8 mx-auto mb-3 opacity-40" />
                        <p className="text-sm">Belum ada bahan baku</p>
                        <p className="text-xs mt-1">Klik "Tambah Bahan" untuk mulai</p>
                      </div>
                    )}

                    {active?.materials?.map(item => {
                      const unitCost = item.packSize > 0 ? ((item.packPrice / item.packSize) * item.qty) * (1 + item.waste / 100) : 0;
                      return (
                        <div key={item.id} className="bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-xl p-4">
                          <div className="flex items-start justify-between mb-3">
                            <input value={item.name} onChange={e => updateMat(item.id, 'name', e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="font-semibold text-sm bg-transparent outline-none text-slate-800 dark:text-slate-100 border-b border-transparent focus:border-emerald-400 transition-colors" />
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fmt(unitCost)}</span>
                              <button onClick={() => delMaterial(item.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2.5">
                            <Input label="Harga pack (Rp)" type="number" value={item.packPrice} onChange={e => updateMat(item.id, 'packPrice', Number(e.target.value))} placeholder="0" />
                            <Input label="Isi pack (gr/ml/pcs)" type="number" value={item.packSize} onChange={e => updateMat(item.id, 'packSize', Number(e.target.value))} placeholder="1" />
                            <Input label="Pemakaian/produk" type="number" value={item.qty} onChange={e => updateMat(item.id, 'qty', Number(e.target.value))} placeholder="0" />
                            <Input label="Susut/Waste" type="number" value={item.waste} onChange={e => updateMat(item.id, 'waste', Number(e.target.value))} placeholder="0" suffix="%" />
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}

                {/* ── FIXED COSTS ── */}
                {activeTab === 'costs' && (
                  <motion.div key="costs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total aktif: <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(m.fixedTotal)}/bln</span></p>
                      <button onClick={addCost} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-3 py-1.5 rounded-lg transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Tambah Biaya
                      </button>
                    </div>

                    {/* Volume & Fee */}
                    <div className="bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Pengaturan Produksi</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="Volume Penjualan (unit/bulan)" type="number" value={active?.expectedSalesVolume} onChange={e => update('expectedSalesVolume', Number(e.target.value))} suffix="unit" />
                        <Input label="Fee Marketplace (%)" type="number" value={active?.marketplaceFee} onChange={e => update('marketplaceFee', Number(e.target.value))} suffix="%" />
                      </div>
                    </div>

                    {active?.fixedCosts?.length === 0 && (
                      <div className="text-center py-12 text-slate-400">
                        <DollarSign className="w-8 h-8 mx-auto mb-3 opacity-40" />
                        <p className="text-sm">Belum ada biaya tetap</p>
                        <p className="text-xs mt-1">Contoh: sewa, listrik, gaji, dll.</p>
                      </div>
                    )}

                    {active?.fixedCosts?.map(item => (
                      <div key={item.id} className={`bg-white dark:bg-slate-800/60 border rounded-xl p-3.5 transition-opacity ${item.isActive === false ? 'opacity-50 border-slate-100 dark:border-slate-700/30' : 'border-slate-100 dark:border-slate-700/60'}`}>
                        {/* Row 1: toggle + name + delete */}
                        <div className="flex items-center gap-2 mb-2">
                          <button onClick={() => updateCost(item.id, 'isActive', item.isActive === false ? true : false)}
                            className={`shrink-0 transition-colors ${item.isActive === false ? 'text-slate-300' : 'text-emerald-500'}`}>
                            {item.isActive === false ? <ToggleLeft className="w-5 h-5" /> : <ToggleRight className="w-5 h-5" />}
                          </button>
                          <input value={item.name} onChange={e => updateCost(item.id, 'name', e.target.value)}
                            className="flex-1 font-medium text-sm bg-transparent outline-none text-slate-700 dark:text-slate-200 min-w-0" />
                          <button onClick={() => delCost(item.id)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0 p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Row 2: amount input full width */}
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-500/30">
                          <span className="text-xs text-slate-400 shrink-0">Rp</span>
                          <input type="number" inputMode="decimal" value={item.amount === 0 ? '' : item.amount} 
                            onChange={e => updateCost(item.id, 'amount', Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            className="bg-transparent text-sm font-medium outline-none flex-1 text-right text-slate-700 dark:text-slate-200" />
                          <span className="text-xs text-slate-400 shrink-0">/bln</span>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* ── STRATEGY ── */}
                {activeTab === 'strategy' && (
                  <motion.div key="str" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                    {/* Presets */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">Pilih Target Margin</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { label: 'Kompetitif', val: 25, desc: 'Pasar massal' },
                          { label: 'Standar', val: 40, desc: 'Untuk UMKM' },
                          { label: 'Premium', val: 65, desc: 'High-value' },
                        ].map(preset => (
                          <button key={preset.val} onClick={() => update('targetMargin', preset.val)}
                            className={`p-4 rounded-2xl border text-left transition-all active:scale-[0.97] ${active?.targetMargin === preset.val ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60'}`}>
                            <p className="text-xl font-black text-slate-800 dark:text-slate-100">{preset.val}%</p>
                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1 leading-tight">{preset.label}</p>
                            <p className="text-[10px] text-slate-400 mt-1 leading-tight hidden sm:block">{preset.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Slider */}
                    <div className="bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Label>Margin kustom</Label>
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 focus-within:ring-2 focus-within:ring-emerald-500/30">
                          <input type="number" value={active?.targetMargin === 0 ? '' : active?.targetMargin} 
                            onChange={e => update('targetMargin', Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            className="w-10 bg-transparent text-sm font-bold text-emerald-600 dark:text-emerald-400 outline-none text-right" />
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">%</span>
                        </div>
                      </div>
                      <input type="range" min="5" max="90" value={active?.targetMargin}
                        onChange={e => update('targetMargin', Number(e.target.value))}
                        className="w-full accent-emerald-500" />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>5%</span><span>90%</span>
                      </div>
                    </div>

                    {/* Result */}
                    <div className="bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-4">Hasil Kalkulasi</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">HPP per Unit</p>
                          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{fmt(m.hppUnit)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Harga Jual</p>
                          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(m.sellPrice)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Laba per Unit</p>
                          <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">{fmt(m.profitUnit)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">BEP Harian</p>
                          <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">{m.bepDaily} unit</p>
                        </div>
                      </div>
                    </div>

                     {/* What-If & Safe Price Hike Tool */}
                     <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                       <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-1.5 uppercase tracking-wider">
                         <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Analisa "Naik Harga Aman"
                       </p>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-3">
                           <div className="flex items-center justify-between text-xs">
                             <span className="text-slate-500">Jika beralih ke Bahan Premium (+15%)</span>
                             <span className="font-bold text-red-500">-{fmtShort((m.matTotal * 0.15) * active?.expectedSalesVolume)} Laba</span>
                           </div>
                           <div className="flex items-center justify-between text-xs">
                             <span className="text-slate-500">Jika naikkan harga Rp2.000...</span>
                             <span className="font-bold text-emerald-500">+{fmtShort(2000 * active?.expectedSalesVolume)} Laba/bln</span>
                           </div>
                         </div>
                         <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                            <p className="text-[10px] font-bold text-emerald-500 mb-1 leading-none uppercase">Rekomendasi Kenaikan</p>
                            <p className="text-[11px] text-slate-500 leading-tight">Maksimal harga aman Anda: <span className="font-bold text-slate-800 dark:text-slate-100">{fmt(m.sellPrice * 1.1)}</span> (+10%). Di atas ini, risiko pelanggan pindah sangat tinggi.</p>
                         </div>
                       </div>
                     </div>

                    {/* Pricing History / Snapshots */}
                    <div className="bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Riwayat Strategi Harga</p>
                        <button onClick={() => {
                          const snap = {
                            id: Date.now(),
                            date: new Date().toLocaleDateString('id-ID'),
                            margin: active.targetMargin,
                            price: m.sellPrice,
                            profit: m.profitUnit
                          };
                          update('snapshots', [snap, ...(active.snapshots || [])]);
                        }} className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg transition-transform active:scale-95">
                          Simpan Versi Sekarang
                        </button>
                      </div>
                      {(!active.snapshots || active.snapshots.length === 0) ? (
                        <p className="text-[10px] text-slate-400 italic">Belum ada riwayat harga yang disimpan.</p>
                      ) : (
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2 no-scrollbar">
                          {active.snapshots.map(s => (
                            <div key={s.id} className="flex items-center justify-between text-[10px] bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800">
                              <span className="font-bold text-slate-400">{s.date}</span>
                              <div className="flex items-center gap-3">
                                <span>{s.margin}% Margin</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{fmtShort(s.price)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── REPORT ── */}
                {activeTab === 'report' && (
                  <motion.div key="rep" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                    <div className="bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-xl p-6 print:shadow-none print:border-none" id="print-area">
                      <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-100 dark:border-slate-700">
                        <div>
                          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] mb-1">{businessProfile.name}</p>
                          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-tight">{active?.name || 'Produk Baru'}</h1>
                          <p className="text-[10px] text-slate-400 mt-1">Laporan Analisis HPP & Profitabilitas · {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
                        </div>
                        <div className="flex flex-col items-end">
                           <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center mb-2">
                             <Calculator className="w-5 h-5 text-white" />
                           </div>
                        </div>
                      </div>

                      {/* Executive Summary for Investors */}
                      <div className="mb-6 p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl">
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Ringkasan Eksekutif</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[9px] text-slate-400">Modal Produksi/Bulan</p>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{fmt(active?.expectedSalesVolume * m.matTotal + m.fixedTotal)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400">Proyeksi Laba/Tahun</p>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{fmt(m.profitAnnual)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400">Efisiensi Modal (ROI)</p>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{m.roiYearly}% / thn</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-6">
                        {[
                          { l: 'HPP per Unit', v: fmt(m.hppUnit) },
                          { l: 'Harga Jual', v: fmt(m.sellPrice) },
                          { l: 'Laba per Unit', v: fmt(m.profitUnit) },
                          { l: 'Margin Keuntungan', v: `${m.margin}%` },
                          { l: 'Volume (unit/bln)', v: active?.expectedSalesVolume },
                          { l: 'Laba Bulanan', v: fmt(m.profitMonthly) },
                          { l: 'BEP Harian', v: `${m.bepDaily} unit` },
                          { l: 'ROI', v: `${m.roi}%` },
                        ].map(item => (
                          <div key={item.l} className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3">
                            <p className="text-[10px] text-slate-400 mb-0.5 font-medium">{item.l}</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.v}</p>
                          </div>
                        ))}
                      </div>

                      {/* Bahan baku breakdown */}
                      {active?.materials?.length > 0 && (
                        <div className="mb-6">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 border-l-4 border-emerald-500 pl-2">RINCIAN BAHAN BAKU</p>
                          <div className="space-y-2">
                             {active.materials.map(item => {
                               const cost = item.packSize > 0 ? ((item.packPrice / item.packSize) * item.qty) * (1 + item.waste / 100) : 0;
                               return (
                                 <div key={item.id} className="flex justify-between items-center text-xs py-2 border-b border-slate-50 dark:border-slate-800/50">
                                    <span className="text-slate-600 dark:text-slate-400 font-medium">{item.name}</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-100">{fmt(cost)}</span>
                                 </div>
                               );
                             })}
                             <div className="flex justify-between items-center text-sm py-3 border-t border-emerald-500/20 mt-2">
                                <span className="font-bold text-slate-800 dark:text-slate-100">Total HPP Bahan</span>
                                <span className="font-black text-emerald-600">{fmt(m.matTotal)}</span>
                             </div>
                          </div>
                        </div>
                      )}

                      {/* Biaya tetap breakdown */}
                      {active?.fixedCosts?.filter(f => f.isActive !== false).length > 0 && (
                        <div className="mb-6">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 border-l-4 border-slate-400 pl-2 uppercase">Biaya Tetap Aktif</p>
                          <div className="space-y-2">
                             {active.fixedCosts.filter(f => f.isActive !== false).map(item => (
                               <div key={item.id} className="flex justify-between items-center text-xs py-2 border-b border-slate-50 dark:border-slate-800/50">
                                  <span className="text-slate-600 dark:text-slate-400 font-medium">{item.name}</span>
                                  <span className="font-bold text-slate-800 dark:text-slate-100">{fmt(item.amount)}/bln</span>
                               </div>
                             ))}
                             <div className="flex justify-between items-center text-[10px] py-3 mt-1 opacity-60">
                                <span>Porsi Biaya per Unit</span>
                                <span className="font-bold">{fmt(m.fixedTotal / Math.max(1, active?.expectedSalesVolume))}</span>
                             </div>
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border border-slate-100 dark:border-slate-800">
                        <p className="font-bold text-slate-800 dark:text-slate-100 mb-2 underline decoration-emerald-500 decoration-2 underline-offset-4">Kesimpulan Operasional</p>
                        Untuk mencapai titik impas (break-even), usaha ini perlu menjual minimal <strong className="text-slate-800 dark:text-slate-100">{m.bepDaily} unit per hari</strong> dengan harga jual <strong className="text-emerald-600 dark:text-emerald-400">{fmt(m.sellPrice)}</strong>. Dengan target bulanan {active?.expectedSalesVolume} unit, Anda akan menghasilkan laba bersih <strong className="text-slate-800 dark:text-slate-100">{fmt(m.profitMonthly)}</strong> dengan efisiensi modal (ROI) sebesar <strong className="text-slate-800 dark:text-slate-100">{m.roiYearly}% per tahun</strong>.
                      </div>

                      {/* Footer Branding Refined */}
                      <div className="mt-12 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6">
                         <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ">Confidential Business Report</p>
                         </div>
                         <p className="text-[9px] text-slate-300">Generated by HPP Master PRO · {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 no-print">
                      <button onClick={() => window.print()} className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <Printer className="w-4 h-4" /> Cetak / PDF
                      </button>
                      <button onClick={() => {
                        const headers = ["Produk", "HPP", "Harga Jual", "Laba/Unit", "Laba/Bulan", "ROI (%)"];
                        const rows = products.map(p => {
                          const met = calcMetrics(p);
                          return [p.name, met.hppUnit, met.sellPrice, met.profitUnit, met.profitMonthly, met.roiYearly];
                        });
                        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `hpp_master_export_${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                      }} className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600 border border-emerald-200 dark:border-emerald-800/50 rounded-xl py-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors">
                        <FileText className="w-4 h-4" /> Export CSV
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </main>

          {/* Mobile Bottom Nav */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800 flex z-50 pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]" style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}>
            {NAV.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-2 px-0.5 transition-all active:scale-[0.85] ${activeTab === id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                <div className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${activeTab === id ? 'bg-emerald-50 dark:bg-emerald-950/50 shadow-inner' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                  <Icon className={`${activeTab === id ? 'w-5 h-5' : 'w-4 h-4'} transition-all`} />
                </div>
                <span className={`text-[9px] font-bold tracking-tight leading-none ${activeTab === id ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
              </button>
            ))}
          </nav>

        </div>
      </div>
    </div>
  );
}
