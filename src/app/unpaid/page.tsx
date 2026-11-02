"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  UNPAID_STORAGE_DATE,
  UnpaidVendor,
  UnpaidCategory,
  UNPAID_CATEGORIES,
  getUnpaidCategoryMeta,
  calculateVendorStats,
} from '@/lib/unpaid';

export default function UnpaidManagementPage() {
  const getKstDate = () => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split('T')[0];
  };

  const [vendors, setVendors] = useState<UnpaidVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 필터 및 검색 상태
  const [categoryFilter, setCategoryFilter] = useState<'all' | UnpaidCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'unpaid' | 'all' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVendors, setExpandedVendors] = useState<Record<string, boolean>>({});

  // 상단 빠른 등록 / 납부 폼 상태
  const [formMode, setFormMode] = useState<'payment' | 'new_vendor' | 'add_charge'>('new_vendor');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCategory, setNewVendorCategory] = useState<UnpaidCategory>('세금·4대보험');
  const [txDate, setTxDate] = useState(getKstDate());
  const [txAmount, setTxAmount] = useState('');
  const [txMemo, setTxMemo] = useState('');

  // 업체명/카테고리 수정 모달 상태
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [editVendorName, setEditVendorName] = useState('');
  const [editVendorCategory, setEditVendorCategory] = useState<UnpaidCategory>('세금·4대보험');

  // 개별 내역(날짜·구분·금액·내용) 수정 상태
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editTxDate, setEditTxDate] = useState('');
  const [editTxType, setEditTxType] = useState<'charge' | 'payment'>('charge');
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxMemo, setEditTxMemo] = useState('');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const formatNumber = (num: number) => num.toLocaleString('ko-KR');
  const parseNumber = (str: string) => parseInt(str.toString().replace(/,/g, '') || '0', 10);
  const formatAmountInput = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    if (!clean) return '';
    return parseInt(clean, 10).toLocaleString('ko-KR');
  };

  const saveToDb = async (updated: UnpaidVendor[]) => {
    setVendors(updated);
    localStorage.setItem('money_unpaid_vendors', JSON.stringify(updated));
    setSaving(true);
    try {
      await supabase.from('money_finances').upsert(
        {
          target_date: UNPAID_STORAGE_DATE,
          accounts: [],
          expenditures: [],
          total_account_balance: 0,
          total_expenditure: 0,
          final_balance: 0,
          memo: JSON.stringify(updated),
        },
        { onConflict: 'target_date' }
      );
    } catch (e) {
      console.error('Failed to sync unpaid vendors:', e);
    } finally {
      setSaving(false);
    }
  };

  const loadData = async () => {
    let localData: UnpaidVendor[] = [];
    try {
      const raw = localStorage.getItem('money_unpaid_vendors');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localData = parsed;
          setVendors(parsed);
          if (parsed.length > 0) {
            setFormMode('payment');
            setSelectedVendorId(parsed[0].id);
          }
          setLoading(false);
        }
      }
    } catch {}

    try {
      const { data } = await supabase
        .from('money_finances')
        .select('memo')
        .eq('target_date', UNPAID_STORAGE_DATE)
        .maybeSingle();

      if (data && data.memo) {
        const parsed = JSON.parse(data.memo);
        if (Array.isArray(parsed)) {
          setVendors(parsed);
          localStorage.setItem('money_unpaid_vendors', JSON.stringify(parsed));
          if (parsed.length > 0 && !selectedVendorId) {
            setFormMode('payment');
            setSelectedVendorId(parsed[0].id);
          }
        }
      } else if (localData.length > 0) {
        await saveToDb(localData);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 전체 요약 통계 계산
  const summary = useMemo(() => {
    let totalCharged = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let taxRemaining = 0;
    let purchaseRemaining = 0;
    let otherRemaining = 0;
    let activeVendorCount = 0;

    vendors.forEach((v) => {
      const st = calculateVendorStats(v);
      totalCharged += st.totalCharged;
      totalPaid += st.totalPaid;
      totalRemaining += st.remaining;
      if (st.remaining > 0) activeVendorCount += 1;

      if (v.category === '세금·4대보험') taxRemaining += st.remaining;
      else if (v.category === '매입·거래처') purchaseRemaining += st.remaining;
      else otherRemaining += st.remaining;
    });

    const overallPaidRate =
      totalCharged > 0 ? Math.min(100, Math.round((totalPaid / totalCharged) * 100)) : 0;

    return {
      totalCharged,
      totalPaid,
      totalRemaining,
      taxRemaining,
      purchaseRemaining,
      otherRemaining,
      activeVendorCount,
      overallPaidRate,
    };
  }, [vendors]);

  // 필터링 및 잔금 큰 순서 정렬
  const filteredVendors = useMemo(() => {
    return vendors
      .map((v) => ({ vendor: v, stats: calculateVendorStats(v) }))
      .filter(({ vendor, stats }) => {
        if (categoryFilter !== 'all' && vendor.category !== categoryFilter) return false;
        if (statusFilter === 'unpaid' && stats.remaining <= 0) return false;
        if (statusFilter === 'completed' && stats.remaining > 0) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchName = vendor.name.toLowerCase().includes(q);
          const matchCat = vendor.category.toLowerCase().includes(q);
          const matchTx = (vendor.transactions || []).some(
            (t) => t.memo.toLowerCase().includes(q) || t.date.includes(q)
          );
          return matchName || matchCat || matchTx;
        }
        return true;
      })
      .sort((a, b) => b.stats.remaining - a.stats.remaining);
  }, [vendors, categoryFilter, statusFilter, searchQuery]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseNumber(txAmount);
    if (amountNum <= 0) {
      alert('금액을 올바르게 입력해주세요.');
      return;
    }

    if (formMode === 'new_vendor') {
      if (!newVendorName.trim()) {
        alert('상호명 또는 세금명을 입력해주세요. (예: 부가세 미납, 두올, 건강보험)');
        return;
      }
      const newVendor: UnpaidVendor = {
        id: Date.now().toString(),
        name: newVendorName.trim(),
        category: newVendorCategory,
        createdAt: new Date().toISOString(),
        transactions: [
          {
            id: `${Date.now()}-tx`,
            date: txDate,
            type: 'charge',
            amount: amountNum,
            memo: txMemo.trim() || '최초 미납금 등록',
            createdAt: new Date().toISOString(),
          },
        ],
      };
      const updated = [newVendor, ...vendors];
      await saveToDb(updated);
      setNewVendorName('');
      setTxAmount('');
      setTxMemo('');
      setSelectedVendorId(newVendor.id);
      setExpandedVendors((prev) => ({ ...prev, [newVendor.id]: true }));
    } else {
      const targetId = selectedVendorId || (vendors[0] && vendors[0].id);
      if (!targetId) {
        alert('먼저 미납 업체나 세금 항목을 선택해주세요.');
        return;
      }
      const txType = formMode === 'payment' ? 'payment' : 'charge';
      const defaultMemo = formMode === 'payment' ? '일부 납부' : '미납금 추가 발생';

      const updated = vendors.map((v) => {
        if (v.id !== targetId) return v;
        const nextTx = [
          {
            id: `${Date.now()}-tx`,
            date: txDate,
            type: txType as 'charge' | 'payment',
            amount: amountNum,
            memo: txMemo.trim() || defaultMemo,
            createdAt: new Date().toISOString(),
          },
          ...(v.transactions || []),
        ].sort((a, b) => b.date.localeCompare(a.date));
        return { ...v, transactions: nextTx };
      });

      await saveToDb(updated);
      setTxAmount('');
      setTxMemo('');
      setExpandedVendors((prev) => ({ ...prev, [targetId]: true }));
    }
  };

  const handleDeleteTransaction = async (vendorId: string, txId: string) => {
    if (!confirm('이 내역을 삭제하시겠습니까? 삭제하면 잔금이 다시 계산됩니다.')) return;
    const updated = vendors.map((v) => {
      if (v.id !== vendorId) return v;
      return {
        ...v,
        transactions: (v.transactions || []).filter((t) => t.id !== txId),
      };
    });
    await saveToDb(updated);
  };

  const handleDeleteVendor = async (vendorId: string, name: string) => {
    if (!confirm(`[${name}] 항목과 모든 납부 내역을 삭제하시겠습니까?`)) return;
    const updated = vendors.filter((v) => v.id !== vendorId);
    await saveToDb(updated);
    if (selectedVendorId === vendorId) {
      setSelectedVendorId(updated[0]?.id || '');
    }
  };

  const handleStartEditVendor = (v: UnpaidVendor) => {
    setEditingVendorId(v.id);
    setEditVendorName(v.name);
    setEditVendorCategory(v.category);
    setExpandedVendors((prev) => ({ ...prev, [v.id]: true }));
    if (v.transactions && v.transactions.length === 1) {
      const firstTx = v.transactions[0];
      setEditingTxId(firstTx.id);
      setEditTxDate(firstTx.date);
      setEditTxType(firstTx.type);
      setEditTxAmount(formatNumber(firstTx.amount));
      setEditTxMemo(firstTx.memo);
    }
  };

  const handleSaveEditVendor = async (vendorId: string) => {
    if (!editVendorName.trim()) return alert('상호명을 입력해주세요.');
    const updated = vendors.map((v) => {
      if (v.id !== vendorId) return v;
      let nextTransactions = v.transactions || [];
      if (editingTxId) {
        const amt = parseNumber(editTxAmount);
        if (amt > 0) {
          nextTransactions = nextTransactions
            .map((t) =>
              t.id === editingTxId
                ? {
                    ...t,
                    date: editTxDate,
                    type: editTxType,
                    amount: amt,
                    memo: editTxMemo.trim() || (editTxType === 'payment' ? '일부 납부' : '미납금 등록'),
                  }
                : t
            )
            .sort((a, b) => b.date.localeCompare(a.date));
        }
      }
      return {
        ...v,
        name: editVendorName.trim(),
        category: editVendorCategory,
        transactions: nextTransactions,
      };
    });
    await saveToDb(updated);
    setEditingVendorId(null);
    setEditingTxId(null);
  };

  const handleStartEditTx = (tx: {
    id: string;
    date: string;
    type: 'charge' | 'payment';
    amount: number;
    memo: string;
  }) => {
    setEditingTxId(tx.id);
    setEditTxDate(tx.date);
    setEditTxType(tx.type);
    setEditTxAmount(formatNumber(tx.amount));
    setEditTxMemo(tx.memo);
  };

  const handleSaveEditTx = async (vendorId: string, txId: string) => {
    const amt = parseNumber(editTxAmount);
    if (amt <= 0) return alert('금액을 올바르게 입력해주세요.');
    const updated = vendors.map((v) => {
      if (v.id !== vendorId) return v;
      const nextTransactions = (v.transactions || [])
        .map((t) =>
          t.id === txId
            ? {
                ...t,
                date: editTxDate,
                type: editTxType,
                amount: amt,
                memo: editTxMemo.trim() || (editTxType === 'payment' ? '일부 납부' : '미납금 등록'),
              }
            : t
        )
        .sort((a, b) => b.date.localeCompare(a.date));
      return { ...v, transactions: nextTransactions };
    });
    await saveToDb(updated);
    setEditingTxId(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedVendors((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 업체 카드에서 '납부 기록' 버튼 클릭 시 상단 폼에 해당 업체 자동 세팅
  const quickSelectForPayment = (vendorId: string) => {
    setFormMode('payment');
    setSelectedVendorId(vendorId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-xs">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-800 transition-colors focus:outline-none shrink-0"
              aria-label="메뉴 열기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-sm sm:text-xl font-bold text-gray-900 whitespace-nowrap truncate tracking-tight">
              미납금 · 외상 잔금 관리
            </h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <a
              href="/unpaid"
              className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-sm font-bold transition flex items-center shadow-xs whitespace-nowrap shrink-0"
            >
              미납금<span className="hidden sm:inline">&nbsp;관리</span>
            </a>
            <a
              href="/ledger"
              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-sm font-bold transition flex items-center shadow-xs whitespace-nowrap shrink-0"
            >
              장부<span className="hidden sm:inline">&nbsp;보기</span>
            </a>
            <a
              href="/bookmarks"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/70 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-sm font-bold transition flex items-center shadow-xs whitespace-nowrap shrink-0"
            >
              북마크<span className="hidden sm:inline">&nbsp;공유페이지</span>
            </a>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-sm font-bold transition flex items-center shadow-sm whitespace-nowrap shrink-0"
            >
              공유<span className="hidden sm:inline">페이지 보기</span>
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
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-1.5 flex-1 overflow-y-auto">
          <a
            href="/admin?menu=finance"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            <span>일일 자금 현황</span>
          </a>

          <a
            href="/admin?menu=ledger"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            <span>지출장부 입력 (매장·집)</span>
          </a>

          <a
            href="/ledger"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            <span>통합 지출장부 보기</span>
          </a>

          <a
            href="/unpaid"
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm bg-rose-50 text-rose-700 border border-rose-200 transition-colors whitespace-nowrap"
          >
            <span>미납금 · 외상 잔금 관리</span>
            <span className="text-xs font-extrabold">{vendors.length}</span>
          </a>

          <a
            href="/admin?menu=alba"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            <span>알바관리</span>
          </a>

          <a
            href="/admin?menu=bookmark"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            <span>북마크</span>
          </a>

          <a
            href="/admin?menu=event"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            <span>경조사 관리</span>
          </a>

          <a
            href="/admin?menu=password"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            <span>비밀번호 설정</span>
          </a>
        </div>
      </aside>

      <main className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 space-y-5">
        {/* 1. 상단 전체 미납 총액 · 납부된 금액 · 남은 총 잔금 대시보드 */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-3">
            <div>
              <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200/70 px-2.5 py-1 rounded-full whitespace-nowrap">
                미납 잔금 남음 {summary.activeVendorCount}곳
              </span>
              <h2 className="text-base sm:text-xl font-bold text-gray-900 mt-1.5 break-keep tracking-tight">
                업체 · 세금별 미납 및 납부 현황
              </h2>
            </div>

            <div className="text-right ml-auto">
              <div className="text-xs font-medium text-gray-400">현재 남은 총 미납 잔금</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 tabular-nums tracking-tight">
                {formatNumber(summary.totalRemaining)}
                <span className="text-sm font-semibold text-rose-500 ml-1">원</span>
              </div>
            </div>
          </div>

          {/* 총 발생 미납금 − 누적 납부액 = 남은 잔금 배너 */}
          <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-zinc-50 border border-gray-200 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-700 flex-wrap">
                <span className="whitespace-nowrap">
                  총 미납 발생액{' '}
                  <strong className="font-bold text-gray-900 tabular-nums">
                    {formatNumber(summary.totalCharged)}원
                  </strong>
                </span>
                <span className="text-gray-400">−</span>
                <span className="whitespace-nowrap">
                  누적 납부 완료{' '}
                  <strong className="font-bold text-emerald-600 tabular-nums">
                    {formatNumber(summary.totalPaid)}원
                  </strong>
                </span>
                <span className="text-gray-400">=</span>
                <span className="whitespace-nowrap">
                  남은 잔금{' '}
                  <strong className="font-extrabold text-rose-600 tabular-nums">
                    {formatNumber(summary.totalRemaining)}원
                  </strong>
                </span>
              </div>

              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full tabular-nums self-start sm:self-auto whitespace-nowrap">
                전체 상환율 {summary.overallPaidRate}%
              </span>
            </div>

            {/* 전체 상환 프로그레스 바 */}
            <div className="w-full h-2 bg-gray-200/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${summary.overallPaidRate}%` }}
              />
            </div>
          </div>

          {/* 분야별 남은 미납 잔금 요약 3단 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() =>
                setCategoryFilter(categoryFilter === '세금·4대보험' ? 'all' : '세금·4대보험')
              }
              className={`text-left p-3.5 rounded-2xl border transition-all ${
                categoryFilter === '세금·4대보험'
                  ? 'bg-rose-50 border-rose-400 shadow-2xs'
                  : 'bg-white border-gray-200 hover:border-rose-300'
              }`}
            >
              <div className="text-xs font-bold text-rose-700">세금 · 4대보험 미납</div>
              <div className="mt-1 text-lg sm:text-xl font-bold text-gray-900 tabular-nums">
                {formatNumber(summary.taxRemaining)}
                <span className="text-xs font-normal text-gray-500 ml-0.5">원</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setCategoryFilter(categoryFilter === '매입·거래처' ? 'all' : '매입·거래처')
              }
              className={`text-left p-3.5 rounded-2xl border transition-all ${
                categoryFilter === '매입·거래처'
                  ? 'bg-blue-50 border-blue-400 shadow-2xs'
                  : 'bg-white border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="text-xs font-bold text-blue-700">매입 · 거래처 미납</div>
              <div className="mt-1 text-lg sm:text-xl font-bold text-gray-900 tabular-nums">
                {formatNumber(summary.purchaseRemaining)}
                <span className="text-xs font-normal text-gray-500 ml-0.5">원</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setCategoryFilter(categoryFilter === '임대·공과금' ? 'all' : '임대·공과금')
              }
              className={`text-left p-3.5 rounded-2xl border transition-all ${
                categoryFilter === '임대·공과금'
                  ? 'bg-amber-50 border-amber-400 shadow-2xs'
                  : 'bg-white border-gray-200 hover:border-amber-300'
              }`}
            >
              <div className="text-xs font-bold text-amber-800">임대 · 공과금 · 기타</div>
              <div className="mt-1 text-lg sm:text-xl font-bold text-gray-900 tabular-nums">
                {formatNumber(summary.otherRemaining)}
                <span className="text-xs font-normal text-gray-500 ml-0.5">원</span>
              </div>
            </button>
          </div>
        </section>

        {/* 2. 빠른 입력 카드 (납부 차감 / 신규 미납 업체 등록 / 기존 업체 미납금 추가) */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight">
              미납금 등록 및 날짜별 납부(차감) 기록
            </h3>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setFormMode('payment')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
                  formMode === 'payment'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                납부(잔금 차감)
              </button>
              <button
                type="button"
                onClick={() => setFormMode('new_vendor')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
                  formMode === 'new_vendor'
                    ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                신규 미납업체 등록
              </button>
              <button
                type="button"
                onClick={() => setFormMode('add_charge')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
                  formMode === 'add_charge'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                기존업체 미납 추가
              </button>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-3">
            {formMode === 'new_vendor' ? (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">분류</label>
                  <select
                    value={newVendorCategory}
                    onChange={(e) => setNewVendorCategory(e.target.value as UnpaidCategory)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-base sm:text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {UNPAID_CATEGORIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-8">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    상호명 / 세금명
                  </label>
                  <input
                    type="text"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    placeholder="예: 국세청 부가세, 두올, 국민연금 미납"
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-base sm:text-sm font-normal text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  대상 업체 / 세금 선택
                </label>
                {vendors.length === 0 ? (
                  <div className="p-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-xs text-gray-500">
                    등록된 업체가 없습니다. 먼저 우측 상단의 [신규 미납업체 등록]을 눌러 업체를 추가해주세요.
                  </div>
                ) : (
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-base sm:text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {vendors.map((v) => {
                      const st = calculateVendorStats(v);
                      return (
                        <option key={v.id} value={v.id}>
                          [{v.category}] {v.name} (현재 잔금: {formatNumber(st.remaining)}원)
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            )}

            {/* 날짜 -> 금액 -> 적요(메모) 순서 (사용자 선호 반영) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-base sm:text-sm font-normal text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {formMode === 'payment' ? '납부 금액 (원)' : '미납 금액 (원)'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={txAmount}
                  onChange={(e) => setTxAmount(formatAmountInput(e.target.value))}
                  placeholder="0"
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-base sm:text-sm font-medium text-right tabular-nums text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  내역 메모 (선택)
                </label>
                <input
                  type="text"
                  value={txMemo}
                  onChange={(e) => setTxMemo(e.target.value)}
                  placeholder={
                    formMode === 'payment'
                      ? '예: 1차 분납, 계좌이체 일부 납부'
                      : '예: 10월분 미납, 상반기 부가세'
                  }
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-base sm:text-sm font-normal text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`w-full py-3 rounded-xl text-sm font-semibold text-white shadow-xs transition-colors ${
                formMode === 'payment'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : formMode === 'add_charge'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-gray-900 hover:bg-black'
              } disabled:bg-gray-300`}
            >
              {saving
                ? '저장 중...'
                : formMode === 'payment'
                ? '납부 내역 기록 (잔금 차감)'
                : formMode === 'add_charge'
                ? '미납금 추가 기록 (잔금 합산)'
                : '신규 미납 항목 등록하기'}
            </button>
          </form>
        </section>

        {/* 3. 필터 및 검색 바 */}
        <section className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: 'all', label: '전체 분류' },
                { key: '세금·4대보험', label: '세금·4대보험' },
                { key: '매입·거래처', label: '매입·거래처' },
                { key: '임대·공과금', label: '임대·공과금' },
                { key: '기타미납', label: '기타미납' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setCategoryFilter(t.key as 'all' | UnpaidCategory)}
                  className={`px-3 py-1.5 rounded-xl text-xs transition-colors whitespace-nowrap ${
                    categoryFilter === t.key
                      ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-500 font-bold'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 font-medium'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              {[
                { key: 'all', label: '전체' },
                { key: 'unpaid', label: '미납 잔금 있음' },
                { key: 'completed', label: '완납 완료' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStatusFilter(st.key as 'unpaid' | 'all' | 'completed')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs transition-colors whitespace-nowrap ${
                    statusFilter === st.key
                      ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-500 font-bold'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 font-medium'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="상호명, 세금명, 메모 검색..."
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-base sm:text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
        </section>

        {/* 4. 업체 · 세금별 미납 잔금 카드 리스트 (클릭 시 날짜별 납부 히스토리 펼침) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs sm:text-sm font-semibold text-gray-700">
              업체를 누르면 날짜별 미납·납부 내역이 펼쳐집니다 ({filteredVendors.length}곳)
            </span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
              데이터를 불러오는 중...
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center space-y-1.5">
              <div className="text-sm font-semibold text-gray-500">
                등록된 미납 내역이 없습니다.
              </div>
              <p className="text-xs text-gray-400">
                상단 입력란에서 세금이나 거래처 미납금을 등록하면 업체별 잔금이 자동 계산됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredVendors.map(({ vendor, stats }) => {
                const meta = getUnpaidCategoryMeta(vendor.category);
                const isExpanded = !!expandedVendors[vendor.id];
                const isCompleted = stats.remaining <= 0;

                return (
                  <div
                    key={vendor.id}
                    className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden transition-all"
                  >
                    <div className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => toggleExpand(vendor.id)}
                        >
                          {editingVendorId === vendor.id ? (
                            <div
                              className="flex items-center gap-1.5 flex-wrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <select
                                value={editVendorCategory}
                                onChange={(e) =>
                                  setEditVendorCategory(e.target.value as UnpaidCategory)
                                }
                                className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white"
                              >
                                {UNPAID_CATEGORIES.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={editVendorName}
                                onChange={(e) => setEditVendorName(e.target.value)}
                                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1 bg-white font-semibold"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditVendor(vendor.id)}
                                className="text-xs font-semibold bg-indigo-600 text-white px-2.5 py-1 rounded-lg"
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingVendorId(null)}
                                className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-lg"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dotClass}`} />
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap ${meta.badgeClass}`}
                              >
                                {vendor.category}
                              </span>
                              <span className="text-base sm:text-lg font-bold text-gray-900 tracking-tight break-keep">
                                {vendor.name}
                              </span>
                              {isCompleted && (
                                <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  완납 완료
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2.5 mt-1.5 pl-4 text-xs text-gray-500 flex-wrap tabular-nums">
                            <span className="whitespace-nowrap">
                              총 미납원금: <strong className="font-semibold text-gray-700">{formatNumber(stats.totalCharged)}원</strong>
                            </span>
                            <span className="text-gray-300">|</span>
                            <span className="text-emerald-700 whitespace-nowrap">
                              누적 납부: <strong className="font-semibold">{formatNumber(stats.totalPaid)}원</strong> ({stats.paidRate}%)
                            </span>
                          </div>
                        </div>

                        <div
                          className="text-right shrink-0 cursor-pointer"
                          onClick={() => toggleExpand(vendor.id)}
                        >
                          <div className="text-[11px] font-medium text-gray-400">남은 잔금</div>
                          <div
                            className={`text-lg sm:text-xl font-extrabold tabular-nums whitespace-nowrap ${
                              isCompleted ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {formatNumber(stats.remaining)}
                            <span className="text-xs font-normal text-gray-500 ml-0.5">원</span>
                          </div>
                          <div className="text-[11px] font-medium text-indigo-600 mt-0.5">
                            {isExpanded ? '내역 접기 ▲' : `내역 ${(vendor.transactions || []).length}건 ▼`}
                          </div>
                        </div>
                      </div>

                      {/* 진행 바 & 빠른 액션 버튼 */}
                      <div className="space-y-2">
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${stats.paidRate}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-0.5">
                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={() => quickSelectForPayment(vendor.id)}
                              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                            >
                              + 납부 기록하기
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartEditVendor(vendor)}
                            className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                          >
                            상호·내역 수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVendor(vendor.id, vendor.name)}
                            className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 펼쳐지는 날짜별 미납발생 / 납부 차감 상세 내역 (모바일 1줄 정렬 + 인라인 수정 지원) */}
                    {isExpanded && (
                      <div className="bg-gray-50/80 border-t border-gray-100 divide-y divide-gray-100">
                        {(vendor.transactions || []).map((tx) => (
                          <div key={tx.id} className="px-3 sm:px-5 py-2.5 text-xs sm:text-sm">
                            {editingTxId === tx.id ? (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2.5 rounded-xl border border-indigo-200">
                                <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 flex-1">
                                  <input
                                    type="date"
                                    value={editTxDate}
                                    onChange={(e) => setEditTxDate(e.target.value)}
                                    className="p-1.5 border border-gray-300 rounded-lg text-xs text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                  <select
                                    value={editTxType}
                                    onChange={(e) =>
                                      setEditTxType(e.target.value as 'charge' | 'payment')
                                    }
                                    className="p-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                    <option value="charge">미납발생 (+)</option>
                                    <option value="payment">납부차감 (-)</option>
                                  </select>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={editTxAmount}
                                    onChange={(e) =>
                                      setEditTxAmount(formatAmountInput(e.target.value))
                                    }
                                    placeholder="금액"
                                    className="p-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-right tabular-nums text-gray-900 sm:w-28 outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                  <input
                                    type="text"
                                    value={editTxMemo}
                                    onChange={(e) => setEditTxMemo(e.target.value)}
                                    placeholder="내역 메모"
                                    className="p-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 flex-1 min-w-[100px] outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditTx(vendor.id, tx.id)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 whitespace-nowrap"
                                  >
                                    저장
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingTxId(null)}
                                    className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 whitespace-nowrap"
                                  >
                                    취소
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                                  <span className="tabular-nums text-gray-400 text-[11px] sm:text-xs shrink-0 whitespace-nowrap">
                                    <span className="sm:hidden">{tx.date.slice(5)}</span>
                                    <span className="hidden sm:inline">{tx.date}</span>
                                  </span>
                                  <span
                                    className={`text-[10px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded border shrink-0 whitespace-nowrap ${
                                      tx.type === 'payment'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}
                                  >
                                    {tx.type === 'payment' ? '납부(차감)' : '미납발생'}
                                  </span>
                                  <span className="font-normal text-gray-800 truncate min-w-0">
                                    {tx.memo}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`tabular-nums font-semibold whitespace-nowrap ${
                                      tx.type === 'payment' ? 'text-emerald-600' : 'text-rose-600'
                                    }`}
                                  >
                                    {tx.type === 'payment' ? '-' : '+'}
                                    {formatNumber(tx.amount)}원
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditTx(tx)}
                                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap"
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTransaction(vendor.id, tx.id)}
                                    className="text-[11px] font-medium text-red-600 hover:text-red-800 bg-red-50 px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
