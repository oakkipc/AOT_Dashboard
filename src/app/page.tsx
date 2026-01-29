"use client"

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'

interface TradingAccount {
  account_id: string | number;
  account_name: string;
  equity: number;
  balance: number;
  is_usc: boolean;
  is_demo: boolean;
  updated_at: string;
  total_lots?: number;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([])
  const [goldPrice, setGoldPrice] = useState<number | null>(null)
  const [now, setNow] = useState(new Date())
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [cols, setCols] = useState<number>(3)
  const [isMounted, setIsMounted] = useState(false)

  // ระบบ Sort State
  const [sortConfig, setSortConfig] = useState<{ key: 'equity' | 'dd' | 'name'; direction: 'asc' | 'desc' }>({
    key: 'equity',
    direction: 'desc'
  })

  const fetchGoldPrice = async () => {
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
      const data = await res.json();
      if (data.price) setGoldPrice(parseFloat(data.price));
    } catch (e) { console.error("Gold API Error:", e); }
  }

  const fetchAccounts = async () => {
    const { data, error } = await supabase.from('trading_accounts').select('*')
    if (!error && data) {
      const uniqueData = (data as TradingAccount[]).reduce((acc: TradingAccount[], current) => {
        const x = acc.find(item => item.account_id === current.account_id);
        if (!x) return acc.concat([current]);
        if (new Date(current.updated_at) > new Date(x.updated_at)) {
          return acc.map(item => item.account_id === current.account_id ? current : item);
        }
        return acc;
      }, []);
      setAccounts(uniqueData);
    }
  }

  // 🔥 ระบบคำนวณการ Sort
  const sortedAccounts = useMemo(() => {
    const sortableItems = [...accounts];
    sortableItems.sort((a, b) => {
      let aVal: any, bVal: any;

      if (sortConfig.key === 'equity') {
        aVal = a.is_usc ? a.equity / 100 : a.equity;
        bVal = b.is_usc ? b.equity / 100 : b.equity;
      } else if (sortConfig.key === 'dd') {
        aVal = a.balance > 0 ? ((a.equity - a.balance) / a.balance) * 100 : 0;
        bVal = b.balance > 0 ? ((b.equity - b.balance) / b.balance) * 100 : 0;
      } else {
        aVal = a.account_name.toLowerCase();
        bVal = b.account_name.toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [accounts, sortConfig]);

  const requestSort = (key: 'equity' | 'dd' | 'name') => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  }

  const isStale = (updatedAt: string) => {
    if (!updatedAt) return true;
    const diff = Math.abs((now.getTime() - new Date(updatedAt).getTime()) / 1000);
    const actualDiff = diff > 20000 ? Math.abs(diff - 25200) : diff;
    return actualDiff > 180;
  }

  useEffect(() => {
    setIsMounted(true)
    if (window.innerWidth < 768) setViewMode('table');
    fetchAccounts();
    fetchGoldPrice();
    const timer = setInterval(() => setNow(new Date()), 10000)
    const goldTimer = setInterval(fetchGoldPrice, 30000)
    const channel = supabase.channel('aot_v24').on('postgres_changes', { event: '*', schema: 'public', table: 'trading_accounts' }, () => fetchAccounts()).subscribe()
    return () => { clearInterval(timer); clearInterval(goldTimer); supabase.removeChannel(channel); }
  }, [])

  const totalEquityUSD = accounts.reduce((sum, a) => a.is_demo ? sum : sum + (a.is_usc ? a.equity / 100 : a.equity), 0)

  if (!isMounted) return null;

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 p-2 md:p-6 font-sans uppercase tracking-tight">
      <div className="max-w-[1800px] mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 bg-slate-900/40 p-4 md:px-8 rounded-[2rem] md:rounded-full border border-slate-800 backdrop-blur-xl shadow-2xl gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between">
            <h1 className="text-lg font-black text-white tracking-tighter">AOT TERMINAL</h1>
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
               <span className="text-[8px] font-black text-amber-500 tracking-widest">XAUUSD</span>
               <span className="text-sm font-mono font-bold text-white">{goldPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '---.--'}</span>
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 scale-90">
              <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>CARDS</button>
              <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>TABLE</button>
            </div>
            <div className="text-right border-l border-slate-800 pl-4">
              <p className="text-blue-400 text-[8px] font-black opacity-80 leading-none mb-1">NET EQUITY</p>
              <p className="text-xl font-mono font-bold text-white leading-none">
                {totalEquityUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs">USD</span>
              </p>
            </div>
          </div>
        </div>

        {/* VIEW: TABLE WITH SORT */}
        {viewMode === 'table' && (
          <div className="bg-slate-900 border border-slate-800 rounded-[1.5rem] overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="bg-slate-950 text-[9px] font-black text-slate-500 border-b border-slate-800">
                <tr>
                  <th onClick={() => requestSort('name')} className="p-4 w-[35%] cursor-pointer hover:text-white transition-colors">
                    PORTFOLIO {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => requestSort('equity')} className="p-4 text-right w-[40%] cursor-pointer hover:text-white transition-colors">
                    EQUITY / BAL {sortConfig.key === 'equity' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th onClick={() => requestSort('dd')} className="p-4 text-center w-[25%] text-red-400 cursor-pointer hover:text-red-200 transition-colors">
                    DD% {sortConfig.key === 'dd' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-[11px] md:text-sm uppercase">
                {sortedAccounts.map((acc) => {
                  const dd = acc.balance > 0 ? ((acc.equity - acc.balance) / acc.balance) * 100 : 0
                  const color = acc.is_usc ? 'text-amber-500' : 'text-blue-400'
                  return (
                    <tr key={acc.account_id} className={`hover:bg-slate-800/30 transition-colors ${acc.is_demo ? 'opacity-60 bg-slate-900/40' : ''}`}>
                      <td className="p-4 overflow-hidden">
                        <p className="font-bold text-white truncate">{acc.account_name}</p>
                        <p className="text-[8px] text-slate-500 font-mono">ID: {acc.account_id}</p>
                      </td>
                      <td className="p-4 text-right font-mono font-bold">
                        <div className="text-white">
                          {acc.equity.toLocaleString(undefined, {minimumFractionDigits: 1})} <span className={`text-[8px] ${color}`}>{acc.is_usc ? 'USC' : 'USD'}</span>
                        </div>
                        <div className="text-[9px] text-slate-500 opacity-60">
                          {acc.balance.toLocaleString()}
                        </div>
                      </td>
                      <td className={`p-4 text-center font-mono font-bold ${dd < 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                        {dd.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW: GRID (CARDS) */}
        {viewMode === 'grid' && (
          <div className={`grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-${cols}`}>
            {sortedAccounts.map((acc) => {
              const offline = isStale(acc.updated_at)
              const dd = acc.balance > 0 ? ((acc.equity - acc.balance) / acc.balance) * 100 : 0
              const color = acc.is_usc ? 'text-amber-500' : 'text-blue-400'
              return (
                <div key={acc.account_id} className={`bg-slate-900 border-2 rounded-[2rem] p-6 shadow-2xl transition-all duration-500 ${offline ? 'border-red-500/40' : 'border-slate-800 hover:border-blue-500/50'} ${acc.is_demo ? 'opacity-80' : ''}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="max-w-[70%]">
                      <h2 className={`text-base font-black truncate ${offline ? 'text-red-400' : 'text-white'}`}>{acc.account_name}</h2>
                      <p className="text-[9px] text-slate-500 font-mono">ID: {acc.account_id}</p>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full border text-[8px] font-black ${offline ? 'text-red-500 border-red-500/20' : 'text-emerald-400 border-emerald-500/20'}`}>{offline ? 'OFFLINE' : 'LIVE'}</div>
                  </div>
                  <div className="text-center mb-6">
                    <p className={`${color} text-[9px] font-black mb-1 opacity-80 tracking-widest`}>EQUITY</p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl md:text-5xl font-mono font-black text-white leading-none">{acc.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span className={`${color} text-sm font-black`}>{acc.is_usc ? 'USC' : 'USD'}</span>
                    </div>
                    <div className="mt-2 text-[10px] font-mono font-bold text-slate-500 opacity-60">BAL: {acc.balance.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/50 text-center mb-4">
                    <p className="text-[8px] text-slate-500 font-black mb-1 tracking-widest">DRAWDOWN</p>
                    <p className={`text-2xl font-bold font-mono ${dd < 0 ? 'text-red-500' : 'text-emerald-400'}`}>{dd.toFixed(2)}%</p>
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-slate-600 border-t border-slate-800/40 pt-4">
                    <span>LOTS: {acc.total_lots?.toFixed(2) || '0.00'}</span>
                    <span className="font-mono opacity-60 uppercase">{new Date(acc.updated_at).toLocaleTimeString('th-TH', { hour12: false })}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}