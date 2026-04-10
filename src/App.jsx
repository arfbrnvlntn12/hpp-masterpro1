import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Plus, Trash2, Calculator, TrendingUp, Target,
  Save, FileText, LayoutDashboard, Database, X,
  Loader2, LogOut, Sun, Moon, ChevronDown, Package,
  DollarSign, Percent, ShoppingCart, AlertCircle, CheckCircle,
  Printer, ToggleLeft, ToggleRight, Edit2, BarChart2, Zap, Copy, Menu, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

// --- AUTH CONFIG ---
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('hpp_token', token);
  } else {
    delete axios.defaults.headers.common['Authorization'];
    localStorage.removeItem('hpp_token');
  }
};

// Initialize token from storage
const savedToken = localStorage.getItem('hpp_token');
if (savedToken) axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;


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
    profitMonthly: 0, profitDaily: 0, profitAnnual: 0, margin: 0, bepDaily: 0, roi: 0, roiYearly: 0, 
    paybackDays: 0, unitsToGoal: [], risk: { level: 'N/A', score: 0, advice: '' },
    recommendation: { price: 0, target: 0, margin: 0 },
    insights: [] 
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

  const hppUnit = matTotal + (vol > 0 ? fixedTotal / vol : 0);
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

  const roiYearly = hppUnit > 0 ? Math.round(((profitUnit * vol * 12) / (matTotal * vol + fixedTotal)) * 100) : 0;

  return {
    matTotal: Math.round(matTotal),
    fixedTotal: Math.round(fixedTotal),
    hppUnit: Math.round(hppUnit),
    sellPrice: Math.round(sellPrice),
    profitUnit: Math.round(profitUnit),
    profitMonthly: Math.round(profitUnit * vol),
    profitDaily: Math.round((profitUnit * vol) / 30),
    profitAnnual: Math.round(profitUnit * vol * 12),
    margin: sellPrice > 0 ? Math.round((profitUnit / sellPrice) * 100) : 0,
    bepDaily: bep,
    roi: hppUnit > 0 ? Math.round((profitUnit / hppUnit) * 100) : 0,
    roiYearly,
    paybackDays: profitUnit > 0 ? Math.ceil((matTotal * vol + fixedTotal) / (profitUnit * (vol/30))) : 0,
    unitsToGoal,
    risk: { level: riskLevel, score: Math.round(riskScore * 100), advice: riskAdvice },
    recommendation: {
      price: suggestedPrice,
      target: suggestedTarget,
      margin: recommendedMargin
    },
    // New: Aggressive Insights
    insights: [
      riskScore > 0.65 ? { type: 'danger', text: `Ketergantungan bahan baku Anda kritis (${Math.round(riskScore * 100)}%). Jika harga pasar naik sedikit, Anda rugi!` } : null,
      margin < 20 ? { type: 'warning', text: "Margin tipis! Anda kerja keras tapi untung sedikit. Pertimbangkan naikkan harga." } : null,
      (vol * profitUnit) < fixedTotal ? { type: 'danger', text: "Target penjualan Anda belum menutupi biaya operasional bulanan." } : null,
      roiYearly > 150 ? { type: 'success', text: "Bisnis ini 'Mesin Cetak Uang'. Fokus pada penetrasi pasar!" } : null
    ].filter(Boolean)
  };
};

// ─── SUB-COMPONENTS ──────────────────────────────────────
const Label = ({ children }) => (
  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{children}</p>
);

const Input = ({ label, type = 'text', prefix, suffix, onChange, ...props }) => {
  const isNumeric = type === 'number';
  const displayValue = (isNumeric && (props.value === 0 || props.value === '0')) ? '' : props.value;

  const handleChange = (e) => {
    if (!onChange) return;
    if (isNumeric) {
      const val = e.target.value;
      if (val === '') {
        // If empty, pass 0 to the parent handler
        onChange({ target: { value: 0, name: props.name } });
      } else if (/^\d*\.?\d*$/.test(val)) {
        // Only allow valid numeric strings
        onChange(e);
      }
    } else {
      onChange(e);
    }
  };

  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-400 transition-all">
        {prefix && <span className="text-slate-400 text-xs shrink-0">{prefix}</span>}
        <input
          {...props}
          type={isNumeric ? 'text' : type}
          inputMode={isNumeric ? 'decimal' : props.inputMode}
          className="flex-1 bg-transparent text-sm font-medium text-slate-800 dark:text-slate-100 outline-none min-w-0 placeholder:text-slate-300"
          value={displayValue}
          onChange={handleChange}
          onFocus={(e) => e.target.select()}
        />
        {suffix && <span className="text-slate-400 text-xs shrink-0">{suffix}</span>}
      </div>
    </div>
  );
};

const Stat = ({ label, value, sub, accent = false, small = false, tip = null, premium = false, onLockClick }) => (
  <div className={`rounded-xl p-4 border relative group overflow-hidden ${accent ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-700/60'}`}>
    {premium && (
      <div className="absolute inset-0 z-10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onLockClick} className="bg-slate-900 dark:bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded-lg">UPGRADE</button>
      </div>
    )}
    <div className="flex items-center gap-1.5 mb-1">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      {premium && <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />}
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

// ─── AUTH PAGE ───────────────────────────────────────────
const AuthPage = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const { data } = await axios.post(API_BASE + endpoint, form);
      setAuthToken(data.token);
      onAuthSuccess(data.user);
    } catch (err) { alert(err.response?.data?.message || 'Auth failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm bg-slate-900 rounded-[2rem] p-8 border border-slate-800 shadow-2xl">
        <h2 className="text-2xl font-black text-white mb-6">{isLogin ? 'Selamat Datang' : 'Buat Akun'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && <input className="w-full bg-slate-800 p-3 rounded-xl text-white" placeholder="Nama Usaha" onChange={e => setForm({...form, name: e.target.value})} />}
          <input className="w-full bg-slate-800 p-3 rounded-xl text-white" placeholder="Email" onChange={e => setForm({...form, email: e.target.value})} />
          <input className="w-full bg-slate-800 p-3 rounded-xl text-white" type="password" placeholder="Password" onChange={e => setForm({...form, password: e.target.value})} />
          <button disabled={loading} className="w-full bg-emerald-500 py-4 rounded-xl font-bold text-white">{loading ? '...' : (isLogin ? 'Masuk' : 'Daftar')}</button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full text-xs text-slate-500 mt-4">{isLogin ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}</button>
      </motion.div>
    </div>
  );
};

// ─── ONBOARDING WIZARD ──────────────────────────────────────
const OnboardingWizard = ({ step, setStep, active, update, addMaterial, updateMat, addCost, updateCost, onComplete, isDark }) => {
  const m = calcMetrics(active);
  
  const totalSteps = 6;
  const isLast = step === totalSteps;

  return (
    <div className={`fixed inset-0 z-[100] flex items-start md:items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-md overflow-y-auto`}>
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }} 
        className="bg-white dark:bg-slate-900 w-full max-w-[480px] rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden border border-white/20 relative"
      >
        
        {/* Progress Bar (Brand Emerald) */}
        <div className="absolute top-0 left-0 right-0 h-1.5 flex bg-slate-100 dark:bg-slate-800">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(step / totalSteps) * 100}%` }} 
            className="bg-emerald-500 h-full shadow-[0_0_10px_#10b981]" 
          />
        </div>

        <div className="p-8 md:p-10">
          {step > 1 && step < totalSteps && (
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-6">Langkah {step} dari {totalSteps-1}</p>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} transition={{ duration: 0.3 }} className="text-center space-y-8 py-4">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40 rotate-3">
                  <Calculator className="w-12 h-12 text-white" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 leading-tight tracking-tight">Berhenti nebak harga jual.</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed px-4">Hitung HPP, tentukan harga, dan tahu target penjualan Anda dalam 2 menit.</p>
                </div>
                <button onClick={() => setStep(2)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-emerald-500/30 transition-all active:scale-95 text-base tracking-tight">Mulai Hitung Sekarang</button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-8">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Kita mulai dari produk Anda</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Produk apa yang ingin Anda hitung hari ini?</p>
                </div>
                <div className="space-y-5">
                  <Input label="Nama Produk" value={active.name} onChange={e => update('name', e.target.value)} placeholder="Contoh: Keripik Pisang, Kaos Polos, dll" autoFocus />
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <Input label="Target Jual (Unit / Bulan)" type="number" value={active.expectedSalesVolume} onChange={e => update('expectedSalesVolume', Number(e.target.value))} suffix="unit" />
                  </div>
                </div>
                <button onClick={() => { if(!active.materials.length) addMaterial(); setStep(3); }} className="w-full bg-slate-900 dark:bg-emerald-500 text-white font-bold py-4 rounded-[1.2rem] transition-all active:scale-95">Lanjutkan</button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-8">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Masukkan bahan utama Anda</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Cukup 1 bahan dulu, nanti bisa ditambah selengkapnya.</p>
                </div>
                <div className="space-y-3 bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-700">
                  <Input label="Nama Bahan" value={active.materials[0]?.name} onChange={e => updateMat(active.materials[0].id, 'name', e.target.value)} placeholder="Misal: Kain Cotton Combed" />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Harga Pack (Rp)" type="number" value={active.materials[0]?.packPrice} onChange={e => updateMat(active.materials[0].id, 'packPrice', Number(e.target.value))} />
                    <Input label="Isi Pack" type="number" value={active.materials[0]?.packSize} onChange={e => updateMat(active.materials[0].id, 'packSize', Number(e.target.value))} />
                  </div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Semakin detail bahan → semakin akurat</p>
                </div>
                <button onClick={() => setStep(4)} className="w-full bg-slate-900 dark:bg-emerald-500 text-white font-bold py-4 rounded-[1.2rem] transition-all active:scale-95">Berikutnya</button>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="s4" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-8 text-center py-4">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-[1.5rem] flex items-center justify-center mx-auto text-blue-500 border border-blue-100 dark:border-blue-800">
                  <DollarSign className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Tambahkan biaya operasional (opsional)</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 px-4">Gaji karyawan, sewa tempat, atau biaya listrik bulanan Anda.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={() => { addCost(); setStep(5); }} className="w-full bg-slate-900 dark:bg-emerald-500 text-white font-bold py-4 rounded-[1.2rem] flex items-center justify-center gap-2">
                     <Plus className="w-4 h-4" /> Tambah Biaya
                  </button>
                  <button onClick={() => setStep(5)} className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 py-2">Lewati dulu (bisa diisi nanti)</button>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div key="s5" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-8">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Tentukan keuntungan Anda</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Pilih strategi yang paling cocok dengan target pasar Anda.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { l: 'Kompetitif', v: 25, d: 'Cepat laku (Pasar masal)' },
                    { l: 'Standar', v: 40, d: 'Seimbang (Rekomendasi)' },
                    { l: 'Premium', v: 65, d: 'Margin tinggi (Eksklusif)' }
                  ].map(p => (
                    <button key={p.v} onClick={() => { update('targetMargin', p.v); setStep(6); }} className={`flex items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all ${active.targetMargin === p.v ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 scale-[1.02] shadow-lg shadow-emerald-500/10' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
                      <div className="text-left leading-tight">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100">{p.l}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{p.d}</p>
                      </div>
                      <p className="text-xl font-black text-emerald-600">{p.v}%</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div key="s6" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }} className="text-center space-y-8 py-2">
                <div className="relative">
                   <div className="absolute inset-0 bg-amber-400 blur-2xl opacity-20 animate-pulse" />
                   <div className="w-20 h-20 bg-amber-100 dark:bg-amber-950/50 rounded-full flex items-center justify-center mx-auto text-amber-500 relative z-10">
                     <Zap className="w-10 h-10 fill-current" />
                   </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tighter italic">🎉 Ini strategi terbaik Anda!</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed px-6">Dengan strategi ini, Anda bisa menguasai pasar dengan profit maksimal.</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-[2rem] p-8 shadow-inner space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Harga Jual</p>
                      <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{fmt(m.sellPrice)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Laba / Produk</p>
                      <p className="text-2xl font-black text-emerald-600">{fmt(m.profitUnit)}</p>
                    </div>
                  </div>
                  <div className="h-[1px] bg-slate-200 dark:bg-slate-700 w-full" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                    Target Aman: <span className="text-slate-800 dark:text-slate-100 px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-lg">{m.bepDaily} produk/hari</span> agar bisnis tetap untung & terus bertumbuh.
                  </p>
                </div>
                <button onClick={onComplete} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-[1.5rem] shadow-[0_15px_40px_rgba(16,185,129,0.3)] transition-all active:scale-95 text-base">Lihat Dashboard Saya</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

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
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [wizardStep, setWizardStep] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Auth Check on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!savedToken) {
        setAuthLoading(false);
        return;
      }
      try {
        const { data } = await axios.get(API_BASE + '/auth/me');
        setUser(data);
        setIsPremium(data.is_premium);
      } catch (err) {
        setAuthToken(null);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API_BASE}/products`);
        setProducts(data);
        if (data.length > 0) setActiveId(data[0].id);
      } catch (err) { console.error('Load failed:', err); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, [user]);

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setProducts([]);
    setActiveId(null);
  };

  const defaultProduct = (n = 1) => ({
    id: 'p-' + Date.now(),
    name: `Produk ${n}`,
    targetMargin: 0,
    expectedSalesVolume: 0,
    marketplaceFee: 0,
    actualSales: 0,
    materials: [],
    fixedCosts: [],
    snapshots: [],
    streak: 3,
    lastTrackedDate: new Date().toDateString()
  });

  const active = useMemo(() => products.find(p => p.id === activeId) || products[0], [products, activeId]);
  const m = useMemo(() => calcMetrics(active), [active]);

  const update = (field, val) => {
    const newProducts = products.map(p => p.id === active.id ? { ...p, [field]: val } : p);
    setProducts(newProducts);
    
    // Sync to DB
    const sync = async () => {
      try {
        await axios.post(`${API_BASE}/products/${active.id}`, { ...active, [field]: val });
      } catch (err) { console.error('Sync failed:', err); }
    };
    
    clearTimeout(window.syncTimer);
    window.syncTimer = setTimeout(sync, 1000);
  };

  const updateMat = (mid, field, val) => update('materials', active.materials.map(m => m.id === mid ? { ...m, [field]: val } : m));
  const updateCost = (fid, field, val) => update('fixedCosts', active.fixedCosts.map(f => f.id === fid ? { ...f, [field]: val } : f));

  const addMaterial = () => update('materials', [...(active.materials || []), { id: 'm-' + Date.now(), name: 'Bahan Baru', packPrice: 0, packSize: 0, qty: 0, waste: 0 }]);
  const delMaterial = (mid) => update('materials', active.materials.filter(m => m.id !== mid));
  const addCost = () => update('fixedCosts', [...(active.fixedCosts || []), { id: 'f-' + Date.now(), name: 'Biaya Baru', amount: 0, isActive: true }]);
  const delCost = (fid) => update('fixedCosts', active.fixedCosts.filter(f => f.id !== fid));

  const addProduct = async () => {
    if (!isPremium && products.length >= 1) {
      setShowPremiumModal(true);
      return;
    }
    const newP = defaultProduct(products.length + 1);
    setProducts([...products, newP]);
    setActiveId(newP.id);
    await axios.post(`${API_BASE}/products/${newP.id}`, newP);
  };

  const deleteProduct = async (id) => {
    setProducts(products.filter(p => p.id !== id));
    if (activeId === id) setActiveId(products[0]?.id || null);
    await axios.delete(`${API_BASE}/products/${id}`);
  };

  const duplicateProduct = async () => {
    if (!isPremium && products.length >= 1) {
      setShowPremiumModal(true);
      return;
    }
    const p = { ...active, id: 'p-' + Date.now(), name: active.name + ' (Copy)' };
    setProducts([...products, p]);
    setActiveId(p.id);
    await axios.post(`${API_BASE}/products/${p.id}`, p);
  };

  const handlePrint = () => {
    const content = document.getElementById("print-area").innerHTML;
    const printRoot = document.getElementById("print-root");
    if (!printRoot) return window.print();
    printRoot.className = document.documentElement.classList.contains('dark') ? 'dark' : '';
    printRoot.innerHTML = `<div class="p-8 bg-white text-black min-h-screen">${content}</div>`;
    window.print();
    printRoot.innerHTML = "";
  };

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-emerald-100 dark:selection:bg-emerald-900/40 ${isDark ? 'dark' : ''}`}>
      {loading && <div className="fixed inset-x-0 top-0 h-1 bg-emerald-500 animate-pulse z-[1000]" />}

      {authLoading ? (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
           <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : !user ? (
        <AuthPage onAuthSuccess={(u) => { setUser(u); setIsPremium(u.is_premium); }} />
      ) : (
        <>
          {/* ── SIDEBAR ── */}
          <aside className="hidden md:flex w-56 flex-col bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 shrink-0 sticky top-0 h-screen">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Calculator className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-100">HPP Master</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isPremium ? 'PREMIUM USER' : 'FREE USER'}</p>
                <p className="text-sm font-black text-slate-900 dark:text-white truncate">{user.name || 'Bisnis Anda'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>

            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">Produk</p>
              <div className="space-y-0.5 max-h-44 overflow-y-auto no-scrollbar">
                {products.map(p => (
                  <button key={p.id} onClick={() => setActiveId(p.id)}
                    className={`w-full flex flex-col items-start px-3 py-2.5 rounded-xl text-xs font-medium transition-all group border ${p.id === activeId ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' : 'text-slate-600 dark:text-slate-400 border-transparent hover:bg-white dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="truncate max-w-[100px] font-bold">{p.name}</span>
                      {products.length > 1 && <X onClick={e => { e.stopPropagation(); deleteProduct(p.id); }} className="w-3 h-3 opacity-0 group-hover:opacity-60" />}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={addProduct} className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-slate-400 hover:text-emerald-600 transition-colors mt-1">
                <Plus className="w-3 h-3" /> Tambah produk
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto no-scrollbar">
              {NAV.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)} className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === id ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </nav>

            <div className="p-3 border-t border-slate-100 dark:border-slate-800">
              <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-400 hover:text-red-500 transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Keluar
              </button>
            </div>
          </aside>

          {/* ── CONTENT ── */}
          <main className="flex-1 overflow-y-auto scrollbar-thin pb-28 md:pb-8">
            <div className="max-w-3xl mx-auto p-4 md:p-8">
              <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && (
                  <motion.div key="dash" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="bg-emerald-600 rounded-2xl p-6 shadow-xl text-white">
                      <p className="text-3xl font-black tracking-tight">{fmt(m.recommendation.price)}</p>
                      <p className="text-xs opacity-80">Harga Jual Optimal</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-xl p-4">
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={[50, 100, 150, 200, 250, 300].map(u => ({ unit: `${u}`, laba: Math.max(0, Math.round(m.profitUnit * u - (u < 100 ? m.fixedTotal * (1 - u / 100) : 0))) }))}>
                          <CartesianGrid strokeDasharray="2 4" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                          <XAxis dataKey="unit" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => fmtShort(v)} />
                          <Tooltip formatter={v => [fmtShort(v), 'Laba']} contentStyle={{ fontSize: 11, borderRadius: 10, border: 'none', background: isDark ? '#1e293b' : '#fff' }} />
                          <Area type="monotone" dataKey="laba" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.1} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>

          {/* ── PREMIUM MODAL ── */}
          <AnimatePresence>
            {showPremiumModal && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10">
                   <div className="p-8 text-center space-y-6">
                      <div className="w-16 h-16 bg-amber-400 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20 rotate-6">
                         <Zap className="w-8 h-8 text-white fill-current" />
                      </div>
                      <div className="space-y-2">
                         <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Buka Fitur Premium</h3>
                         <p className="text-sm text-slate-500 dark:text-slate-400">Ambil kendali penuh atas profit bisnis Anda dengan fitur asisten tercanggih.</p>
                      </div>
                      <div className="pt-2">
                         <button onClick={() => {
                           const msg = `Halo Admin HPP Master, saya ingin upgrade ke Premium untuk usaha "${user.name}". Tolong info metode pembayarannya ya.`;
                           window.open(`https://wa.me/6283871829666?text=${encodeURIComponent(msg)}`, '_blank');
                         }} className="w-full bg-slate-900 dark:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95">Upgrade Sekarang — 39rb/bln</button>
                         <button onClick={() => setShowPremiumModal(false)} className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 mt-4 py-2">Mungkin Nanti</button>
                      </div>
                   </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
