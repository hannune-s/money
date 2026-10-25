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

interface BookmarkItem {
  id: string;
  category?: string;
  title: string;
  url: string;
  note: string;
  createdAt: string;
}

const DEFAULT_BOOKMARK_CATEGORIES = [
  { name: '업무/사업', icon: '💼', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: '주요쇼핑몰', icon: '⭐', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { name: '금융/세무', icon: '🏦', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: '쇼핑/구매', icon: '🛒', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  { name: '아이/교육', icon: '👶', badgeClass: 'bg-pink-50 text-pink-700 border-pink-200' },
  { name: '생활/기타', icon: '🏠', badgeClass: 'bg-gray-100 text-gray-700 border-gray-200' },
];

const getBookmarkCategory = (item: BookmarkItem): string => {
  if (item.category && item.category.trim()) return item.category.trim();
  const combined = `${item.title} ${item.note || ''} ${item.url}`.toLowerCase();
  if (combined.includes('아이') || combined.includes('학부모') || combined.includes('나이스') || combined.includes('학교') || combined.includes('교육')) {
    return '아이/교육';
  }
  if (combined.includes('쇼핑') || combined.includes('쿠팡') || combined.includes('알리') || combined.includes('h&m') || combined.includes('몰')) {
    return '쇼핑/구매';
  }
  if (combined.includes('은행') || combined.includes('뱅킹') || combined.includes('홈택스') || combined.includes('세무') || combined.includes('금융') || combined.includes('카드')) {
    return '금융/세무';
  }
  if (combined.includes('식스샵') || combined.includes('업무') || combined.includes('사업') || combined.includes('배민') || combined.includes('스마트스토어') || combined.includes('포스')) {
    return '업무/사업';
  }
  return '생활/기타';
};

const getCategoryMeta = (catName: string) => {
  const found = DEFAULT_BOOKMARK_CATEGORIES.find((c) => c.name === catName);
  if (found) return found;
  return { name: catName, icon: '📌', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
};

const ALBA_STORAGE_DATE = '1970-01-01';
const TOTAL_SUMMARY_STORAGE_DATE = '1970-01-03';
const BOOKMARK_STORAGE_DATE = '1970-01-04';

const formatExternalUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '#';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const getFaviconUrl = (rawUrl: string) => {
  try {
    const formatted = formatExternalUrl(rawUrl);
    const { hostname } = new URL(formatted);
    if (!hostname) return '';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
  } catch {
    return '';
  }
};

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

  // 관리자 페이지 인증 상태
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const [loginPin, setLoginPin] = useState('');
  const [checkingLoginPin, setCheckingLoginPin] = useState(false);

  // 네비게이션 및 메뉴 상태
  const [activeMenu, setActiveMenu] = useState<'finance' | 'alba' | 'bookmark' | 'password'>('finance');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // [1] 일일 자금 현황 상태
  const [accounts, setAccounts] = useState(defaultAccounts);
  const [expenditures, setExpenditures] = useState([{ name: '', amount: '' }]);
  const [targetDate, setTargetDate] = useState(getKstDate());
  const [memo, setMemo] = useState('');
  const [status, setStatus] = useState({ msg: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);

  // [1-2] 토탈 현황 (현재까지 매출·매입·지출) 및 차입·상환 상태
  const [cumSales, setCumSales] = useState('');
  const [cumPurchases, setCumPurchases] = useState('');
  const [cumExpenses, setCumExpenses] = useState('');
  const [borrowItems, setBorrowItems] = useState([{ name: '', amount: '' }]);
  const [repayItems, setRepayItems] = useState([{ name: '', amount: '' }]);
  const [summarySaving, setSummarySaving] = useState(false);

  // [3] 비밀번호 설정 상태 (공유 페이지 & 어드민 페이지)
  const [dashboardPin, setDashboardPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [savingAdminPin, setSavingAdminPin] = useState(false);

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

  // [2-2] 북마크 상태
  const [bookmarkList, setBookmarkList] = useState<BookmarkItem[]>([]);
  const [savedCustomCategories, setSavedCustomCategories] = useState<string[]>([]);
  const [bmCategory, setBmCategory] = useState('업무/사업');
  const [bmCustomCategory, setBmCustomCategory] = useState('');
  const [bmFilterCategory, setBmFilterCategory] = useState('전체');
  const [bmTitle, setBmTitle] = useState('');
  const [bmUrl, setBmUrl] = useState('');
  const [bmNote, setBmNote] = useState('');
  const [bmSearch, setBmSearch] = useState('');
  const [bmLoading, setBmLoading] = useState(false);
  const [editingBmId, setEditingBmId] = useState<string | null>(null);

  const formatNumber = (num: number) => num.toLocaleString('ko-KR');
  const parseNumber = (str: string) => parseInt(str.toString().replace(/,/g, '') || '0', 10);
  const formatAmountInput = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    if (!clean) return '';
    return parseInt(clean, 10).toLocaleString('ko-KR');
  };

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
  const cumTotalBalance = parseNumber(cumSales) - parseNumber(cumPurchases) - parseNumber(cumExpenses);
  const totalBorrowed = borrowItems.reduce((sum, item) => sum + parseNumber(item.amount), 0);
  const totalRepaid = repayItems.reduce((sum, item) => sum + parseNumber(item.amount), 0);
  const loanRemainingBalance = totalBorrowed - totalRepaid;

  const updateBorrowItem = (index: number, field: 'name' | 'amount', value: string) => {
    const next = [...borrowItems];
    if (field === 'amount') {
      next[index] = { ...next[index], amount: formatAmountInput(value) };
    } else {
      next[index] = { ...next[index], name: value };
    }
    setBorrowItems(next);
  };
  const addBorrowItem = () => setBorrowItems([...borrowItems, { name: '', amount: '' }]);
  const removeBorrowItem = (index: number) => {
    const next = borrowItems.filter((_, i) => i !== index);
    setBorrowItems(next.length > 0 ? next : [{ name: '', amount: '' }]);
  };

  const updateRepayItem = (index: number, field: 'name' | 'amount', value: string) => {
    const next = [...repayItems];
    if (field === 'amount') {
      next[index] = { ...next[index], amount: formatAmountInput(value) };
    } else {
      next[index] = { ...next[index], name: value };
    }
    setRepayItems(next);
  };
  const addRepayItem = () => setRepayItems([...repayItems, { name: '', amount: '' }]);
  const removeRepayItem = (index: number) => {
    const next = repayItems.filter((_, i) => i !== index);
    setRepayItems(next.length > 0 ? next : [{ name: '', amount: '' }]);
  };

  useEffect(() => {
    if (sessionStorage.getItem('money_admin_authed') === 'true') {
      setIsAdminAuthed(true);
    }
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckingLoginPin(true);
    const { verifyAdminPin } = await import('./actions');
    const isValid = await verifyAdminPin(loginPin);
    if (isValid) {
      setIsAdminAuthed(true);
      sessionStorage.setItem('money_admin_authed', 'true');
    } else {
      alert('관리자 비밀번호가 일치하지 않습니다.');
      setLoginPin('');
    }
    setCheckingLoginPin(false);
  };

  useEffect(() => {
    loadData();
  }, [targetDate]);

  useEffect(() => {
    loadAlbaRecords();
    loadBookmarkRecords();
    loadTotalSummary();
  }, []);

  const applySummaryParsed = (parsed: any) => {
    if (!parsed || typeof parsed !== 'object') return;
    setCumSales(parsed.cumSales ? formatNumber(Number(parsed.cumSales)) : '');
    setCumPurchases(parsed.cumPurchases ? formatNumber(Number(parsed.cumPurchases)) : '');
    setCumExpenses(parsed.cumExpenses ? formatNumber(Number(parsed.cumExpenses)) : '');

    if (Array.isArray(parsed.borrowItems) && parsed.borrowItems.length > 0) {
      setBorrowItems(
        parsed.borrowItems.map((b: any) => ({
          name: b.name || '',
          amount: b.amount ? formatNumber(Number(b.amount)) : '',
        }))
      );
    } else if (parsed.loanBorrowed) {
      setBorrowItems([{ name: '기존 차입금', amount: formatNumber(Number(parsed.loanBorrowed)) }]);
    } else {
      setBorrowItems([{ name: '', amount: '' }]);
    }

    if (Array.isArray(parsed.repayItems) && parsed.repayItems.length > 0) {
      setRepayItems(
        parsed.repayItems.map((r: any) => ({
          name: r.name || '',
          amount: r.amount ? formatNumber(Number(r.amount)) : '',
        }))
      );
    } else if (parsed.loanRepaid) {
      setRepayItems([{ name: '기존 상환금', amount: formatNumber(Number(parsed.loanRepaid)) }]);
    } else {
      setRepayItems([{ name: '', amount: '' }]);
    }
  };

  const loadTotalSummary = async () => {
    try {
      const { data } = await supabase
        .from('money_finances')
        .select('memo')
        .eq('target_date', TOTAL_SUMMARY_STORAGE_DATE)
        .single();

      if (data && data.memo) {
        const parsed = JSON.parse(data.memo);
        applySummaryParsed(parsed);
        return;
      }
      const local = localStorage.getItem('money_total_summary');
      if (local) applySummaryParsed(JSON.parse(local));
    } catch {
      const local = localStorage.getItem('money_total_summary');
      if (local) applySummaryParsed(JSON.parse(local));
    }
  };

  const saveTotalSummary = async (silent = false) => {
    if (!silent) setSummarySaving(true);
    const validBorrows = borrowItems
      .filter(b => b.name.trim() || parseNumber(b.amount) > 0)
      .map(b => ({ name: b.name, amount: parseNumber(b.amount) }));
    const validRepays = repayItems
      .filter(r => r.name.trim() || parseNumber(r.amount) > 0)
      .map(r => ({ name: r.name, amount: parseNumber(r.amount) }));

    const summaryObj = {
      cumSales: parseNumber(cumSales),
      cumPurchases: parseNumber(cumPurchases),
      cumExpenses: parseNumber(cumExpenses),
      borrowItems: validBorrows,
      repayItems: validRepays,
    };
    localStorage.setItem('money_total_summary', JSON.stringify(summaryObj));
    try {
      const { error } = await supabase.from('money_finances').upsert(
        {
          target_date: TOTAL_SUMMARY_STORAGE_DATE,
          accounts: [],
          expenditures: [],
          total_account_balance: 0,
          total_expenditure: 0,
          final_balance: 0,
          memo: JSON.stringify(summaryObj),
        },
        { onConflict: 'target_date' }
      );
      if (error) throw error;
      if (!silent) {
        setStatus({ msg: '✅ 토탈 및 차입·상환 현황이 저장되었습니다!', type: 'success' });
        setTimeout(() => setStatus({ msg: '', type: '' }), 3000);
      }
    } catch (err: any) {
      if (!silent) {
        setStatus({ msg: `❌ 저장 실패: ${err.message}`, type: 'error' });
        setTimeout(() => setStatus({ msg: '', type: '' }), 3000);
      }
    } finally {
      if (!silent) setSummarySaving(false);
    }
  };

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
      await saveTotalSummary(true);
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

  // --- [2-2] 북마크 데이터 불러오기 및 저장 로직 ---
  const loadBookmarkRecords = async () => {
    try {
      const { data } = await supabase
        .from('money_finances')
        .select('memo, accounts')
        .eq('target_date', BOOKMARK_STORAGE_DATE)
        .single();

      if (data) {
        if (Array.isArray(data.accounts)) {
          const customCats = data.accounts.filter((c: any) => typeof c === 'string' && c.trim());
          setSavedCustomCategories(customCats);
          localStorage.setItem('money_bookmark_categories', JSON.stringify(customCats));
        }
        if (data.memo) {
          const parsed = JSON.parse(data.memo);
          if (Array.isArray(parsed)) {
            setBookmarkList(parsed);
            return;
          }
        }
      }
      const localCats = localStorage.getItem('money_bookmark_categories');
      if (localCats) setSavedCustomCategories(JSON.parse(localCats));
      const local = localStorage.getItem('money_bookmarks');
      if (local) setBookmarkList(JSON.parse(local));
    } catch {
      const localCats = localStorage.getItem('money_bookmark_categories');
      if (localCats) setSavedCustomCategories(JSON.parse(localCats));
      const local = localStorage.getItem('money_bookmarks');
      if (local) setBookmarkList(JSON.parse(local));
    }
  };

  const saveBookmarkRecordsToDb = async (
    updatedList: BookmarkItem[],
    updatedCustomCats: string[] = savedCustomCategories
  ) => {
    setBookmarkList(updatedList);
    localStorage.setItem('money_bookmarks', JSON.stringify(updatedList));
    localStorage.setItem('money_bookmark_categories', JSON.stringify(updatedCustomCats));
    setBmLoading(true);
    try {
      await supabase.from('money_finances').upsert(
        {
          target_date: BOOKMARK_STORAGE_DATE,
          accounts: updatedCustomCats,
          expenditures: [],
          total_account_balance: 0,
          total_expenditure: 0,
          final_balance: 0,
          memo: JSON.stringify(updatedList),
        },
        { onConflict: 'target_date' }
      );
    } catch (e) {
      console.error('Failed to sync bookmarks to DB:', e);
    } finally {
      setBmLoading(false);
    }
  };

  // 현재 사용중인 모든 카테고리 목록 (기본 카테고리 + 저장된 커스텀 카테고리 + 북마크에 사용된 카테고리)
  const allBookmarkCategories = [
    ...DEFAULT_BOOKMARK_CATEGORIES.map((c) => c.name),
    ...Array.from(
      new Set(
        [
          ...savedCustomCategories,
          ...bookmarkList.map((item) => getBookmarkCategory(item)),
        ].filter((cat) => cat && !DEFAULT_BOOKMARK_CATEGORIES.some((d) => d.name === cat))
      )
    ),
  ];

  const handleSaveCustomCategory = async () => {
    const trimmed = bmCustomCategory.trim();
    if (!trimmed) {
      alert('추가할 분류명을 입력해주세요.');
      return;
    }
    let nextCats = savedCustomCategories;
    if (
      !DEFAULT_BOOKMARK_CATEGORIES.some((d) => d.name === trimmed) &&
      !savedCustomCategories.includes(trimmed)
    ) {
      nextCats = [...savedCustomCategories, trimmed];
      setSavedCustomCategories(nextCats);
      await saveBookmarkRecordsToDb(bookmarkList, nextCats);
    }
    setBmCategory(trimmed);
    setBmCustomCategory('');
  };

  const handleDeleteCustomCategory = async (catName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const inUseCount = bookmarkList.filter((b) => getBookmarkCategory(b) === catName).length;
    if (inUseCount > 0) {
      alert(`'${catName}' 분류에 등록된 북마크가 ${inUseCount}개 있습니다. 북마크를 먼저 다른 분류로 옮기거나 삭제해주세요.`);
      return;
    }
    if (!confirm(`'${catName}' 분류 버튼을 삭제하시겠습니까?`)) return;
    const nextCats = savedCustomCategories.filter((c) => c !== catName);
    setSavedCustomCategories(nextCats);
    if (bmCategory === catName) setBmCategory('업무/사업');
    if (bmFilterCategory === catName) setBmFilterCategory('전체');
    await saveBookmarkRecordsToDb(bookmarkList, nextCats);
  };

  const handleBookmarkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bmTitle.trim() || !bmUrl.trim()) {
      alert('사이트명과 링크 주소를 입력해주세요.');
      return;
    }

    const finalCategory =
      bmCategory === '직접입력'
        ? bmCustomCategory.trim() || '생활/기타'
        : bmCategory;
    const normalizedUrl = formatExternalUrl(bmUrl);

    let nextCats = savedCustomCategories;
    if (
      !DEFAULT_BOOKMARK_CATEGORIES.some((d) => d.name === finalCategory) &&
      !savedCustomCategories.includes(finalCategory)
    ) {
      nextCats = [...savedCustomCategories, finalCategory];
      setSavedCustomCategories(nextCats);
    }

    if (editingBmId) {
      const updated = bookmarkList.map((item) =>
        item.id === editingBmId
          ? {
              ...item,
              category: finalCategory,
              title: bmTitle.trim(),
              url: normalizedUrl,
              note: bmNote.trim(),
            }
          : item
      );
      await saveBookmarkRecordsToDb(updated, nextCats);
      setEditingBmId(null);
    } else {
      const newItem: BookmarkItem = {
        id: Date.now().toString(),
        category: finalCategory,
        title: bmTitle.trim(),
        url: normalizedUrl,
        note: bmNote.trim(),
        createdAt: new Date().toISOString(),
      };
      await saveBookmarkRecordsToDb([newItem, ...bookmarkList], nextCats);
    }

    setBmTitle('');
    setBmUrl('');
    setBmNote('');
    if (bmCategory === '직접입력') {
      setBmCustomCategory('');
      setBmCategory(finalCategory);
    }
  };

  const handleEditBookmark = (item: BookmarkItem) => {
    setEditingBmId(item.id);
    const cat = getBookmarkCategory(item);
    setBmCategory(cat);
    setBmCustomCategory('');
    setBmTitle(item.title);
    setBmUrl(item.url);
    setBmNote(item.note || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteBookmark = async (id: string) => {
    if (!confirm('이 북마크를 삭제하시겠습니까?')) return;
    const updated = bookmarkList.filter((item) => item.id !== id);
    await saveBookmarkRecordsToDb(updated);
    if (editingBmId === id) {
      setEditingBmId(null);
      setBmTitle('');
      setBmUrl('');
      setBmNote('');
    }
  };

  const filteredBookmarkList = bookmarkList.filter((item) => {
    const itemCat = getBookmarkCategory(item);
    if (bmFilterCategory !== '전체' && itemCat !== bmFilterCategory) return false;
    if (!bmSearch.trim()) return true;
    const q = bmSearch.trim().toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q) ||
      itemCat.toLowerCase().includes(q) ||
      (item.note && item.note.toLowerCase().includes(q))
    );
  });

  if (!isAdminAuthed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans pb-24">
        <form onSubmit={handleAdminLogin} className="bg-white p-7 sm:p-8 rounded-3xl shadow-xl border border-gray-100 w-full max-w-sm flex flex-col items-center">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">🛡️</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-2 whitespace-nowrap">머니장부 관리자(Admin)</h2>
          <p className="text-xs sm:text-sm text-gray-500 mb-7 text-center break-keep">
            관리자 전용 페이지입니다.<br />어드민 비밀번호 4자리를 입력해주세요.
          </p>

          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={loginPin}
            onChange={e => setLoginPin(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-full text-center text-3xl tracking-[0.5em] p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-6 font-mono transition-shadow"
            placeholder="****"
            autoFocus
          />
          <button
            type="submit"
            disabled={checkingLoginPin || loginPin.length < 4}
            className="w-full py-4 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white font-bold rounded-2xl transition-colors shadow-sm whitespace-nowrap"
          >
            {checkingLoginPin ? '확인 중...' : '관리자 접속'}
          </button>
        </form>
      </div>
    );
  }

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
              {activeMenu === 'finance'
                ? '💸 일일 자금 현황'
                : activeMenu === 'alba'
                ? '🚨 알바 근무태도 · 이력 관리'
                : activeMenu === 'bookmark'
                ? '🔖 북마크 관리'
                : '🔒 비밀번호 설정'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <a
              href="/bookmarks"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/70 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition flex items-center shadow-xs whitespace-nowrap shrink-0"
            >
              🔖 북마크<span className="hidden sm:inline">&nbsp;공유페이지</span>
            </a>
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

          <button
            onClick={() => {
              setActiveMenu('bookmark');
              setIsDrawerOpen(false);
            }}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-bold text-sm transition-colors text-left whitespace-nowrap ${
              activeMenu === 'bookmark'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg shrink-0">🔖</span>
              <span>북마크</span>
            </div>
            <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-extrabold shrink-0">
              {bookmarkList.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveMenu('password');
              setIsDrawerOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-sm transition-colors text-left whitespace-nowrap ${
              activeMenu === 'password'
                ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-lg shrink-0">🔒</span>
            <span>비밀번호 설정</span>
          </button>
        </div>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <button
            onClick={() => {
              sessionStorage.removeItem('money_admin_authed');
              setIsAdminAuthed(false);
              setLoginPin('');
              setIsDrawerOpen(false);
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs transition-colors whitespace-nowrap"
          >
            🔐 관리자 화면 잠금 (로그아웃)
          </button>
          <div className="text-xs text-gray-400 text-center">
            © 2026 머니장부 Admin
          </div>
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

            {/* 1. 토탈 현황 (현재까지 매출 / 매입 / 지출 -> 현잔고) */}
            <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-4 sm:p-5">
              <div className="flex justify-between items-center gap-2 mb-3.5 pb-2.5 border-b border-gray-100">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-indigo-900 flex items-center gap-1.5 whitespace-nowrap">
                    <span>📊</span> 토탈 현황
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">현재까지 누적 매출 · 매입 · 지출 정산</p>
                </div>
                <button
                  type="button"
                  onClick={() => saveTotalSummary(false)}
                  disabled={summarySaving}
                  className="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {summarySaving ? '저장 중...' : '💾 저장'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex sm:flex-col items-center sm:items-stretch justify-between gap-2 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                  <label className="text-[13px] sm:text-sm font-bold text-gray-700 whitespace-nowrap shrink-0 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black">+</span>
                    현재까지 매출
                  </label>
                  <div className="relative flex-1 sm:w-full max-w-[200px] sm:max-w-none">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={cumSales}
                      onChange={e => setCumSales(formatAmountInput(e.target.value))}
                      className="w-full py-2 pl-3 pr-7 bg-white border border-gray-200 rounded-xl text-right font-bold text-[15px] text-blue-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs font-bold text-gray-400">원</span>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-stretch justify-between gap-2 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                  <label className="text-[13px] sm:text-sm font-bold text-gray-700 whitespace-nowrap shrink-0 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-orange-50 text-orange-600 flex items-center justify-center text-xs font-black">−</span>
                    매입
                  </label>
                  <div className="relative flex-1 sm:w-full max-w-[200px] sm:max-w-none">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={cumPurchases}
                      onChange={e => setCumPurchases(formatAmountInput(e.target.value))}
                      className="w-full py-2 pl-3 pr-7 bg-white border border-gray-200 rounded-xl text-right font-bold text-[15px] text-orange-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs font-bold text-gray-400">원</span>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-stretch justify-between gap-2 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                  <label className="text-[13px] sm:text-sm font-bold text-gray-700 whitespace-nowrap shrink-0 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-red-50 text-red-600 flex items-center justify-center text-xs font-black">−</span>
                    지출
                  </label>
                  <div className="relative flex-1 sm:w-full max-w-[200px] sm:max-w-none">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={cumExpenses}
                      onChange={e => setCumExpenses(formatAmountInput(e.target.value))}
                      className="w-full py-2 pl-3 pr-7 bg-white border border-gray-200 rounded-xl text-right font-bold text-[15px] text-red-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs font-bold text-gray-400">원</span>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 pt-3 border-t border-indigo-100 bg-indigo-50/70 px-3.5 py-3 rounded-xl flex justify-between items-center gap-2">
                <div>
                  <span className="text-[13px] sm:text-sm font-extrabold text-indigo-900 whitespace-nowrap block">토탈 현잔고</span>
                  <span className="text-[11px] text-indigo-500 font-semibold whitespace-nowrap">현재까지 매출 − 매입 − 지출</span>
                </div>
                <span className={`text-[17px] sm:text-xl font-black whitespace-nowrap ${cumTotalBalance >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
                  {formatNumber(cumTotalBalance)} <span className="text-xs sm:text-sm font-bold">원</span>
                </span>
              </div>
            </div>

            {/* 2. 차입 · 상환 현황 (당일 지출 내역처럼 항목 직접 추가/삭제 방식) */}
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-4 sm:p-5">
              <div className="flex justify-between items-center gap-2 mb-4 pb-2.5 border-b border-gray-100">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-amber-900 flex items-center gap-1.5 whitespace-nowrap">
                    <span>💳</span> 차입 · 상환 현황
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">차입 항목과 상환 항목을 직접 추가하여 남은 잔금을 관리합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => saveTotalSummary(false)}
                  disabled={summarySaving}
                  className="text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {summarySaving ? '저장 중...' : '💾 저장'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {/* 좌측: 차입 내역 */}
                <div className="bg-amber-50/40 rounded-xl border border-amber-100 p-3.5 flex flex-col">
                  <div className="flex justify-between items-center gap-2 mb-3">
                    <h3 className="text-[15px] sm:text-base font-extrabold text-amber-900 flex items-center gap-1.5 whitespace-nowrap">
                      <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-black">借</span>
                      차입 내역 ({borrowItems.length}건)
                    </h3>
                    <button
                      type="button"
                      onClick={addBorrowItem}
                      className="bg-amber-100/80 text-amber-800 px-2.5 py-1 rounded-lg hover:bg-amber-200 text-xs font-bold transition whitespace-nowrap shrink-0"
                    >
                      + 항목 추가
                    </button>
                  </div>

                  <div className="space-y-2 flex-1 max-h-[220px] overflow-y-auto pr-1">
                    {borrowItems.map((item, i) => (
                      <div key={i} className="flex space-x-2 items-center">
                        <input
                          type="text"
                          placeholder="차입처/내용"
                          value={item.name}
                          onChange={e => updateBorrowItem(i, 'name', e.target.value)}
                          className="w-1/2 p-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-[15px]"
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="차입 금액"
                          value={item.amount}
                          onChange={e => updateBorrowItem(i, 'amount', e.target.value)}
                          className="w-1/2 p-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-right text-[15px] font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() => removeBorrowItem(i)}
                          className="text-red-400 hover:text-red-600 font-bold px-1.5 shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-amber-200/70 flex justify-between items-center font-bold text-[15px] sm:text-base whitespace-nowrap">
                    <span className="text-gray-700">차입 합계:</span>
                    <span className="text-amber-800">{formatNumber(totalBorrowed)} 원</span>
                  </div>
                </div>

                {/* 우측: 상환 내역 */}
                <div className="bg-emerald-50/40 rounded-xl border border-emerald-100 p-3.5 flex flex-col">
                  <div className="flex justify-between items-center gap-2 mb-3">
                    <h3 className="text-[15px] sm:text-base font-extrabold text-emerald-900 flex items-center gap-1.5 whitespace-nowrap">
                      <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black">還</span>
                      상환 내역 ({repayItems.length}건)
                    </h3>
                    <button
                      type="button"
                      onClick={addRepayItem}
                      className="bg-emerald-100/80 text-emerald-800 px-2.5 py-1 rounded-lg hover:bg-emerald-200 text-xs font-bold transition whitespace-nowrap shrink-0"
                    >
                      + 항목 추가
                    </button>
                  </div>

                  <div className="space-y-2 flex-1 max-h-[220px] overflow-y-auto pr-1">
                    {repayItems.map((item, i) => (
                      <div key={i} className="flex space-x-2 items-center">
                        <input
                          type="text"
                          placeholder="상환처/내용"
                          value={item.name}
                          onChange={e => updateRepayItem(i, 'name', e.target.value)}
                          className="w-1/2 p-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 text-[15px]"
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="상환 금액"
                          value={item.amount}
                          onChange={e => updateRepayItem(i, 'amount', e.target.value)}
                          className="w-1/2 p-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 text-right text-[15px] font-semibold text-emerald-700"
                        />
                        <button
                          type="button"
                          onClick={() => removeRepayItem(i)}
                          className="text-red-400 hover:text-red-600 font-bold px-1.5 shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-emerald-200/70 flex justify-between items-center font-bold text-[15px] sm:text-base whitespace-nowrap">
                    <span className="text-gray-700">상환 합계:</span>
                    <span className="text-emerald-700">{formatNumber(totalRepaid)} 원</span>
                  </div>
                </div>
              </div>

              {totalBorrowed > 0 && (
                <div className="mt-3.5 px-1">
                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                    <span>상환 진행률</span>
                    <span className="text-emerald-600">
                      {Math.min(100, Math.round((totalRepaid / totalBorrowed) * 100))}% 완료
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round((totalRepaid / totalBorrowed) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-3.5 pt-3 border-t border-amber-200 bg-amber-50/70 px-3.5 py-3 rounded-xl flex justify-between items-center gap-2">
                <div>
                  <span className="text-[13px] sm:text-sm font-extrabold text-amber-900 whitespace-nowrap block">남은 잔금 (미상환 잔액)</span>
                  <span className="text-[11px] text-amber-600 font-semibold whitespace-nowrap">차입 합계 − 상환 합계</span>
                </div>
                <span className={`text-[17px] sm:text-xl font-black whitespace-nowrap ${loanRemainingBalance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {formatNumber(loanRemainingBalance)} <span className="text-xs sm:text-sm font-bold">원</span>
                </span>
              </div>
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
          </div>
        ) : activeMenu === 'alba' ? (
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
        ) : activeMenu === 'bookmark' ? (
          /* ==================== [메뉴 2-2] 북마크 관리 ==================== */
          <div className="space-y-4">
            {/* 북마크 전용 공유화면 바로가기 & 주소 복사 배너 */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-amber-900 flex items-center gap-1.5">
                  <span>🔖</span> 북마크 전용 공유 페이지
                </h2>
                <p className="text-xs text-amber-700 mt-0.5 break-keep">
                  장부 내용 없이 등록된 북마크 목록만 깔끔하게 보이고 클릭 시 바로 사이트로 이동하는 전용 공유 화면입니다.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/bookmarks`;
                    navigator.clipboard.writeText(shareUrl);
                    alert(`북마크 공유 주소가 복사되었습니다!\n${shareUrl}`);
                  }}
                  className="px-3 py-2 bg-white hover:bg-amber-100/60 text-amber-800 border border-amber-300 rounded-xl text-xs font-extrabold transition-colors whitespace-nowrap shadow-xs"
                >
                  📋 공유주소 복사
                </button>
                <a
                  href="/bookmarks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold transition-colors whitespace-nowrap shadow-xs"
                >
                  🔗 북마크 공유화면 열기 ↗
                </a>
              </div>
            </div>

            {/* 북마크 등록 / 수정 폼 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-gray-100">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-gray-900 break-keep">
                    {editingBmId ? '✏️ 북마크 수정하기' : '➕ 새 북마크 등록하기'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5 break-keep">
                    분류(업무/금융/쇼핑/아이 등)를 선택하고 사이트명·링크를 입력하면 항목별로 깔끔하게 정리됩니다.
                  </p>
                </div>
                {editingBmId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBmId(null);
                      setBmCategory('업무/사업');
                      setBmCustomCategory('');
                      setBmTitle('');
                      setBmUrl('');
                      setBmNote('');
                    }}
                    className="text-xs font-bold text-gray-500 hover:text-gray-800 bg-gray-100 px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0"
                  >
                    수정 취소
                  </button>
                )}
              </div>

              <form onSubmit={handleBookmarkSubmit} className="space-y-3.5">
                {/* 분류(카테고리) 선택 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-700">
                    분류 선택 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {allBookmarkCategories.map((catName) => {
                      const meta = getCategoryMeta(catName);
                      const isSelected = bmCategory === catName;
                      const isPreset = DEFAULT_BOOKMARK_CATEGORIES.some((d) => d.name === catName);
                      return (
                        <button
                          key={catName}
                          type="button"
                          onClick={() => setBmCategory(catName)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <span>{meta.icon}</span>
                          <span>{catName}</span>
                          {!isPreset && (
                            <span
                              onClick={(e) => handleDeleteCustomCategory(catName, e)}
                              title="이 분류 삭제"
                              className={`ml-1 px-1 rounded hover:bg-black/10 text-[10px] ${
                                isSelected ? 'text-amber-100 hover:text-white' : 'text-gray-400 hover:text-red-500'
                              }`}
                            >
                              ✕
                            </span>
                          )}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setBmCategory('직접입력')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 ${
                        bmCategory === '직접입력'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span>➕</span>
                      <span>직접입력</span>
                    </button>
                  </div>

                  {bmCategory === '직접입력' && (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="새 분류명 입력 (예: 주요쇼핑몰, 거래처, 부동산 등)"
                        value={bmCustomCategory}
                        onChange={(e) => setBmCustomCategory(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveCustomCategory();
                          }
                        }}
                        className="w-full sm:w-72 p-2 bg-amber-50/40 border border-amber-300 rounded-xl text-xs sm:text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCustomCategory}
                        disabled={bmLoading}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs sm:text-sm whitespace-nowrap shadow-xs transition-colors shrink-0"
                      >
                        💾 분류 저장
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">
                      사이트명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="예: 국세청 홈택스, 나이스학부모, 식스샵 등"
                      value={bmTitle}
                      onChange={(e) => setBmTitle(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-700">
                      링크 주소 (URL) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="예: https://www.hometax.go.kr"
                      value={bmUrl}
                      onChange={(e) => setBmUrl(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-700">기타 비고 (선택)</label>
                  <input
                    type="text"
                    placeholder="예: 아이 학교사이트 / 매월 10일 세금계산서 발행용 등"
                    value={bmNote}
                    onChange={(e) => setBmNote(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={bmLoading}
                  className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm transition-all text-sm sm:text-base whitespace-nowrap"
                >
                  {bmLoading ? '저장 중...' : editingBmId ? '💾 북마크 수정 내용 저장하기' : '➕ 북마크 추가하기'}
                </button>
              </form>
            </div>

            {/* 북마크 검색바 + 카테고리 필터 탭 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={bmSearch}
                    onChange={(e) => setBmSearch(e.target.value)}
                    placeholder="사이트명, 분류, 링크 주소, 비고 내용으로 검색..."
                    className="w-full pl-9 pr-8 py-2 bg-gray-100 rounded-lg text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute left-3 top-2 text-gray-400 text-sm">🔍</span>
                  {bmSearch && (
                    <button
                      onClick={() => setBmSearch('')}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 font-bold text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="text-xs font-bold text-gray-500 px-1 shrink-0 whitespace-nowrap">
                  표시 <span className="text-amber-600">{filteredBookmarkList.length}</span>개 / 전체 {bookmarkList.length}개
                </div>
              </div>

              {/* 카테고리 필터 버튼 */}
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setBmFilterCategory('전체')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    bmFilterCategory === '전체'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  전체 ({bookmarkList.length})
                </button>
                {allBookmarkCategories.map((catName) => {
                  const count = bookmarkList.filter((b) => getBookmarkCategory(b) === catName).length;
                  if (count === 0 && !DEFAULT_BOOKMARK_CATEGORIES.some((d) => d.name === catName)) return null;
                  const meta = getCategoryMeta(catName);
                  const isActive = bmFilterCategory === catName;
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => setBmFilterCategory(catName)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <span>{meta.icon}</span>
                      <span>{catName}</span>
                      <span className={isActive ? 'text-amber-100' : 'text-gray-400'}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 분류별 그룹화된 북마크 리스트 (1줄에 2~3개 컴팩트 그리드) */}
            {filteredBookmarkList.length > 0 ? (
              <div className="space-y-4">
                {allBookmarkCategories.map((catName) => {
                  const itemsInCat = filteredBookmarkList.filter(
                    (item) => getBookmarkCategory(item) === catName
                  );
                  if (itemsInCat.length === 0) return null;
                  const meta = getCategoryMeta(catName);

                  return (
                    <div key={catName} className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${meta.badgeClass}`}>
                          <span>{meta.icon}</span>
                          <span>{catName}</span>
                        </span>
                        <span className="text-xs font-bold text-gray-400">{itemsInCat.length}</span>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
                        {itemsInCat.map((item) => {
                          const targetUrl = formatExternalUrl(item.url);
                          const faviconUrl = getFaviconUrl(item.url);
                          const firstLetter = (item.title || '?').trim().charAt(0).toUpperCase();

                          return (
                            <div
                              key={item.id}
                              className="flex flex-col items-center justify-between p-2.5 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group text-center min-w-0"
                            >
                              <a
                                href={targetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={item.note ? `${item.title} - ${item.note}` : item.title}
                                className="flex flex-col items-center w-full min-w-0"
                              >
                                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gray-100 group-hover:bg-white group-hover:shadow-sm border border-gray-200/60 flex items-center justify-center mb-1.5 transition-all overflow-hidden shrink-0">
                                  {faviconUrl ? (
                                    <img
                                      src={faviconUrl}
                                      alt={item.title}
                                      className="w-6 h-6 object-contain rounded-xs"
                                      onError={(e) => {
                                        const target = e.currentTarget;
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent && !parent.querySelector('.fallback-initial')) {
                                          const span = document.createElement('span');
                                          span.className = 'fallback-initial text-sm font-extrabold text-gray-600';
                                          span.textContent = firstLetter;
                                          parent.appendChild(span);
                                        }
                                      }}
                                    />
                                  ) : (
                                    <span className="text-sm font-extrabold text-gray-600">
                                      {firstLetter}
                                    </span>
                                  )}
                                </div>

                                <span className="text-xs font-semibold text-gray-800 group-hover:text-black truncate w-full px-0.5">
                                  {item.title}
                                </span>

                                {item.note && (
                                  <span className="text-[10px] text-gray-400 truncate w-full mt-0.5 px-0.5">
                                    {item.note}
                                  </span>
                                )}
                              </a>

                              <div className="flex items-center justify-center gap-1 mt-1.5">
                                <button
                                  onClick={() => handleEditBookmark(item)}
                                  className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors whitespace-nowrap"
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => handleDeleteBookmark(item.id)}
                                  className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-1.5 py-0.5 rounded transition-colors whitespace-nowrap"
                                >
                                  삭제
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                <div className="text-2xl mb-1">🔖</div>
                <div className="text-sm font-semibold">
                  {bmSearch ? `'${bmSearch}'에 해당하는 북마크가 없습니다.` : '아직 등록된 북마크가 없습니다.'}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ==================== [메뉴 3] 비밀번호 설정 (공유페이지 & 어드민페이지) ==================== */
          <div className="max-w-xl mx-auto space-y-5">
            {/* 1. 공유 페이지 비밀번호 설정 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shrink-0">
                  📊
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900">공유 페이지 비밀번호 설정</h3>
                  <p className="text-xs text-gray-500 break-keep">
                    일일잔고현황 공유 페이지(메인 화면) 접속 시 물어볼 숫자 4자리 비밀번호를 변경합니다.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={dashboardPin}
                  onChange={e => setDashboardPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="새 4자리 숫자 (예: 1234)"
                  className="flex-1 p-3 bg-gray-50 border border-gray-300 rounded-xl text-center tracking-[0.3em] font-mono text-base focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  onClick={async () => {
                    if (dashboardPin.length !== 4) return alert('숫자 4자리를 입력해주세요.');
                    setSavingPin(true);
                    const { setDashboardPin: savePinAction } = await import('./actions');
                    const res = await savePinAction(dashboardPin);
                    setSavingPin(false);
                    if (res.success) {
                      alert('공유 페이지 비밀번호가 변경되었습니다.');
                      setDashboardPin('');
                    } else {
                      alert(res.error);
                    }
                  }}
                  disabled={savingPin}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold px-5 rounded-xl transition-colors whitespace-nowrap shrink-0 text-sm sm:text-base"
                >
                  {savingPin ? '저장 중...' : '변경 저장'}
                </button>
              </div>
            </div>

            {/* 2. 어드민(관리자) 페이지 비밀번호 설정 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-9 h-9 rounded-xl bg-yellow-100 text-yellow-800 flex items-center justify-center text-lg shrink-0">
                  🛡️
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-gray-900">어드민 페이지 비밀번호 설정</h3>
                  <p className="text-xs text-gray-500 break-keep">
                    관리자 페이지(/admin) 접속 시 물어볼 숫자 4자리 비밀번호를 변경합니다.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={adminPin}
                  onChange={e => setAdminPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="새 4자리 숫자 (예: 1234)"
                  className="flex-1 p-3 bg-gray-50 border border-gray-300 rounded-xl text-center tracking-[0.3em] font-mono text-base focus:ring-2 focus:ring-yellow-500 outline-none"
                />
                <button
                  onClick={async () => {
                    if (adminPin.length !== 4) return alert('숫자 4자리를 입력해주세요.');
                    setSavingAdminPin(true);
                    const { setAdminPin: saveAdminPinAction } = await import('./actions');
                    const res = await saveAdminPinAction(adminPin);
                    setSavingAdminPin(false);
                    if (res.success) {
                      alert('어드민 페이지 비밀번호가 변경되었습니다.');
                      setAdminPin('');
                    } else {
                      alert(res.error);
                    }
                  }}
                  disabled={savingAdminPin}
                  className="bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white font-bold px-5 rounded-xl transition-colors whitespace-nowrap shrink-0 text-sm sm:text-base"
                >
                  {savingAdminPin ? '저장 중...' : '변경 저장'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
