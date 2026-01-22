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
  const [isMounted, setIsMounted] = useState(false)

  const fetchAccounts = async () => {
    const { data, error } = await supabase.from('trading_accounts').select('*')
    if (!error && data) {
      // กรองและเรียงลำดับเหมือนเดิม
      const uniqueData = data.reduce((acc: any[], current) => {
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

  useEffect(() => {
    setIsMounted(true)
    fetchAccounts()
    const timer = setInterval(() => setNow(new Date()), 10000)
    const channel = supabase.channel('aot_v14').on('postgres_changes', { event: '*', schema: 'public', table: 'trading_accounts' }, () => fetchAccounts()).subscribe()
    return () => { clearInterval(timer); supabase.removeChannel(channel); }
  }, [])

  // ฟังก์ชันแสดงเวลาที่อ่านค่า +07:00 จาก Python มาแสดงตรงๆ
  const formatThaiTime = (dateString: string) => {
    if (!isMounted || !dateString) return "--:--:--";
    return new Date(dateString).toLocaleTimeString('th-TH', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  };

  if (!isMounted) return null;

  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 p-6 font-sans uppercase tracking-tight">
      <div className="max-w-[1200px] mx-auto">
        {/* สรุปยอดรวม (ข้าม Demo / หาร 100 ถ้าเป็น USC) */}
        <div className="flex justify-between items-center mb-8 bg-slate-900/40 p-6 rounded-full border border-slate-800 backdrop-blur-xl">
          <h1 className="text-xl font-black text-white pr-4 border-r border-slate-700">AOT TERMINAL</h1>
          <div className="text-right">
            <p className="text-blue-400 text-[8px] font-black tracking-widest">NET REAL EQUITY (USD)</p>
            <p className="text-2xl font-mono font-bold text-white leading-none">
              ${accounts.reduce((sum, a) => a.is_demo ? sum : sum + (a.is_usc ? (a.equity || 0)/100 : (a.equity || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* GRID แสดงพอร์ท */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc) => {
            const balance = acc.balance || 0
            const equity = acc.equity || 0
            const ddPct = balance > 0 ? ((equity - balance) / balance) * 100 : 0
            
            return (
              <div key={acc.account_id} className="relative bg-slate-900 border-2 border-slate-800 rounded-[2.5rem] p-7 shadow-2xl">
                {acc.is_demo && <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] font-black px-4 py-1 rounded-b-xl">DEMO</div>}
                <div className="flex justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-black text-white">{acc.account_name}</h2>
                    <p className="text-slate-500 text-[10px] font-mono">ID: {acc.account_id} | {acc.is_usc ? 'USC' : 'USD'}</p>
                  </div>
                </div>
                <div className="text-center mb-6">
                  <p className="text-blue-400 text-[9px] font-black mb-1 uppercase">Equity</p>
                  <p className="text-5xl font-mono font-black text-white tracking-tighter">${equity.toLocaleString()}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                  <div className="text-center">
                    <p className="text-[8px] text-slate-500 font-black mb-1 uppercase">Drawdown</p>
                    <p className={`text-base font-bold font-mono ${ddPct < 0 ? 'text-red-500' : 'text-emerald-400'}`}>{ddPct.toFixed(2)}%</p>
                  </div>
                  <div className="text-center border-l border-slate-800">
                    <p className="text-[8px] text-slate-500 font-black mb-1 uppercase">Balance</p>
                    <p className="text-base font-bold font-mono text-slate-300">${balance.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-6 flex justify-between items-center text-[9px] font-bold text-slate-600 border-t border-slate-800 pt-4">
                  <span>VOL: {acc.total_lots?.toFixed(2)} L</span>
                  <span className="font-mono text-slate-400">SYNC: {formatThaiTime(acc.updated_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}