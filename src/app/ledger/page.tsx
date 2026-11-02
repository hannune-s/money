"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  LEDGER_STORAGE_DATE,
  LedgerEntry,
  getLedgerCategoryMeta,
  autoClassifyLedgerCategory,
} from '@/lib/ledger';

export default function LedgerViewPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeTab, setScopeTab] = useState<'all' | 'store' | 'home'>('all');
  const [costFilter, setCostFilter] = useState<'all' | 'fixed' | 'variable'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or 'YYYY-MM'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const formatNumber = (num: number) => num.toLocaleString('ko-KR');

  const loadLedgerData = async () => {
    // 1. 로컬 캐시 먼저 즉시 표시
    try {
      const local = localStorage.getItem('money_ledger_entries');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          setEntries(parsed);
          setLoading(false);
        }
      }
    } catch {
      // ignore
    }

    // 2. Supabase 실시간 동기화
    try {
      const { data } = await supabase
        .from('money_finances')
        .select('memo')
        .eq('target_date', LEDGER_STORAGE_DATE)
        .maybeSingle();

      if (data && data.memo) {
        const parsed = JSON.parse(data.memo);
        if (Array.isArray(parsed)) {
          setEntries(parsed);
          localStorage.setItem('money_ledger_entries', JSON.stringify(parsed));
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedgerData();
  }, []);

  // 등록된 데이터의 월(YYYY-MM) 목록 추출
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.date && e.date.length >= 7) {
        set.add(e.date.slice(0, 7));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  // 월 필터가 적용된 전체 내역
  const monthFilteredEntries = useMemo(() => {
    if (selectedMonth === 'all') return entries;
    return entries.filter((e) => e.date.startsWith(selectedMonth));
  }, [entries, selectedMonth]);

  const resolveCategory = (item: LedgerEntry) => {
    if (item.category && item.category !== '기타지출') {
      return item.category;
    }
    return autoClassifyLedgerCategory(item.description, item.scope);
  };

  // 상단 토탈 요약 수치 계산 (매장 수입, 기타·부수입, 매장 지출, 집 지출, 총 지출, 매입대금 제외 실지출, 고정/변동)
  const summary = useMemo(() => {
    let storeTotal = 0;
    let storeFixed = 0;
    let storeVariable = 0;
    let storePurchaseTotal = 0; // 매장 매입·물품대금 합계

    let homeTotal = 0;
    let homeFixed = 0;
    let homeVariable = 0;

    let purchaseTotal = 0; // 전체 매입·물품대금 합계
    let storeIncomeTotal = 0; // 매장 수입
    let sideIncomeTotal = 0; // 기타·부수입 (보험보상금 등)
    const sideIncomeItems: LedgerEntry[] = [];

    monthFilteredEntries.forEach((item) => {
      const amt = Number(item.amount) || 0;
      const cat = resolveCategory(item);
      const isPurchase = cat === '매입·물품대금';

      if (item.scope === 'income') {
        storeIncomeTotal += amt;
      } else if (item.scope === 'side_income') {
        sideIncomeTotal += amt;
        sideIncomeItems.push(item);
      } else if (item.scope === 'store') {
        storeTotal += amt;
        if (isPurchase) {
          storePurchaseTotal += amt;
          purchaseTotal += amt;
        }
        if (item.costType === 'fixed') storeFixed += amt;
        else storeVariable += amt;
      } else if (item.scope === 'home') {
        homeTotal += amt;
        if (isPurchase) {
          purchaseTotal += amt;
        }
        if (item.costType === 'fixed') homeFixed += amt;
        else homeVariable += amt;
      }
    });

    const incomeTotal = storeIncomeTotal + sideIncomeTotal;
    const totalExpense = storeTotal + homeTotal;
    const totalExpenseWithoutPurchase = totalExpense - purchaseTotal;
    const storeTotalWithoutPurchase = storeTotal - storePurchaseTotal;
    const totalFixed = storeFixed + homeFixed;
    const totalVariable = storeVariable + homeVariable;
    const netBalance = incomeTotal - totalExpense;

    return {
      storeTotal,
      storeFixed,
      storeVariable,
      storePurchaseTotal,
      storeTotalWithoutPurchase,
      homeTotal,
      homeFixed,
      homeVariable,
      purchaseTotal,
      storeIncomeTotal,
      sideIncomeTotal,
      sideIncomeItems: sideIncomeItems.sort((a, b) => b.date.localeCompare(a.date)),
      incomeTotal,
      totalExpense,
      totalExpenseWithoutPurchase,
      totalFixed,
      totalVariable,
      netBalance,
    };
  }, [monthFilteredEntries]);

  // 현재 선택된 탭(전체/매장/집) + 고정/변동 + 검색어로 필터링된 지출 내역
  const filteredExpenses = useMemo(() => {
    return monthFilteredEntries.filter((item) => {
      if (item.scope === 'income' || item.scope === 'side_income') return false; // 지출 항목별 집계에서는 지출만 표시
      if (scopeTab !== 'all' && item.scope !== scopeTab) return false;
      if (costFilter !== 'all' && item.costType !== costFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const cat = resolveCategory(item).toLowerCase();
        return (
          item.description.toLowerCase().includes(q) ||
          cat.includes(q) ||
          item.date.includes(q)
        );
      }
      return true;
    });
  }, [monthFilteredEntries, scopeTab, costFilter, searchQuery]);

  // 항목(카테고리)별 그룹화 및 합계 정렬
  const categoryGroups = useMemo(() => {
    const map: Record<
      string,
      {
        category: string;
        total: number;
        fixedTotal: number;
        variableTotal: number;
        storeTotal: number;
        homeTotal: number;
        items: LedgerEntry[];
      }
    > = {};

    filteredExpenses.forEach((item) => {
      const cat = resolveCategory(item);
      if (!map[cat]) {
        map[cat] = {
          category: cat,
          total: 0,
          fixedTotal: 0,
          variableTotal: 0,
          storeTotal: 0,
          homeTotal: 0,
          items: [],
        };
      }
      const amt = Number(item.amount) || 0;
      map[cat].total += amt;
      if (item.costType === 'fixed') map[cat].fixedTotal += amt;
      else map[cat].variableTotal += amt;
      if (item.scope === 'store') map[cat].storeTotal += amt;
      else if (item.scope === 'home') map[cat].homeTotal += amt;
      map[cat].items.push(item);
    });

    // 각 카테고리 내부는 날짜 최신순 정렬, 카테고리끼리는 금액 큰 순서대로 정렬
    return Object.values(map)
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => b.date.localeCompare(a.date)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  const currentViewTotal = useMemo(
    () => categoryGroups.reduce((acc, g) => acc + g.total, 0),
    [categoryGroups]
  );

  const currentViewTotalWithoutPurchase = useMemo(
    () =>
      categoryGroups
        .filter((g) => g.category !== '매입·물품대금')
        .reduce((acc, g) => acc + g.total, 0),
    [categoryGroups]
  );

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
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
              통합 지출장부<span className="hidden sm:inline text-gray-500 font-medium"> (매장 · 집)</span>
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
            href="/unpaid"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            <span>미납금 · 외상 잔금 관리</span>
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

        <div className="p-4 border-t border-gray-100 space-y-3">
          <a
            href="/admin"
            onClick={() => {
              sessionStorage.removeItem('money_admin_authed');
            }}
            className="block text-center w-full py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs transition-colors whitespace-nowrap"
          >
            관리자 화면 잠금 (로그아웃)
          </a>
          <div className="text-xs text-gray-400 text-center">
            © 2026 머니장부 Admin
          </div>
        </div>
      </aside>

      <main className="max-w-3xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 space-y-5">
        {/* 1. 매장 + 집 토탈 지출 요약 대시보드 */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-bold px-2.5 sm:px-3 py-1 rounded-full border border-indigo-200 outline-none cursor-pointer"
                >
                  <option value="all">전체 누적 결산 (전체 기간)</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {m.split('-')[0]}년 {Number(m.split('-')[1])}월 결산
                    </option>
                  ))}
                </select>
                <a
                  href="/admin?menu=ledger"
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors whitespace-nowrap"
                >
                  + 장부 입력
                </a>
              </div>
              <h2 className="text-base sm:text-xl font-bold text-gray-900 mt-1.5 break-keep tracking-tight">
                매장 지출 + 집 지출 토탈 현황
              </h2>
            </div>
            <div className="text-right ml-auto">
              <div className="text-xs font-medium text-gray-400">총 지출 합계 (매장 + 집 전체)</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-800 tabular-nums">
                {formatNumber(summary.totalExpense)}
                <span className="text-xs font-normal text-gray-400 ml-1">원</span>
              </div>
            </div>
          </div>

          {/* ★ 핵심 지표 1: 매입대금을 제외한 순수 실지출 합계 강조 박스 */}
          <div className="bg-gradient-to-r from-rose-50 via-amber-50/70 to-orange-50 border border-rose-200 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-rose-800 break-keep">
                  매입대금 제외 순수 지출 합계 (핵심 관리 지출)
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-normal text-gray-600 mt-0.5 break-keep">
                전체 지출 <span className="tabular-nums font-semibold">{formatNumber(summary.totalExpense)}원</span>에서 물품 매입대금(<span className="tabular-nums font-semibold text-blue-700">{formatNumber(summary.purchaseTotal)}원</span>)을 뺀 금액
              </p>
            </div>
            <div className="text-right sm:shrink-0">
              <div className="text-xl sm:text-2xl font-bold text-rose-600 tabular-nums tracking-tight whitespace-nowrap">
                {formatNumber(summary.totalExpenseWithoutPurchase)}
                <span className="text-sm font-semibold text-rose-500 ml-1">원</span>
              </div>
            </div>
          </div>

          {/* ★ 핵심 지표 2: 총 수입(매장 수입 + 기타·부수입) 대비 지출 차감 후 남은 금액 */}
          <div
            className={`rounded-2xl p-3.5 sm:p-4 border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs ${
              summary.netBalance >= 0
                ? 'bg-gradient-to-r from-emerald-50 via-teal-50/80 to-cyan-50 border-emerald-300'
                : 'bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 border-red-300'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-xs sm:text-sm font-bold break-keep ${
                    summary.netBalance >= 0 ? 'text-emerald-900' : 'text-red-900'
                  }`}
                >
                  총 수입(매출·부수입) 차감 후 잔액 (수입 − 총지출)
                </span>
                {summary.incomeTotal > 0 && (
                  <span className="text-[11px] font-semibold bg-white/90 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full tabular-nums whitespace-nowrap">
                    지출비중 {Math.round((summary.totalExpense / summary.incomeTotal) * 100)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-[13px] text-gray-700 flex-wrap">
                <span className="whitespace-nowrap">
                  매장 수입 <strong className="font-bold text-emerald-700 tabular-nums">{formatNumber(summary.storeIncomeTotal)}원</strong>
                </span>
                {summary.sideIncomeTotal > 0 && (
                  <>
                    <span className="text-gray-400">+</span>
                    <span className="whitespace-nowrap">
                      부수입 <strong className="font-bold text-purple-700 tabular-nums">{formatNumber(summary.sideIncomeTotal)}원</strong>
                    </span>
                  </>
                )}
                <span className="text-gray-400">−</span>
                <span className="whitespace-nowrap">
                  총 지출 <strong className="font-bold text-rose-600 tabular-nums">{formatNumber(summary.totalExpense)}원</strong>
                </span>
              </div>
              {summary.sideIncomeItems.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {summary.sideIncomeItems.map((si) => (
                    <span
                      key={si.id}
                      className="inline-flex items-center gap-1 text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md tabular-nums whitespace-nowrap"
                    >
                      {si.description}: +{formatNumber(si.amount)}원
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="text-right sm:shrink-0">
              <div className="text-[11px] font-medium text-gray-500">차감 후 남은 금액</div>
              <div
                className={`text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight whitespace-nowrap ${
                  summary.netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {summary.netBalance > 0 ? '+' : ''}
                {formatNumber(summary.netBalance)}
                <span className="text-sm sm:text-base font-bold ml-1">원</span>
              </div>
            </div>
          </div>

          {/* 매장 지출 vs 집 지출 2단 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setScopeTab(scopeTab === 'store' ? 'all' : 'store')}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                scopeTab === 'store'
                  ? 'bg-blue-50 border-blue-500 shadow-xs'
                  : 'bg-white border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-blue-700 whitespace-nowrap">
                  매장 지출
                </span>
                <span className="text-[11px] font-semibold text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded-full tabular-nums">
                  {summary.totalExpense > 0
                    ? `${Math.round((summary.storeTotal / summary.totalExpense) * 100)}%`
                    : '0%'}
                </span>
              </div>
              <div className="mt-2 text-lg sm:text-2xl font-bold text-blue-700 tabular-nums">
                {formatNumber(summary.storeTotal)}
                <span className="text-xs font-normal text-gray-500 ml-1">원</span>
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 whitespace-nowrap">
                <span>매입 제외 매장지출:</span>
                <span className="tabular-nums">{formatNumber(summary.storeTotalWithoutPurchase)}원</span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-gray-500 flex-wrap">
                <span className="whitespace-nowrap">고정: {formatNumber(summary.storeFixed)}원</span>
                <span className="whitespace-nowrap">변동: {formatNumber(summary.storeVariable)}원</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setScopeTab(scopeTab === 'home' ? 'all' : 'home')}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                scopeTab === 'home'
                  ? 'bg-amber-50 border-amber-500 shadow-xs'
                  : 'bg-white border-gray-200 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-amber-800 whitespace-nowrap">
                  집 지출
                </span>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full tabular-nums">
                  기준 3,500,000원 대비 {Math.round((summary.homeTotal / 3500000) * 100)}%
                </span>
              </div>
              <div className="mt-2 text-lg sm:text-2xl font-bold text-amber-700 tabular-nums">
                {formatNumber(summary.homeTotal)}
                <span className="text-xs font-normal text-gray-500 ml-1">원</span>
              </div>
              {(() => {
                const HOME_BUDGET = 3500000;
                const homeRemaining = HOME_BUDGET - summary.homeTotal;
                return (
                  <div
                    className={`mt-1.5 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-xs ${
                      homeRemaining >= 0
                        ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    <span className="font-medium whitespace-nowrap">
                      350만 원 기준 차감 후:
                    </span>
                    <span
                      className={`font-extrabold tabular-nums text-sm whitespace-nowrap ${
                        homeRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {homeRemaining > 0 ? '+' : ''}
                      {formatNumber(homeRemaining)}원
                    </span>
                  </div>
                );
              })()}
              <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-gray-500 flex-wrap">
                <span className="whitespace-nowrap">고정: {formatNumber(summary.homeFixed)}원</span>
                <span className="whitespace-nowrap">변동: {formatNumber(summary.homeVariable)}원</span>
              </div>
            </button>
          </div>

          {/* 전체 고정지출 vs 변동지출 요약 바 */}
          <div className="bg-gray-50 rounded-2xl p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-gray-600 border border-gray-100">
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1 text-indigo-700 whitespace-nowrap">
                총 고정: <strong className="tabular-nums font-semibold">{formatNumber(summary.totalFixed)}원</strong>
              </span>
              <span className="text-gray-300">|</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 whitespace-nowrap">
                총 변동: <strong className="tabular-nums font-semibold">{formatNumber(summary.totalVariable)}원</strong>
              </span>
              <span className="text-gray-300">|</span>
              <span className="inline-flex items-center gap-1 text-blue-700 whitespace-nowrap">
                매입대금: <strong className="tabular-nums font-semibold">{formatNumber(summary.purchaseTotal)}원</strong>
              </span>
            </div>
          </div>
        </section>

        {/* 2. 탭 선택 (전체 / 매장 지출 / 집 지출) & 고정/변동 필터 */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* 매장 / 집 구분 탭 */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                {
                  key: 'all',
                  label: '전체 합산',
                  activeClass: 'bg-indigo-50 text-indigo-700 border-2 border-indigo-500 shadow-xs font-bold',
                },
                {
                  key: 'store',
                  label: '매장 지출',
                  activeClass: 'bg-blue-50 text-blue-700 border-2 border-blue-500 shadow-xs font-bold',
                },
                {
                  key: 'home',
                  label: '집 지출',
                  activeClass: 'bg-amber-50 text-amber-800 border-2 border-amber-500 shadow-xs font-bold',
                },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setScopeTab(t.key as 'all' | 'store' | 'home')}
                  className={`py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm transition-all whitespace-nowrap ${
                    scopeTab === t.key
                      ? t.activeClass
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 font-medium'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 고정 / 변동 필터 */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              {[
                {
                  key: 'all',
                  label: '전체',
                  activeClass: 'bg-indigo-50 text-indigo-700 border-2 border-indigo-500 font-bold',
                },
                {
                  key: 'fixed',
                  label: '고정만',
                  activeClass: 'bg-indigo-50 text-indigo-700 border-2 border-indigo-500 font-bold',
                },
                {
                  key: 'variable',
                  label: '변동만',
                  activeClass: 'bg-teal-50 text-teal-700 border-2 border-teal-500 font-bold',
                },
              ].map((cf) => (
                <button
                  key={cf.key}
                  type="button"
                  onClick={() => setCostFilter(cf.key as 'all' | 'fixed' | 'variable')}
                  className={`px-3 py-1.5 rounded-xl text-xs transition-colors whitespace-nowrap ${
                    costFilter === cf.key
                      ? cf.activeClass
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 font-medium'
                  }`}
                >
                  {cf.label}
                </button>
              ))}
            </div>
          </div>

          {/* 적요 / 항목 빠른 검색 (모바일 줌 방지 text-base sm:text-sm) */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="항목명(예: 통신비, 매입) 또는 적요 검색..."
              className="w-full pl-4 pr-16 py-2.5 bg-white border border-gray-200 rounded-2xl text-base sm:text-sm font-normal text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md hover:text-gray-800"
              >
                지우기 ✕
              </button>
            )}
          </div>
        </section>

        {/* 3. 항목별 토탈 금액 리스트 (클릭 시 세부내역 펼침) */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-1">
            <div className="text-xs sm:text-sm font-semibold text-gray-700 break-keep">
              항목을 누르면 언제·무엇이 지출되었는지 세부내역이 펼쳐집니다
            </div>
            <div className="text-xs font-medium text-gray-500 tabular-nums flex items-center gap-2 flex-wrap">
              <span className="whitespace-nowrap">표시 합계: {formatNumber(currentViewTotal)}원</span>
              <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/70 font-semibold whitespace-nowrap">
                매입 제외: {formatNumber(currentViewTotalWithoutPurchase)}원
              </span>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-sm font-medium">
              장부 데이터를 불러오는 중...
            </div>
          ) : categoryGroups.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center space-y-2">
              <div className="text-sm font-semibold text-gray-500">
                아직 표시할 지출 내역이 없습니다.
              </div>
              <p className="text-xs text-gray-400 break-keep">
                어드민의 [지출장부 입력] 메뉴에서 날짜·적요·금액을 입력하면 자동으로 항목별 집계됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {categoryGroups.map((group) => {
                const meta = getLedgerCategoryMeta(group.category);
                const isExpanded = !!expandedCategories[group.category];
                const ratio =
                  currentViewTotal > 0
                    ? Math.round((group.total / currentViewTotal) * 100)
                    : 0;

                return (
                  <div
                    key={group.category}
                    className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden transition-all"
                  >
                    {/* 항목 요약 헤더 (클릭 시 세부내역 토글) */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(group.category)}
                      className="w-full bg-white p-4 sm:p-5 text-left hover:bg-gray-50/80 transition-colors flex flex-col gap-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${meta.barClass}`} />
                            <span className="text-sm sm:text-base font-bold text-gray-900 whitespace-nowrap tracking-tight">
                              {group.category}
                            </span>
                            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                              {group.items.length}건
                            </span>
                            <span className="text-[11px] font-normal text-gray-400 tabular-nums">
                              ({ratio}%)
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 mt-1 pl-4 text-[11px] font-normal text-gray-400 flex-wrap">
                            {scopeTab === 'all' && (
                              <>
                                {group.storeTotal > 0 && (
                                  <span className="text-blue-600 font-medium whitespace-nowrap tabular-nums">
                                    매장 {formatNumber(group.storeTotal)}원
                                  </span>
                                )}
                                {group.homeTotal > 0 && (
                                  <span className="text-amber-700 font-medium whitespace-nowrap tabular-nums">
                                    집 {formatNumber(group.homeTotal)}원
                                  </span>
                                )}
                              </>
                            )}
                            {group.fixedTotal > 0 && (
                              <span className="whitespace-nowrap tabular-nums">고정 {formatNumber(group.fixedTotal)}원</span>
                            )}
                            {group.variableTotal > 0 && (
                              <span className="whitespace-nowrap tabular-nums">변동 {formatNumber(group.variableTotal)}원</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-base sm:text-lg font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                              {formatNumber(group.total)}
                              <span className="text-xs font-normal text-gray-500 ml-0.5">원</span>
                            </div>
                            <div className="text-[11px] font-medium text-indigo-600 whitespace-nowrap">
                              {isExpanded ? '접기 ▲' : '세부내역 ▼'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 비중 프로그레스 바 */}
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${meta.barClass} rounded-full transition-all duration-300`}
                          style={{ width: `${Math.max(ratio, 3)}%` }}
                        />
                      </div>
                    </button>

                    {/* 클릭 시 펼쳐지는 세부 지출 내역 */}
                    {isExpanded && (
                      <div className="bg-gray-50/70 border-t border-gray-100 divide-y divide-gray-100">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className="px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-2 text-xs sm:text-sm"
                          >
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                              <span className="tabular-nums text-gray-400 text-[11px] sm:text-xs shrink-0 whitespace-nowrap">
                                <span className="sm:hidden">{item.date.slice(5)}</span>
                                <span className="hidden sm:inline">{item.date}</span>
                              </span>
                              <span
                                className={`text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded-md border shrink-0 whitespace-nowrap ${
                                  item.scope === 'store'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {item.scope === 'store' ? '매장' : '집'}
                              </span>
                              <span
                                className={`text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap ${
                                  item.costType === 'fixed'
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'bg-gray-200/70 text-gray-700'
                                }`}
                              >
                                {item.costType === 'fixed' ? '고정' : '변동'}
                              </span>
                              <span className="font-normal text-gray-800 truncate min-w-0">
                                {item.description}
                              </span>
                            </div>

                            <div className="tabular-nums font-medium text-gray-800 shrink-0 text-right whitespace-nowrap">
                              {formatNumber(item.amount)}원
                            </div>
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
