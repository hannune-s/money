"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function FinancesDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const getKstDate = () => {
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return kst.toISOString().split('T')[0];
  };
  const targetDate = getKstDate();
  
  const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  const displayDate = new Date(new Date().getTime() + (9 * 60 * 60 * 1000)).toLocaleDateString('ko-KR', dateOptions);

  const formatNumber = (num: number) => num.toLocaleString('ko-KR');

  const loadDashboard = async () => {
    try {
      const { data: financeData, error } = await supabase
        .from('money_finances')
        .select('*')
        .eq('target_date', targetDate)
        .single();
        
      if (error || !financeData) {
        setData(null);
      } else {
        setData(financeData);
      }
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const [isAuthed, setIsAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [checkingPin, setCheckingPin] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckingPin(true);
    const { verifyDashboardPin } = await import('./admin/actions');
    const isValid = await verifyDashboardPin(pin);
    if (isValid) {
      setIsAuthed(true);
      sessionStorage.setItem('finance_dashboard_authed', 'true');
    } else {
      alert('비밀번호가 일치하지 않습니다.');
      setPin('');
    }
    setCheckingPin(false);
  };

  useEffect(() => {
    if (sessionStorage.getItem('finance_dashboard_authed') === 'true') {
      setIsAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    loadDashboard();

    // 실시간 구독
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'money_finances' },
        (payload) => {
          if (payload.new && (payload.new as any).target_date === targetDate) {
            loadDashboard();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthed]);

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans pb-24">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 w-full max-w-sm flex flex-col items-center">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">일일잔고현황</h2>
          <p className="text-sm text-gray-500 mb-8 text-center">보호된 페이지입니다.<br/>비밀번호 4자리를 입력해주세요.</p>
          
          <input 
            type="password" 
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-full text-center text-3xl tracking-[0.5em] p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6 font-mono transition-shadow"
            placeholder="****"
            autoFocus
          />
          <button type="submit" disabled={checkingPin || pin.length < 4} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl transition-colors shadow-sm">
            확인
          </button>
        </form>
        <style>{`nav { display: none !important; }`}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans pb-24">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        {/* 헤더 영역 */}
        <div className="bg-indigo-600 p-6 sm:p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-indigo-700 opacity-20 transform -skew-y-3 origin-top-left"></div>
          <h1 className="text-2xl sm:text-3xl font-extrabold relative z-10">📊 일일잔고현황</h1>
          <p className="mt-2 text-indigo-100 font-medium relative z-10">{displayDate}</p>
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="text-center py-16">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium animate-pulse">데이터를 불러오는 중입니다...</p>
            </div>
          ) : data ? (
            <div>
              {/* 최종 잔고 하이라이트 */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-2xl p-8 mb-8 text-center shadow-sm">
                <h2 className="text-green-800 text-lg font-bold mb-3 tracking-wide">오늘의 최종 현잔고</h2>
                <p className="text-xs text-green-600 mb-2 font-medium opacity-80">(금액을 누르면 보입니다)</p>
                <div 
                  onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                  className={`text-4xl sm:text-5xl font-semibold text-green-600 cursor-pointer transition-all duration-300 select-none ${
                    !isBalanceVisible ? 'blur-[10px] opacity-70' : 'drop-shadow-sm'
                  }`}
                >
                  {formatNumber(data.final_balance)} <span className="text-2xl sm:text-3xl font-medium">원</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {/* 계좌 현황 표 */}
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-blue-50 flex justify-between items-center p-4 border-b border-blue-100">
                    <h3 className="text-lg font-bold text-blue-800">🏦 법인계좌 잔고</h3>
                    <span className="text-sm font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                      총액 {formatNumber(data.total_account_balance)}원
                    </span>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <tbody className="divide-y divide-gray-100">
                      {data.accounts && data.accounts.length > 0 ? (
                        data.accounts.map((acc: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="py-4 px-5 text-gray-600 font-medium">{acc.name}</td>
                            <td className="py-4 px-5 text-right font-bold text-gray-900">{formatNumber(acc.balance)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={2} className="py-8 text-center text-gray-400">등록된 계좌가 없습니다.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 지출 현황 표 */}
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-red-50 flex justify-between items-center p-4 border-b border-red-100">
                    <h3 className="text-lg font-bold text-red-800">💳 당일 지출 내역</h3>
                    <span className="text-sm font-bold text-red-600 bg-red-100 px-3 py-1 rounded-full">
                      합계 {formatNumber(data.total_expenditure)}원
                    </span>
                  </div>
                  <table className="w-full text-left border-collapse">
                    <tbody className="divide-y divide-gray-100">
                      {data.expenditures && data.expenditures.length > 0 ? (
                        data.expenditures.map((exp: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="py-4 px-5 text-gray-600 font-medium">{exp.name}</td>
                            <td className="py-4 px-5 text-right font-bold text-gray-900">{formatNumber(exp.amount)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={2} className="py-8 text-center text-gray-400">지출 내역이 없습니다.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="mt-8 pt-4 border-t border-gray-100 text-right flex justify-between items-center text-sm">
                <span className="text-indigo-500 font-semibold flex items-center gap-1">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                  </span>
                  실시간 연동 중
                </span>
                <span className="text-gray-400 font-medium">마지막 업데이트: {new Date(data.created_at).toLocaleTimeString('ko-KR')}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-xl text-gray-700 font-bold mb-2">오늘 입력된 자금 현황이 없습니다.</p>
              <p className="text-gray-500">관리자가 데이터를 등록하면 자동으로 반영됩니다.</p>
            </div>
          )}
        </div>
      </div>
      <style>{`nav { display: none !important; }`}</style>
    </div>
  );
}
