"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AlbaRecord {
  id: string;
  date: string;
  name: string;
  communityId?: string;
  phone: string;
  attitude: string;
  incident: string;
  createdAt: string;
}

const ALBA_STORAGE_DATE = '1970-01-01';

export default function FinancesAdminPage() {
  const defaultAccounts = [
    { name: '법인계좌', balance: '' },
    { name: '우체국', balance: '' },
    { name: '카카오뱅크', balance: '' },
    ...Array(7).fill({ name: '', balance: '' })
  ];

  const getKstDate = () => {
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return kst.toISOString().split('T')[0];
  };

  // 네비게이션 및 메뉴 상태
  const [activeMenu, setActiveMenu] = useState<'finance' | 'alba'>('finance');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // [1] 일일 자금 현황 상태
  const [accounts, setAccounts] = useState(defaultAccounts);
  const [expenditures, setExpenditures] = useState([{ name: '', amount: '' }]);
  const [targetDate, setTargetDate] = useState(getKstDate());
  const [memo, setMemo] = useState('');
  const [status, setStatus] = useState({ msg: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [dashboardPin, setDashboardPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);

  // [2] 알바관리 상태
  const [albaList, setAlbaList] = useState<AlbaRecord[]>([]);
  const [albaDate, setAlbaDate] = useState(getKstDate());
  const [albaName, setAlbaName] = useState('');
  const [albaCommunityId, setAlbaCommunityId] = useState('');
  const [albaPhone, setAlbaPhone] = useState('');
  const [albaAttitude, setAlbaAttitude] = useState('주의/보통');
  const [albaIncident, setAlbaIncident] = useState('');
  const [albaSearch, setAlbaSearch] = useState('');
  const [albaLoading, setAlbaLoading] = useState(false);
  const [editingAlbaId, setEditingAlbaId] = useState<string | null>(null);

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

  useEffect(() => {
    loadAlbaRecords();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase
        .from('money_finances')
        .select('*')
        .eq('target_date', targetDate)
        .single();
        
      if (data) {
        setMemo(data.memo || '');
        const loadedAccounts = [
          { name: '법인계좌', balance: '' },
          { name: '우체국', balance: '' },
          { name: '카카오뱅크', balance: '' },
          ...Array(7).fill({ name: '', balance: '' })
        ];
        if (data.accounts) {
          data.accounts.forEach((acc: any, i: number) => {
            if (i < 10) {
              loadedAccounts[i] = { 
                name: i < 3 ? loadedAccounts[i].name : acc.name, 
                balance: acc.balance ? formatNumber(acc.balance) : '' 
              };
            } else {
              loadedAccounts.push({
                name: acc.name,
                balance: acc.balance ? formatNumber(acc.balance) : ''
              });
            }
          });
        }
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
    setAccounts([
      { name: '법인계좌', balance: '' },
      { name: '우체국', balance: '' },
      { name: '카카오뱅크', balance: '' },
      ...Array(7).fill({ name: '', balance: '' })
    ]);
    setExpenditures([{ name: '', amount: '' }]);
    setMemo('');
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
      final_balance: totals.finalBalance,
      memo: memo
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

  const addAccount = () => setAccounts([...accounts, { name: '', balance: '' }]);
  const removeAccount = (index: number) => setAccounts(accounts.filter((_, i) => i !== index));

  // --- [2] 알바관리 데이터 불러오기 및 저장 로직 ---
  const loadAlbaRecords = async () => {
    try {
      const { data } = await supabase
        .from('money_finances')
        .select('memo')
        .eq('target_date', ALBA_STORAGE_DATE)
        .single();

      if (data && data.memo) {
        const parsed = JSON.parse(data.memo);
        if (Array.isArray(parsed)) {
          setAlbaList(parsed);
          return;
        }
      }
      const local = localStorage.getItem('money_alba_records');
      if (local) setAlbaList(JSON.parse(local));
    } catch (e) {
      const local = localStorage.getItem('money_alba_records');
      if (local) setAlbaList(JSON.parse(local));
    }
  };

  const saveAlbaRecordsToDb = async (updatedList: AlbaRecord[]) => {
    setAlbaList(updatedList);
    localStorage.setItem('money_alba_records', JSON.stringify(updatedList));
    setAlbaLoading(true);
    try {
      await supabase.from('money_finances').upsert({
        target_date: ALBA_STORAGE_DATE,
        accounts: [],
        expenditures: [],
        total_account_balance: 0,
        total_expenditure: 0,
        final_balance: 0,
        memo: JSON.stringify(updatedList)
      }, { onConflict: 'target_date' });
    } catch (e) {
      console.error('Failed to sync alba records to DB:', e);
    } finally {
      setAlbaLoading(false);
    }
  };

  const formatPhone = (val: string) => {
    const nums = val.replace(/[^0-9]/g, '').slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
  };

  const handleAlbaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albaName.trim() || !albaPhone.trim()) {
      alert('이름과 연락처를 입력해주세요.');
      return;
    }

    if (editingAlbaId) {
      const updated = albaList.map(item =>
        item.id === editingAlbaId
          ? {
              ...item,
              date: albaDate,
              name: albaName.trim(),
              communityId: albaCommunityId.trim(),
              phone: albaPhone.trim(),
              attitude: albaAttitude,
              incident: albaIncident.trim()
            }
          : item
      );
      await saveAlbaRecordsToDb(updated);
      setEditingAlbaId(null);
    } else {
      const newRecord: AlbaRecord = {
        id: Date.now().toString(),
        date: albaDate,
        name: albaName.trim(),
        communityId: albaCommunityId.trim(),
        phone: albaPhone.trim(),
        attitude: albaAttitude,
        incident: albaIncident.trim(),
        createdAt: new Date().toISOString()
      };
      await saveAlbaRecordsToDb([newRecord, ...albaList]);
    }

    setAlbaName('');
    setAlbaCommunityId('');
    setAlbaPhone('');
    setAlbaAttitude('주의/보통');
    setAlbaIncident('');
  };

  const handleEditAlba = (record: AlbaRecord) => {
    setEditingAlbaId(record.id);
    setAlbaDate(record.date);
    setAlbaName(record.name);
    setAlbaCommunityId(record.communityId || '');
    setAlbaPhone(record.phone);
    setAlbaAttitude(record.attitude);
    setAlbaIncident(record.incident);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteAlba = async (id: string) => {
    if (!confirm('이 알바 기록을 삭제하시겠습니까?')) return;
    const updated = albaList.filter(item => item.id !== id);
    await saveAlbaRecordsToDb(updated);
    if (editingAlbaId === id) {
      setEditingAlbaId(null);
      setAlbaName('');
      setAlbaCommunityId('');
      setAlbaPhone('');
      setAlbaIncident('');
    }
  };

  const filteredAlbaList = albaList.filter(item => {
    if (!albaSearch.trim()) return true;
    const q = albaSearch.trim().toLowerCase();
    const cleanQ = q.replace(/-/g, '');
    const cleanPhone = item.phone.replace(/-/g, '');
    return (
      item.name.toLowerCase().includes(q) ||
      (item.communityId && item.communityId.toLowerCase().includes(q)) ||
      item.phone.includes(q) ||
      (cleanQ.length > 0 && cleanPhone.includes(cleanQ))
    );
  });

  const getAttitudeBadgeClass = (attitude: string) => {
    if (attitude.includes('우수') || attitude.includes('성실')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (attitude.includes('주의') || attitude.includes('보통')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (attitude.includes('불량') || attitude.includes('지각')) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (attitude.includes('기타')) return 'bg-gray-100 text-gray-700 border-gray-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 고정 네비게이션 바 (햄버거 메뉴 + 탭 전환) */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 -ml-1.5 rounded-xl text-gray-700 hover:bg-gray-100 focus:outline-none transition-colors shrink-0"
              aria-label="메뉴 열기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-base sm:text-xl font-extrabold text-gray-900 tracking-tight whitespace-nowrap truncate">
              {activeMenu === 'finance' ? '💸 일일 자금 현황' : '🚨 알바 근무태도 · 이력 관리'}
            </span>
          </div>

          <div className="flex items-center shrink-0">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition flex items-center shadow-sm whitespace-nowrap shrink-0"
            >
              📊 공유페이지<span className="hidden sm:inline">&nbsp;보기</span>
            </a>
          </div>
        </div>
      </header>

      {/* 햄버거 사이드 드로어 메뉴 */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 w-72 max-w-[82vw] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-yellow-50/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-400 text-gray-900 font-black flex items-center justify-center text-lg shadow-sm shrink-0">
              M
            </div>
            <div>
              <div className="font-extrabold text-gray-900 text-base leading-tight whitespace-nowrap">머니장부 Admin</div>
              <div className="text-[11px] text-gray-500 whitespace-nowrap">자금 & 알바 통합 관리</div>
            </div>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-2 flex-1">
          <button
            onClick={() => {
              setActiveMenu('finance');
              setIsDrawerOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-sm transition-colors text-left whitespace-nowrap ${
              activeMenu === 'finance'
                ? 'bg-blue-50 text-blue-600 border border-blue-100'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-lg shrink-0">💸</span>
            <span>일일 자금 현황</span>
          </button>

          <button
            onClick={() => {
              setActiveMenu('alba');
              setIsDrawerOpen(false);
            }}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-bold text-sm transition-colors text-left whitespace-nowrap ${
              activeMenu === 'alba'
                ? 'bg-red-50 text-red-600 border border-red-100'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg shrink-0">🚨</span>
              <span>알바관리</span>
            </div>
            <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-extrabold shrink-0">
              {albaList.length}
            </span>
          </button>
        </div>

        <div className="p-4 border-t border-gray-100 text-xs text-gray-400 text-center">
          © 2026 머니장부 Admin
        </div>
      </aside>

      {/* 본문 영역 */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-16">
        {activeMenu === 'finance' ? (
          /* ==================== [메뉴 1] 일일 자금 현황 ==================== */
          <div className="space-y-5 sm:space-y-6">
            <div className="flex justify-between items-center gap-2 bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-gray-200">
              <span className="font-bold text-gray-700 text-sm sm:text-base whitespace-nowrap shrink-0">📅 조회 및 입력 날짜</span>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="p-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 text-sm sm:text-base"
              />
            </div>

            {/* 전달사항 메모 (최종 현잔고 위) */}
            <div className="bg-yellow-50 rounded-2xl shadow-sm border border-yellow-200 p-4 sm:p-6">
              <h2 className="text-yellow-800 text-base sm:text-lg font-bold mb-2.5 sm:mb-3 tracking-wide flex items-center whitespace-nowrap">
                <span className="mr-2">📝</span> 전달사항
              </h2>
              <textarea 
                value={memo} 
                onChange={e => setMemo(e.target.value)} 
                placeholder="오늘의 전달사항이나 공유할 내용을 입력하세요." 
                className="w-full p-3.5 sm:p-4 border border-yellow-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 text-gray-800 min-h-[100px] resize-y bg-white text-sm"
              />
            </div>

            {/* 최종 현잔고 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
              <h2 className="text-gray-500 text-sm font-bold mb-2 tracking-wide">오늘의 최종 현잔고</h2>
              <p className="text-xs text-green-600 mb-2 font-medium opacity-80">(금액을 누르면 보입니다)</p>
              <div 
                onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                className={`text-3xl sm:text-5xl font-extrabold text-green-600 cursor-pointer transition-all duration-300 select-none whitespace-nowrap ${
                  !isBalanceVisible ? 'blur-[12px] opacity-70' : 'drop-shadow-sm'
                }`}
              >
                {formatNumber(totals.finalBalance)} <span className="text-xl sm:text-3xl text-gray-400">원</span>
              </div>
            </div>

            {/* 저장 및 초기화 버튼 (계좌잔고내역 상단 근처로 배치) */}
            <div className="flex justify-center gap-2.5 sm:gap-3 py-1">
              <button onClick={handleSave} disabled={loading} className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3.5 px-4 sm:px-12 rounded-xl shadow-md transition-all text-sm sm:text-lg whitespace-nowrap">
                {loading ? '저장 중...' : '💾 자금 현황 저장'}
              </button>
              <button onClick={() => { if(confirm('모두 비우시겠습니까?')) resetForm(); }} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3.5 px-5 sm:px-10 rounded-xl shadow-sm transition-all text-sm sm:text-lg whitespace-nowrap shrink-0">
                초기화
              </button>
            </div>

            {status.msg && (
              <div className={`text-center font-bold text-sm sm:text-base ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {status.msg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {/* Accounts */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 flex flex-col">
                <div className="flex justify-between items-center gap-2 mb-4">
                  <h2 className="text-lg sm:text-xl font-semibold text-blue-800 whitespace-nowrap">🏦 계좌잔고내역 ({accounts.length}개)</h2>
                  <button onClick={addAccount} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 text-xs sm:text-sm font-semibold transition whitespace-nowrap shrink-0">+ 항목 추가</button>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto pr-1 sm:pr-2 min-h-[300px]">
                  {accounts.map((acc, i) => (
                    <div key={i} className="flex space-x-2 items-center">
                      <input 
                        type="text" 
                        placeholder="은행명 (예: 국민)" 
                        value={acc.name} 
                        onChange={e => updateAccount(i, 'name', e.target.value)} 
                        readOnly={i < 3}
                        className={`w-1/2 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm ${i < 3 ? 'bg-gray-100 text-gray-600 font-semibold outline-none focus:ring-0 cursor-default' : ''}`} 
                      />
                      <input type="text" placeholder="잔고 입력" value={acc.balance} onChange={e => updateAccount(i, 'balance', e.target.value)} className="w-1/2 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-right text-sm" />
                      {i >= 3 ? (
                        <button onClick={() => removeAccount(i)} className="text-red-400 hover:text-red-600 font-bold px-2 shrink-0">✕</button>
                      ) : (
                        <div className="w-7 shrink-0"></div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center font-bold text-base sm:text-lg mt-auto whitespace-nowrap">
                  <span>계좌 총액:</span>
                  <span className="text-blue-600">{formatNumber(totals.totalAccounts)} 원</span>
                </div>
              </div>

              {/* Expenditures */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 flex flex-col">
                <div className="flex justify-between items-center gap-2 mb-4">
                  <h2 className="text-lg sm:text-xl font-semibold text-red-800 whitespace-nowrap">💳 당일 지출 내역</h2>
                  <button onClick={addExpenditure} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 text-xs sm:text-sm font-semibold transition whitespace-nowrap shrink-0">+ 항목 추가</button>
                </div>
                <div className="space-y-3 overflow-y-auto pr-1 sm:pr-2 flex-1 min-h-[300px]">
                  {expenditures.map((exp, i) => (
                    <div key={i} className="flex space-x-2 items-center">
                      <input type="text" placeholder="지출 내용" value={exp.name} onChange={e => updateExpenditure(i, 'name', e.target.value)} className="w-1/2 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 text-sm" />
                      <input type="text" placeholder="금액" value={exp.amount} onChange={e => updateExpenditure(i, 'amount', e.target.value)} className="w-1/2 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 text-right text-sm" />
                      <button onClick={() => removeExpenditure(i)} className="text-red-400 hover:text-red-600 font-bold px-2 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center font-bold text-base sm:text-lg mt-auto whitespace-nowrap">
                  <span>지출 합계:</span>
                  <span className="text-red-600">{formatNumber(totals.totalExpenditures)} 원</span>
                </div>
              </div>
            </div>

            {/* 비밀번호 설정 (맨 아래) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 mt-8 max-w-md mx-auto">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-2">🔒 공유 페이지 비밀번호 설정</h3>
              <p className="text-xs text-gray-500 mb-4 break-keep">공유 링크에 접속할 때 물어볼 4자리 비밀번호를 설정합니다.</p>
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
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {savingPin ? '저장 중...' : '설정'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ==================== [메뉴 2] 알바관리 (평가/이력/사건사고 기록) ==================== */
          <div className="space-y-3">
            {/* 입력 폼 카드 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="flex justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-gray-900 break-keep">
                    {editingAlbaId ? '✏️ 알바 평가 기록 수정' : '✍️ 알바 근무태도 · 사건사고 기록하기'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5 break-keep">
                    근무 태도, 무단결근, 노쇼, 사건·사고 등을 기록해 두면 언제든 이름·연락처로 조회할 수 있습니다.
                  </p>
                </div>
                {editingAlbaId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAlbaId(null);
                      setAlbaName('');
                      setAlbaCommunityId('');
                      setAlbaPhone('');
                      setAlbaAttitude('주의/보통');
                      setAlbaIncident('');
                    }}
                    className="text-xs font-bold text-gray-500 hover:text-gray-800 bg-gray-100 px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0"
                  >
                    수정 취소
                  </button>
                )}
              </div>

              <form onSubmit={handleAlbaSubmit} className="space-y-3.5 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">날짜</label>
                    <input
                      type="date"
                      value={albaDate}
                      onChange={e => setAlbaDate(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">이름 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="예: 홍길동"
                      value={albaName}
                      onChange={e => setAlbaName(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">커뮤니티 아이디/닉네임</label>
                    <input
                      type="text"
                      placeholder="예: 당근/알바몬 ID"
                      value={albaCommunityId}
                      onChange={e => setAlbaCommunityId(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">연락처 <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      required
                      placeholder="010-0000-0000"
                      value={albaPhone}
                      onChange={e => setAlbaPhone(formatPhone(e.target.value))}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">근무태도 평가</label>
                    <select
                      value={albaAttitude}
                      onChange={e => setAlbaAttitude(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="우수/성실">🟢 우수 / 성실함</option>
                      <option value="주의/보통">🟡 주의 / 보통</option>
                      <option value="불량/상습지각">🟠 불량 / 상습지각·불성실</option>
                      <option value="악성/블랙리스트">🔴 악성 / 무단결근·노쇼·사고 (채용금지)</option>
                      <option value="기타">⚪ 기타</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-700">근무태도 상세 및 기타 사건·사고 내역</label>
                  <textarea
                    rows={3}
                    placeholder="예: 첫날 지각 후 연락 두절(무단 추노), 손님과 마찰, 스마트폰만 봄, 주휴수당 악용 등 구체적인 사례를 적어주세요."
                    value={albaIncident}
                    onChange={e => setAlbaIncident(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  />
                </div>

                <button
                  type="submit"
                  disabled={albaLoading}
                  className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm transition-all text-sm sm:text-base whitespace-nowrap"
                >
                  {albaLoading ? '저장 중...' : (editingAlbaId ? '💾 수정 내용 저장하기' : '➕ 알바 평가 기록 저장하기')}
                </button>
              </form>
            </div>

            {/* 검색바 영역 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={albaSearch}
                  onChange={e => setAlbaSearch(e.target.value)}
                  placeholder="이름, 커뮤니티 아이디, 전화번호로 검색..."
                  className="w-full pl-9 pr-8 py-2 bg-gray-100 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute left-3 top-2 text-gray-400 text-sm">🔍</span>
                {albaSearch && (
                  <button
                    onClick={() => setAlbaSearch('')}
                    className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 font-bold text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="text-xs font-bold text-gray-500 px-1 shrink-0 whitespace-nowrap">
                총 <span className="text-blue-600">{filteredAlbaList.length}</span>명 기록됨
              </div>
            </div>

            {/* 하단 저장된 알바 기록 리스트 */}
            <div className="space-y-2">
              {filteredAlbaList.length > 0 ? (
                filteredAlbaList.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 px-3.5 py-2.5 flex flex-col gap-1.5 hover:border-gray-300 transition-all"
                  >
                    <div className="flex flex-wrap justify-between items-center gap-y-1.5 gap-x-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${getAttitudeBadgeClass(item.attitude)}`}>
                          {item.attitude}
                        </span>
                        <span className="text-sm sm:text-base font-extrabold text-gray-900 whitespace-nowrap">{item.name}</span>
                        {item.communityId && (
                          <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                            🆔 {item.communityId}
                          </span>
                        )}
                        <a
                          href={`tel:${item.phone}`}
                          className="text-xs sm:text-sm font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md hover:underline whitespace-nowrap shrink-0"
                        >
                          📞 {item.phone}
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5 ml-auto shrink-0">
                        <span className="text-[11px] font-semibold text-gray-400 whitespace-nowrap">{item.date}</span>
                        <button
                          onClick={() => handleEditAlba(item)}
                          className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors whitespace-nowrap"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteAlba(item.id)}
                          className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-md transition-colors whitespace-nowrap"
                        >
                          삭제
                        </button>
                      </div>
                    </div>

                    {item.incident && (
                      <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-gray-700 whitespace-pre-wrap break-words leading-snug">
                        {item.incident}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                  <div className="text-2xl mb-1">📋</div>
                  <div className="text-sm font-semibold">
                    {albaSearch ? `'${albaSearch}'에 해당하는 검색 결과가 없습니다.` : '아직 등록된 알바 평가 기록이 없습니다.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
