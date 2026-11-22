"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  HQ_LEDGER_STORAGE_DATE,
  LedgerEntry,
  LedgerScope,
  LedgerCostType,
  LEDGER_CATEGORIES,
  getLedgerCategoryMeta,
  autoClassifyLedgerCategory,
} from '@/lib/ledger';

type HqLedgerScope = 'store' | 'income' | 'side_income';

interface HqLedgerSectionProps {
  onEntryCountChange?: (count: number) => void;
}

export default function HqLedgerSection({ onEntryCountChange }: HqLedgerSectionProps) {
  const getKstDate = () => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split('T')[0];
  };

  // 데이터 & 자동분류 학습 규칙 상태
  const [ledgerList, setLedgerList] = useState<LedgerEntry[]>([]);
  const [ledgerCustomRules, setLedgerCustomRules] = useState<Record<string, string>>({});
  const [initialLoading, setInitialLoading] = useState(true);

  // [좌측] 입력 폼 상태
  const [lgDate, setLgDate] = useState(getKstDate());
  const [lgScope, setLgScope] = useState<HqLedgerScope>('store');
  const [lgCostType, setLgCostType] = useState<LedgerCostType>('variable');
  const [lgDescription, setLgDescription] = useState('');
  const [lgAmount, setLgAmount] = useState('');
  const [lgManualCategory, setLgManualCategory] = useState('');
  const [lgRememberRule, setLgRememberRule] = useState(true);
  const [lgLoading, setLgLoading] = useState(false);
  const [editingLgId, setEditingLgId] = useState<string | null>(null);

  // [좌측] 최근 입력 내역 필터/검색/페이지 상태
  const [lgFilterScope, setLgFilterScope] = useState<'all' | HqLedgerScope>('all');
  const [lgFilterDate, setLgFilterDate] = useState('');
  const [lgSearch, setLgSearch] = useState('');
  const [lgCurrentPage, setLgCurrentPage] = useState(1);

  // [우측] 장부 보기 (결산 월 / 고정·변동 필터 / 항목 검색 / 펼침 상태)
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [costFilter, setCostFilter] = useState<'all' | 'fixed' | 'variable'>('all');
  const [viewSearchQuery, setViewSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const formatNumber = (num: number) => num.toLocaleString('ko-KR');
  const parseNumber = (str: string) => parseInt(str.toString().replace(/,/g, '') || '0', 10);
  const formatAmountInput = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    if (!clean) return '';
    return parseInt(clean, 10).toLocaleString('ko-KR');
  };

  useEffect(() => {
    onEntryCountChange?.(ledgerList.length);
  }, [ledgerList.length, onEntryCountChange]);

  const saveHqLedgerRecordsToDb = async (
    newList: LedgerEntry[],
    newRules: Record<string, string> = ledgerCustomRules
  ) => {
    localStorage.setItem('money_hq_ledger_entries', JSON.stringify(newList));
    localStorage.setItem('money_hq_ledger_rules', JSON.stringify(newRules));

    const payload = {
      target_date: HQ_LEDGER_STORAGE_DATE,
      accounts: [newRules],
      expenditures: [],
      total_account_balance: 0,
      total_expenditure: 0,
      final_balance: 0,
      memo: JSON.stringify(newList),
    };

    const { error } = await supabase
      .from('money_finances')
      .upsert(payload, { onConflict: 'target_date' });

    if (error) {
      console.error('Failed to sync HQ ledger to DB:', error);
    }
  };

  const loadHqLedgerRecords = async () => {
    let localEntries: LedgerEntry[] = [];
    let localRules: Record<string, string> = {};

    try {
      // 기존 통합 장부에서 학습한 사용자 키워드 규칙도 기본 베이스로 함께 활용
      const sharedRulesRaw = localStorage.getItem('money_ledger_rules');
      if (sharedRulesRaw) {
        const parsedShared = JSON.parse(sharedRulesRaw);
        if (parsedShared && typeof parsedShared === 'object') {
          localRules = { ...parsedShared };
        }
      }

      const rawLocal = localStorage.getItem('money_hq_ledger_entries');
      if (rawLocal) {
        const parsedLocal = JSON.parse(rawLocal);
        if (Array.isArray(parsedLocal)) {
          localEntries = parsedLocal;
          setLedgerList(parsedLocal);
          setInitialLoading(false);
        }
      }
      const rawRules = localStorage.getItem('money_hq_ledger_rules');
      if (rawRules) {
        const parsedRules = JSON.parse(rawRules);
        if (parsedRules && typeof parsedRules === 'object') {
          localRules = { ...localRules, ...parsedRules };
          setLedgerCustomRules(localRules);
        }
      }
    } catch {
      // ignore
    }

    try {
      const { data } = await supabase
        .from('money_finances')
        .select('memo, accounts')
        .eq('target_date', HQ_LEDGER_STORAGE_DATE)
        .maybeSingle();

      let dbEntries: LedgerEntry[] = [];
      if (data?.memo) {
        const parsed = JSON.parse(data.memo);
        if (Array.isArray(parsed)) {
          dbEntries = parsed;
        }
      }

      let dbRules: Record<string, string> = {};
      if (
        Array.isArray(data?.accounts) &&
        data.accounts.length > 0 &&
        typeof data.accounts[0] === 'object'
      ) {
        dbRules = data.accounts[0] as Record<string, string>;
      }

      if (localEntries.length > 0 && dbEntries.length === 0) {
        const mergedRules = { ...localRules, ...dbRules };
        setLedgerList(localEntries);
        setLedgerCustomRules(mergedRules);
        await saveHqLedgerRecordsToDb(localEntries, mergedRules);
      } else if (dbEntries.length > 0) {
        const getSig = (e: LedgerEntry) =>
          `${e.date}|${e.scope}|${(e.description || '').trim()}|${e.amount}`;
        const mapById = new Map<string, LedgerEntry>();
        const sigSet = new Set<string>();
        dbEntries.forEach((item) => {
          mapById.set(item.id, item);
          sigSet.add(getSig(item));
        });
        let hasLocalOnly = false;
        localEntries.forEach((item) => {
          const sig = getSig(item);
          if (!mapById.has(item.id) && !sigSet.has(sig)) {
            mapById.set(item.id, item);
            sigSet.add(sig);
            hasLocalOnly = true;
          }
        });
        const mergedList = Array.from(mapById.values()).sort((a, b) =>
          b.date.localeCompare(a.date)
        );
        const mergedRules = { ...localRules, ...dbRules };
        setLedgerList(mergedList);
        setLedgerCustomRules(mergedRules);
        localStorage.setItem('money_hq_ledger_entries', JSON.stringify(mergedList));
        localStorage.setItem('money_hq_ledger_rules', JSON.stringify(mergedRules));
        if (hasLocalOnly) {
          await saveHqLedgerRecordsToDb(mergedList, mergedRules);
        }
      }
    } catch {
      // ignore
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadHqLedgerRecords();
  }, []);

  const resetLedgerForm = () => {
    setEditingLgId(null);
    setLgDate(getKstDate());
    setLgDescription('');
    setLgAmount('');
    setLgManualCategory('');
  };

  const resolveEntryCategory = (item: LedgerEntry) => {
    if (item.category && item.category !== '기타지출') {
      return item.category;
    }
    return autoClassifyLedgerCategory(item.description, item.scope, ledgerCustomRules);
  };

  // 적요 입력 시 실시간 자동 분류 미리보기
  const previewClassifiedCategory = lgManualCategory.trim()
    ? lgManualCategory.trim()
    : autoClassifyLedgerCategory(lgDescription, lgScope as LedgerScope, ledgerCustomRules);

  const handleAddOrUpdateLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lgDescription.trim()) {
      alert('적요(내용)를 입력해주세요. (예: 매입대금 두올, KT 인터넷, 보험보상금)');
      return;
    }
    const numericAmount = parseNumber(lgAmount);
    if (numericAmount <= 0) {
      alert('금액을 올바르게 입력해주세요.');
      return;
    }

    setLgLoading(true);
    try {
      const finalCategory = lgManualCategory.trim()
        ? lgManualCategory.trim()
        : autoClassifyLedgerCategory(
            lgDescription.trim(),
            lgScope as LedgerScope,
            ledgerCustomRules
          );

      let updatedRules = { ...ledgerCustomRules };
      if (lgManualCategory.trim() && lgRememberRule && lgDescription.trim()) {
        const keywordKey = lgDescription.trim().split(/\s+/)[0];
        if (keywordKey && keywordKey.length >= 2) {
          updatedRules[keywordKey] = lgManualCategory.trim();
          setLedgerCustomRules(updatedRules);
        }
      }

      let updatedList: LedgerEntry[];
      if (editingLgId) {
        updatedList = ledgerList.map((item) =>
          item.id === editingLgId
            ? {
                ...item,
                date: lgDate,
                scope: lgScope as LedgerScope,
                costType: lgCostType,
                description: lgDescription.trim(),
                amount: numericAmount,
                category: finalCategory,
              }
            : item
        );
      } else {
        const newRecord: LedgerEntry = {
          id: Date.now().toString(),
          date: lgDate,
          scope: lgScope as LedgerScope,
          costType: lgCostType,
          description: lgDescription.trim(),
          amount: numericAmount,
          category: finalCategory,
          createdAt: new Date().toISOString(),
        };
        updatedList = [newRecord, ...ledgerList];
      }

      updatedList.sort((a, b) => b.date.localeCompare(a.date));
      setLedgerList(updatedList);
      await saveHqLedgerRecordsToDb(updatedList, updatedRules);
      resetLedgerForm();
    } catch (err) {
      console.error(err);
      alert('본점 장부 저장 중 오류가 발생했습니다.');
    } finally {
      setLgLoading(false);
    }
  };

  const handleEditLedger = (item: LedgerEntry) => {
    setEditingLgId(item.id);
    setLgDate(item.date);
    setLgScope(item.scope === 'income' || item.scope === 'side_income' ? item.scope : 'store');
    setLgCostType(item.costType);
    setLgDescription(item.description);
    setLgAmount(formatNumber(item.amount));
    setLgManualCategory(item.category === '기타지출' ? '' : item.category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteLedger = async (id: string) => {
    if (!confirm('이 본점 장부 내역을 삭제하시겠습니까?')) return;
    const updatedList = ledgerList.filter((item) => item.id !== id);
    setLedgerList(updatedList);
    await saveHqLedgerRecordsToDb(updatedList, ledgerCustomRules);
    if (editingLgId === id) resetLedgerForm();
  };

  // [좌측] 최근 입력 내역 필터링
  const filteredLedgerList = useMemo(() => {
    return ledgerList.filter((item) => {
      if (lgFilterScope !== 'all' && item.scope !== lgFilterScope) return false;
      if (lgFilterDate && item.date !== lgFilterDate) return false;
      if (!lgSearch.trim()) return true;
      const q = lgSearch.trim().toLowerCase();
      const cat = resolveEntryCategory(item).toLowerCase();
      return (
        item.description.toLowerCase().includes(q) ||
        cat.includes(q) ||
        item.date.includes(q)
      );
    });
  }, [ledgerList, lgFilterScope, lgFilterDate, lgSearch, ledgerCustomRules]);

  // [우측] 장부 보기용 월 목록 추출
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    ledgerList.forEach((e) => {
      if (e.date && e.date.length >= 7) {
        set.add(e.date.slice(0, 7));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [ledgerList]);

  // [우측] 월 필터가 적용된 전체 내역
  const monthFilteredEntries = useMemo(() => {
    if (selectedMonth === 'all') return ledgerList;
    return ledgerList.filter((e) => e.date.startsWith(selectedMonth));
  }, [ledgerList, selectedMonth]);

  // [우측] 본점 토탈 요약 수치 계산 (집 지출 제외, 매장 지출·매장 수입·기타부수입·매입제외 실지출·고정/변동)
  const summary = useMemo(() => {
    let storeTotal = 0;
    let storeFixed = 0;
    let storeVariable = 0;
    let purchaseTotal = 0;
    let storeIncomeTotal = 0;
    let sideIncomeTotal = 0;
    const sideIncomeItems: LedgerEntry[] = [];

    monthFilteredEntries.forEach((item) => {
      const amt = Number(item.amount) || 0;
      const cat = resolveEntryCategory(item);
      const isPurchase = cat === '매입·물품대금';

      if (item.scope === 'income') {
        storeIncomeTotal += amt;
      } else if (item.scope === 'side_income') {
        sideIncomeTotal += amt;
        sideIncomeItems.push(item);
      } else {
        // 본점 매장 지출
        storeTotal += amt;
        if (isPurchase) {
          purchaseTotal += amt;
        }
        if (item.costType === 'fixed') storeFixed += amt;
        else storeVariable += amt;
      }
    });

    const incomeTotal = storeIncomeTotal + sideIncomeTotal;
    const totalExpense = storeTotal;
    const totalExpenseWithoutPurchase = totalExpense - purchaseTotal;
    const netBalance = incomeTotal - totalExpense;

    return {
      storeTotal,
      storeFixed,
      storeVariable,
      purchaseTotal,
      storeIncomeTotal,
      sideIncomeTotal,
      sideIncomeItems: sideIncomeItems.sort((a, b) => b.date.localeCompare(a.date)),
      incomeTotal,
      totalExpense,
      totalExpenseWithoutPurchase,
      netBalance,
    };
  }, [monthFilteredEntries, ledgerCustomRules]);

  // [우측] 고정/변동 + 검색어로 필터링된 지출 내역
  const filteredExpenses = useMemo(() => {
    return monthFilteredEntries.filter((item) => {
      if (item.scope === 'income' || item.scope === 'side_income') return false;
      if (costFilter !== 'all' && item.costType !== costFilter) return false;
      if (viewSearchQuery.trim()) {
        const q = viewSearchQuery.trim().toLowerCase();
        const cat = resolveEntryCategory(item).toLowerCase();
        return (
          item.description.toLowerCase().includes(q) ||
          cat.includes(q) ||
          item.date.includes(q)
        );
      }
      return true;
    });
  }, [monthFilteredEntries, costFilter, viewSearchQuery, ledgerCustomRules]);

  // [우측] 항목(카테고리)별 그룹화 및 합계 정렬
  const categoryGroups = useMemo(() => {
    const map: Record<
      string,
      {
        category: string;
        total: number;
        fixedTotal: number;
        variableTotal: number;
        items: LedgerEntry[];
      }
    > = {};

    filteredExpenses.forEach((item) => {
      const cat = resolveEntryCategory(item);
      if (!map[cat]) {
        map[cat] = {
          category: cat,
          total: 0,
          fixedTotal: 0,
          variableTotal: 0,
          items: [],
        };
      }
      const amt = Number(item.amount) || 0;
      map[cat].total += amt;
      if (item.costType === 'fixed') map[cat].fixedTotal += amt;
      else map[cat].variableTotal += amt;
      map[cat].items.push(item);
    });

    return Object.values(map)
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => b.date.localeCompare(a.date)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredExpenses, ledgerCustomRules]);

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

  const allExpanded =
    categoryGroups.length > 0 &&
    categoryGroups.every((g) => !!expandedCategories[g.category]);

  const toggleAllCategories = () => {
    if (allExpanded) {
      setExpandedCategories({});
    } else {
      const next: Record<string, boolean> = {};
      categoryGroups.forEach((g) => {
        next[g.category] = true;
      });
      setExpandedCategories(next);
    }
  };

  return (
    <div className="space-y-5">
      {/* 상단 본점지출관리 안내 배너 */}
      <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-blue-500/20 border border-blue-400/40 text-blue-200 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
              본점 전용 통합 화면
            </span>
            <h2 className="text-base sm:text-lg font-extrabold">
              본점지출관리 (좌측 입력 · 우측 장부 현황 한눈에 보기)
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-1 break-keep">
            기존 매장·집 장부와 완전히 분리된 <strong className="text-amber-300">본점 전용 지출·수입 장부</strong>입니다. 왼쪽에서 입력하면 오른쪽 항목별 장부 현황에 실시간으로 즉시 반영됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs font-bold bg-white/10 px-3.5 py-2 rounded-xl border border-white/15">
          <span className="text-slate-300">총 등록 건수</span>
          <span className="text-amber-300 text-sm font-black tabular-nums">{ledgerList.length}건</span>
        </div>
      </div>

      {/* ==================== 좌/우 50:50 분할 레이아웃 ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-start">
        {/* ==================== [왼쪽 50%] 입력 화면 + 최근 입력 내역 ==================== */}
        <div className="space-y-5 min-w-0">
          {/* 1. 빠른 입력 폼 카드 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 flex items-center gap-2 tracking-tight">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                <span>{editingLgId ? '본점 장부 내역 수정' : '일일 지출·수입 기록'}</span>
              </h3>
              {editingLgId && (
                <button
                  type="button"
                  onClick={resetLedgerForm}
                  className="text-xs font-bold text-gray-500 hover:text-gray-800 bg-gray-100 px-3 py-1.5 rounded-lg"
                >
                  수정 취소
                </button>
              )}
            </div>

            <form onSubmit={handleAddOrUpdateLedger} className="space-y-4">
              {/* 1열: 구분 (매장 지출 / 매장 수입 / 기타·부수입 — 집 지출 제외) & 고정/변동 체크 */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    1. 장부 구분 선택
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setLgScope('store')}
                      className={`py-2.5 px-1.5 sm:px-2 rounded-xl font-semibold text-xs sm:text-sm border transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                        lgScope === 'store'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span>매장 지출</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLgScope('income')}
                      className={`py-2.5 px-1.5 sm:px-2 rounded-xl font-semibold text-xs sm:text-sm border transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                        lgScope === 'income'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span>매장 수입</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLgScope('side_income')}
                      className={`py-2.5 px-1.5 sm:px-2 rounded-xl font-semibold text-xs sm:text-sm border transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                        lgScope === 'side_income'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span>기타·부수입</span>
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    2. 고정 / 변동 체크
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLgCostType('fixed')}
                      className={`py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm border transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                        lgCostType === 'fixed'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span>고정</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLgCostType('variable')}
                      className={`py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm border transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                        lgCostType === 'variable'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span>변동</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2열: 날짜 / 금액 / 적요 */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
                  <input
                    type="date"
                    value={lgDate}
                    onChange={(e) => setLgDate(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-base sm:text-sm font-normal text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">금액 (원)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={lgAmount}
                    onChange={(e) => setLgAmount(formatAmountInput(e.target.value))}
                    placeholder="0"
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-base sm:text-sm font-medium text-right tabular-nums text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    적요 (어디에 썼는지 / 무슨 수입인지)
                  </label>
                  <input
                    type="text"
                    value={lgDescription}
                    onChange={(e) => setLgDescription(e.target.value)}
                    placeholder="예: 매입대금 두올, 보험보상금, 전기요금"
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-base sm:text-sm font-normal text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* 3열: 실시간 자동분류 미리보기 & 수동 변경 옵션 */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                    자동 분류 항목:
                  </span>
                  {(() => {
                    const meta = getLedgerCategoryMeta(previewClassifiedCategory);
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap ${meta.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.barClass}`} />
                        <span>{meta.name}</span>
                      </span>
                    );
                  })()}
                  {!lgManualCategory && lgDescription.trim() && (
                    <span className="text-[11px] text-gray-400 font-normal">
                      (적요 내용으로 자동 매칭됨)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={lgManualCategory}
                    onChange={(e) => setLgManualCategory(e.target.value)}
                    className="w-full sm:w-auto text-sm sm:text-xs font-medium bg-white border border-gray-300 rounded-lg px-2.5 py-2 sm:py-1.5 text-gray-700 outline-none"
                  >
                    <option value="">적요로 자동 분류 (추천)</option>
                    {LEDGER_CATEGORIES.map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name} (직접 선택)
                      </option>
                    ))}
                  </select>

                  {lgManualCategory && (
                    <label className="inline-flex items-center gap-1 text-xs sm:text-[11px] font-medium text-indigo-600 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={lgRememberRule}
                        onChange={(e) => setLgRememberRule(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>다음부터 이 단어 기억하기</span>
                    </label>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={lgLoading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-xl text-sm shadow-sm transition-colors whitespace-nowrap"
              >
                {lgLoading
                  ? '저장 중...'
                  : editingLgId
                  ? '수정 내용 저장하기'
                  : '장부에 기록하기'}
              </button>
            </form>
          </div>

          {/* 2. 최근 입력 내역 확인 및 수정/삭제 카드 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                  최근 입력 내역 ({filteredLedgerList.length}건)
                </h3>
                <p className="text-xs text-gray-500 break-keep mt-0.5">
                  입력된 내역은 우측 장부 현황에 실시간으로 자동 합산됩니다.
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { key: 'all', label: '전체' },
                  { key: 'store', label: '매장' },
                  { key: 'income', label: '매장수입' },
                  { key: 'side_income', label: '부수입' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setLgFilterScope(tab.key as 'all' | HqLedgerScope);
                      setLgCurrentPage(1);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs transition whitespace-nowrap ${
                      lgFilterScope === tab.key
                        ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-500 font-bold'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 font-medium'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 날짜별 조회 달력 & 검색창 */}
            <div className="mb-3 space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2 bg-gray-50/80 p-3 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-700 text-xs sm:text-sm whitespace-nowrap shrink-0">
                    📅 조회 날짜 선택
                  </span>
                  <input
                    type="date"
                    value={lgFilterDate}
                    onChange={(e) => {
                      setLgFilterDate(e.target.value);
                      setLgCurrentPage(1);
                    }}
                    className="p-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 text-xs sm:text-sm outline-none cursor-pointer"
                  />
                  {lgFilterDate ? (
                    <button
                      type="button"
                      onClick={() => {
                        setLgFilterDate('');
                        setLgCurrentPage(1);
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors whitespace-nowrap"
                    >
                      전체 날짜 보기 ✕
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 font-medium">
                      (전체 날짜 표시 중)
                    </span>
                  )}
                </div>

                {/* 현재 필터링된 내역의 지출/수입 합계 요약 */}
                {(() => {
                  const filteredExpenseSum = filteredLedgerList
                    .filter((it) => it.scope === 'store')
                    .reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
                  const filteredIncomeSum = filteredLedgerList
                    .filter((it) => it.scope === 'income' || it.scope === 'side_income')
                    .reduce((acc, it) => acc + (Number(it.amount) || 0), 0);

                  return (
                    <div className="flex items-center gap-2 text-xs tabular-nums ml-auto shrink-0 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200">
                      <span className="text-gray-600 whitespace-nowrap">
                        {lgFilterDate ? `${lgFilterDate} 지출:` : '조회 지출:'}{' '}
                        <strong className="font-bold text-rose-600">
                          {formatNumber(filteredExpenseSum)}원
                        </strong>
                      </span>
                      {filteredIncomeSum > 0 && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="text-gray-600 whitespace-nowrap">
                            수입:{' '}
                            <strong className="font-bold text-emerald-600">
                              +{formatNumber(filteredIncomeSum)}원
                            </strong>
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              <input
                type="text"
                value={lgSearch}
                onChange={(e) => {
                  setLgSearch(e.target.value);
                  setLgCurrentPage(1);
                }}
                placeholder="적요, 항목명(예: 통신비, 식자재), 날짜 검색..."
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base sm:text-sm outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            {filteredLedgerList.length > 0 ? (
              (() => {
                const ITEMS_PER_PAGE = 10;
                const totalPages = Math.max(
                  1,
                  Math.ceil(filteredLedgerList.length / ITEMS_PER_PAGE)
                );
                const safePage = Math.min(lgCurrentPage, totalPages);
                const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
                const pagedItems = filteredLedgerList.slice(
                  startIndex,
                  startIndex + ITEMS_PER_PAGE
                );

                return (
                  <>
                    <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                      {pagedItems.map((item, idx) => {
                        const resolvedCat = resolveEntryCategory(item);
                        const catMeta = getLedgerCategoryMeta(resolvedCat);
                        const rowNumber = startIndex + idx + 1;
                        const isNewDateGroup =
                          idx === 0 || pagedItems[idx - 1].date !== item.date;
                        const dayItems = filteredLedgerList.filter(
                          (it) => it.date === item.date
                        );
                        const dayExpenseSum = dayItems
                          .filter((it) => it.scope === 'store')
                          .reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
                        const dayIncomeSum = dayItems
                          .filter((it) => it.scope === 'income' || it.scope === 'side_income')
                          .reduce((acc, it) => acc + (Number(it.amount) || 0), 0);

                        return (
                          <div key={item.id}>
                            {isNewDateGroup && (
                              <div className="bg-slate-50/90 px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2 border-b border-gray-100 text-[11px] sm:text-xs">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLgFilterDate(
                                      lgFilterDate === item.date ? '' : item.date
                                    );
                                    setLgCurrentPage(1);
                                  }}
                                  className="font-bold text-slate-700 hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
                                  title="클릭하면 이 날짜 내역만 모아봅니다"
                                >
                                  <span>📅 {item.date}</span>
                                  <span className="text-[10px] font-medium text-slate-400">
                                    ({dayItems.length}건 ·{' '}
                                    {lgFilterDate === item.date
                                      ? '전체보기'
                                      : '이 날짜만 보기'}
                                    )
                                  </span>
                                </button>
                                <div className="flex items-center gap-2 tabular-nums text-[11px]">
                                  {dayExpenseSum > 0 && (
                                    <span className="text-gray-500">
                                      지출{' '}
                                      <strong className="font-bold text-gray-800">
                                        {formatNumber(dayExpenseSum)}원
                                      </strong>
                                    </span>
                                  )}
                                  {dayIncomeSum > 0 && (
                                    <span className="text-emerald-700">
                                      수입{' '}
                                      <strong className="font-bold">
                                        +{formatNumber(dayIncomeSum)}원
                                      </strong>
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="px-2 sm:px-3.5 py-2.5 flex items-center justify-between gap-1 sm:gap-2 hover:bg-gray-50/80 transition-colors">
                              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
                                <span className="text-[11px] text-gray-400 min-w-[1rem] text-center shrink-0 tabular-nums">
                                  {rowNumber}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLgFilterDate(
                                      lgFilterDate === item.date ? '' : item.date
                                    );
                                    setLgCurrentPage(1);
                                  }}
                                  className="text-[11px] text-gray-500 hover:text-indigo-600 hover:underline shrink-0 tabular-nums whitespace-nowrap"
                                  title="이 날짜만 모아보기"
                                >
                                  {item.date.slice(5)}
                                </button>
                                <span
                                  className={`text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${
                                    item.scope === 'store'
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : item.scope === 'side_income'
                                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  {item.scope === 'store'
                                    ? '매장'
                                    : item.scope === 'side_income'
                                    ? '부수입'
                                    : '매장수입'}
                                </span>
                                {item.scope !== 'income' && item.scope !== 'side_income' && (
                                  <span
                                    className={`text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${
                                      item.costType === 'fixed'
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'bg-teal-50 text-teal-700'
                                    }`}
                                  >
                                    {item.costType === 'fixed' ? '고정' : '변동'}
                                  </span>
                                )}
                                <span
                                  className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border shrink-0 whitespace-nowrap ${catMeta.badgeClass}`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${catMeta.barClass}`}
                                  />
                                  {catMeta.name}
                                </span>
                                <span className="text-xs sm:text-sm font-normal text-gray-800 truncate min-w-0">
                                  {item.description}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                <span
                                  className={`text-xs sm:text-sm font-medium tabular-nums whitespace-nowrap ${
                                    item.scope === 'income' || item.scope === 'side_income'
                                      ? 'text-emerald-600'
                                      : 'text-gray-800'
                                  }`}
                                >
                                  {item.scope === 'income' || item.scope === 'side_income'
                                    ? '+'
                                    : ''}
                                  {formatNumber(item.amount)}원
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleEditLedger(item)}
                                    className="text-[11px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md whitespace-nowrap"
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLedger(item.id)}
                                    className="text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md whitespace-nowrap"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 페이지네이션 */}
                    {totalPages > 1 &&
                      (() => {
                        const pageBlockSize = 5;
                        const currentBlock = Math.floor((safePage - 1) / pageBlockSize);
                        const startPage = currentBlock * pageBlockSize + 1;
                        const endPage = Math.min(
                          totalPages,
                          startPage + pageBlockSize - 1
                        );
                        const visiblePages = Array.from(
                          { length: endPage - startPage + 1 },
                          (_, i) => startPage + i
                        );

                        return (
                          <div className="mt-4 flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setLgCurrentPage(1)}
                              disabled={safePage === 1}
                              className="px-2 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                            >
                              « 처음
                            </button>
                            <button
                              type="button"
                              onClick={() => setLgCurrentPage((p) => Math.max(1, p - 1))}
                              disabled={safePage === 1}
                              className="px-2 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                            >
                              ‹ 이전
                            </button>
                            {visiblePages.map((pageNum) => (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setLgCurrentPage(pageNum)}
                                className={`w-8 h-8 rounded-lg text-xs transition-colors tabular-nums ${
                                  safePage === pageNum
                                    ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-500 font-bold'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 font-medium'
                                }`}
                              >
                                {pageNum}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setLgCurrentPage((p) => Math.min(totalPages, p + 1))
                              }
                              disabled={safePage === totalPages}
                              className="px-2 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                            >
                              다음 ›
                            </button>
                            <button
                              type="button"
                              onClick={() => setLgCurrentPage(totalPages)}
                              disabled={safePage === totalPages}
                              className="px-2 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                            >
                              끝 »
                            </button>
                          </div>
                        );
                      })()}
                  </>
                );
              })()
            ) : (
              <div className="py-10 text-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <div className="text-2xl mb-1">📒</div>
                <div className="text-xs sm:text-sm font-normal">
                  아직 입력된 본점 장부 내역이 없습니다. 위 입력창에서 첫 내역을 기록해보세요!
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ==================== [오른쪽 50%] 장부 보기 화면 (요약 대시보드 + 항목별 집계) ==================== */}
        <div className="space-y-5 min-w-0">
          {/* 1. 본점 지출 · 수입 토탈 요약 대시보드 */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-bold px-3 py-1.5 rounded-full border border-indigo-200 outline-none cursor-pointer"
                  >
                    <option value="all">전체 누적 결산 (전체 기간)</option>
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m.split('-')[0]}년 {Number(m.split('-')[1])}월 결산
                      </option>
                    ))}
                  </select>
                </div>
                <h2 className="text-base sm:text-xl font-bold text-gray-900 mt-1.5 break-keep tracking-tight">
                  본점 지출 · 수입 토탈 현황
                </h2>
              </div>
              <div className="text-right ml-auto">
                <div className="text-xs font-medium text-gray-400">본점 총 지출 합계</div>
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
                  전체 지출{' '}
                  <span className="tabular-nums font-semibold">
                    {formatNumber(summary.totalExpense)}원
                  </span>
                  에서 물품 매입대금(
                  <span className="tabular-nums font-semibold text-blue-700">
                    {formatNumber(summary.purchaseTotal)}원
                  </span>
                  )을 뺀 금액
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
                    매장 수입{' '}
                    <strong className="font-bold text-emerald-700 tabular-nums">
                      {formatNumber(summary.storeIncomeTotal)}원
                    </strong>
                  </span>
                  {summary.sideIncomeTotal > 0 && (
                    <>
                      <span className="text-gray-400">+</span>
                      <span className="whitespace-nowrap">
                        부수입{' '}
                        <strong className="font-bold text-purple-700 tabular-nums">
                          {formatNumber(summary.sideIncomeTotal)}원
                        </strong>
                      </span>
                    </>
                  )}
                  <span className="text-gray-400">−</span>
                  <span className="whitespace-nowrap">
                    총 지출{' '}
                    <strong className="font-bold text-rose-600 tabular-nums">
                      {formatNumber(summary.totalExpense)}원
                    </strong>
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

            {/* 고정 지출 vs 변동 지출 2단 카드 (클릭 시 고정/변동 필터링) */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCostFilter(costFilter === 'fixed' ? 'all' : 'fixed')}
                className={`text-left p-3.5 sm:p-4 rounded-2xl border-2 transition-all ${
                  costFilter === 'fixed'
                    ? 'bg-indigo-50 border-indigo-500 shadow-xs'
                    : 'bg-white border-gray-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs sm:text-sm font-bold text-indigo-700 whitespace-nowrap">
                    고정 지출
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-full tabular-nums">
                    {summary.totalExpense > 0
                      ? `${Math.round((summary.storeFixed / summary.totalExpense) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="mt-1.5 text-base sm:text-xl font-bold text-indigo-700 tabular-nums">
                  {formatNumber(summary.storeFixed)}
                  <span className="text-xs font-normal text-gray-500 ml-1">원</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCostFilter(costFilter === 'variable' ? 'all' : 'variable')}
                className={`text-left p-3.5 sm:p-4 rounded-2xl border-2 transition-all ${
                  costFilter === 'variable'
                    ? 'bg-teal-50 border-teal-500 shadow-xs'
                    : 'bg-white border-gray-200 hover:border-teal-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs sm:text-sm font-bold text-teal-700 whitespace-nowrap">
                    변동 지출
                  </span>
                  <span className="text-[11px] font-semibold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-full tabular-nums">
                    {summary.totalExpense > 0
                      ? `${Math.round((summary.storeVariable / summary.totalExpense) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="mt-1.5 text-base sm:text-xl font-bold text-teal-700 tabular-nums">
                  {formatNumber(summary.storeVariable)}
                  <span className="text-xs font-normal text-gray-500 ml-1">원</span>
                </div>
              </button>
            </div>

            {/* 전체 고정지출 vs 변동지출 vs 매입대금 요약 바 */}
            <div className="bg-gray-50 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-gray-600 border border-gray-100">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-indigo-700 whitespace-nowrap">
                  총 고정:{' '}
                  <strong className="tabular-nums font-semibold">
                    {formatNumber(summary.storeFixed)}원
                  </strong>
                </span>
                <span className="text-gray-300">|</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 whitespace-nowrap">
                  총 변동:{' '}
                  <strong className="tabular-nums font-semibold">
                    {formatNumber(summary.storeVariable)}원
                  </strong>
                </span>
                <span className="text-gray-300">|</span>
                <span className="inline-flex items-center gap-1 text-blue-700 whitespace-nowrap">
                  매입대금:{' '}
                  <strong className="tabular-nums font-semibold">
                    {formatNumber(summary.purchaseTotal)}원
                  </strong>
                </span>
              </div>
            </div>
          </section>

          {/* 2. 고정/변동 필터 & 항목 빠른 검색 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                {[
                  {
                    key: 'all',
                    label: '전체 지출 항목',
                    activeClass:
                      'bg-indigo-50 text-indigo-700 border-2 border-indigo-500 font-bold',
                  },
                  {
                    key: 'fixed',
                    label: '고정만',
                    activeClass:
                      'bg-indigo-50 text-indigo-700 border-2 border-indigo-500 font-bold',
                  },
                  {
                    key: 'variable',
                    label: '변동만',
                    activeClass:
                      'bg-teal-50 text-teal-700 border-2 border-teal-500 font-bold',
                  },
                ].map((cf) => (
                  <button
                    key={cf.key}
                    type="button"
                    onClick={() => setCostFilter(cf.key as 'all' | 'fixed' | 'variable')}
                    className={`px-3 py-2 rounded-xl text-xs transition-colors whitespace-nowrap ${
                      costFilter === cf.key
                        ? cf.activeClass
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 font-medium'
                    }`}
                  >
                    {cf.label}
                  </button>
                ))}
              </div>

              {categoryGroups.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllCategories}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  {allExpanded ? '전체 접기 ▲' : '전체 펼치기 ▼'}
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={viewSearchQuery}
                onChange={(e) => setViewSearchQuery(e.target.value)}
                placeholder="장부 항목명(예: 통신비, 매입) 또는 적요 검색..."
                className="w-full pl-4 pr-16 py-2.5 bg-white border border-gray-200 rounded-2xl text-base sm:text-sm font-normal text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
              />
              {viewSearchQuery && (
                <button
                  type="button"
                  onClick={() => setViewSearchQuery('')}
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
                항목을 누르면 세부 지출 내역이 펼쳐집니다
              </div>
              <div className="text-xs font-medium text-gray-500 tabular-nums flex items-center gap-2 flex-wrap">
                <span className="whitespace-nowrap">
                  표시 합계: {formatNumber(currentViewTotal)}원
                </span>
                <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/70 font-semibold whitespace-nowrap">
                  매입 제외: {formatNumber(currentViewTotalWithoutPurchase)}원
                </span>
              </div>
            </div>

            {initialLoading ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 text-sm font-medium">
                본점 장부 데이터를 불러오는 중...
              </div>
            ) : categoryGroups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center space-y-2">
                <div className="text-sm font-semibold text-gray-500">
                  아직 표시할 본점 지출 내역이 없습니다.
                </div>
                <p className="text-xs text-gray-400 break-keep">
                  왼쪽 입력 화면에서 날짜·금액·적요를 기록하면 이곳에 항목별로 자동 집계됩니다.
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
                      {/* 항목 요약 헤더 */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(group.category)}
                        className="w-full bg-white p-4 text-left hover:bg-gray-50/80 transition-colors flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${meta.barClass}`}
                              />
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
                              {group.fixedTotal > 0 && (
                                <span className="whitespace-nowrap tabular-nums">
                                  고정 {formatNumber(group.fixedTotal)}원
                                </span>
                              )}
                              {group.variableTotal > 0 && (
                                <span className="whitespace-nowrap tabular-nums">
                                  변동 {formatNumber(group.variableTotal)}원
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <div className="text-base sm:text-lg font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                                {formatNumber(group.total)}
                                <span className="text-xs font-normal text-gray-500 ml-0.5">
                                  원
                                </span>
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
                              className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm"
                            >
                              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                                <span className="tabular-nums text-gray-400 text-[11px] sm:text-xs shrink-0 whitespace-nowrap">
                                  {item.date}
                                </span>
                                <span className="text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200 shrink-0 whitespace-nowrap">
                                  매장
                                </span>
                                <span
                                  className={`text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap ${
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

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="tabular-nums font-medium text-gray-800 text-right whitespace-nowrap">
                                  {formatNumber(item.amount)}원
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleEditLedger(item)}
                                  className="text-[11px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded whitespace-nowrap"
                                >
                                  수정
                                </button>
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
        </div>
      </div>
    </div>
  );
}
