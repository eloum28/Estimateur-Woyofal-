
import React, { useState, useMemo } from 'react';
import { 
  GlobalSettings, 
  CalculationMode, 
  MonthlyInputMode,
  ApplianceRow, 
  MonthlyBreakdown 
} from './types';
import { 
  DEFAULT_SETTINGS, 
  TIER_CONFIG, 
  DEFAULT_WATTS, 
  DEFAULT_TOTAL_KWH, 
  APPLIANCE_HOURS,
  formatFCFA,
  formatKWh
} from './constants';
import { copyToClipboard, validateInput } from './utils';

const App: React.FC = () => {
  // --- State ---
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<CalculationMode>(CalculationMode.APPLIANCE);
  const [monthlyInputMode, setMonthlyInputMode] = useState<MonthlyInputMode>(MonthlyInputMode.KWH);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile drawer closed by default
  
  // Mode 1 State
  const [applianceWatts, setApplianceWatts] = useState<number>(DEFAULT_WATTS);
  
  // Mode 2 States
  const [totalKWhInput, setTotalKWhInput] = useState<number>(DEFAULT_TOTAL_KWH);
  const [monthlyWatts, setMonthlyWatts] = useState<number>(1000);
  const [monthlyHours, setMonthlyHours] = useState<number>(8);
  const [purchaseAmountFcfa, setPurchaseAmountFcfa] = useState<number>(20000);

  // Feedback State
  const [toast, setToast] = useState<string | null>(null);

  // --- Helpers ---
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const resetDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    setApplianceWatts(DEFAULT_WATTS);
    setTotalKWhInput(DEFAULT_TOTAL_KWH);
    setMonthlyWatts(1000);
    setMonthlyHours(8);
    setPurchaseAmountFcfa(20000);
    showToast("Application reset to defaults");
  };

  // --- Share Logic ---
  const handleShare = async () => {
    const appUrl = window.location.origin + window.location.pathname;
    const shareTitle = "Woyofal Electricity Estimate (Senegal)";
    const shareText = `⚡ Woyofal Summary:
Total Amount: ${formatFCFA(monthlyData.cost)}
Energy: ${formatKWh(monthlyData.kWh)}

Tier Breakdown:
${monthlyData.breakdown.map(b => `- ${b.tier}: ${formatKWh(b.kWh)} @ ${b.price} FCFA`).join('\n')}

Estimate yours here: ${appUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: appUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      const success = await copyToClipboard(shareText);
      if (success) showToast("Summary & Link Copied!");
    }
  };

  // --- Logic ---
  const isSettingsValid = validateInput(settings.daysPerMonth, false) &&
                          validateInput(settings.priceT1) &&
                          validateInput(settings.priceT2) &&
                          validateInput(settings.priceT3);

  const getBreakdownFromKWh = (kWh: number): MonthlyBreakdown[] => {
    const k1 = Math.min(kWh, TIER_CONFIG.threshold1);
    const k2 = Math.min(Math.max(kWh - TIER_CONFIG.threshold1, 0), TIER_CONFIG.threshold2 - TIER_CONFIG.threshold1);
    const k3 = Math.max(kWh - TIER_CONFIG.threshold2, 0);

    return [
      { tier: 'Tier 1 (0-150)', kWh: k1, price: settings.priceT1, cost: k1 * settings.priceT1 },
      { tier: 'Tier 2 (151-250)', kWh: k2, price: settings.priceT2, cost: k2 * settings.priceT2 },
      { tier: 'Tier 3 (>250)', kWh: k3, price: settings.priceT3, cost: k3 * settings.priceT3 },
    ];
  };

  const getKWhFromFcfa = (amount: number): number => {
    const maxCostT1 = TIER_CONFIG.threshold1 * settings.priceT1;
    const maxKWhT2 = TIER_CONFIG.threshold2 - TIER_CONFIG.threshold1;
    const maxCostT2 = maxKWhT2 * settings.priceT2;

    if (amount <= maxCostT1) return amount / settings.priceT1;
    if (amount <= maxCostT1 + maxCostT2) return TIER_CONFIG.threshold1 + (amount - maxCostT1) / settings.priceT2;
    return TIER_CONFIG.threshold2 + (amount - maxCostT1 - maxCostT2) / settings.priceT3;
  };

  const applianceRows: ApplianceRow[] = useMemo(() => {
    if (!isSettingsValid || !validateInput(applianceWatts)) return [];
    return APPLIANCE_HOURS.map(hours => {
      const kWh = (applianceWatts / 1000) * hours * settings.daysPerMonth;
      return {
        hours,
        kWh,
        costT1: kWh * settings.priceT1,
        costT2: kWh * settings.priceT2,
        costT3: kWh * settings.priceT3,
      };
    });
  }, [applianceWatts, settings, isSettingsValid]);

  const monthlyData = useMemo(() => {
    let effectiveKWh = 0;
    let effectiveCost = 0;

    if (monthlyInputMode === MonthlyInputMode.KWH) {
      effectiveKWh = totalKWhInput;
    } else if (monthlyInputMode === MonthlyInputMode.WATTS) {
      effectiveKWh = (monthlyWatts / 1000) * monthlyHours * settings.daysPerMonth;
    } else {
      effectiveCost = purchaseAmountFcfa;
      effectiveKWh = getKWhFromFcfa(effectiveCost);
    }
    
    const breakdown = getBreakdownFromKWh(effectiveKWh);
    effectiveCost = monthlyInputMode === MonthlyInputMode.FCFA ? purchaseAmountFcfa : breakdown.reduce((acc, b) => acc + b.cost, 0);
    
    return { kWh: effectiveKWh, cost: effectiveCost, breakdown };
  }, [monthlyInputMode, totalKWhInput, monthlyWatts, monthlyHours, purchaseAmountFcfa, settings, isSettingsValid]);

  const progressMax = Math.max(monthlyData.kWh, 400);

  const SidebarContent = () => (
    <div className="p-6 flex flex-col gap-8 h-full">
      <div className="flex items-center justify-between lg:hidden">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Settings</h2>
        <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Tariff Settings</h2>
        <div className="space-y-4">
          <div className="relative">
            <label className="text-[11px] font-bold text-slate-500 mb-1 block">Days Per Month</label>
            <input 
              type="number" 
              value={settings.daysPerMonth}
              onChange={(e) => setSettings({ ...settings, daysPerMonth: parseFloat(e.target.value) || 1 })}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
            />
            <span className="absolute right-3 top-[30px] text-[10px] font-bold text-slate-400">Days</span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Tier Prices</h2>
        <div className="space-y-4">
          {[
            { label: 'Tier 1 (0-150)', key: 'priceT1' },
            { label: 'Tier 2 (151-250)', key: 'priceT2' },
            { label: 'Tier 3 (>250)', key: 'priceT3' }
          ].map((tier) => (
            <div key={tier.key} className="relative">
              <label className="text-[11px] font-bold text-slate-500 mb-1 block">{tier.label}</label>
              <input 
                type="number" 
                step="0.01"
                value={settings[tier.key as keyof GlobalSettings]}
                onChange={(e) => setSettings({ ...settings, [tier.key]: parseFloat(e.target.value) || 0 })}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
              />
              <span className="absolute right-3 top-[30px] text-[10px] font-bold text-slate-400">FCFA</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-auto lg:hidden">
        <button 
          onClick={() => { resetDefaults(); setIsSidebarOpen(false); }}
          className="w-full py-3 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
        >
          Reset All Defaults
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 overflow-x-hidden">
      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Top Navigation */}
      <nav className="h-16 md:h-20 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold tracking-tight">Woyofal <span className="text-indigo-600">Estimator</span></h1>
            <p className="hidden xs:block text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Senegal Power Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2.5 text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
            title="Open Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          </button>
          <button 
            onClick={resetDefaults}
            className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-transparent"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Reset
          </button>
        </div>
      </nav>

      <div className="flex flex-1 relative">
        {/* Sidebar - Desktop & Mobile Drawer */}
        <aside className={`fixed lg:static top-0 left-0 h-full bg-white z-[60] lg:z-0 border-r border-slate-200 transition-all duration-300 ease-in-out lg:w-80 ${isSidebarOpen ? 'w-80 shadow-2xl' : 'w-0 lg:w-80 overflow-hidden'}`}>
          <SidebarContent />
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
          <div className="max-w-4xl mx-auto">
            {/* Tabs Navigation - Refined for mobile */}
            <div className="flex border-b border-slate-200 mb-6 md:mb-8 overflow-x-auto no-scrollbar scroll-smooth">
              <button 
                onClick={() => setMode(CalculationMode.APPLIANCE)}
                className={`pb-4 px-4 md:px-1 text-sm font-bold transition-all relative whitespace-nowrap ${mode === CalculationMode.APPLIANCE ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Appliance Analysis
                {mode === CalculationMode.APPLIANCE && <div className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-indigo-600" />}
              </button>
              <button 
                onClick={() => setMode(CalculationMode.MONTHLY)}
                className={`pb-4 px-4 md:px-6 text-sm font-bold transition-all relative whitespace-nowrap ${mode === CalculationMode.MONTHLY ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Monthly Calculator
                {mode === CalculationMode.MONTHLY && <div className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-indigo-600" />}
              </button>
            </div>

            {/* Content Area */}
            {mode === CalculationMode.APPLIANCE ? (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-md">
                      <h3 className="text-lg font-bold mb-1">Impact Analysis</h3>
                      <p className="text-sm text-slate-500">Choose the wattage of your appliance to see its monthly cost breakdown.</p>
                    </div>
                    <div className="w-full md:w-56 relative group">
                      <label className="text-[11px] font-bold text-slate-500 mb-1.5 block group-focus-within:text-indigo-600">Appliance Power</label>
                      <input 
                        type="number" 
                        inputMode="numeric"
                        value={applianceWatts}
                        onChange={(e) => setApplianceWatts(parseFloat(e.target.value) || 0)}
                        className="w-full h-12 md:h-14 pl-4 pr-14 bg-white border border-slate-200 rounded-xl text-lg font-bold focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 outline-none transition-all"
                      />
                      <span className="absolute right-4 top-[32px] md:top-[38px] font-bold text-slate-300 pointer-events-none">Watts</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <th className="px-5 py-4">Daily Usage</th>
                          <th className="px-5 py-4">Consumption</th>
                          <th className="px-5 py-4">T1 Cost</th>
                          <th className="px-5 py-4">T2 Cost</th>
                          <th className="px-5 py-4">T3 Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {applianceRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                            <td className="px-5 py-5 font-bold text-slate-700 whitespace-nowrap">{row.hours}h <span className="text-slate-400 text-[10px]">/ day</span></td>
                            <td className="px-5 py-5 text-slate-600 font-mono font-medium whitespace-nowrap">{formatKWh(row.kWh)}</td>
                            <td className="px-5 py-5 text-indigo-600 font-bold whitespace-nowrap">{formatFCFA(row.costT1)}</td>
                            <td className="px-5 py-5 text-emerald-600 font-bold whitespace-nowrap">{formatFCFA(row.costT2)}</td>
                            <td className="px-5 py-5 text-orange-600 font-bold whitespace-nowrap">{formatFCFA(row.costT3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <p className="text-[10px] text-slate-400 italic text-center sm:text-left">Calculation: (W / 1000) × Hours × {settings.daysPerMonth} Days.</p>
                    <button 
                      onClick={() => {
                        const header = "Usage Time,kWh/month,Cost @ Tier 1,Cost @ Tier 2,Cost @ Tier 3";
                        const body = applianceRows.map(r => `${r.hours}h/day,${r.kWh.toFixed(1)},${r.costT1.toFixed(0)},${r.costT2.toFixed(0)},${r.costT3.toFixed(0)}`).join('\n');
                        copyToClipboard(`${header}\n${body}`).then(s => s && showToast("CSV Copied"));
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm sm:bg-transparent sm:border-transparent sm:shadow-none"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                      Export CSV
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-12">
                <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <h3 className="text-lg font-bold mb-1">Monthly Estimator</h3>
                        <p className="text-sm text-slate-500">Pick an input type to see tier totals.</p>
                      </div>
                      <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 w-full sm:w-fit overflow-x-auto no-scrollbar">
                        {[
                          { id: MonthlyInputMode.KWH, label: 'kWh' },
                          { id: MonthlyInputMode.WATTS, label: 'Watts' },
                          { id: MonthlyInputMode.FCFA, label: 'FCFA' }
                        ].map(m => (
                          <button 
                            key={m.id}
                            onClick={() => setMonthlyInputMode(m.id)}
                            className={`flex-1 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${monthlyInputMode === m.id ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 items-end">
                      {monthlyInputMode === MonthlyInputMode.KWH && (
                        <div className="sm:col-span-2 md:col-span-3 relative">
                          <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Total Monthly Consumption (kWh)</label>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            value={totalKWhInput}
                            onChange={(e) => setTotalKWhInput(parseFloat(e.target.value) || 0)}
                            className="w-full h-12 md:h-14 px-4 bg-white border border-slate-200 rounded-xl text-lg font-bold focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 outline-none transition-all"
                          />
                          <span className="absolute right-4 top-[34px] md:top-[42px] font-bold text-slate-300 pointer-events-none">kWh</span>
                        </div>
                      )}
                      {monthlyInputMode === MonthlyInputMode.WATTS && (
                        <>
                          <div className="relative">
                            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Avg Power</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              value={monthlyWatts}
                              onChange={(e) => setMonthlyWatts(parseFloat(e.target.value) || 0)}
                              className="w-full h-12 md:h-14 px-4 bg-white border border-slate-200 rounded-xl text-lg font-bold focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 outline-none transition-all"
                            />
                            <span className="absolute right-4 top-[34px] md:top-[42px] font-bold text-slate-300 pointer-events-none">W</span>
                          </div>
                          <div className="relative">
                            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Hours/Day</label>
                            <input 
                              type="number" 
                              inputMode="numeric"
                              value={monthlyHours}
                              max="24"
                              onChange={(e) => setMonthlyHours(parseFloat(e.target.value) || 0)}
                              className="w-full h-12 md:h-14 px-4 bg-white border border-slate-200 rounded-xl text-lg font-bold focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 outline-none transition-all"
                            />
                            <span className="absolute right-4 top-[34px] md:top-[42px] font-bold text-slate-300 pointer-events-none">H</span>
                          </div>
                          <div className="h-12 md:h-14 flex items-center px-4 text-xs font-bold text-slate-400 bg-slate-50 rounded-xl border border-slate-200 sm:col-span-2 md:col-span-1">
                            Calculated for {settings.daysPerMonth} Days
                          </div>
                        </>
                      )}
                      {monthlyInputMode === MonthlyInputMode.FCFA && (
                        <div className="sm:col-span-2 md:col-span-3 relative">
                          <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Target Purchase Amount (FCFA)</label>
                          <input 
                            type="number" 
                            inputMode="numeric"
                            value={purchaseAmountFcfa}
                            onChange={(e) => setPurchaseAmountFcfa(parseFloat(e.target.value) || 0)}
                            className="w-full h-12 md:h-14 px-4 bg-white border border-slate-200 rounded-xl text-lg font-bold focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 outline-none transition-all"
                          />
                          <span className="absolute right-4 top-[34px] md:top-[42px] font-bold text-slate-300 pointer-events-none">FCFA</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* SaaS Result Card - Refined layout for small screens */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div className={`p-6 md:p-8 rounded-[2rem] border shadow-2xl transition-all duration-500 flex flex-col items-center justify-center text-center ${monthlyInputMode === MonthlyInputMode.FCFA ? 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-200' : 'bg-emerald-600 border-emerald-700 text-white shadow-emerald-200'}`}>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-80">
                      {monthlyInputMode === MonthlyInputMode.FCFA ? 'Estimated Energy' : 'Estimated Cost'}
                    </span>
                    <h4 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 tracking-tighter">
                      {monthlyInputMode === MonthlyInputMode.FCFA ? formatKWh(monthlyData.kWh) : formatFCFA(monthlyData.cost)}
                    </h4>
                    <div className="px-5 py-2 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold border border-white/10">
                      {monthlyInputMode === MonthlyInputMode.FCFA ? `For ${formatFCFA(monthlyData.cost)}` : `At ${formatKWh(monthlyData.kWh)}`}
                    </div>
                  </div>

                  <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-center">
                    <h4 className="text-[11px] font-bold text-slate-500 mb-6 uppercase tracking-widest text-center">Tier Allocation</h4>
                    <div className="space-y-6">
                      <div className="relative pt-4 px-2">
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                          <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${Math.min(monthlyData.kWh, 150) / progressMax * 100}%` }} />
                          <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${Math.min(Math.max(monthlyData.kWh - 150, 0), 100) / progressMax * 100}%` }} />
                          <div className="bg-orange-400 h-full transition-all duration-500" style={{ width: `${Math.max(monthlyData.kWh - 250, 0) / progressMax * 100}%` }} />
                        </div>
                        {/* Current Indicator */}
                        <div 
                          className="absolute top-[14px] w-2 h-6 bg-slate-900 rounded-full shadow-lg transition-all duration-500 z-10"
                          style={{ left: `calc(${Math.min(monthlyData.kWh, progressMax) / progressMax * 100}% - 1px)` }}
                        />
                        {/* Threshold Markers */}
                        <div className="flex justify-between mt-2 px-1 relative h-6">
                          <div className="flex flex-col items-center absolute" style={{ left: '0%' }}>
                            <span className="text-[9px] font-bold text-slate-300">0</span>
                          </div>
                          <div className="flex flex-col items-center absolute" style={{ left: `${150 / progressMax * 100}%` }}>
                            <div className="w-px h-1 bg-slate-300 mb-1" />
                            <span className="text-[9px] font-bold text-slate-400">150</span>
                          </div>
                          <div className="flex flex-col items-center absolute" style={{ left: `${250 / progressMax * 100}%` }}>
                            <div className="w-px h-1 bg-slate-300 mb-1" />
                            <span className="text-[9px] font-bold text-slate-400">250</span>
                          </div>
                          <div className="flex flex-col items-center absolute right-0">
                            <span className="text-[9px] font-bold text-slate-300">{Math.round(progressMax)}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-tight">
                        {monthlyData.kWh > 250 ? "Tier 3 Reached" : monthlyData.kWh > 150 ? "Currently in Tier 2" : "Stayed in Tier 1"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse min-w-[400px]">
                      <thead>
                        <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <th className="px-6 py-4">Tier</th>
                          <th className="px-6 py-4 text-right">Energy</th>
                          <th className="px-6 py-4 text-right">Price</th>
                          <th className="px-6 py-4 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {monthlyData.breakdown.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-700">{row.tier}</td>
                            <td className="px-6 py-4 text-right text-slate-600 font-mono font-medium">{row.kWh.toFixed(1)} <span className="text-[10px] text-slate-400">kWh</span></td>
                            <td className="px-6 py-4 text-right text-slate-400 text-xs">{row.price.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right font-bold text-slate-900">{formatFCFA(row.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100/50 font-black border-t border-slate-100">
                          <td className="px-6 py-5 text-slate-900">GRAND TOTAL</td>
                          <td className="px-6 py-5 text-right text-slate-900">{monthlyData.kWh.toFixed(1)} <span className="text-[10px] opacity-60 font-medium">kWh</span></td>
                          <td className="px-6 py-5"></td>
                          <td className={`px-6 py-5 text-right text-base md:text-lg ${monthlyInputMode === MonthlyInputMode.FCFA ? 'text-indigo-600' : 'text-emerald-600'}`}>
                            {formatFCFA(monthlyData.cost)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="p-4 bg-slate-50 flex flex-col sm:flex-row gap-3 justify-end border-t border-slate-100">
                    <button 
                      onClick={handleShare}
                      className="px-5 py-3 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                      Share Report
                    </button>
                    <button 
                      onClick={() => {
                        const header = "Tier,kWh,Price,Cost";
                        const body = monthlyData.breakdown.map(b => `${b.tier},${b.kWh.toFixed(1)},${b.price.toFixed(2)},${b.cost.toFixed(0)}`).join('\n');
                        const footer = `Total,,${monthlyData.kWh.toFixed(1)},${monthlyData.cost.toFixed(0)}`;
                        copyToClipboard(`${header}\n${body}\n${footer}`).then(s => s && showToast("CSV Copied"));
                      }}
                      className="px-5 py-3 md:py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Download CSV
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Toast Notification - Mobile Refined */}
      {toast && (
        <div className="fixed bottom-6 md:bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 z-[70] w-[90%] sm:w-auto">
          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          </div>
          <span className="text-sm font-bold tracking-tight whitespace-nowrap">{toast}</span>
        </div>
      )}
    </div>
  );
};

export default App;
