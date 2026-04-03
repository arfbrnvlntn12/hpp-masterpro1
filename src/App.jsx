import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Calculator, TrendingUp, Target, 
  Zap, Printer, Home, Layers, Save, 
  FileText, LayoutDashboard, Database, X, ArrowUpRight, ArrowDownRight,
  Loader2, LogOut, Trophy, Gem, Sparkles, PieChart as LucidePieChart, Send, CheckCircle2
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
  const totalFixedMonthly = (product.fixedCosts || []).filter(f => f.isActive).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
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

// --- REUSABLE COMPONENTS (PATERN USER) ---

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
  const [product, setProduct] = useState({
    name: 'Croissant Almond', targetMargin: 45, expectedSalesVolume: 1200, marketplaceFee: 0,
    materials: [
      { id: 1, name: 'Tepung Terigu', qty: 150, packSize: 1000, packPrice: 18000, waste: 2 },
      { id: 2, name: 'Mentega Tawar', qty: 100, packSize: 1000, packPrice: 120000, waste: 0 }
    ],
    fixedCosts: [
      { id: 10, name: 'Gaji Karyawan', amount: 5000000, isActive: true },
      { id: 11, name: 'Sewa Ruko', amount: 3500000, isActive: true }
    ]
  });

  const m = useMemo(() => calculateMetrics(product), [product]);
  const handleLogin = () => { setIsLoggedIn(true); };
  const handleLogout = () => { setIsLoggedIn(false); };

  if (!isLoggedIn) return (
    <div className="min-h-screen bg-[#0B0F1A] flex items-center justify-center p-6 text-white font-outfit">
      <div className="w-full max-w-sm glass-card rounded-[40px] p-10 border border-white/10 shadow-2xl space-y-8 text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-[22px] mx-auto flex items-center justify-center shadow-2xl"><Calculator className="w-8 h-8"/></div>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">HPPMASTER <span className="text-indigo-500">PRO</span></h1>
        <button onClick={handleLogin} className="w-full h-14 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all">Launch Enterprise</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#0B0F1A] text-white font-outfit overflow-hidden">
      
      {/* 🧱 SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-72 flex-col p-8 border-r border-white/10 shrink-0 bg-[#0B0F1A] z-50">
        <div className="flex items-center gap-4 mb-14 px-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-indigo-600/30 shadow-2xl"><Calculator className="w-6 h-6"/></div>
          <h1 className="text-xl font-black italic uppercase tracking-tighter">HPPMASTER</h1>
        </div>
        <nav className="flex-1 space-y-2">
           <button onClick={()=>setActiveTab('dashboard')} className={cn("w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-black text-[10px] uppercase italic tracking-widest", activeTab==='dashboard'? "bg-indigo-600 shadow-xl":"text-slate-500 hover:bg-white/5")}>
              <LayoutDashboard className="w-5 h-5"/> Ringkasan
           </button>
           <button onClick={()=>setActiveTab('materials')} className={cn("w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-black text-[10px] uppercase italic tracking-widest", activeTab==='materials'? "bg-indigo-600 shadow-xl":"text-slate-500 hover:bg-white/5")}>
              <Database className="w-5 h-5"/> Bahan Baku
           </button>
           <button onClick={()=>setActiveTab('strategy')} className={cn("w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-black text-[10px] uppercase italic tracking-widest", activeTab==='strategy'? "bg-indigo-600 shadow-xl":"text-slate-500 hover:bg-white/5")}>
              <TrendingUp className="w-5 h-5"/> Strategi Harga
           </button>
           <button onClick={()=>setActiveTab('report')} className={cn("w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-black text-[10px] uppercase italic tracking-widest", activeTab==='report'? "bg-indigo-600 shadow-xl":"text-slate-500 hover:bg-white/5")}>
              <FileText className="w-5 h-5"/> Laporan Audit
           </button>
        </nav>
        <button onClick={handleLogout} className="mt-auto px-5 py-4 text-slate-700 font-black text-[10px] uppercase tracking-widest hover:text-rose-500 transition-colors flex items-center gap-3"><LogOut className="w-5 h-5"/> Shutdown</button>
      </aside>

      {/* 📊 MAIN CONTENT */}
      <main className="flex-1 p-5 md:p-10 overflow-y-auto pb-36 md:pb-10 relative">
        <header className="mb-10 md:mb-14">
           <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.5em] italic leading-none mb-3">Enterprise Core System</p>
           <h1 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">{activeTab.toUpperCase()}</h1>
        </header>

        <div className="max-w-[1200px] mx-auto w-full">
           <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div key="db" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
                   {/* 📊 RESPONSIVE GRID (Auto Mobile) */}
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                      <Card isHero title="Monthly Profit" value={formatCompactIDR(m.totalProfit)} icon={Trophy} clr="amber" trend={12} subtext="Financial Output" />
                      <Card isHero title="BEP target" value={`${m.bepDaily} Unit`} icon={Target} clr="rose" trend={2} subtext="Safe Breakeven" />
                      <Card title="Unit HPP cost" value={formatIDR(m.hppPerUnit)} icon={Calculator} clr="emerald" subtext="Production Base" />
                      <Card title="Retail Price" value={formatIDR(m.recommendedPrice)} icon={TrendingUp} clr="indigo" subtext="Market Position" />
                   </div>
                   <div className="glass-card rounded-[32px] md:rounded-[48px] p-6 md:p-12 bg-white/[0.02] border border-white/10 h-[300px] md:h-[450px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[{n:'100',p:m.totalProfit/10},{n:'500',p:m.totalProfit/2},{n:'1k',p:m.totalProfit},{n:'1.5k',p:m.totalProfit*1.5}]}>
                          <defs><linearGradient id="cP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false}/>
                          <XAxis dataKey="n" stroke="#475569" fontSize={11} axisLine={false} tickLine={false}/>
                          <RechartsTooltip contentStyle={{background:'#0a0b1e',border:'none',borderRadius:'20px',fontSize:'12px',boxShadow:'0 20px 50px rgba(0,0,0,0.6)'}}/>
                          <Area type="monotone" dataKey="p" stroke="#6366f1" fillOpacity={1} fill="url(#cP)" strokeWidth={5} />
                        </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </motion.div>
              )}

              {activeTab === 'materials' && (
                <motion.div key="mat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {product.materials.map(item => (
                        <div key={item.id} className="bg-white/5 border border-white/10 rounded-[32px] p-8 space-y-6">
                           <input value={item.name} className="bg-transparent border-none p-0 text-xl font-black italic uppercase text-indigo-400 focus:ring-0" />
                           <div className="grid grid-cols-2 gap-4">
                              <div className="bg-white/5 p-4 rounded-2xl space-y-1"><p className="text-[8px] font-black uppercase text-slate-500 italic">Price</p><p className="text-lg font-black italic">{formatIDR(item.packPrice)}</p></div>
                              <div className="bg-rose-500/5 p-4 rounded-2xl space-y-1"><p className="text-[8px] font-black uppercase text-rose-400 italic">Waste %</p><p className="text-lg font-black italic">{item.waste}%</p></div>
                           </div>
                        </div>
                      ))}
                      <button onClick={()=>{}} className="bg-white/3 border-2 border-dashed border-white/10 rounded-[32px] p-10 flex flex-col items-center justify-center gap-4 text-slate-500 hover:text-indigo-400 hover:bg-white/5 transition-all"><Plus className="w-10 h-10"/> <span className="font-black text-[10px] uppercase italic tracking-[0.3em]">Add Inventory Item</span></button>
                   </div>
                </motion.div>
              )}

              {activeTab === 'strategy' && (
                <motion.div key="str" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
                   {/* 📊 STRATEGY CARD (MOBILE STACK) */}
                   <div className="flex flex-col md:flex-row gap-6 md:gap-10">
                    {[
                      { l: 'Tier Competitive', m: 25, ic: Sparkles, clr: 'amber' },
                      { l: 'Tier Standard Pro', m: 45, ic: Trophy, clr: 'indigo', active: true },
                      { l: 'Tier Enterprise', m: 70, ic: Gem, clr: 'rose' }
                    ].map(t => (
                      <div key={t.l} onClick={() => setProduct({ ...product, targetMargin: t.m })} className={cn(
                        "flex-1 bg-white/5 border-2 rounded-[32px] md:rounded-[48px] p-8 md:p-12 transition-all cursor-pointer relative overflow-hidden group",
                        product.targetMargin===t.m ? `border-${t.clr}-500 bg-${t.clr}-500/[0.05] scale-[1.03] shadow-2xl` : "border-white/10 opacity-50"
                      )}>
                        <div className="flex justify-between items-start mb-10"><div className={cn("w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center", `bg-${t.clr}-500/20 text-${t.clr}-400`)}><t.ic className="w-7 h-7" /></div><p className="text-3xl md:text-5xl font-black italic tracking-tighter leading-none">{t.m}%</p></div>
                        <h4 className={cn("text-xl md:text-2xl font-black uppercase italic tracking-tighter leading-none mb-1", `text-${t.clr}-400`)}>{t.l}</h4>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 italic leading-none">Market Segment Ratio</p>
                      </div>
                    ))}
                   </div>
                   <div className="bg-[#0B0F1A] border-2 border-indigo-500/20 rounded-[40px] md:rounded-[64px] p-10 md:p-20 shadow-2xl relative overflow-hidden">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                         <div className="space-y-4"><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic">Retail Output</p><p className="text-4xl md:text-7xl font-black italic tracking-tighter">{formatIDR(m.recommendedPrice)}</p></div>
                         <div className="space-y-4"><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic text-right">Daily Target</p><p className="text-4xl md:text-7xl font-black italic tracking-tighter text-emerald-400 text-right">{m.bepDaily} Unit</p></div>
                      </div>
                   </div>
                </motion.div>
              )}

              {activeTab === 'report' && (
                <motion.div key="rep" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-10">
                   <div className="bg-white text-slate-900 rounded-[48px] md:rounded-[64px] p-10 md:p-20 shadow-2xl shadow-black/50 min-h-[800px] border border-slate-100 font-bold relative overflow-hidden">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.05] rotate-[20deg] text-[180px] font-black pointer-events-none select-none tracking-widest italic">AUDIT</div>
                      <div className="flex justify-between items-start border-b-[6px] border-slate-900 pb-12 mb-16 relative z-10">
                         <div><h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter leading-none border-l-[18px] border-indigo-600 pl-8">BUSINESS <span className="text-indigo-600">AUDIT</span></h1><p className="text-[12px] font-black uppercase tracking-[0.4em] italic mt-3 text-slate-400">Enterprise Strategy Suite v3.2</p></div>
                         <div className="w-20 h-20 bg-slate-900 rounded-[28px] flex items-center justify-center text-white"><LucidePieChart className="w-10 h-10"/></div>
                      </div>

                      {/* 🎯 KPI SECTION (Mobile Friendly 2x2) */}
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-16 relative z-10 font-black italic">
                        <div className="bg-slate-100 rounded-[32px] p-8 text-center"><p className="text-[10px] text-slate-400 uppercase leading-none mb-2 tracking-widest italic leading-none">Price</p><p className="text-xl md:text-2xl">{formatCompactIDR(m.recommendedPrice).replace('Rp','').trim()}</p></div>
                        <div className="bg-indigo-50 rounded-[32px] p-8 text-center text-indigo-700"><p className="text-[10px] text-indigo-400 uppercase leading-none mb-2 tracking-widest italic leading-none">HPP</p><p className="text-xl md:text-2xl">{formatCompactIDR(m.hppPerUnit).replace('Rp','').trim()}</p></div>
                        <div className="bg-rose-50 rounded-[32px] p-8 text-center text-rose-700"><p className="text-[10px] text-rose-500 uppercase leading-none mb-2 tracking-widest italic leading-none">BEP</p><p className="text-4xl leading-none">{m.bepDaily}</p></div>
                        <div className="bg-slate-900 rounded-[32px] p-8 text-center text-white shadow-xl"><p className="text-[10px] text-slate-500 uppercase leading-none mb-2 tracking-widest italic leading-none">Profit</p><p className="text-xl md:text-2xl text-indigo-400">{formatCompactIDR(m.totalProfit).replace('Rp','').trim()}</p></div>
                      </div>

                      <div className="p-10 md:p-16 bg-slate-50 border-l-[12px] border-indigo-600 rounded-r-[56px] italic leading-[2.2] text-slate-600 text-[18px] md:text-[20px] text-justify relative z-10 font-bold">Audit Intelligence mendeteksi efisiensi operasional sistem tetap stabil. Target minimal harian <span className="text-indigo-900 font-black underline mx-2">{m.bepDaily} UNIT</span> wajib dipertahankan untuk mengimbangi beban organisasi sebesar <span className="text-rose-800 font-black mx-2">{formatIDR(m.totalFixedMonthly)}</span> per bulan.</div>
                      <button onClick={()=>window.print()} className="w-full h-24 bg-slate-900 text-white rounded-[40px] text-lg font-black uppercase mt-12 shadow-2xl flex items-center justify-center gap-4 italic tracking-widest print:hidden active:scale-95 transition-all"><Printer className="w-7 h-7"/> DOWNLOAD FINAL PDF REPORT</button>
                   </div>
                </motion.div>
              )}
           </AnimatePresence>
        </div>

        {/* ⚡ STICKY BUTTON MOBILE */}
        <button onClick={()=>{setIsSaving(true);setTimeout(()=>setIsSaving(false),600);}} className="fixed bottom-24 left-6 right-6 md:hidden h-16 bg-indigo-600 text-white font-black uppercase text-sm rounded-[20px] shadow-[0_15px_30px_rgba(79,70,229,0.5)] z-[100] border-t border-white/20 active:scale-95 transition-all flex items-center justify-center gap-3 italic tracking-widest">
           {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-6 h-6"/>} Simpan Perubahan Data
        </button>

        {/* 🧭 BOTTOM NAV MOBILE */}
        <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-[#0a0b1e]/95 backdrop-blur-2xl border-t border-white/10 flex justify-around px-2 pb-8 pt-4 z-[110] shadow-[0_-15px_40px_rgba(0,0,0,0.8)]">
           <MobileNavItem icon={LayoutDashboard} label="Summary" active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')}/>
           <MobileNavItem icon={Database} label="Inventory" active={activeTab==='materials'} onClick={()=>setActiveTab('materials')}/>
           <MobileNavItem icon={TrendingUp} label="Pricing" active={activeTab==='strategy'} onClick={()=>setActiveTab('strategy')}/>
           <MobileNavItem icon={FileText} label="Audit" active={activeTab==='report'} onClick={()=>setActiveTab('report')}/>
        </nav>
      </main>
    </div>
  );
};

export default App;
