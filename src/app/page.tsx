"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [now, setNow] = useState(new Date())
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [cols, setCols] = useState<number>(2)

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from('trading_accounts')
      .select('*')
      .order('updated_at', { ascending: false })
    
    if (!error && data) {
      const uniqueData = data.reduce((acc: any[], current) => {
        const x = acc.find(item => item.account_id === current.account_id);
        if (!x) return acc.concat([current]);
        return acc;
      }, []);
      setAccounts(uniqueData)
    }
  }

  const isStale = (updatedAt: string) => {
    const lastUpdate = new Date(updatedAt).getTime()
    const currentTime = now.getTime()
    let diffInSeconds = (currentTime - lastUpdate) / 1000
    if (diffInSeconds > 25000) diffInSeconds -= 25200 
    return diffInSeconds > 180 
  }

  useEffect(() => {
    fetchAccounts()
    const timer = setInterval(() => setNow(new Date()), 10000)
    const channel = supabase.channel('aot_v8').on('postgres_changes', { event: '*', schema: 'public', table: 'trading_accounts' }, () => fetchAccounts()).subscribe()
    return () => { clearInterval(timer); supabase.removeChannel(channel); }
  }, [])

  // 🔥 จุดสำคัญ: คำนวณยอดรวม โดยข้ามพอร์ทที่เป็น is_demo และจัดการ USC/USD
  const totalEquityUSD = accounts.reduce((sum, a) => {
    if (a.is_demo) return sum; // ถ้าเป็น Demo ไม่ต้องบวกเข้ายอดรวม
    const val = a.is_usc ? (a.equity || 0) / 100 : (a.equity || 0)
    return sum + val
  }, 0)

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 p-4 md:p-6 font-sans uppercase tracking-tight">
      <div className="max-w-[1800px] mx-auto">
        
        {/* HEADER - ระนาบเดียวกันบรรทัดเดียว */}
        <div className="flex flex-row items-center justify-between mb-8 bg-slate-900/40 p-4 px-8 rounded-full border border-slate-800 backdrop-blur-xl shadow-2xl">
          
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black text-white tracking-tighter border-r border-slate-700 pr-4">AOT TERMINAL</h1>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 scale-90">
              <button onClick={() => setViewMode('grid')} className={`px-4 py-1.5 rounded-lg text-[9px] font-bold transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>CARDS</button>
              <button onClick={() => setViewMode('table')} className={`px-4 py-1.5 rounded-lg text-[9px] font-bold transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>TABLE</button>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            {viewMode === 'grid' && (
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 scale-90">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} onClick={() => setCols(n)} className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all ${cols === n ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>{n}</button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-blue-400 text-[8px] font-black tracking-[0.2em] mb-0.5 uppercase">Net Real Equity (USD)</p>
              <p className="text-2xl font-mono font-bold text-white tracking-tighter">
                ${totalEquityUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="h-8 w-[1px] bg-slate-800"></div>
            <div className="flex flex-col items-end">
               <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mb-1"></span>
               <p className="text-[8px] text-slate-500 font-bold uppercase">Live Sync</p>
            </div>
          </div>
        </div>

        {/* VIEW: GRID */}
        {viewMode === 'grid' && (
          <div className={`grid gap-6 grid-cols-1 ${cols === 2 ? 'md:grid-cols-2' : cols === 3 ? 'md:grid-cols-2 lg:grid-cols-3' : cols === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : ''}`}>
            {accounts.map((acc) => {
              const offline = isStale(acc.updated_at)
              const balance = acc.balance || 0
              const equity = acc.equity || 0
              const ddPct = balance > 0 ? ((equity - balance) / balance) * 100 : 0
              
              return (
                <div key={acc.account_id} className={`relative transition-all duration-500 bg-slate-900 border-2 rounded-[2.5rem] p-8 shadow-2xl ${offline ? 'border-red-500/40 grayscale-[0.2]' : 'border-slate-800 hover:border-blue-500/50'} ${acc.is_demo ? 'opacity-90' : ''}`}>
                  
                  {/* Demo Badge */}
                  {acc.is_demo && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] font-black px-4 py-1 rounded-b-xl shadow-lg uppercase">
                      Demo Account
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className={`text-xl font-black truncate ${offline ? 'text-red-400' : 'text-white'}`}>{acc.account_name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500 text-[10px] font-mono tracking-widest">ID: {acc.account_id}</p>
                        <span className={`text-[8px] font-bold px-1.5 rounded ${acc.is_usc ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                          {acc.is_usc ? 'USC' : 'USD'}
                        </span>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-full border text-[8px] font-black ${offline ? 'text-red-500 border-red-500/20' : 'text-emerald-400 border-emerald-500/20'}`}>{offline ? 'OFFLINE' : 'LIVE'}</div>
                  </div>

                  <div className="text-center mb-8">
                    <p className={`text-[10px] font-black mb-2 tracking-widest ${acc.is_demo ? 'text-slate-500' : 'text-blue-400'}`}>EQUITY</p>
                    <div className={`${cols >= 3 ? 'text-4xl' : 'text-6xl'} font-mono font-black tracking-tighter text-white leading-none`}>
                      ${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 text-center">
                      <p className="text-[9px] text-slate-500 font-black mb-1">DRAWDOWN</p>
                      <p className={`text-lg font-bold font-mono ${ddPct < 0 ? 'text-red-500' : 'text-emerald-400'}`}>{ddPct.toFixed(2)}%</p>
                    </div>
                    <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 text-center">
                      <p className="text-[9px] text-slate-500 font-black mb-1 tracking-widest uppercase">Balance</p>
                      <p className="text-lg font-mono font-bold text-slate-300">${balance.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px] font-bold text-slate-600 border-t border-slate-800/50 pt-5">
                    <span>VOL: {acc.total_lots?.toFixed(2)} L</span>
                    <span>SYNC: {new Date(acc.updated_at).toLocaleTimeString('th-TH')}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* VIEW: TABLE */}
        {viewMode === 'table' && (
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-950 text-[10px] font-black text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="p-6">PORTFOLIO</th>
                  <th className="p-6">TYPE</th>
                  <th className="p-6 text-right">EQUITY</th>
                  <th className="p-6 text-right text-blue-400">VALUE (USD)</th>
                  <th className="p-6 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {accounts.map((acc) => {
                  const offline = isStale(acc.updated_at)
                  const equityUSD = acc.is_usc ? acc.equity / 100 : acc.equity
                  return (
                    <tr key={acc.account_id} className={`hover:bg-slate-800/30 transition-colors ${acc.is_demo ? 'bg-slate-900/50' : ''}`}>
                      <td className="p-6">
                        <p className="font-bold text-white text-base">{acc.account_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono tracking-widest">{acc.account_id}</p>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[10px] font-bold ${acc.is_usc ? 'text-amber-500' : 'text-blue-400'}`}>{acc.is_usc ? 'CENT (USC)' : 'STANDARD (USD)'}</span>
                          {acc.is_demo && <span className="text-[9px] font-black text-amber-500">DEMO ACCOUNT</span>}
                        </div>
                      </td>
                      <td className="p-6 text-right font-mono font-bold text-white text-lg">${acc.equity?.toLocaleString()}</td>
                      <td className="p-6 text-right font-mono font-bold text-blue-400 text-lg">
                        {acc.is_demo ? <span className="text-slate-600">EXCLUDED</span> : `$${equityUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="p-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black ${offline ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-400'}`}>{offline ? 'OFFLINE' : 'LIVE'}</span>
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