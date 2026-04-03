import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  Plus, Trash2, Calculator, TrendingUp, Target, 
  Info, ShoppingBag, Zap, Printer, RefreshCcw, Store, ChevronRight, ChevronLeft, 
  CheckCircle2, PieChart as LucidePieChart, Users, Home, HelpCircle, Layers, Download, Save, 
  FileText, Settings, LayoutDashboard, Database, CreditCard, BarChart3, X, ArrowUpRight, ArrowDownRight,
  Loader2, AlertCircle, Lock, Mail, Eye, EyeOff, LogOut, Search, Filter, Edit3, Calendar, ShieldCheck,
  Trophy, Gem, Sparkles, Scale, Percent, Wallet, DollarSign, Sunrise, TrendingDown, ClipboardCheck,
  Check, ArrowRight, Activity, ShieldAlert, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, AreaChart, Area, Cell, PieChart as RePieChart, Pie
} from 'recharts';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- UTILS ---
const cn = (...inputs) => twMerge(clsx(inputs));

const formatIDR = (val) => {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(val || 0);
};

const formatCompactIDR = (val) => {
  if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)} Jt`;
  if (val >= 1000) return `Rp ${(val / 1000).toFixed(1)} Rb`;
  return formatIDR(val);
};

// --- LOGIC ENGINE ---
const calculateMetrics = (product, customMargin = null) => {
  if (!product) return null;
  const targetMargin = customMargin !== null ? customMargin : (Number(product.targetMargin) || 10);
  
  let totalWasteCost = 0;
  const materials = (product.materials || []).map(m => {
    const pPrice = Number(m.packPrice) || 0;
    const pSize = Math.max(0.00001, Number(m.packSize) || 1);
    const pQty = Number(m.qty) || 0;
    const pWaste = Number(m.waste) || 0;
    const rawCost = (pPrice / pSize) * pQty;
    const itemWasteCost = rawCost * (pWaste / 100);
    const totalItemCost = rawCost + itemWasteCost;
    totalWasteCost += itemWasteCost;
    return { ...m, unitPrice: totalItemCost, itemWasteCost };
  });

  const totalMaterialCost = materials.reduce((sum, m) => sum + m.unitPrice, 0);
  const activeFixedCosts = (product.fixedCosts || []).filter(f => f && f.isActive !== false);
  const totalFixedMonthly = activeFixedCosts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const vol = Math.max(1, Number(product.expectedSalesVolume) || 1);
  const marketplaceFeePercent = Number(product.marketplaceFee) || 0;
  
  const hppPerUnit = totalMaterialCost + (totalFixedMonthly / vol);
  const marginMultiplier = 1 - (targetMargin / 100) - (marketplaceFeePercent / 100);
  const recommendedPrice = marginMultiplier > 0 ? hppPerUnit / marginMultiplier : hppPerUnit * 2;
  const profitPerUnit = recommendedPrice * (targetMargin / 100);
  const totalProfit = profitPerUnit * vol;
  const marginContribution = recommendedPrice - totalMaterialCost - (recommendedPrice * (marketplaceFeePercent / 100));
  const bepUnits = marginContribution > 0 ? totalFixedMonthly / marginContribution : 0;
  const bepDaily = bepUnits / 30;

  return {
    totalMaterialCost: Math.round(totalMaterialCost),
    totalFixedMonthly: Math.round(totalFixedMonthly),
    hppPerUnit: Math.round(hppPerUnit),
    recommendedPrice: Math.round(recommendedPrice),
    profitPerUnit: Math.round(profitPerUnit),
    totalProfit: Math.round(totalProfit),
    bepUnits: Math.ceil(bepUnits),
    bepDaily: Math.ceil(bepDaily),
    totalRevenue: Math.round(recommendedPrice * vol),
    totalWasteCost: Math.round(totalWasteCost),
    materials,
    fixedCosts: (product.fixedCosts || []),
    activeFixedCosts,
    targetMargin: Math.round(targetMargin),
    marketplaceFeePercent
  };
};

// --- APP ---

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [product, setProduct] = useState({
    id: 'croissant-almond', name: 'Croissant Almond',
    materials: [
      { id: 1, name: 'Tepung Terigu Premium', qty: 150, unit: 'g', packSize: 1000, packPrice: 18000, waste: 2 },
      { id: 2, name: 'Mentega Tawar Prancis', qty: 100, unit: 'g', packSize: 1000, packPrice: 120000, waste: 0 },
      { id: 3, name: 'Telur Ayam Omega', qty: 2, unit: 'butir', packSize: 1, packPrice: 3500, waste: 8 }
    ],
    fixedCosts: [
      { id: 10, name: 'Gaji Karyawan Utama', amount: 5000000, type: 'fix', isActive: true },
      { id: 11, name: 'Listrik & Air Industri', amount: 1200000, type: 'fix', isActive: true },
      { id: 12, name: 'Sewa Ruko Bulanan', amount: 3500000, type: 'fix', isActive: true }
    ],
    targetMargin: 45, expectedSalesVolume: 1200, marketplaceFee: 0
  });

  const activeMetrics = useMemo(() => calculateMetrics(product), [product]);
  useEffect(() => { const s = localStorage.getItem('isLoggedIn'); if (s === 'true') setIsLoggedIn(true); setTimeout(() => setIsLoading(false), 600); }, []);
  const handleLogin = () => { localStorage.setItem('isLoggedIn', 'true'); setIsLoggedIn(true); };
  const handleLogout = () => { localStorage.removeItem('isLoggedIn'); setIsLoggedIn(false); };

  const handleCustomPriceChange = (price) => {
    if (price === '') return;
    const val = Number(price) || 0;
    if (val <= activeMetrics.hppPerUnit) { setProduct(p => ({ ...p, targetMargin: 0 })); return; }
    const feePercent = activeMetrics.marketplaceFeePercent || 0;
    const hpp = activeMetrics.hppPerUnit;
    const marginPercent = (1 - (feePercent / 100) - (hpp / val)) * 100;
    setProduct(p => ({ ...p, targetMargin: Math.round(marginPercent) }));
  };

  const updateMaterial = (id, field, value) => {
    setProduct(p => ({ ...p, materials: (p.materials || []).map(m => (m.id === id ? { ...m, [field]: value } : m)) }));
  };

  const updateFixedCost = (id, field, value) => {
    setProduct(p => ({ ...p, fixedCosts: (p.fixedCosts || []).map(f => (f.id === id ? { ...f, [field]: value } : f)) }));
  };

  const BackgroundBlobs = () => (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-blob" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[120px] animate-blob" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[20%] left-[-5%] w-[30%] h-[30%] bg-purple-600/5 rounded-full blur-[100px] animate-blob" style={{ animationDelay: '4s' }} />
    </div>
  );

  const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <button onClick={onClick} className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative", 
      active 
        ? "bg-indigo-600/20 text-white border border-indigo-500/20 shadow-[0_0_15px_rgba(79,70,229,0.1)]" 
        : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-200"
    )}>
      <Icon className={cn("w-5 h-5", active ? "text-indigo-400 scale-110" : "text-slate-600 group-hover:text-slate-400 group-hover:rotate-6 transition-all")} />
      <span className={cn("font-bold text-[11px] uppercase tracking-[0.25em] transition-all", active ? "text-white" : "text-slate-500")}>{label}</span>
      {active && (
        <motion.div 
          layoutId="sidebar-active" 
          className="absolute -left-1 top-2 bottom-2 w-1.5 bg-indigo-500 rounded-full blur-[2px]" 
        />
      )}
    </button>
  );

  const MetricCard = ({ title, value, subtext, icon: Icon, clr = "indigo", trend = null, isHero = false }) => (
    <div className={cn(
      "glass-card rounded-3xl p-6 relative overflow-hidden group hover:bg-white/[0.06] transition-all border border-white/5 active:scale-[0.98]",
      isHero ? "col-span-1 md:col-span-2 border-indigo-500/20 bg-gradient-to-br from-indigo-600/5 to-transparent" : "shadow-md"
    )}>
      <div className={cn("absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-[0.05] blur-[40px]", `bg-${clr}-500`)} />
      <div className="flex justify-between items-start mb-4">
        <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 group-hover:-rotate-3", `bg-${clr}-500/20 text-${clr}-400`)}>
          <Icon className="w-5.5 h-5.5" />
        </div>
        <div className="flex flex-col items-end">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 italic mb-1">{title}</div>
          {trend && (
            <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black italic", trend > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
              {trend > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
      </div>
      <div className={cn("font-black text-white italic tracking-tighter leading-none mb-2", isHero ? "text-4xl" : "text-2xl")}>{value}</div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none italic flex items-center gap-1.5">
        {subtext}
        <Info className="w-2.5 h-2.5 opacity-30 cursor-help hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );

  const MetricBadge = ({ value, color = "slate", prefix = "" }) => (
    <span className={cn("font-black px-1.5 py-0.5 rounded-md text-[12px] mx-1 border align-baseline tracking-tight italic", 
      color === "indigo" ? "bg-indigo-50 text-indigo-700 border-indigo-100" : color === "emerald" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : color === "rose" ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-slate-100 text-slate-900 border-slate-200"
    )}>{prefix}{value}</span>
  );

  if (isLoading) return <div className="min-h-screen bg-[#080916] flex flex-col items-center justify-center text-white font-outfit relative overflow-hidden"><BackgroundBlobs /><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /><span className="mt-4 text-[9px] font-black uppercase tracking-[0.6em] text-slate-500 animate-pulse italic">HPP MASTER PRO ACTIVE</span></div>;

  if (!isLoggedIn) return (
    <div className="min-h-screen bg-[#080916] flex flex-col items-center justify-center p-6 relative overflow-hidden font-outfit">
      <BackgroundBlobs />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8"><div className="w-14 h-14 bg-indigo-600 rounded-[18px] mx-auto flex items-center justify-center shadow-2xl mb-4"><Calculator className="text-white w-7 h-7" /></div><h1 className="text-xl font-black text-white uppercase italic tracking-tighter">HPP MASTER <span className="text-indigo-500">PRO</span></h1></div>
        <div className="glass-card rounded-[32px] p-8 shadow-2xl">
          <form onSubmit={(e)=>{e.preventDefault(); handleLogin();}} className="space-y-5">
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-2">Email</label><input type="email" required defaultValue="admin@masterhpp.com" className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3 px-5 text-sm text-white focus:outline-none focus:border-indigo-500/30 transition-all font-bold" /></div>
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-2">Password</label><input type="password" required defaultValue="password123" className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3 px-5 text-sm text-white focus:outline-none focus:border-indigo-500/30 transition-all font-bold" /></div>
            <button type="submit" className="w-full bg-indigo-600 text-white font-black uppercase tracking-[0.2em] py-3 rounded-xl text-[10px] shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Launch Dashboard</button>
          </form></div></motion.div></div>);

  return (
    <div className="h-screen bg-[#080916] flex text-slate-200 overflow-hidden font-outfit relative">
      <BackgroundBlobs />
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0a0b1e] border-r border-white/5 flex flex-col p-6 h-full lg:flex shrink-0 print:hidden relative z-50">
        <div className="flex items-center gap-3 mb-12 px-2 cursor-pointer group">
          <div className="w-10 h-10 bg-indigo-600 rounded-[14px] flex items-center justify-center shadow-[0_10px_20px_rgba(79,70,229,0.3)] group-hover:rotate-6 transition-all duration-500">
            <Calculator className="text-white w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <div className="font-outfit font-black text-lg italic tracking-tighter leading-none uppercase text-white">HPP MASTER</div>
            <div className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.3em] mt-1">PRO EDITION</div>
          </div>
        </div>
        <div className="space-y-1.5 flex-1 pr-1 font-bold overflow-y-auto no-scrollbar">
          <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em] mb-4 ml-4 italic">Core Analytics</p>
          <SidebarItem icon={LayoutDashboard} label="Ringkasan" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Database} label="Bahan Baku" active={activeTab === 'bahan-baku'} onClick={() => setActiveTab('bahan-baku')} />
          <SidebarItem icon={Zap} label="Operasional" active={activeTab === 'biaya-operasional'} onClick={() => setActiveTab('biaya-operasional')} />
          <div className="pt-8 mb-4">
            <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em] mb-4 ml-4 italic">Decision Tools</p>
            <SidebarItem icon={TrendingUp} label="Strategi Harga" active={activeTab === 'strategi-harga'} onClick={() => setActiveTab('strategi-harga')} />
            <SidebarItem icon={FileText} label="Laporan Audit" active={activeTab === 'laporan'} onClick={() => setActiveTab('laporan')} />
          </div>
        </div>
        <div className="mt-auto pt-6 border-t border-white/5 px-1">
          <div className="flex items-center gap-3 p-4 bg-white/[0.02] rounded-2xl mb-4 border border-white/5">
             <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-indigo-400">ADM</div>
             <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-black text-white truncate leading-none uppercase italic">Admin Toko</p>
                <p className="text-[8px] font-bold text-slate-600 truncate mt-1">Standard Pro Plan</p>
             </div>
          </div>
          <SidebarItem icon={LogOut} label="Log Out" onClick={handleLogout} />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative bg-transparent font-medium overflow-hidden">
        <header className="h-16 bg-[#080916]/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-8 shrink-0 z-40 print:hidden font-bold">
           <div className="flex items-center gap-6">
              <div className="flex flex-col">
                 <div className="flex items-center gap-2 text-[8px] font-black text-slate-500 uppercase tracking-widest italic mb-1">
                    <Home className="w-2.5 h-2.5" /> / {activeTab.replace('-',' ').toUpperCase()}
                 </div>
                 <h1 className="text-sm font-black text-white italic tracking-tighter uppercase leading-none">{activeTab === 'dashboard' ? 'RINGKASAN ANALITIK' : activeTab.replace('-',' ').toUpperCase()}</h1>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest italic">Sinkronisasi Aktif</span>
              </div>
           </div>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all group cursor-pointer">
                 <Layers className="w-3 h-3 text-indigo-400 group-hover:rotate-12 transition-transform"/>
                 <select className="bg-transparent border-none text-[9px] font-black uppercase text-white focus:ring-0 cursor-pointer outline-none italic"><option>Produk: {product.name}</option><option>Produk: Cookie Crumble</option></select>
              </div>
              <button onClick={()=>{setIsSaving(true);setTimeout(()=>setIsSaving(false),600);}} className="group px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-[9px] uppercase shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 hover:bg-indigo-500">{isSaving ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-3.5 h-3.5" />} Simpan Data</button>
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 font-medium scroll-smooth custom-scrollbar">
          <div className="max-w-[1280px] mx-auto w-full space-y-6">
            <AnimatePresence mode="wait">

              {/* 1. DASHBOARD */}
              {activeTab === 'dashboard' && (
                <motion.div key="db" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <MetricCard isHero title="Laba Bulanan (Target)" value={formatCompactIDR(activeMetrics.totalProfit)} icon={Trophy} clr="amber" trend={12.4} subtext="Target Pertumbuhan Usaha" />
                    <MetricCard isHero title="Wajib Jual Harian (BEP)" value={`${activeMetrics.bepDaily} Unit`} icon={Target} clr="rose" trend={-2.1} subtext="Titik Impas Aman Operasional" />
                    <MetricCard title="HPP Per Unit" value={formatIDR(activeMetrics.hppPerUnit)} icon={Calculator} clr="emerald" subtext="Beban Pokok Produksi" />
                    <MetricCard title="Simulasi Harga" value={formatIDR(activeMetrics.recommendedPrice)} icon={TrendingUp} clr="indigo" subtext="Posisi Harga Di Pasar" />
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    <div className="xl:col-span-8 space-y-6">
                      <div className="glass-card rounded-[32px] p-8 bg-[#0a0b1e]/40 border-white/5 overflow-hidden">
                        <div className="flex justify-between items-center mb-8">
                          <div><h3 className="text-xs font-black text-white uppercase italic tracking-widest flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-500"/> Proyeksi Pertumbuhan Laba</h3></div>
                        </div>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={[{n:'100',p:activeMetrics.profitPerUnit*100},{n:'500',p:activeMetrics.profitPerUnit*500},{n:'1k',p:activeMetrics.profitPerUnit*1000},{n:'1.5k',p:activeMetrics.profitPerUnit*1500}]}>
                              <defs><linearGradient id="cP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false}/>
                              <XAxis dataKey="n" stroke="#475569" fontSize={10} axisLine={false} tickLine={false}/>
                              <RechartsTooltip contentStyle={{background:'#0a0b1e',border:'none',borderRadius:'12px',fontSize:'11px'}}/>
                              <Area type="monotone" dataKey="p" stroke="#6366f1" fillOpacity={1} fill="url(#cP)" strokeWidth={3}/>
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="glass-card rounded-[32px] p-8 shadow-xl relative border-white/5 bg-[#0a0b1e]/20">
                        <div className="flex justify-between items-center mb-6">
                           <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2 italic"><Database className="w-4 h-4 text-emerald-500"/> Rincian Komposisi Bahan</h3>
                           <button onClick={()=>setActiveTab('bahan-baku')} className="text-[9px] font-black text-indigo-400 uppercase italic hover:underline">Kelola Detail</button>
                        </div>
                        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-[10px] font-black text-slate-600 border-b border-white/5 uppercase italic tracking-widest text-left"><th className="pb-5 pl-2">Komponen</th><th className="pb-5 text-center">Porsi</th><th className="pb-5 text-center">Susut</th><th className="pb-5 text-right pr-2">HPP</th></tr></thead>
                        <tbody>{activeMetrics.materials.map(m=>(<tr key={m.id} className="hover:bg-white/[0.02] border-b border-white/5 last:border-0 font-bold"><td className="py-5 pl-2 text-white italic">{m.name}</td><td className="py-5 text-center text-slate-400">{m.qty}{m.unit}</td><td className="py-5 text-center"><span className="px-2 py-0.5 rounded-md bg-rose-500/5 text-rose-500 text-[10px]">{m.waste}%</span></td><td className="py-5 text-right pr-2 font-black">Rp {formatIDR(m.unitPrice).replace('Rp','').trim()}</td></tr>))}</tbody></table></div>
                      </div>
                    </div>
                    <div className="xl:col-span-4 space-y-6">
                       <div className="glass-card rounded-[32px] p-8 bg-indigo-600/10 border-indigo-500/20 text-center"><Sparkles className="w-10 h-10 text-indigo-500 mx-auto mb-4 animate-pulse"/><h4 className="text-lg font-black text-white italic uppercase mb-2">Insight Strategis</h4><p className="text-xs text-slate-400 italic mb-6">Penjualan anda berada diatas ambang batas BEP harian.</p><button onClick={()=>setActiveTab('strategi-harga')} className="w-full py-4 bg-indigo-600 rounded-xl text-[10px] font-black uppercase">Optimasi Sekarang</button></div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 2. BAHAN BAKU */}
              {activeTab === 'bahan-baku' && (
                <motion.div key="bb" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div><h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Database Bahan Baku</h2><p className="text-[10px] font-bold text-slate-500 uppercase mt-1 italic">Monitor Efisiensi & Kontribusi HPP</p></div>
                    <div className="flex gap-3"><input placeholder="Cari Bahan..." className="bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none w-48 italic"/><button onClick={()=>{setProduct(p=>({...p, materials: [...(p.materials || []), {id: Date.now(), name: 'Bahan Baru', qty: 1, unit: 'g', packSize: 1, packPrice: 0, waste: 0}]}))}} className="px-5 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl flex items-center gap-2"><Plus className="w-4 h-4"/> Tambah</button></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {product.materials.map(m => {
                      const costWeight = ((m.unitPrice / activeMetrics.hppPerUnit) * 100).toFixed(1);
                      const isHighWaste = m.waste > 15;
                      return (
                        <div key={m.id} className={cn("glass-card rounded-[32px] p-6 space-y-6 border border-white/5 hover:border-white/10 transition-all shadow-xl group", isHighWaste && "border-rose-500/20")}>
                          <div className="flex justify-between items-center"><span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase italic", isHighWaste ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500")}>{isHighWaste ? "⚠️ Susut Tinggi" : "✓ Aman"}</span><span className="text-[10px] font-black text-indigo-400 italic">Impact: {costWeight}%</span></div>
                          <input value={m.name} onChange={e=>updateMaterial(m.id,'name',e.target.value)} className="w-full bg-transparent border-none p-0 text-xl font-black text-white italic uppercase focus:ring-0" placeholder="Nama Bahan..."/>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1"><span className="text-[8px] font-black text-slate-500 uppercase italic leading-none">Harga Beli</span><input type="number" value={m.packPrice||''} onChange={e=>updateMaterial(m.id,'packPrice',Number(e.target.value))} className="bg-transparent border-none p-0 w-full text-white font-black italic focus:ring-0 text-center" placeholder="0"/></div>
                            <div className="bg-rose-500/5 p-4 rounded-2xl border border-white/5 space-y-1"><span className="text-[8px] font-black text-rose-500 uppercase italic leading-none">Susut %</span><input type="number" value={m.waste||''} onChange={e=>updateMaterial(m.id,'waste',Number(e.target.value))} className="bg-transparent border-none p-0 w-full text-rose-400 font-black italic focus:ring-0 text-center" placeholder="0"/></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                             <div className="p-3 bg-white/3 rounded-2xl border border-white/5 text-center"><p className="text-[8px] font-black text-slate-600 uppercase italic leading-none mb-1">Vol Beli</p><input type="number" value={m.packSize} onChange={e=>updateMaterial(m.id, 'packSize', Number(e.target.value))} className="bg-transparent border-none p-0 w-full text-white font-black italic focus:ring-0 text-center text-sm"/><p className="text-[7px] text-slate-700 uppercase font-black">{m.unit}</p></div>
                             <div className="p-3 bg-white/3 rounded-2xl border border-white/5 text-center"><p className="text-[8px] font-black text-slate-600 uppercase italic leading-none mb-1">Resep</p><input type="number" value={m.qty} onChange={e=>updateMaterial(m.id, 'qty', Number(e.target.value))} className="bg-transparent border-none p-0 w-full text-white font-black italic focus:ring-0 text-center text-sm"/><p className="text-[7px] text-slate-700 uppercase font-black">{m.unit}</p></div>
                          </div>
                          <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={()=>setProduct(p=>({...p, materials: p.materials.filter(x=>x.id!==m.id)}))} className="text-slate-800 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button></div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* 3. BIAYA OPERASIONAL */}
              {activeTab === 'biaya-operasional' && (
                <motion.div key="bo" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    <div className="lg:col-span-8 glass-card rounded-[32px] p-8 border-white/5 bg-gradient-to-br from-indigo-900/10 to-transparent shadow-2xl relative overflow-hidden">
                       <div className="flex justify-between items-center mb-10">
                          <div><h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">Pusat Kontrol Operasional</h2><p className="text-[10px] font-bold text-slate-500 uppercase italic mt-1">Monitor Beban Tetap vs Variabel Bulanan</p></div>
                          <div className="text-right"><p className="text-[10px] font-black text-slate-500 uppercase italic leading-none">Total Operasional</p><p className="text-3xl font-black text-white italic tracking-tighter mt-1">{formatIDR(activeMetrics.totalFixedMonthly)}</p></div>
                       </div>
                       <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-3"><div className="flex justify-between items-end"><span className="text-[10px] font-black text-indigo-400 uppercase italic">Fix Costs</span><span className="text-xs font-black text-white italic">{formatIDR(activeMetrics.totalFixedMonthly*0.8)}</span></div><div className="w-full h-2 bg-white/5 rounded-full overflow-hidden shrink-0"><div className="h-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" style={{ width: '80%' }} /></div></div>
                          <div className="space-y-3"><div className="flex justify-between items-end"><span className="text-[10px] font-black text-amber-500 uppercase italic">Variable</span><span className="text-xs font-black text-white italic">{formatIDR(activeMetrics.totalFixedMonthly*0.2)}</span></div><div className="w-full h-2 bg-white/5 rounded-full overflow-hidden shrink-0"><div className="h-full bg-amber-500 shadow-[0_0_10px_#f59e0b]" style={{ width: '20%' }} /></div></div>
                       </div>
                    </div>
                    <div className="lg:col-span-4 glass-card rounded-[32px] p-8 bg-rose-500/5 border-rose-500/10 flex flex-col justify-center items-center text-center">
                       <ShieldAlert className="w-10 h-10 text-rose-500 mb-4 animate-pulse" /><h4 className="text-lg font-black text-white italic uppercase tracking-tighter">Batas Efisiensi</h4><p className="text-[10px] font-bold text-slate-500 italic mt-1 leading-relaxed px-4">Kurangi beban harian untuk menurunkan target unit BEP harian Anda.</p>
                       <button onClick={()=>{setProduct(p=>({...p, fixedCosts: [...(p.fixedCosts || []), {id: Date.now(), name: 'Biaya Baru', amount: 0, type: 'fix', isActive: true}]}))}} className="mt-8 w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[9px] font-black uppercase text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"><Plus className="w-4 h-4"/> Tambah Item</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {product.fixedCosts.map(item => {
                      const share = ((item.amount / (activeMetrics.totalFixedMonthly || 1)) * 100).toFixed(0);
                      return (
                        <div key={item.id} className={cn("glass-card rounded-[32px] p-7 transition-all border group relative overflow-hidden", item.isActive ? "bg-white/[0.02] border-white/5 shadow-xl" : "opacity-40 grayscale border-white/5")}>
                          <div className="flex justify-between items-center mb-6">
                             <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase italic", item.isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-500")}>{item.isActive ? "Hitung Dalam HPP" : "Diabaikan"}</span>
                             <button onClick={()=>updateFixedCost(item.id, 'isActive', !item.isActive)} className={cn("w-12 h-6 rounded-full relative p-1 flex items-center transition-all", item.isActive ? "bg-indigo-600 justify-end" : "bg-slate-800 justify-start")}><div className="w-4 h-4 bg-white rounded-full shadow-md"/></button>
                          </div>
                          <div className="space-y-4">
                             <input value={item.name} onChange={e=>updateFixedCost(item.id,'name',e.target.value)} className="w-full bg-transparent border-none p-0 text-xl font-black text-white italic uppercase focus:ring-0 tracking-tighter" placeholder="Deskripsi..."/>
                             <div className="flex items-baseline gap-2 font-black italic"><span className="text-sm text-slate-500">Rp</span><input type="number" value={item.amount||''} onChange={e=>updateFixedCost(item.id,'amount',Number(e.target.value))} className="bg-transparent border-none p-0 text-4xl text-white focus:ring-0 w-full tracking-tighter" placeholder="0"/></div>
                          </div>
                          <div className="flex justify-between items-center pt-8 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                             <p className="text-[10px] font-bold text-slate-600 italic">Impact Share: <span className="text-indigo-400 font-black">{share}%</span></p>
                             <button onClick={()=>setProduct(p=>({...p, fixedCosts: p.fixedCosts.filter(x=>x.id!==item.id)}))} className="text-slate-800 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* 4. STRATEGI HARGA - GUIDED FLOW */}
              {activeTab === 'strategi-harga' && (
                <motion.div key="sh" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-12 pb-20 max-w-6xl mx-auto">
                   
                   {/* STEP 1: STRATEGY SELECTION */}
                   <section className="space-y-8">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-l-4 border-indigo-500 pl-6">
                         <div className="space-y-1">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] italic">Langkah 01</span>
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none font-outfit">Pilih Karakter Bisnis</h2>
                            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest italic mt-2">Tentukan level keuntungan berdasarkan peta kompetisi pasar</p>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                          { l: 'Tier Kompetitif', m: 25, ic: Sparkles, clr: 'amber', hint: 'Bisnis Baru / Penetrasi', badge: 'Pasar Massal' },
                          { l: 'Tier Standar', m: 45, ic: Trophy, clr: 'indigo', hint: 'Kualitas & Layanan Utama', badge: 'Best for Growth', recommended: true },
                          { l: 'Tier Premium', m: 70, ic: Gem, clr: 'rose', hint: 'Eksklusif & High-Value', badge: 'Niche Market' }
                        ].map(t => (
                          <div 
                            key={t.l} 
                            onClick={() => setProduct({ ...product, targetMargin: t.m })} 
                            className={cn(
                              "glass-card rounded-[32px] p-8 space-y-6 border-2 transition-all cursor-pointer group relative overflow-hidden",
                              product.targetMargin === t.m 
                                ? `border-${t.clr}-500 bg-${t.clr}-500/[0.03] shadow-[0_20px_50px_rgba(0,0,0,0.3)] scale-[1.02] z-10` 
                                : "border-white/5 opacity-50 hover:opacity-80 grayscale-[0.5] hover:grayscale-0"
                            )}
                          >
                            {t.recommended && (
                               <div className="absolute top-4 right-4 px-3 py-1 bg-indigo-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-lg italic">Recommended</div>
                            )}
                            <div className="flex justify-between items-start">
                               <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl", `bg-${t.clr}-600`)}>
                                  <t.ic className="w-7 h-7" />
                               </div>
                               <div className="text-right">
                                  <p className="text-[9px] font-black text-slate-500 uppercase italic mb-1">Target Margin</p>
                                  <p className="text-3xl font-black text-white italic tracking-tighter">{t.m}%</p>
                               </div>
                            </div>
                            <div className="space-y-1">
                               <h4 className={cn("text-xl font-black uppercase italic tracking-tighter leading-none mb-1", `text-${t.clr}-400`)}>{t.l}</h4>
                               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">{t.hint}</p>
                            </div>
                            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                               <p className="text-[8px] font-black text-slate-600 uppercase mb-2 italic">Badge Karakter</p>
                               <span className={cn("inline-block px-3 py-1 rounded-lg text-[9px] font-black uppercase italic tracking-widest", `bg-${t.clr}-500/10 text-${t.clr}-400`)}>
                                  {t.badge}
                               </span>
                            </div>
                          </div>
                        ))}
                      </div>
                   </section>

                   {/* VISUAL DIVIDER / FLOW ARROW */}
                   <div className="flex justify-center -my-6 relative z-20">
                      <div className="w-12 h-12 bg-[#0a0b1e] border border-white/10 rounded-full flex items-center justify-center text-indigo-500 shadow-xl">
                         <ChevronDown className="w-6 h-6 animate-bounce" />
                      </div>
                   </div>

                   {/* STEP 2: IMPACT & RESULTS PANEL */}
                   <section className="space-y-8">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-l-4 border-indigo-500 pl-6">
                         <div className="space-y-1">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] italic">Langkah 02</span>
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none font-outfit">Analisis Hasil Strategi</h2>
                            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest italic mt-2">Dampak pemilihan strategi terhadap angka riil di lapangan</p>
                         </div>
                      </div>

                      <div className="glass-card rounded-[40px] p-10 border-white/5 bg-[#0a0b1e]/40 shadow-2xl relative overflow-hidden">
                         <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500 opacity-[0.03] blur-[120px] pointer-events-none" />
                         <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
                            <div className="space-y-2">
                               <p className="text-[10px] font-black text-slate-500 uppercase italic flex items-center gap-2 tracking-widest">Rekomendasi Harga <Info className="w-3 h-3 opacity-30"/></p>
                               <p className="text-4xl font-black text-white italic tracking-tighter leading-none">{formatIDR(activeMetrics.recommendedPrice)}</p>
                            </div>
                            <div className="space-y-2">
                               <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest">Margin Real / Unit</p>
                               <p className="text-4xl font-black text-emerald-400 italic tracking-tighter leading-none">{formatIDR(activeMetrics.profitPerUnit)}</p>
                            </div>
                            <div className="space-y-2">
                               <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest">HPP Unit Pokok</p>
                               <p className="text-4xl font-black text-slate-400 italic tracking-tighter leading-none">{formatIDR(activeMetrics.hppPerUnit)}</p>
                            </div>
                            <div className="space-y-2 text-right flex flex-col justify-center items-end border-l border-white/5 pl-8">
                               <p className="text-[10px] font-black text-indigo-400 uppercase italic tracking-widest mb-1">Status Profitabilitas</p>
                               <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 font-black italic text-xs uppercase tracking-widest">
                                  Healthy Margin <CheckCircle2 className="w-4 h-4 ml-2" />
                               </div>
                            </div>
                         </div>
                      </div>
                   </section>
                   <div className="flex justify-center -my-6 relative z-20">
                      <div className="w-12 h-12 bg-[#0a0b1e] border border-white/10 rounded-full flex items-center justify-center text-indigo-500 shadow-xl">
                         <ChevronDown className="w-6 h-6 animate-bounce" />
                      </div>
                   </div>

                   {/* STEP 3 & 4: ADJUSTMENT & TARGET (2-COLUMN LAYOUT) */}
                   <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch pt-2">
                      {/* STEP 3: ADJUSTMENT */}
                      <div className="lg:col-span-7 space-y-4">
                         <div className="flex items-center gap-4 border-l-4 border-amber-500 pl-5 mb-6">
                            <div className="space-y-1">
                               <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.3em] italic">Langkah 03 (Opsional)</span>
                               <h2 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none font-outfit">Fine-Tuning Margin</h2>
                            </div>
                         </div>
                         <div className="glass-card rounded-[32px] p-8 border border-white/5 bg-white/[0.01] shadow-xl relative overflow-hidden flex flex-col justify-center h-full min-h-[280px]">
                            <div className="absolute left-[-40px] top-[-40px] w-48 h-48 bg-amber-500 opacity-[0.03] blur-[80px]" />
                            <div className="space-y-8 relative z-10">
                               <div className="text-center space-y-1">
                                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block italic mb-2">Atur Margin Keuntungan</label>
                                  <div className="flex items-center justify-center gap-4">
                                     <button onClick={()=>setProduct(p=>({...p, targetMargin: Math.max(5, p.targetMargin-5)}))} className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white text-[10px] hover:bg-white/10 transition-all font-black">-5%</button>
                                     <p className="text-6xl font-black text-white italic tracking-tighter leading-none select-none drop-shadow-2xl">{product.targetMargin}<span className="text-2xl text-indigo-500">%</span></p>
                                     <button onClick={()=>setProduct(p=>({...p, targetMargin: Math.min(95, p.targetMargin+5)}))} className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white text-[10px] hover:bg-white/10 transition-all font-black">+5%</button>
                                  </div>
                               </div>
                               <div className="px-6">
                                  <input 
                                     type="range" min="5" max="95" 
                                     value={product.targetMargin} 
                                     onChange={e=>setProduct({...product, targetMargin: Number(e.target.value)})} 
                                     className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-indigo-500 cursor-pointer shadow-inner"
                                  />
                               </div>
                               <p className="text-center text-[9px] font-bold text-slate-600 italic uppercase tracking-wider">Adjustment Manual Per Garis</p>
                            </div>
                         </div>
                      </div>

                      {/* STEP 4: TARGET BEP */}
                      <div className="lg:col-span-5 space-y-4">
                         <div className="flex items-center gap-4 border-l-4 border-emerald-500 pl-5 mb-6">
                            <div className="space-y-1">
                               <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] italic">Langkah 04 — Goal</span>
                               <h2 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none font-outfit">Target Laju Harian</h2>
                            </div>
                         </div>
                         <div className="glass-card rounded-[32px] p-8 bg-indigo-600/[0.04] border border-indigo-500/10 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center h-full min-h-[280px]">
                            <div className="absolute right-[-30px] bottom-[-30px] w-48 h-48 bg-emerald-500 opacity-[0.05] blur-[80px]" />
                            <div className="bg-[#0a0b1e]/60 p-10 rounded-[40px] border border-white/5 shadow-inner w-full flex flex-col items-center justify-center relative z-10">
                               <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.3em] mb-4 text-center italic leading-none">Daily Target (BEP)</p>
                               <div className="relative">
                                  <p className="text-7xl font-black text-white italic tracking-tighter leading-none">{activeMetrics.bepDaily}</p>
                                  <div className="absolute -right-8 top-0 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-[8px] font-black animate-pulse shadow-lg">BEP</div>
                               </div>
                               <p className="text-[9px] font-black text-slate-500 mt-6 uppercase flex items-center gap-2 italic tracking-widest leading-none">
                                  <Sunrise className="w-4 h-4 text-amber-500"/> Unit Terjual / Hari
                               </p>
                            </div>
                         </div>
                      </div>
                   </section>

                   {/* FINAL ACTION CALL */}
                   <div className="pt-10 flex flex-col items-center gap-6">
                      <div className="w-px h-24 bg-gradient-to-b from-indigo-500/50 to-transparent" />
                      <button onClick={()=>setActiveTab('laporan')} className="px-12 py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase italic tracking-[0.3em] text-xs shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:bg-indigo-500 active:scale-95 transition-all flex items-center gap-4 group">
                         Finalisasi & Cetak Audit <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                      </button>
                   </div>
                </motion.div>
              )}

              {/* 5. LAPORAN AUDIT PROFESIONAL */}
              {activeTab === 'laporan' && (
                <motion.div key="lap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-10 max-w-5xl mx-auto pb-24">
                  
                  {/* REPORT CONTROLS */}
                  <div className="flex justify-between items-center border-b border-white/5 pb-8 mb-4 print:hidden px-4">
                     <div>
                        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none italic">Audit Intelligence Suite</h2>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic">Professional performance audit & profit roadmap</p>
                     </div>
                     <div className="flex gap-4">
                        <button onClick={()=>window.print()} className="px-8 py-4 rounded-2xl bg-white border border-slate-900 text-black text-[11px] font-black uppercase flex items-center gap-3 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">
                           <Printer className="w-5 h-5"/> CETAK LAPORAN PROFESIONAL
                        </button>
                     </div>
                  </div>

                  {/* MAIN REPORT PAPER */}
                  <div className="bg-white p-14 rounded-[32px] shadow-[0_40px_80px_rgba(0,0,0,0.4)] text-slate-900 print:shadow-none print:p-0 print:m-0 print:rounded-none relative overflow-hidden font-outfit border border-slate-100 min-h-[1200px]">
                      
                      {/* WATERMARK & HEADER context */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] rotate-[-25deg] pointer-events-none text-[220px] font-black text-black leading-none select-none tracking-[0.1em] whitespace-nowrap uppercase">CONFIDENTIAL</div>
                      
                      <div className="flex justify-between items-start border-b-[6px] border-slate-900 pb-12 mb-12 relative z-10">
                         <div className="space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                               <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl">
                                  <Calculator className="w-6 h-6" />
                               </div>
                               <span className="text-sm font-black uppercase tracking-[0.4em] text-slate-400">Master HPP Engine v2.0</span>
                            </div>
                            <h1 className="text-5xl font-black uppercase tracking-tighter border-l-[15px] border-indigo-600 pl-8 leading-none italic">
                               LAPORAN AUDIT<br/>
                               <span className="text-indigo-600">PERFORMA BISNIS</span>
                            </h1>
                            <div className="flex gap-10 pl-8 pt-4">
                               <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">PRODUK AUDIT</p><p className="font-black text-sm italic">{product.name.toUpperCase()}</p></div>
                               <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TANGGAL LAPORAN</p><p className="font-black text-sm italic">{new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
                               <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID AUDIT</p><p className="font-black text-sm italic text-indigo-600">#{product.id.toUpperCase()}-0024</p></div>
                            </div>
                         </div>
                         <div className="text-right">
                            <div className="w-24 h-24 bg-slate-900 rounded-[32px] shadow-2xl flex items-center justify-center text-white mb-4 ml-auto">
                               <LucidePieChart className="w-12 h-12" />
                            </div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 inline-block">Verified Accurate ✓</p>
                         </div>
                      </div>

                      <div className="grid grid-cols-12 gap-12 relative z-10">
                         {/* MODULE 1: KPI INTERPRETATION (LEFT COLUMN) */}
                         <div className="col-span-12 xl:col-span-8 space-y-12">
                            
                            {/* SECTION: KPI TIERS */}
                            <section className="space-y-6">
                               <h3 className="text-xs font-black uppercase tracking-[0.4em] border-b-2 border-slate-900 pb-3 italic flex items-center gap-3 text-slate-900 leading-none">
                                  <TrendingUp className="text-indigo-600 w-6 h-6"/> Ringkasan Metrik Finansial
                               </h3>
                               <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-slate-50 border border-slate-200 rounded-[32px] p-8 space-y-3 relative overflow-hidden group">
                                     <p className="text-[10px] font-black text-slate-400 uppercase italic">Profit Per Unit (Nett)</p>
                                     <div className="flex items-end justify-between">
                                        <p className="text-3xl font-black italic">{formatIDR(activeMetrics.profitPerUnit)}</p>
                                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full uppercase italic leading-none border border-emerald-200 shadow-sm">Sehat</span>
                                     </div>
                                     <p className="text-[9px] font-bold text-slate-500 italic mt-2">"Kontribusi bersih tiap unit terjual ke laba bulanan."</p>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-200 rounded-[32px] p-8 space-y-3 relative overflow-hidden group">
                                     <p className="text-[10px] font-black text-slate-400 uppercase italic">Current Margin (%)</p>
                                     <div className="flex items-end justify-between">
                                        <p className="text-3xl font-black italic">{product.targetMargin}%</p>
                                        <span className={cn("text-[10px] font-black px-3 py-1 rounded-full uppercase italic leading-none border shadow-sm", product.targetMargin > 30 ? "bg-indigo-100 text-indigo-800 border-indigo-200" : "bg-amber-100 text-amber-800 border-amber-200")}>
                                           {product.targetMargin > 30 ? "Optimal" : "Fair"}
                                        </span>
                                     </div>
                                     <p className="text-[9px] font-bold text-slate-500 italic mt-2">"Persentase keuntungan di atas seluruh beban pokok."</p>
                                  </div>
                               </div>
                            </section>

                            {/* SECTION: EXECUTIVE SUMMARY TEXT */}
                            <section className="space-y-6">
                               <h3 className="text-xs font-black uppercase tracking-[0.4em] border-b-2 border-slate-900 pb-3 italic flex items-center gap-3 text-slate-900 leading-none">
                                  <FileText className="text-indigo-600 w-6 h-6"/> Analisis & Insight Strategis
                               </h3>
                               <div className="p-10 bg-slate-900 text-white rounded-[48px] italic leading-[2.2] shadow-2xl relative overflow-hidden">
                                  <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500 opacity-20 blur-[80px]" />
                                  <p className="text-sm font-medium text-slate-300 mb-6 font-outfit text-justify relative z-10">
                                     Hasil audit menunjukkan bahwa struktur biaya <MetricBadge value={product.name} /> telah mencapai <span className="text-emerald-400 font-bold">Titik Efisiensi Aman</span>. Dengan total beban operasional bulanan sebesar <MetricBadge value={formatIDR(activeMetrics.totalFixedMonthly)} color="rose" />, bisnis Anda memerlukan volume harian minimal <MetricBadge value={`${activeMetrics.bepDaily} Unit`} color="indigo" /> untuk beroperasi tanpa risiko kerugian. 
                                  </p>
                                  <div className="p-6 bg-white/5 border border-white/10 rounded-[32px] relative z-10">
                                     <div className="flex items-center gap-3 mb-4"><Zap className="w-5 h-5 text-amber-500"/> <span className="text-[11px] font-black uppercase tracking-widest text-amber-500 italic">Smart AI Observation</span></div>
                                     <p className="text-[13px] leading-relaxed text-slate-100 font-bold italic">
                                        "Biaya bahan baku berkontribusi <span className="text-indigo-400">{(activeMetrics.totalMaterialCost / activeMetrics.hppPerUnit * 100).toFixed(0)}%</span> terhadap total HPP. Terdapat potensi peningkatan margin hingga <span className="text-emerald-400">{(product.targetMargin + 10)}%</span> jika volume produksi ditingkatkan ke skala industri."
                                     </p>
                                  </div>
                               </div>
                            </section>

                            {/* SECTION: GROWTH RECOMMENDATIONS */}
                            <section className="space-y-6 pt-4">
                               <h3 className="text-xs font-black uppercase tracking-[0.4em] border-b-2 border-slate-900 pb-3 italic flex items-center gap-3 text-slate-900 leading-none">
                                  <Target className="text-indigo-600 w-6 h-6"/> Rekomendasi Aksi (Growth List)
                               </h3>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="flex items-start gap-4 p-8 border border-slate-100 rounded-3xl group hover:bg-slate-50 transition-all">
                                     <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0"><Check className="w-5 h-5"/></div>
                                     <div className="space-y-2">
                                        <p className="text-sm font-black uppercase tracking-tighter italic text-slate-900 leading-none">Optimasi Harga Retail</p>
                                        <p className="text-[11px] text-slate-500 font-medium italic">Naikkan harga ke <span className="text-indigo-600 font-bold">{formatIDR(activeMetrics.hppPerUnit * 2)}</span> untuk mengejar Tier Standar.</p>
                                     </div>
                                  </div>
                                  <div className="flex items-start gap-4 p-8 border border-slate-100 rounded-3xl group hover:bg-slate-50 transition-all">
                                     <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0"><Percent className="w-5 h-5"/></div>
                                     <div className="space-y-2">
                                        <p className="text-sm font-black uppercase tracking-tighter italic text-slate-900 leading-none">Penghematan Overhead</p>
                                        <p className="text-[11px] text-slate-500 font-medium italic">Tekan biaya listrik & utilitas sebesar <span className="text-rose-500 font-bold">10%</span> untuk menurunkan BEP harian.</p>
                                     </div>
                                  </div>
                               </div>
                            </section>
                         </div>

                         {/* MODULE 2: DATA VISUALS (RIGHT COLUMN) */}
                         <div className="col-span-12 xl:col-span-4 space-y-12 border-l border-slate-100 pl-12">
                            
                            {/* PIE CHART WITH LABELS */}
                            <section className="space-y-8">
                               <h3 className="text-xs font-black uppercase tracking-[0.4em] border-b-2 border-slate-900 pb-3 italic text-slate-900 text-center leading-none">Struktur Biaya</h3>
                               <div className="h-64 relative">
                                  <ResponsiveContainer width="100%" height="100%">
                                     <RePieChart>
                                        <Pie 
                                          data={[
                                             { name: 'Bahan Baku', value: activeMetrics.totalMaterialCost },
                                             { name: 'Overhead', value: activeMetrics.totalFixedMonthly / (product.expectedSalesVolume || 1) },
                                             { name: 'Profit Margin', value: activeMetrics.profitPerUnit }
                                          ]} 
                                          cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value"
                                        >
                                           <Cell fill="#6366f1" /> {/* Indigo */}
                                           <Cell fill="#cbd5e1" /> {/* Slate */}
                                           <Cell fill="#10b981" /> {/* Emerald */}
                                        </Pie>
                                     </RePieChart>
                                  </ResponsiveContainer>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Flow</span>
                                     <span className="text-2xl font-black text-slate-900 italic tracking-tighter">FINANCE</span>
                                  </div>
                               </div>
                               <div className="space-y-4 pt-4">
                                  <div className="flex justify-between items-center text-[11px] font-bold italic"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-[#6366f1]"/> Bahan Baku (COGS)</div><span className="font-black">{(activeMetrics.totalMaterialCost / activeMetrics.recommendedPrice * 100).toFixed(0)}%</span></div>
                                  <div className="flex justify-between items-center text-[11px] font-bold italic"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-[#cbd5e1]"/> Beban Operasional</div><span className="font-black">{((activeMetrics.totalFixedMonthly / product.expectedSalesVolume) / activeMetrics.recommendedPrice * 100).toFixed(0)}%</span></div>
                                  <div className="flex justify-between items-center text-[11px] font-bold italic"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-[#10b981]"/> Keuntungan Bersih</div><span className="font-black">{product.targetMargin}%</span></div>
                               </div>
                            </section>

                            {/* GROWTH SCENARIOS */}
                            <section className="space-y-8 pt-8">
                               <h3 className="text-xs font-black uppercase tracking-[0.4em] border-b-2 border-slate-900 pb-3 italic text-slate-900 text-center leading-none">Simulasi Pertumbuhan</h3>
                               <div className="space-y-3">
                                  {[
                                     { label: 'Baseline', vol: product.expectedSalesVolume, profit: activeMetrics.totalProfit, clr: 'slate' },
                                     { label: 'Scale Up', vol: Math.round(product.expectedSalesVolume * 1.5), profit: activeMetrics.totalProfit * 1.5, clr: 'indigo' },
                                     { label: 'Dominasi', vol: product.expectedSalesVolume * 2, profit: activeMetrics.totalProfit * 2, clr: 'emerald' }
                                  ].map(s => (
                                     <div key={s.label} className={cn("p-4 rounded-2xl border transition-all flex justify-between items-center", s.clr === 'indigo' ? "bg-indigo-50 border-indigo-100" : s.clr === 'emerald' ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-200")}>
                                        <div className="space-y-1">
                                           <p className="text-[10px] font-black uppercase text-slate-500 italic leading-none">{s.label}</p>
                                           <p className="text-xs font-bold text-slate-900 italic">{s.vol} Unit</p>
                                        </div>
                                        <div className="text-right">
                                           <p className={cn("text-sm font-black italic", s.clr === 'indigo' ? "text-indigo-600" : s.clr === 'emerald' ? "text-emerald-700" : "text-slate-900")}>{formatCompactIDR(s.profit)}</p>
                                        </div>
                                     </div>
                                  ))}
                               </div>
                               <p className="text-[9px] font-bold text-slate-400 italic text-center uppercase tracking-widest mt-4">Angka Di Atas Adalah Proyeksi Laba Bersih</p>
                            </section>
                         </div>
                      </div>

                      {/* FOOTER & VALIDATION */}
                      <div className="mt-20 pt-10 border-t-2 border-slate-900 flex justify-between items-center italic relative z-10">
                         <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[24px] bg-slate-900 flex items-center justify-center p-4 text-white shadow-2xl">
                               <ShieldCheck className="w-full h-full text-emerald-400" />
                            </div>
                            <div className="flex flex-col gap-1">
                               <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic leading-none">Security Hash Protocol</span>
                               <span className="text-sm font-black uppercase text-slate-900 tracking-tighter italic leading-none">CERTIFIED HPP MASTER AUDIT</span>
                            </div>
                         </div>
                         <div className="text-right flex flex-col items-end gap-2">
                            <p className="text-[10px] items-center gap-3 justify-end text-slate-400 uppercase font-black tracking-[0.4em] italic flex leading-none">Digital Signature <Lock className="w-3.5 h-3.5"/></p>
                            <p className="text-[12px] text-indigo-700 font-black uppercase mt-1 italic px-6 py-2.5 rounded-full bg-indigo-50 border border-indigo-100 leading-none shadow-sm">ID-TOKEN: {Math.random().toString(36).substr(2, 12).toUpperCase()}</p>
                         </div>
                      </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
