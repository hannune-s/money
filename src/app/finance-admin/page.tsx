"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function FinancesAdminPage() {
  const [accounts, setAccounts] = useState(Array(8).fill({ name: '', balance: '' }));
  const [expenditures, setExpenditures] = useState([{ name: '', amount: '' }]);
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState({ msg: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [dashboardPin, setDashboardPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const formatNumber = (num: number) => num.toLocaleString('ko-KR');
  const parseNumber = (str: string) => parseInt(str.toString().replace(/,/g, '') || '0', 10);

  const calculateTotals = () => {
    let totalAccounts = 0;
    accounts.forEach(acc => totalAccounts += parseNumber(acc.balance));
    let totalExpenditures = 0;
    expenditures.forEach(exp => totalExpenditures += parseNumber(exp.amount));
    return {
      totalAccounts,
      totalExpenditures,
      finalBalance: totalAccounts - totalExpenditures
    };
  };

  const totals = calculateTotals();

  useEffect(() => {
    loadData();
  }, [targetDate]);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('money_finances')
        .select('*')
        .eq('target_date', targetDate)
        .single();
        
      if (data) {
        const loadedAccounts = [...accounts];
        data.accounts.forEach((acc: any, i: number) => {
          if (i < 8) {
            loadedAccounts[i] = { name: acc.name, balance: acc.balance ? formatNumber(acc.balance) : '' };
          }
        });
        setAccounts(loadedAccounts);
        
        if (data.expenditures && data.expenditures.length > 0) {
          setExpenditures(data.expenditures.map((e: any) => ({ name: e.name, amount: e.amount ? formatNumber(e.amount) : '' })));
        } else {
          setExpenditures([{ name: '', amount: '' }]);
        }
      } else {
        resetForm();
      }
    } catch (err) {
      console.log('초기 데이터 없음', err);
      resetForm();
    }
  };

  const resetForm = () => {
    setAccounts(Array(8).fill({ name: '', balance: '' }));
    setExpenditures([{ name: '', amount: '' }]);
  };

  const handleSave = async () => {
    setLoading(true);
    setStatus({ msg: '저장 중...', type: 'info' });
    
    const validAccounts = accounts.filter(a => a.name || parseNumber(a.balance) > 0).map(a => ({ name: a.name, balance: parseNumber(a.balance) }));
    const validExpenditures = expenditures.filter(e => e.name || parseNumber(e.amount) > 0).map(e => ({ name: e.name, amount: parseNumber(e.amount) }));

    const payload = {
      target_date: targetDate,
      accounts: validAccounts,
      expenditures: validExpenditures,
      total_account_balance: totals.totalAccounts,
      total_expenditure: totals.totalExpenditures,
      final_balance: totals.finalBalance
    };

    try {
      const { error } = await supabase.from('money_finances').upsert(payload, { onConflict: 'target_date' });
      if (error) throw error;
      setStatus({ msg: '✅ 성공적으로 저장되었습니다!', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setStatus({ msg: `❌ 저장 실패: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setStatus({ msg: '', type: '' }), 3000);
    }
  };

  const updateAccount = (index: number, field: string, value: string) => {
    const newAccounts = [...accounts];
    if (field === 'balance') {
      const num = parseNumber(value);
      newAccounts[index] = { ...newAccounts[index], [field]: num === 0 && value.trim() === '' ? '' : formatNumber(num) };
    } else {
      newAccounts[index] = { ...newAccounts[index], [field]: value };
    }
    setAccounts(newAccounts);
  };

  const updateExpenditure = (index: number, field: string, value: string) => {
    const newExp = [...expenditures];
    if (field === 'amount') {
      const num = parseNumber(value);
      newExp[index] = { ...newExp[index], [field]: num === 0 && value.trim() === '' ? '' : formatNumber(num) };
    } else {
      newExp[index] = { ...newExp[index], [field]: value };
    }
    setExpenditures(newExp);
  };

  const addExpenditure = () => setExpenditures([...expenditures, { name: '', amount: '' }]);
  const removeExpenditure = (index: number) => setExpenditures(expenditures.filter((_, i) => i !== index));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">💸 일일 자금 현황 관리</h1>
        <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-gray-700" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Accounts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">🏦 계좌잔고내역 (8개)</h2>
          <div className="space-y-3">
            {accounts.map((acc, i) => (
              <div key={i} className="flex space-x-2">
                <input type="text" placeholder="은행명 (예: 국민)" value={acc.name} onChange={e => updateAccount(i, 'name', e.target.value)} className="w-1/3 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm" />
                <input type="text" placeholder="잔고 입력" value={acc.balance} onChange={e => updateAccount(i, 'balance', e.target.value)} className="w-2/3 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-right text-sm" />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between font-bold text-lg">
            <span>계좌 총액:</span>
            <span className="text-blue-600">{formatNumber(totals.totalAccounts)} 원</span>
          </div>
        </div>

        {/* Expenditures */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-red-800">💳 당일 지출 내역</h2>
            <button onClick={addExpenditure} className="bg-red-50 text-red-600 px-3 py-1 rounded-lg hover:bg-red-100 text-sm font-semibold transition">+ 항목 추가</button>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {expenditures.map((exp, i) => (
              <div key={i} className="flex space-x-2 items-center">
                <input type="text" placeholder="지출 내용" value={exp.name} onChange={e => updateExpenditure(i, 'name', e.target.value)} className="w-1/2 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 text-sm" />
                <input type="text" placeholder="금액" value={exp.amount} onChange={e => updateExpenditure(i, 'amount', e.target.value)} className="w-1/2 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 text-right text-sm" />
                <button onClick={() => removeExpenditure(i)} className="text-red-400 hover:text-red-600 font-bold px-2">✕</button>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between font-bold text-lg">
            <span>지출 합계:</span>
            <span className="text-red-600">{formatNumber(totals.totalExpenditures)} 원</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 text-white rounded-2xl p-8 text-center shadow-lg mt-6">
        <h2 className="text-gray-400 text-sm font-semibold mb-2 tracking-wide uppercase">오늘의 최종 현잔고</h2>
        <div className="text-5xl font-extrabold text-green-400">{formatNumber(totals.finalBalance)} <span className="text-3xl text-gray-400">원</span></div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6 max-w-md mx-auto">
        <h3 className="text-lg font-bold text-gray-800 mb-2">🔒 공유 페이지 비밀번호 설정</h3>
        <p className="text-xs text-gray-500 mb-4">공유 링크에 접속할 때 물어볼 4자리 비밀번호를 설정합니다.</p>
        <div className="flex gap-2">
          <input 
            type="password" 
            maxLength={4} 
            value={dashboardPin} 
            onChange={e => setDashboardPin(e.target.value.replace(/[^0-9]/g, ''))} 
            placeholder="예: 1234" 
            className="flex-1 p-2 border border-gray-300 rounded-lg text-center tracking-[0.3em] font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button 
            onClick={async () => {
              if (dashboardPin.length !== 4) return alert('4자리를 입력해주세요.');
              setSavingPin(true);
              const { setDashboardPin: savePinAction } = await import('./actions');
              const res = await savePinAction(dashboardPin);
              setSavingPin(false);
              if (res.success) alert('비밀번호가 설정되었습니다.');
              else alert(res.error);
            }}
            disabled={savingPin}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 rounded-lg transition-colors whitespace-nowrap"
          >
            {savingPin ? '저장 중...' : '설정'}
          </button>
        </div>
      </div>

      <div className="flex justify-center space-x-4 pt-4">
        <button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 px-10 rounded-xl shadow-md transition-all">
          {loading ? '저장 중...' : '💾 자금 현황 저장'}
        </button>
        <button onClick={() => { if(confirm('모두 비우시겠습니까?')) resetForm(); }} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 px-8 rounded-xl shadow-sm transition-all">
          초기화
        </button>
      </div>

      {status.msg && (
        <div className={`text-center font-bold mt-4 ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {status.msg}
        </div>
      )}
      <style>{`nav { display: none !important; }`}</style>
    </div>
  );
}
