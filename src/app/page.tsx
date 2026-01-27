"use client"

import { useEffect, useState } from 'react'
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
  const [now, setNow] = useState(new Date())
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [cols, setCols] = useState<number>(3)
  const [isMounted, setIsMounted] = useState(false)

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

      const sortedData = uniqueData.sort((a, b) => {
        if (a.is_demo !== b.is_demo) return a.is_demo ? 1 : -1;
        return String(a.account_id).localeCompare(String(b.account_id), undefined, { numeric: true });
      });
      setAccounts(sortedData)
    }
  }

  const isStale = (updatedAt: string) => {
    if (!updatedAt) return true;
    const lastUpdate = new Date(updatedAt).getTime();
    const currentTime = now.getTime();
    const diffInSeconds = Math.abs((currentTime - lastUpdate) / 1000);
    const offset7Hours = 25200; 
    const actualDiff = diffInSeconds > 20000 ? Math.abs(diffInSeconds - offset7Hours) : diffInSeconds;
    return actualDiff > 180; 
  }

  useEffect(() => {
    setIsMounted(true)
    fetchAccounts()
    const timer = setInterval(() => setNow(new Date()), 10000)
    const channel = supabase.channel('aot_v21').on('postgres_changes', { event: '*', schema: 'public', table: 'trading_accounts' }, () => fetchAccounts()).subscribe()
    return () => { clearInterval(timer); supabase.removeChannel(channel); }
  }, [])

  const totalEquityUSD = accounts.reduce((sum, a) => {
    if (a.is_demo) return sum;
    return sum + (a.is_usc ? (a.equity || 0) / 100 : (a.equity || 0))
  }, 0)

  const formatThaiTime = (dateString: string) => {
    if (!isMounted || !dateString) return "--:--:--";
    return new Date(dateString).toLocaleTimeString('th-TH', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  };

  if (!isMounted) return null;

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 p-2 md:p-6 font-sans uppercase tracking-tight">
      <div className="max-w-[1800px] mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 bg-slate-900/40 p-4 md:px-8 rounded-[2rem] md:rounded-full border border-slate-800 backdrop-blur-xl shadow-2xl gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <h1 className="text-lg md:text-xl font-black text-white tracking-tighter md:border-r border-slate-700 md:pr-4">AOT TERMINAL</h1>
            
            <div className="flex gap-4 items-center">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 scale-90">
                <button onClick={() => setViewMode('grid')} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>CARDS</button>
                <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>TABLE</button>
              </div>

              {viewMode === 'grid' && (
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 scale-90">
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} onClick={() => setCols(n)} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg text-[10px] font-bold transition-all ${cols === n ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{n}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-center md:text-right w-full md:w-auto p-2">
            <p className="text-blue-400 text-[9px] font-black tracking-[0.2em] mb-0.5 opacity-80">NET REAL EQUITY</p>
            <p className="text-2xl md:text-3xl font-mono font-bold text-white tracking-tighter leading-none">
              {totalEquityUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-blue-400 text-sm">USD</span>
            </p>
          </div>
        </div>

        {/* VIEW: GRID (คงเดิมตามที่คุณชอบ) */}
        {viewMode === 'grid' && (
          <div className={`grid gap-4 md:gap-6 grid-cols-1 ${cols === 2 ? 'md:grid-cols-2' : cols === 3 ? 'md:grid-cols-2 lg:grid-cols-3' : cols === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : ''}`}>
            {accounts.map((acc) => {
              const offline = isStale(acc.updated_at)
              const balance = acc.balance || 0
              const equity = acc.equity || 0
              const ddPct = balance > 0 ? ((equity - balance) / balance) * 100 : 0
              const unit = acc.is_usc ? 'USC' : 'USD'
              const color = acc.is_usc ? 'text-amber-500' : 'text-blue-400'
              
              return (
                <div key={acc.account_id} className={`relative transition-all duration-500 bg-slate-900 border-2 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl ${offline ? 'border-red-500/40' : 'border-slate-800'} ${acc.is_demo ? 'opacity-80' : ''}`}>
                  <div className="flex justify-between items-start mb-4 md:mb-6">
                    <div>
                      <h2 className={`text-base md:text-xl font-black truncate max-w-[180px] ${offline ? 'text-red-400' : 'text-white'}`}>{acc.account_name}</h2>
                      <p className="text-slate-500 text-[9px] md:text-[10px] font-mono mt-0.5">ID: {acc.account_id}</p>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full border text-[8px] font-black ${offline ? 'text-red-500 border-red-500/20' : 'text-emerald-400 border-emerald-500/20'}`}>{offline ? 'OFFLINE' : 'LIVE'}</div>
                  </div>

                  <div className="text-center mb-6 md:mb-8">
                    <p className={`${color} text-[9px] md:text-[10px] font-black mb-1 md:mb-2 tracking-widest opacity-80 uppercase`}>Current Equity</p>
                    <div className="flex items-baseline justify-center gap-1 md:gap-2">
                      <span className={`${cols >= 3 ? 'text-4xl md:text-5xl' : 'text-5xl md:text-7xl'} font-mono font-black tracking-tighter text-white leading-none`}>
                        {equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span className={`${color} text-sm md:text-xl font-black`}>{unit}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-2 opacity-40">
                      <span className="text-[9px] md:text-[10px] font-black text-slate-400">BAL:</span>
                      <span className="text-xs md:text-sm font-mono font-bold text-slate-200">{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span className="text-[8px] font-bold text-slate-400">{unit}</span>
                    </div>
                  </div>

                  <div className="mb-4 md:mb-6">
                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/50 text-center">
                      <p className="text-[8px] md:text-[9px] text-slate-500 font-black mb-1">DRAWDOWN</p>
                      <p className={`text-xl md:text-2xl font-bold font-mono ${ddPct < 0 ? 'text-red-500' : 'text-emerald-400'}`}>{ddPct.toFixed(2)}%</p>
                    </div>
                  </div>

                  <div className="flex justify-between text-[8px] md:text-[10px] font-bold text-slate-600 border-t border-slate-800/40 pt-4">
                    <span>LOTS: {acc.total_lots?.toFixed(2)}</span>
                    <span className="font-mono text-slate-500">SYNC: {formatThaiTime(acc.updated_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* VIEW: TABLE (ปรับตามที่คุณขอ: รวมหน่วยเงิน และขยับ Drawdown เข้ามา) */}
        {viewMode === 'table' && (
          <div className="bg-slate-900 border border-slate-800 rounded-[1.5rem] md:rounded-[2rem] overflow-x-auto shadow-2xl">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-slate-950 text-[9px] md:text-[10px] font-black text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="p-4 md:p-6">PORTFOLIO</th>
                  <th className="p-4 md:p-6 text-right">EQUITY / BALANCE</th>
                  <th className="p-4 md:p-6 text-center text-red-400">DRAWDOWN</th>
                  <th className="p-4 md:p-6 text-right">SYNC TIME</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {accounts.map((acc) => {
                  const ddPct = acc.balance > 0 ? ((acc.equity - acc.balance) / acc.balance) * 100 : 0
                  const unit = acc.is_usc ? 'USC' : 'USD'
                  const color = acc.is_usc ? 'text-amber-500' : 'text-blue-400'
                  
                  return (
                    <tr key={acc.account_id} className={`hover:bg-slate-800/30 transition-colors ${acc.is_demo ? 'bg-slate-900/40' : ''}`}>
                      <td className="p-4 md:p-6">
                        <p className="font-bold text-white text-sm md:text-base leading-none">{acc.account_name}</p>
                        <p className="text-[9px] text-slate-500 font-mono mt-1 opacity-60">ID: {acc.account_id}</p>
                      </td>
                      <td className="p-4 md:p-6 text-right font-mono">
                        {/* รวมหน่วยเงินไว้ข้างหลังตัวเลข */}
                        <div className="font-bold text-white text-sm md:text-lg">
                          {acc.equity.toLocaleString(undefined, {minimumFractionDigits: 2})} <span className={`${color} text-[10px] md:text-xs ml-1`}>{unit}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {acc.balance.toLocaleString()} <span className="opacity-50 ml-0.5">{unit}</span>
                        </div>
                      </td>
                      <td className={`p-4 md:p-6 text-center font-mono font-bold text-base md:text-xl ${ddPct < 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                        {ddPct.toFixed(1)}%
                      </td>
                      <td className="p-4 md:p-6 text-right font-mono text-slate-400 text-[10px] md:text-sm">
                        {formatThaiTime(acc.updated_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}