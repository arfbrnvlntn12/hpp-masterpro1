import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Plus, Trash2, Calculator, TrendingUp, Target, 
  Zap, Printer, Home, Layers, Save, 
  FileText, LayoutDashboard, Database, X, ArrowUpRight, ArrowDownRight,
  Loader2, LogOut, Trophy, Gem, Sparkles, PieChart as LucidePieChart, CheckCircle2, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- UTILS ---
const cn = (...inputs) => twMerge(clsx(inputs));

const formatIDR = (val) => new Intl.NumberFormat('id-ID', { 
  style: 'currency', currency: 'IDR', minimumFractionDigits: 0 
}).format(val || 0);

const formatCompactIDR = (val) => {
  if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)} Jt`;
  if (val >= 1000) return `Rp ${(val / 1000).toFixed(1)} Rb`;
  return formatIDR(val);
};

// --- LOGIC ENGINE ---
const calculateMetrics = (product) => {
  if (!product) return { hppPerUnit: 0, recommendedPrice: 0, totalProfit: 0, bepDaily: 0, totalFixedMonthly: 0 };
  const targetMargin = Number(product.targetMargin) || 0;
  const materials = (product.materials || []).map(m => {
    const pPrice = Number(m.packPrice) || 0;
    const pSize = Math.max(0.001, Number(m.packSize) || 1);
    const pQty = Number(m.qty) || 0;
    const pWaste = Number(m.waste) || 0;
    const cost = (pPrice / pSize) * pQty;
    return { ...m, unitPrice: cost + (cost * (pWaste / 100)) };
  });
  const totalMaterialCost = materials.reduce((sum, m) => sum + m.unitPrice, 0);
  const totalFixedMonthly = (product.fixedCosts || []).filter(f => f.isActive !== false).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const vol = Math.max(1, Number(product.expectedSalesVolume) || 1);
  const hppPerUnit = totalMaterialCost + (totalFixedMonthly / vol);
  const marketplaceFee = Number(product.marketplaceFee) || 0;
  const multiplier = 1 - (targetMargin / 100) - (marketplaceFee / 100);
  const recommendedPrice = multiplier > 0 ? hppPerUnit / multiplier : hppPerUnit * 2;
  const profitPerUnit = recommendedPrice * (targetMargin / 100);
  return {
    hppPerUnit: Math.round(hppPerUnit),
    recommendedPrice: Math.round(recommendedPrice),
    totalProfit: Math.round(profitPerUnit * vol),
    bepDaily: Math.ceil((totalFixedMonthly / (recommendedPrice - totalMaterialCost - (recommendedPrice * (marketplaceFee / 100)))) / 30),
    totalFixedMonthly
  };
};

// --- KOMPONEN REUSABLE ---

function Card({ title, value, subtext, icon: Icon, clr = "indigo", trend = null, isHero = false }) {
  return (
    <div className={cn(
      "bg-white/5 border border-white/10 rounded-2xl md:rounded-[32px] p-5 md:p-8 backdrop-blur transition-all duration-300 hover:scale-[1.02] hover:bg-white/[0.08] relative overflow-hidden group",
      isHero && "bg-gradient-to-br from-indigo-600/5 to-transparent border-indigo-500/20 shadow-2xl"
    )}>
      <div className="flex justify-between items-start mb-4 md:mb-6">
        <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center", `bg-${clr}-500/20 text-${clr}-400`)}>
          {Icon && <Icon className="w-5 h-5 md:w-6 md:h-6" />}
        </div>
        <div className="text-right">
          <p className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest italic">{title}</p>
          {trend && (
             <span className={cn("text-[9px] font-black italic", trend > 0 ? "text-emerald-500" : "text-rose-500")}>
               {trend > 0 ? "+" : ""}{trend}%
             </span>
          )}
        </div>
      </div>
      <h2 className={cn("font-black text-white italic tracking-tighter leading-none mb-2", isHero ? "text-3xl md:text-5xl" : "text-xl md:text-3xl")}>{value}</h2>
      <p className="text-[9px] md:text-[11px] font-bold text-slate-500 uppercase tracking-wider italic leading-none">{subtext}</p>
    </div>
  );
}

const MobileNavItem = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 flex-1 py-1 transition-all">
     <div className={cn("p-2.5 rounded-2xl transition-all duration-500", active ? "bg-indigo-600 text-white shadow-xl -translate-y-2 scale-110" : "text-slate-600")}>
        <Icon className="w-5 h-5" />
     </div>
     {!active && <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 italic leading-none">{label}</span>}
  </button>
);

// --- MAIN APP ---

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSaving, setIsSaving] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // -- PERSISTENCE STATE --
  const [products, setProducts] = useState([]);
  const [activeProductId, setActiveProductId] = useState('new');
  
  const defaultProduct = {
    id: 'new', name: 'Produk Baru', targetMargin: 45, expectedSalesVolume: 100, marketplaceFee: 0,
    materials: [], fixedCosts: []
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);
  // -- LOAD DATA --
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get(`${API_URL}/products`);
        if (res.data && res.data.length > 0) {
          setProducts(res.data);
          setActiveProductId(res.data[0].id);
        } else {
          const init = { ...defaultProduct, id: 'temp-' + Date.now(), name: 'Produk Contoh' };
          setProducts([init]);
          setActiveProductId(init.id);
        }
      } catch (err) {
        console.error("API Error, using fallback:", err);
        const stored = localStorage.getItem('hpp_products');
        if (stored) {
          const parsed = JSON.parse(stored);
          setProducts(parsed);
          setActiveProductId(parsed[0].id);
        } else {
          // ENSURE AT LEAST ONE PRODUCT EXISTS EVEN ON ERROR
          const init = { ...defaultProduct, id: 'err-' + Date.now(), name: 'Produk Offline' };
          setProducts([init]);
          setActiveProductId(init.id);
        }
      }
    };
    fetchProducts();
  }, []);

  const activeProduct = useMemo(() => {
    return products.find(p => p.id === activeProductId) || products[0] || { ...defaultProduct, id: 'fb-' + Date.now() };
  }, [products, activeProductId]);

  const m = useMemo(() => calculateMetrics(activeProduct), [activeProduct]);

  // -- SAVE LOGIC --
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await axios.post(`${API_URL}/products/${activeProduct.id}`, activeProduct);
    } catch (err) {
      console.warn("API Save failed, syncing to LocalStorage only.");
    }
    // Always sync to LocalStorage as a reliable secondary
    localStorage.setItem('hpp_products', JSON.stringify(products));
    setTimeout(() => setIsSaving(false), 800);
  };

  const addProduct = () => {
    const newId = 'prod-' + Date.now();
    const newP = { ...defaultProduct, id: newId, name: `Produk #${products.length + 1}` };
    setProducts([...products, newP]);
    setActiveProductId(newId);
  };

  const deleteProduct = (id, e) => {
    e.stopPropagation();
    if (products.length <= 1) return;
    const filtered = products.filter(p => p.id !== id);
    setProducts(filtered);
    if (activeProductId === id) setActiveProductId(filtered[0].id);
  };

  const updateActiveProduct = (field, value) => {
    setProducts(prev => prev.map(p => p.id === activeProductId ? { ...p, [field]: value } : p));
  };

  const updateMaterial = (mid, field, value) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== activeProductId) return p;
      return {
        ...p,
        materials: p.materials.map(m => m.id === mid ? { ...m, [field]: value } : m)
      };
    }));
  };

  const updateFixedCost = (fid, field, value) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== activeProductId) return p;
      return {
        ...p,
        fixedCosts: p.fixedCosts.map(f => f.id === fid ? { ...f, [field]: value } : f)
      };
    }));
  };

  const handleLogin = () => { setIsLoggedIn(true); };
  const handleLogout = () => { setIsLoggedIn(false); };

  if (!isLoggedIn) return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#0B0F1A]' : 'bg-slate-50'} flex items-center justify-center p-6 text-white font-outfit transition-colors duration-500`}>
      <div className={`w-full max-w-sm glass-card rounded-[40px] p-10 border ${isDarkMode ? 'border-white/10 bg-[#0B0F1A]/60' : 'border-slate-200 bg-white shadow-2xl'} shadow-2xl space-y-8 text-center`}>
        <div className="w-16 h-16 bg-indigo-600 rounded-[22px] mx-auto flex items-center justify-center shadow-2xl"><Calculator className="w-8 h-8 text-white"/></div>
        <h1 className={`text-2xl font-black italic uppercase tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>HPP MASTER <span className="text-indigo-500">PRO</span></h1>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Sistem Operasional Bisnis Mandiri</p>
        <button onClick={handleLogin} className="w-full h-14 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all">Masuk Kontrol Panel</button>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col md:flex-row min-h-screen ${isDarkMode ? 'bg-[#0B0F1A] text-white' : 'bg-white text-slate-950'} font-outfit overflow-hidden transition-colors duration-500`}>
      
      {/* MOBILE SUPER-HEADER */}
      <header className={`lg:hidden h-20 border-b flex items-center justify-between px-6 shrink-0 z-[120] transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0b1e]/90 text-white border-white/5' : 'bg-white/95 text-slate-900 border-slate-200'} backdrop-blur-xl sticky top-0 shadow-lg shadow-black/5`}>
         <div className="flex items-center gap-4 group">
            <div className="w-11 h-11 bg-indigo-600 rounded-[18px] flex items-center justify-center shadow-lg shadow-indigo-600/30 font-black rotate-3">
               <Calculator className="text-white w-5 h-5" />
            </div>
            <div className="flex flex-col">
               <div className={`font-black text-xs italic tracking-tighter uppercase leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>HPP MASTER <span className="text-indigo-500">PRO</span></div>
               <div className="mt-1 flex items-center gap-1.5 overflow-hidden">
                  <select 
                    value={activeProductId} 
                    onChange={(e) => setActiveProductId(e.target.value)}
                    className="bg-transparent border-none p-0 text-[10px] font-black uppercase text-indigo-500 outline-none focus:ring-0 max-w-[120px] truncate"
                  >
                     {products.map(p => <option key={p.id} value={p.id} className="bg-slate-900 text-white">{p.name}</option>)}
                  </select>
                  <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
               </div>
            </div>
         </div>
         <div className="flex items-center gap-4">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${isDarkMode ? 'bg-white/5 border-white/10 text-indigo-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
               {isDarkMode ? <Sparkles className="w-4.5 h-4.5" /> : <Calculator className="w-4.5 h-4.5" />}
            </button>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black border ${isDarkMode ? 'bg-indigo-600/20 border-indigo-500/20 text-indigo-400' : 'bg-slate-200 border-slate-300 text-slate-600'}`}>
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : 'ADM'}
            </div>
         </div>
      </header>

      {/* SIDEBAR DESKTOP */}
      <aside className={`hidden md:flex w-72 flex-col p-8 border-r ${isDarkMode ? 'border-white/10 bg-[#0B0F1A]' : 'border-slate-200 bg-slate-50'} shrink-0 z-50 relative`}>
        <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-indigo-600/30 shadow-2xl"><Calculator className="w-5 h-5 text-white"/></div>
            <h1 className={`text-lg font-black italic uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>HPPMASTER</h1>
        </div>
        
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 mt-6 italic px-2">Koleksi Produk Aktif</p>
        <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar pr-1 max-h-[350px] mb-8">
           {products.map(p => (
             <button key={p.id} onClick={() => setActiveProductId(p.id)} className={cn(
               "w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl transition-all font-black text-[10px] uppercase italic tracking-widest text-left group border",
               p.id === activeProductId 
                  ? "bg-indigo-600 text-white border-transparent shadow-[0_10px_30px_rgba(79,70,229,0.3)]" 
                  : (isDarkMode ? "bg-white/5 text-slate-500 border-transparent hover:bg-white/10" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-100 shadow-sm")
             )}>
                <div className="flex items-center gap-3 overflow-hidden">
                   <div className={cn("w-2 h-2 rounded-full", p.id === activeProductId ? "bg-white" : "bg-slate-700")} />
                   <span className="truncate">{p.name}</span>
                </div>
                {products.length > 1 && (
                  <X onClick={(e) => deleteProduct(p.id, e)} className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-white transition-opacity" />
                )}
             </button>
           ))}
           <button onClick={addProduct} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 border-dashed ${isDarkMode ? 'border-white/5 text-slate-600 hover:border-indigo-500/50' : 'border-slate-300 text-slate-400 hover:border-indigo-500'} transition-all font-black text-[10px] uppercase italic tracking-widest`}>
              <Plus className="w-4 h-4"/> Tambah Item HPP
           </button>
        </div>

        <nav className="space-y-1.5 mb-8 pt-6 border-t border-white/5">
           <button onClick={()=>setActiveTab('dashboard')} className={cn("w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-black text-[10px] uppercase italic tracking-widest", activeTab==='dashboard'? (isDarkMode?"bg-white/10 text-white":"bg-indigo-50 text-indigo-700"):"text-slate-500 hover:bg-white/5")}>
              <LayoutDashboard className="w-4.5 h-4.5"/> Ringkasan
           </button>
           <button onClick={()=>setActiveTab('materials')} className={cn("w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-black text-[10px] uppercase italic tracking-widest", activeTab==='materials'? (isDarkMode?"bg-white/10 text-white":"bg-indigo-50 text-indigo-700"):"text-slate-500 hover:bg-white/5")}>
              <Database className="w-4.5 h-4.5"/> Bahan Baku
           </button>
           <button onClick={()=>setActiveTab('strategy')} className={cn("w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-black text-[10px] uppercase italic tracking-widest", activeTab==='strategy'? (isDarkMode?"bg-white/10 text-white":"bg-indigo-50 text-indigo-700"):"text-slate-500 hover:bg-white/5")}>
              <TrendingUp className="w-4.5 h-4.5"/> Strategi Harga
           </button>
           <button onClick={()=>setActiveTab('report')} className={cn("w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-black text-[10px] uppercase italic tracking-widest", activeTab==='report'? (isDarkMode?"bg-white/10 text-white":"bg-indigo-50 text-indigo-700"):"text-slate-500 hover:bg-white/5")}>
              <FileText className="w-4.5 h-4.5"/> Laporan Audit
           </button>
        </nav>

        <div className="mt-auto space-y-3 pt-6 border-t border-white/5 font-black uppercase text-[10px] italic">
           <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${isDarkMode ? 'text-slate-500 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-200'}`}>
              <div className="w-4.5 h-4.5 flex items-center justify-center">{isDarkMode ? <Sparkles className="w-4 h-4" /> : <Calculator className="w-4 h-4" />}</div>
              {isDarkMode ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
           </button>
           <button onClick={handleLogout} className="w-full flex items-center gap-4 px-5 py-4 text-slate-700 hover:text-rose-500 transition-colors">
              <LogOut className="w-4.5 h-4.5"/> Keluar Aplikasi
           </button>
        </div>
      </aside>

      {/* 📊 MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-hidden">
        <header className={`hidden md:flex h-20 items-center justify-between px-10 shrink-0 z-40 transition-colors duration-500 border-b ${isDarkMode ? 'border-white/5 bg-[#0B0F1A]/40' : 'border-slate-200 bg-white shadow-xl shadow-slate-100/50'}`}>
           <div className="flex flex-col">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.5em] italic leading-none mb-3">Enterprise Suite v3.2</p>
              <h1 className={`text-3xl font-black italic tracking-tighter uppercase leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{activeTab === 'dashboard' ? 'RINGKASAN UTAMA' : activeTab.replace('-',' ')}</h1>
           </div>
           <div className="flex items-center gap-6">
              <div className={`px-5 py-2.5 rounded-2xl border flex items-center gap-3 transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                 <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isSaving ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                 <span className="text-[10px] font-black uppercase tracking-widest">{isSaving ? 'DATABASE SYNCING...' : 'CLOUD SECURED ✓'}</span>
              </div>
              <button onClick={handleSave} className="h-12 px-8 bg-indigo-600 text-white font-black text-[10px] uppercase rounded-2xl shadow-[0_10px_25px_rgba(79,70,229,0.3)] active:scale-95 transition-all flex items-center gap-3 hover:bg-indigo-500 italic"><Save className="w-4 h-4" /> Komit Perubahan</button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 md:p-10 scroll-smooth custom-scrollbar pb-44 md:pb-10 w-full relative">
          <div className="max-w-[1240px] mx-auto w-full">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div key="db" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-10">
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                      <Card isHero title="Laba Bersih Bulanan" value={formatCompactIDR(m.totalProfit)} icon={Trophy} clr="amber" trend={12} subtext="Hasil Financial Bersih" />
                      <Card isHero title="Titik BEP Harian" value={`${m.bepDaily} Unit`} icon={Target} clr="rose" trend={2} subtext="Ambang Batas Risiko" />
                      <Card title="HPP Produk (HPP)" value={formatIDR(m.hppPerUnit)} icon={Calculator} clr="emerald" subtext="HPP Unit Produksi" />
                      <Card title="Harga Rekomendasi" value={formatIDR(m.recommendedPrice)} icon={TrendingUp} clr="indigo" subtext="Target Pasar Optimal" />
                   </div>
                   <div className={`glass-card rounded-[32px] md:rounded-[48px] p-6 md:p-12 border ${isDarkMode ? 'bg-white/[0.02] border-white/10' : 'bg-slate-100 border-slate-200'} h-[300px] md:h-[480px] shadow-inner`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[{n:'100',p:m.totalProfit/10},{n:'500',p:m.totalProfit/2},{n:'1k',p:m.totalProfit},{n:'1.5k',p:m.totalProfit*1.5}]}>
                          <defs><linearGradient id="cP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#ffffff05" : "#0000000a"} vertical={false}/>
                          <XAxis dataKey="n" stroke="#475569" fontSize={11} axisLine={false} tickLine={false}/>
                          <RechartsTooltip contentStyle={{background: isDarkMode ? '#0a0b1e' : '#ffffff', border:'none', borderRadius:'20px', fontSize:'12px', boxShadow:'0 20px 50px rgba(0,0,0,0.1)'}}/>
                          <Area type="monotone" dataKey="p" stroke="#6366f1" fillOpacity={1} fill="url(#cP)" strokeWidth={5} />
                        </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </motion.div>
              )}

              {activeTab === 'materials' && (
                <motion.div key="mat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {activeProduct.materials.map(item => (
                        <div key={item.id} className={`border rounded-[32px] p-8 space-y-6 shadow-xl transition-all ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                           <input 
                              value={item.name} 
                              onChange={e => updateMaterial(item.id, 'name', e.target.value)}
                              className={`bg-transparent border-none p-0 text-xl font-black italic uppercase focus:ring-0 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} 
                           />
                           <div className="grid grid-cols-2 gap-4">
                              <div className={`${isDarkMode ? 'bg-white/5' : 'bg-slate-50'} p-4 rounded-2xl space-y-1`}><p className="text-[8px] font-black uppercase text-slate-500 italic">Harga Beli</p><input type="number" value={item.packPrice} onChange={e => updateMaterial(item.id, 'packPrice', e.target.value)} className="bg-transparent border-none p-0 w-full font-black italic focus:ring-0" /></div>
                              <div className="bg-rose-500/5 p-4 rounded-2xl space-y-1"><p className="text-[8px] font-black uppercase text-rose-400 italic">Susut %</p><input type="number" value={item.waste} onChange={e => updateMaterial(item.id, 'waste', e.target.value)} className="bg-transparent border-none p-0 w-full font-black italic focus:ring-0" /></div>
                           </div>
                        </div>
                      ))}
                      <button onClick={()=>{}} className={`border-2 border-dashed rounded-[32px] p-10 flex flex-col items-center justify-center gap-4 transition-all ${isDarkMode ? 'bg-white/3 border-white/10 text-slate-500 hover:text-indigo-400 hover:bg-white/5' : 'bg-slate-50 border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600'}`}><Plus className="w-10 h-10"/> <span className="font-black text-[10px] uppercase italic tracking-[0.3em]">Tambah Bahan Baru</span></button>
                   </div>
                </motion.div>
              )}

              {activeTab === 'strategy' && (
                <motion.div key="str" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
                   <div className="flex flex-col md:flex-row gap-6 md:gap-10">
                    {[
                      { l: 'Tingkat Kompetitif', m: 25, ic: Sparkles, clr: 'amber', hint: 'Pasar Massal' },
                      { l: 'Tingkat Standar Pro', m: 45, ic: Trophy, clr: 'indigo', hint: 'Sangat Disarankan' },
                      { l: 'Tingkat Premium', m: 70, ic: Gem, clr: 'rose', hint: 'High-Value Brand' }
                    ].map(t => (
                      <div key={t.l} onClick={() => updateActiveProduct('targetMargin', t.m)} className={cn(
                        "flex-1 border-2 rounded-[32px] md:rounded-[48px] p-8 md:p-12 transition-all cursor-pointer relative overflow-hidden group",
                        activeProduct.targetMargin===t.m ? `border-${t.clr}-500 bg-${t.clr}-500/[0.05] scale-[1.03] shadow-2xl` : (isDarkMode ? "bg-white/5 border-white/10 opacity-50" : "bg-white border-slate-200 opacity-60")
                      )}>
                        {t.m === 45 && <div className="absolute top-6 right-6 px-4 py-1.5 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-full shadow-lg italic tracking-widest">Pilihan Utama</div>}
                        <div className="flex justify-between items-start mb-10"><div className={cn("w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center", `bg-${t.clr}-500/20 text-${t.clr}-400`)}><t.ic className="w-7 h-7" /></div><p className="text-3xl md:text-5xl font-black italic tracking-tighter leading-none">{t.m}%</p></div>
                        <h4 className={cn("text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none mb-1", `text-${t.clr}-400`)}>{t.l}</h4>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 italic leading-none">{t.hint}</p>
                      </div>
                    ))}
                   </div>
                   <div className={`border-2 rounded-[40px] md:rounded-[64px] p-10 md:p-20 shadow-2xl relative overflow-hidden ${isDarkMode ? 'bg-[#0B0F1A] border-indigo-500/20' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                         <div className="space-y-4"><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic">Hasil Harga Jual</p><p className={`text-4xl md:text-7xl font-black italic tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatIDR(m.recommendedPrice)}</p></div>
                         <div className="space-y-4"><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic text-right">Target Unit Harian</p><p className="text-4xl md:text-7xl font-black italic tracking-tighter text-emerald-500 text-right">{m.bepDaily} Unit</p></div>
                      </div>
                      <div className="pt-10 mt-10 border-t border-white/5"><p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.5em] italic mb-6">Atur Margin Manual: {activeProduct.targetMargin}%</p><input type="range" min="5" max="95" value={activeProduct.targetMargin} onChange={e=>updateActiveProduct('targetMargin', Number(e.target.value))} className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-indigo-500" /></div>
                   </div>
                </motion.div>
              )}

              {activeTab === 'report' && (
                <motion.div key="rep" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-10">
                   <div className="bg-white text-slate-900 rounded-[32px] md:rounded-[64px] p-8 sm:p-14 md:p-20 shadow-[0_50px_100px_rgba(0,0,0,0.5)] min-h-[800px] border border-slate-100 font-bold relative overflow-hidden">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04] rotate-[20deg] text-[100px] md:text-[220px] font-black pointer-events-none select-none tracking-widest italic whitespace-nowrap">LAPORAN AUDIT</div>
                      <div className="flex justify-between items-start border-b-[6px] border-slate-900 pb-12 mb-16 relative z-10">
                         <div><h1 className="text-3xl md:text-6xl font-black uppercase italic tracking-tighter leading-none border-l-[18px] border-indigo-600 pl-8">AUDIT <span className="text-indigo-600">BISNIS</span></h1><p className="text-[12px] font-black uppercase tracking-[0.4em] italic mt-3 text-slate-400">Sistem Strategi Usaha UMKM</p></div>
                         <div className="w-16 h-16 md:w-20 bg-slate-900 rounded-[28px] flex items-center justify-center text-white"><LucidePieChart className="w-10 h-10"/></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-16 relative z-10 font-black italic">
                        <div className="bg-slate-100 rounded-[24px] md:rounded-[32px] p-6 md:p-8 text-center"><p className="text-[10px] text-slate-400 uppercase leading-none mb-2 tracking-widest italic leading-none">Harga Jual</p><p className="text-xl md:text-2xl">{formatCompactIDR(m.recommendedPrice).replace('Rp','').trim()}</p></div>
                        <div className="bg-indigo-50 rounded-[24px] md:rounded-[32px] p-6 md:p-8 text-center text-indigo-700"><p className="text-[10px] text-indigo-400 uppercase leading-none mb-2 tracking-widest italic leading-none">HPP Produk</p><p className="text-xl md:text-2xl">{formatCompactIDR(m.hppPerUnit).replace('Rp','').trim()}</p></div>
                        <div className="bg-rose-50 rounded-[24px] md:rounded-[32px] p-6 md:p-8 text-center text-rose-700"><p className="text-[10px] text-rose-500 uppercase leading-none mb-2 tracking-widest italic leading-none">Target Unit</p><p className="text-4xl leading-none">{m.bepDaily}</p></div>
                        <div className="bg-slate-900 rounded-[24px] md:rounded-[32px] p-6 md:p-8 text-center text-white shadow-xl"><p className="text-[10px] text-slate-500 uppercase leading-none mb-2 tracking-widest italic leading-none">Laba Bersih</p><p className="text-xl md:text-2xl text-indigo-400">{formatCompactIDR(m.totalProfit).replace('Rp','').trim()}</p></div>
                      </div>
                      <div className="p-8 md:p-16 bg-slate-50 border-l-[12px] border-indigo-600 rounded-r-[56px] italic leading-[2.2] text-slate-600 text-[14px] sm:text-[18px] md:text-[20px] text-justify relative z-10 font-bold">Laporan Audit mendeteksi efisiensi operasional sistem tetap stabil. Target minimal harian sebesar <span className="text-indigo-900 font-black underline mx-2">{m.bepDaily} UNIT</span> wajib dipertahankan untuk mengimbangi beban organisasi sebesar <span className="text-rose-800 font-black mx-2">{formatIDR(m.totalFixedMonthly)}</span> per bulan.</div>
                      <button onClick={()=>window.print()} className="w-full h-24 bg-slate-900 text-white rounded-[40px] text-lg font-black uppercase mt-12 shadow-2xl flex items-center justify-center gap-4 italic tracking-widest print:hidden active:scale-95 transition-all"><Printer className="w-7 h-7"/> UNDUH LAPORAN AUDIT PDF</button>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <button onClick={handleSave} className="fixed bottom-24 left-6 right-6 md:hidden h-16 bg-indigo-600 text-white font-black uppercase text-sm rounded-[20px] shadow-[0_15px_30px_rgba(79,70,229,0.5)] z-[100] border-t border-white/20 active:scale-95 transition-all flex items-center justify-center gap-3 italic tracking-widest">
           {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-6 h-6"/>} Simpan Perubahan Data
        </button>

        <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-[#0a0b1e]/95 backdrop-blur-2xl border-t border-white/10 flex justify-around px-2 pb-8 pt-4 z-[110] shadow-[0_-15px_40px_rgba(0,0,0,0.8)]">
           <MobileNavItem icon={LayoutDashboard} label="Ringkasan" active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')}/>
           <MobileNavItem icon={Database} label="Gudang" active={activeTab==='materials'} onClick={()=>setActiveTab('materials')}/>
           <MobileNavItem icon={TrendingUp} label="Harga" active={activeTab==='strategy'} onClick={()=>setActiveTab('strategy')}/>
           <MobileNavItem icon={FileText} label="Laporan" active={activeTab==='report'} onClick={()=>setActiveTab('report')}/>
        </nav>
      </main>
    </div>
  );
};

export default App;
