"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export const DIARY_STORAGE_DATE = '1970-01-11';

export type DiaryMoodTag = '중요 기록' | '업무·매장' | '약속·계약' | '기억할 일' | '소소한 일상';
export type DiaryFontStyle = 'pen_night' | 'pen_kyobo' | 'pen_maru';

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  tag: DiaryMoodTag;
  title: string;
  content: string;
  isImportant?: boolean;
  createdAt: string;
}

export const DIARY_TAGS: {
  name: DiaryMoodTag;
  label: string;
}[] = [
  { name: '중요 기록', label: '중요 기록' },
  { name: '업무·매장', label: '업무 · 매장' },
  { name: '약속·계약', label: '약속 · 계약' },
  { name: '기억할 일', label: '기억할 일' },
  { name: '소소한 일상', label: '소소한 일상' },
];

export const DIARY_FONTS: {
  key: DiaryFontStyle;
  label: string;
  fontFamily: string;
}[] = [
  {
    key: 'pen_night',
    label: '고운밤 펜글씨',
    fontFamily: "'Cafe24Oneprettynight', 'Gowun Batang', serif",
  },
  {
    key: 'pen_kyobo',
    label: '만년필 손글씨',
    fontFamily: "'KyoboHand', 'Cafe24Oneprettynight', serif",
  },
  {
    key: 'pen_maru',
    label: '가는 명조체',
    fontFamily: "'MaruBuriLight', 'Gowun Batang', serif",
  },
];

interface DailyDiarySectionProps {
  onEntryCountChange?: (count: number) => void;
}

export default function DailyDiarySection({ onEntryCountChange }: DailyDiarySectionProps) {
  const getKstDate = () => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split('T')[0];
  };

  const formatDotDate = (dateStr: string) => {
    if (!dateStr || dateStr.length < 10) return dateStr;
    const [y, m, d] = dateStr.split('-');
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[dt.getDay()] || '';
    return `${y}. ${m}. ${d} (${dayName})`;
  };

  const getKoreanDateLabel = (dateStr: string) => {
    if (!dateStr || dateStr.length < 10) return dateStr;
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const dayName = days[dt.getDay()] || '';
    return `${y}년 ${m}월 ${d}일 ${dayName}`;
  };

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fontStyle, setFontStyle] = useState<DiaryFontStyle>('pen_night');

  // 입력 폼 상태
  const [diaryDate, setDiaryDate] = useState(getKstDate());
  const [diaryTag, setDiaryTag] = useState<DiaryMoodTag>('중요 기록');
  const [diaryTitle, setDiaryTitle] = useState('');
  const [diaryContent, setDiaryContent] = useState('');
  const [diaryImportant, setDiaryImportant] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 검색, 필터, 펼침 및 페이지네이션 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterTag, setFilterTag] = useState<'all' | DiaryMoodTag>('all');
  const [onlyImportant, setOnlyImportant] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    try {
      const savedFont = localStorage.getItem('money_diary_font_style') as DiaryFontStyle | null;
      if (savedFont && DIARY_FONTS.some((f) => f.key === savedFont)) {
        setFontStyle(savedFont);
      }
    } catch {}
  }, []);

  const handleSelectFont = (nextFont: DiaryFontStyle) => {
    setFontStyle(nextFont);
    try {
      localStorage.setItem('money_diary_font_style', nextFont);
    } catch {}
  };

  const currentFontFamily =
    DIARY_FONTS.find((f) => f.key === fontStyle)?.fontFamily || DIARY_FONTS[0].fontFamily;

  useEffect(() => {
    onEntryCountChange?.(entries.length);
  }, [entries.length, onEntryCountChange]);

  const saveEntriesToDb = async (updated: DiaryEntry[]) => {
    setEntries(updated);
    localStorage.setItem('money_daily_diary_entries', JSON.stringify(updated));
    setSaving(true);
    try {
      const { error } = await supabase.from('money_finances').upsert(
        {
          target_date: DIARY_STORAGE_DATE,
          accounts: [],
          expenditures: [],
          total_account_balance: 0,
          total_expenditure: 0,
          final_balance: 0,
          memo: JSON.stringify(updated),
        },
        { onConflict: 'target_date' }
      );
      if (error) {
        console.error('Failed to sync diary entries to DB:', error);
      }
    } catch (e) {
      console.error('Failed to sync diary entries:', e);
    } finally {
      setSaving(false);
    }
  };

  const loadDiaryEntries = async () => {
    let localEntries: DiaryEntry[] = [];
    try {
      const raw = localStorage.getItem('money_daily_diary_entries');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localEntries = parsed;
          setEntries(parsed);
          setLoading(false);
        }
      }
    } catch {
      // ignore
    }

    try {
      const { data } = await supabase
        .from('money_finances')
        .select('memo')
        .eq('target_date', DIARY_STORAGE_DATE)
        .maybeSingle();

      let dbEntries: DiaryEntry[] = [];
      if (data?.memo) {
        const parsed = JSON.parse(data.memo);
        if (Array.isArray(parsed)) {
          dbEntries = parsed;
        }
      }

      if (localEntries.length > 0 && dbEntries.length === 0) {
        setEntries(localEntries);
        await saveEntriesToDb(localEntries);
      } else if (dbEntries.length > 0) {
        const mapById = new Map<string, DiaryEntry>();
        dbEntries.forEach((item) => mapById.set(item.id, item));
        let hasLocalOnly = false;
        localEntries.forEach((item) => {
          if (!mapById.has(item.id)) {
            mapById.set(item.id, item);
            hasLocalOnly = true;
          }
        });
        const merged = Array.from(mapById.values()).sort((a, b) =>
          b.date.localeCompare(a.date)
        );
        setEntries(merged);
        localStorage.setItem('money_daily_diary_entries', JSON.stringify(merged));
        if (hasLocalOnly) {
          await saveEntriesToDb(merged);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiaryEntries();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setDiaryDate(getKstDate());
    setDiaryTag('중요 기록');
    setDiaryTitle('');
    setDiaryContent('');
    setDiaryImportant(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diaryContent.trim() && !diaryTitle.trim()) {
      alert('기록할 내용을 입력해 주세요.');
      return;
    }

    const finalContent = diaryContent.trim() || diaryTitle.trim();
    const autoTitle =
      diaryTitle.trim() ||
      finalContent.split('\n')[0].slice(0, 42) ||
      `${formatDotDate(diaryDate)}의 기록`;

    let updated: DiaryEntry[];
    if (editingId) {
      updated = entries.map((item) =>
        item.id === editingId
          ? {
              ...item,
              date: diaryDate,
              tag: diaryTag,
              title: autoTitle,
              content: finalContent,
              isImportant: diaryImportant,
            }
          : item
      );
    } else {
      const newEntry: DiaryEntry = {
        id: Date.now().toString(),
        date: diaryDate,
        tag: diaryTag,
        title: autoTitle,
        content: finalContent,
        isImportant: diaryImportant,
        createdAt: new Date().toISOString(),
      };
      updated = [newEntry, ...entries];
    }

    updated.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    await saveEntriesToDb(updated);
    resetForm();
  };

  const handleEdit = (item: DiaryEntry) => {
    setEditingId(item.id);
    setDiaryDate(item.date);
    setDiaryTag(item.tag || '중요 기록');
    setDiaryTitle(item.title || '');
    setDiaryContent(item.content || '');
    setDiaryImportant(!!item.isImportant);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    const updated = entries.filter((item) => item.id !== id);
    await saveEntriesToDb(updated);
    if (editingId === id) resetForm();
  };

  const toggleImportant = async (id: string) => {
    const updated = entries.map((item) =>
      item.id === id ? { ...item, isImportant: !item.isImportant } : item
    );
    await saveEntriesToDb(updated);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 월 목록 추출
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.date && e.date.length >= 7) {
        set.add(e.date.slice(0, 7));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  // 검색 및 필터 적용
  const filteredEntries = useMemo(() => {
    const list = entries.filter((item) => {
      if (selectedMonth !== 'all' && !item.date.startsWith(selectedMonth)) return false;
      if (filterDate && item.date !== filterDate) return false;
      if (filterTag !== 'all' && item.tag !== filterTag) return false;
      if (onlyImportant && !item.isImportant) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const inTitle = (item.title || '').toLowerCase().includes(q);
        const inContent = (item.content || '').toLowerCase().includes(q);
        const inDate = (item.date || '').includes(q);
        const inTag = (item.tag || '').toLowerCase().includes(q);
        return inTitle || inContent || inDate || inTag;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const cmp =
        sortOrder === 'desc'
          ? b.date.localeCompare(a.date)
          : a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return sortOrder === 'desc'
        ? (b.createdAt || '').localeCompare(a.createdAt || '')
        : (a.createdAt || '').localeCompare(b.createdAt || '');
    });
  }, [entries, selectedMonth, filterDate, filterTag, onlyImportant, searchQuery, sortOrder]);

  // 검색어 하이라이트
  const renderHighlightedText = (text: string) => {
    const q = searchQuery.trim();
    if (!q) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, idx) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark
          key={idx}
          className="bg-[#E8DEC9] text-[#1C1612] px-1.5 py-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const escapeHtml = (str: string) =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // ==================== A4 종이 보관용 인쇄 ====================
  const openPrintWindow = (targetItems: DiaryEntry[], printTitle: string, subtitle: string) => {
    if (targetItems.length === 0) {
      alert('인쇄할 기록 내역이 없습니다.');
      return;
    }

    const nowStr = getKstDate();

    const dateGroups: { date: string; items: DiaryEntry[] }[] = [];
    targetItems.forEach((it) => {
      const last = dateGroups[dateGroups.length - 1];
      if (last && last.date === it.date) {
        last.items.push(it);
      } else {
        dateGroups.push({ date: it.date, items: [it] });
      }
    });

    const dateSectionsHtml = dateGroups
      .map((group) => {
        const dateLabel = getKoreanDateLabel(group.date);
        const rowsHtml = group.items
          .map((item) => {
            const showSeparateTitle =
              item.title && item.title.trim() !== item.content.trim().split('\n')[0].trim();
            return `
              <div class="entry-box">
                <div class="entry-header">
                  <div class="entry-title-wrap">
                    <span class="tag-badge">${escapeHtml(item.tag)}</span>
                    ${item.isImportant ? '<span class="imp-badge">★ 중요</span>' : ''}
                    ${showSeparateTitle ? `<span class="entry-title">${escapeHtml(item.title)}</span>` : ''}
                  </div>
                </div>
                <div class="entry-content">${escapeHtml(item.content)}</div>
              </div>
            `;
          })
          .join('');

        return `
          <div class="date-card">
            <div class="date-header">
              <div class="date-title">${escapeHtml(dateLabel)}</div>
              <div class="date-count">${group.items.length}건</div>
            </div>
            <div class="date-body">
              ${rowsHtml}
            </div>
          </div>
        `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(printTitle)}</title>
  <style>
    @font-face {
      font-family: 'Cafe24Oneprettynight';
      src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.1/Cafe24Oneprettynight.woff') format('woff');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'KyoboHand';
      src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-04@1.0/KyoboHand.woff') format('woff');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'MaruBuriLight';
      src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-10-21@1.0/MaruBuri-Regular.woff') format('woff');
      font-weight: normal;
      font-style: normal;
    }
    @page { size: A4 portrait; margin: 15mm 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: ${currentFontFamily};
      color: #352E28;
      margin: 0;
      padding: 0;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print {
      background: #F7F2E9;
      border-bottom: 1px solid #E3D9C8;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .no-print-btns { display: flex; gap: 8px; }
    .btn-print {
      background: #E8DEC9;
      color: #2F2720;
      border: 1px solid #B8A68E;
      padding: 8px 18px;
      border-radius: 999px;
      font-weight: 600;
      font-size: 12.5px;
      cursor: pointer;
    }
    .btn-close {
      background: #FAF6F0;
      color: #5A5046;
      border: 1px solid #D6CBB9;
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 12.5px;
      cursor: pointer;
    }
    @media print { .no-print { display: none !important; } }
    .doc-container { max-width: 740px; margin: 0 auto; padding: 12px 6px; }
    .doc-header {
      border-bottom: 1px solid #D5C7B2;
      padding-bottom: 14px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .doc-kicker {
      font-size: 10px;
      letter-spacing: 0.24em;
      color: #8C7F70;
      margin-bottom: 6px;
    }
    .doc-title {
      font-size: 21px;
      font-weight: 400;
      color: #2B2520;
      margin: 0 0 4px 0;
      letter-spacing: 0.12em;
    }
    .doc-subtitle { font-size: 11.5px; color: #786B5D; margin: 0; letter-spacing: 0.04em; }
    .doc-meta { text-align: right; font-size: 11px; color: #786B5D; line-height: 1.6; }
    .date-card {
      border: 1px solid #D4C5B0;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
      page-break-inside: avoid;
      background: #FDFBF7;
    }
    .date-header {
      background: #F7F2E9;
      border-bottom: 1px solid #EAE0D0;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .date-title { font-size: 13.5px; font-weight: 400; color: #2C241D; letter-spacing: 0.08em; }
    .date-count { font-size: 11px; color: #7A6F63; }
    .date-body { padding: 14px 18px; background: #FDFBF7; }
    .entry-box { padding: 10px 0; border-bottom: 1px solid #EAE0D0; }
    .entry-box:last-child { border-bottom: none; padding-bottom: 2px; }
    .entry-box:first-child { padding-top: 2px; }
    .entry-header { margin-bottom: 6px; }
    .entry-title-wrap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .tag-badge {
      font-size: 10.5px;
      background: #F7F2E9;
      color: #6E6256;
      border: 1px solid #D6CBB9;
      padding: 1px 9px;
      border-radius: 999px;
    }
    .imp-badge {
      font-size: 10.5px;
      background: #E8DEC9;
      color: #2F2720;
      border: 1px solid #B8A68E;
      padding: 1px 8px;
      border-radius: 999px;
    }
    .entry-title { font-size: 13.5px; font-weight: 400; color: #2C241D; letter-spacing: 0.04em; }
    .entry-content {
      font-size: 13px;
      line-height: 2.0;
      letter-spacing: 0.03em;
      color: #3E3630;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .doc-footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #E2D8C7;
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      color: #8C7F70;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div style="font-size:12.5px;color:#2C241D;">
      종이 보관용 인쇄 미리보기 (총 ${dateGroups.length}일 · ${targetItems.length}건)
    </div>
    <div class="no-print-btns">
      <button class="btn-print" onclick="window.print()">🖨️ 지금 인쇄하기</button>
      <button class="btn-close" onclick="window.close()">닫기</button>
    </div>
  </div>
  <div class="doc-container">
    <div class="doc-header">
      <div>
        <div class="doc-kicker">MY RECORDS &amp; ARCHIVE</div>
        <h1 class="doc-title">${escapeHtml(printTitle)}</h1>
        <p class="doc-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <div class="doc-meta">
        <div>출력일 : ${nowStr}</div>
        <div>수록 : 총 ${dateGroups.length}일 (${targetItems.length}건)</div>
      </div>
    </div>
    ${dateSectionsHtml}
    <div class="doc-footer">
      <span>나의 기록들 · 종이 보관용 문서</span>
      <span>${nowStr}</span>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=860,height=920,scrollbars=yes');
    if (!win) {
      alert('팝업 차단이 설정되어 있습니다. 브라우저에서 팝업을 허용해주세요.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const handlePrintSingleEntry = (item: DiaryEntry) => {
    openPrintWindow(
      [item],
      `나의 기록들 (${formatDotDate(item.date)})`,
      `[${item.tag}] ${item.title}`
    );
  };

  const handlePrintFiltered = () => {
    const descParts: string[] = [];
    if (selectedMonth !== 'all') descParts.push(`${selectedMonth}`);
    if (filterDate) descParts.push(`${filterDate}`);
    if (filterTag !== 'all') descParts.push(`${filterTag}`);
    if (onlyImportant) descParts.push('중요 기록만');
    if (searchQuery.trim()) descParts.push(`검색어 "${searchQuery.trim()}"`);

    const sub =
      descParts.length > 0
        ? `조회 조건 : ${descParts.join(' · ')}`
        : '날짜별 나의 기록들 전체 보관본';

    openPrintWindow(filteredEntries, '나의 기록들', sub);
  };

  // 페이지네이션 계산 (한 페이지에 12줄씩 심플 목차 표시)
  const ITEMS_PER_PAGE = 12;
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const pagedEntries = filteredEntries.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const allPagedExpanded =
    pagedEntries.length > 0 && pagedEntries.every((it) => !!expandedIds[it.id]);

  const toggleAllPaged = () => {
    if (allPagedExpanded) {
      const next = { ...expandedIds };
      pagedEntries.forEach((it) => {
        delete next[it.id];
      });
      setExpandedIds(next);
    } else {
      const next = { ...expandedIds };
      pagedEntries.forEach((it) => {
        next[it.id] = true;
      });
      setExpandedIds(next);
    }
  };

  return (
    <div
      className="space-y-7 text-[#352E28] selection:bg-[#DFD3C3]"
      style={{ fontFamily: currentFontFamily }}
    >
      {/* 얇고 감성적인 펜글씨 웹폰트 로드 */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Nanum+Myeongjo:wght@400;700&display=swap');
        @font-face {
          font-family: 'Cafe24Oneprettynight';
          src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.1/Cafe24Oneprettynight.woff') format('woff');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'KyoboHand';
          src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-04@1.0/KyoboHand.woff') format('woff');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'MaruBuriLight';
          src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-10-21@1.0/MaruBuri-Regular.woff') format('woff');
          font-weight: 300;
          font-style: normal;
          font-display: swap;
        }
      `}</style>

      {/* ==================== 상단 메인 카드 & 기록 입력 영역 ==================== */}
      <section className="relative rounded-2xl overflow-hidden bg-[#F7F2E9] border border-[#E3D9C8] px-5 py-7 sm:px-10 sm:py-9 shadow-[0_10px_30px_rgba(60,46,33,0.05)]">
        {/* 은은한 창살 & 햇살 나뭇잎 그림자 */}
        <div
          className="pointer-events-none absolute -top-6 -right-6 w-64 h-64 opacity-[0.09]"
          style={{
            background: 'radial-gradient(circle at 75% 25%, #5C4B3B 0%, transparent 65%)',
          }}
        />
        <svg
          className="pointer-events-none absolute top-0 right-0 w-56 h-56 text-[#4A3C2F] opacity-[0.08]"
          viewBox="0 0 200 200"
          fill="currentColor"
        >
          <path d="M90 0 L200 45 L200 52 L85 5 Z" />
          <path d="M110 0 L200 35 L200 40 L105 2 Z" />
          <path d="M70 15 L200 68 L200 74 L66 20 Z" />
          <path d="M140 0 L115 70 L121 72 L146 0 Z" />
          <path d="M170 0 L145 80 L151 82 L176 0 Z" />
          <path d="M120 75 Q140 85 155 110 Q135 100 120 75 Z" />
          <path d="M105 82 Q118 102 118 128 Q105 108 105 82 Z" />
          <path d="M135 68 Q162 72 182 90 Q155 86 135 68 Z" />
          <path d="M88 90 Q95 110 88 132 Q82 110 88 90 Z" />
        </svg>

        <div className="relative z-10">
          {/* 상단 타이틀 & 펜글씨체 선택 & 전체 인쇄 버튼 */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#E3D9C8]">
            <div>
              <p className="text-[11.5px] sm:text-xs text-[#8C7F70] tracking-[0.22em] mb-2 font-normal">
                매일의 중요한 순간을 차곡차곡 담아두는 곳
              </p>
              <h1
                className="text-[24px] sm:text-[31px] font-light text-[#1E1915] tracking-[0.16em] leading-snug"
                style={{ fontFamily: "'Gowun Batang', 'Nanum Myeongjo', serif" }}
              >
                나의 기록들
              </h1>
              <p
                className="text-[10.5px] sm:text-[11.5px] text-[#7A6F63] tracking-[0.32em] mt-1 uppercase font-light"
                style={{ fontFamily: "'Gowun Batang', 'Nanum Myeongjo', serif" }}
              >
                — M Y &nbsp; R E C O R D S
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2 shrink-0">
              {/* 펜글씨체 선택 스위치 */}
              <div className="flex items-center gap-1 bg-[#FAF6F0] p-1 rounded-full border border-[#DFD5C5]">
                <span className="text-[10.5px] text-[#8C7F70] pl-2.5 pr-1 tracking-[0.06em]">
                  글씨체
                </span>
                {DIARY_FONTS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => handleSelectFont(f.key)}
                    style={{ fontFamily: f.fontFamily }}
                    className={`px-2.5 py-1 rounded-full text-[11.5px] transition-colors whitespace-nowrap ${
                      fontStyle === f.key
                        ? 'bg-[#E8DEC9] text-[#2F2720] border border-[#B8A68E]'
                        : 'text-[#6E6358] hover:text-[#2F2720]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full border border-[#D6CBB9] bg-[#FAF6F0] text-[#5A5046] hover:border-[#8C7D6B] text-[11.5px] transition-colors"
                  >
                    수정 취소
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrintFiltered}
                  disabled={filteredEntries.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#B8A68E] bg-[#E8DEC9] hover:bg-[#DFD2BA] disabled:opacity-40 text-[#2F2720] text-[11.5px] transition-colors shadow-2xs cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>
                    {searchQuery.trim() ||
                    filterDate ||
                    selectedMonth !== 'all' ||
                    filterTag !== 'all' ||
                    onlyImportant
                      ? `조회 내역 인쇄 (${filteredEntries.length}건)`
                      : `전체 기록 인쇄 (${entries.length}건)`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 기록 작성 폼 */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            {/* 날짜 & 태그 스티커 & 중요 체크 */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={diaryDate}
                  onChange={(e) => setDiaryDate(e.target.value)}
                  className="px-3 py-1 bg-[#FDFBF7] border border-[#D4C5B0] rounded-full text-xs text-[#352E28] focus:border-[#8C7D6B] outline-none cursor-pointer shadow-2xs"
                />

                <div className="flex items-center gap-1.5 flex-wrap">
                  {DIARY_TAGS.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setDiaryTag(t.name)}
                      className={`px-3 py-1 rounded-full text-[11.5px] tracking-[0.04em] transition-colors whitespace-nowrap ${
                        diaryTag === t.name
                          ? 'border border-[#B8A68E] bg-[#E8DEC9] text-[#2F2720] shadow-2xs'
                          : 'border border-[#D6CBB9] bg-[#FAF6F0] text-[#6E6358] hover:border-[#8C7D6B]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDiaryImportant((prev) => !prev)}
                className={`px-3 py-1 rounded-full text-[11.5px] tracking-[0.04em] transition-colors flex items-center gap-1 whitespace-nowrap ${
                  diaryImportant
                    ? 'border border-[#B8A68E] bg-[#E8DEC9] text-[#2F2720] shadow-2xs'
                    : 'border border-[#D6CBB9] bg-[#FAF6F0] text-[#7A6F63] hover:border-[#8C7D6B]'
                }`}
              >
                <span>{diaryImportant ? '★' : '☆'}</span>
                <span>중요 기록</span>
              </button>
            </div>

            {/* 제목 입력 */}
            <div>
              <input
                type="text"
                value={diaryTitle}
                onChange={(e) => setDiaryTitle(e.target.value)}
                placeholder="목록에 표시될 짧은 제목 (비워두시면 본문 첫 줄이 제목이 됩니다)"
                className="w-full px-4 py-2.5 bg-[#FDFBF7] border border-[#D4C5B0] rounded-xl text-[13px] sm:text-[13.5px] font-normal text-[#352E28] placeholder:text-[#A6998A] tracking-[0.04em] focus:border-[#8C7D6B] outline-none shadow-2xs"
              />
            </div>

            {/* 본문 입력 */}
            <div>
              <textarea
                value={diaryContent}
                onChange={(e) => setDiaryContent(e.target.value)}
                rows={5}
                placeholder={`오늘 있었던 중요한 일이나 기억해 둘 약속을 일기처럼 편하게 적어주세요.\n단어 하나로 언제든 다시 검색해 찾고, 종이로 출력해 보관할 수 있습니다.`}
                className="w-full p-4 bg-[#FDFBF7] border border-[#D4C5B0] rounded-2xl text-[13px] sm:text-[13.5px] font-normal text-[#3E3630] placeholder:text-[#A6998A] leading-[1.95] tracking-[0.04em] resize-y focus:border-[#8C7D6B] outline-none shadow-2xs"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-7 py-2.5 rounded-full border border-[#B8A68E] bg-[#E8DEC9] hover:bg-[#DFD2BA] disabled:opacity-50 text-[#2F2720] text-[13px] tracking-[0.08em] transition-colors shadow-xs cursor-pointer"
              >
                {saving
                  ? '저장하는 중...'
                  : editingId
                  ? '수정한 기록 저장하기'
                  : '오늘의 기록 남기기'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ==================== 기록 목차 섹션 헤더 & 단어 검색 바 ==================== */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1 border-b border-[#D5C7B2] pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[13.5px] sm:text-[14.5px] text-[#2C241D] tracking-[0.14em] font-normal">
              소소한 기록 목차
            </h2>
            <span className="text-[11.5px] text-[#786B5D] tracking-[0.06em]">
              ({filteredEntries.length}건)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {pagedEntries.length > 0 && (
              <button
                type="button"
                onClick={toggleAllPaged}
                className="text-[11px] text-[#6E6358] hover:text-[#2C241D] px-2.5 py-0.5 rounded-full border border-[#D6CBB9] bg-[#FAF6F0] transition-colors"
              >
                {allPagedExpanded ? '내용 모두 접기 ▴' : '내용 모두 펼치기 ▾'}
              </button>
            )}
            <span className="text-[10px] text-[#786B5D] tracking-[0.18em] uppercase hidden sm:inline">
              MY ARCHIVE
            </span>
          </div>
        </div>

        {/* 단어 검색 & 날짜/분류 필터 카드 */}
        <div className="bg-[#F7F2E9] rounded-2xl border border-[#E3D9C8] p-3.5 sm:p-4 space-y-2.5 shadow-[0_6px_20px_rgba(60,46,33,0.03)]">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="찾고 싶은 단어를 입력하면 해당 기록의 내용까지 바로 펼쳐집니다 (예: 할부, 진공기, 치과...)"
              className="w-full pl-4 pr-20 py-2 bg-[#FDFBF7] border border-[#D4C5B0] rounded-full text-[12.5px] sm:text-[13px] text-[#352E28] placeholder:text-[#A6998A] tracking-[0.03em] focus:border-[#8C7D6B] outline-none shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#5A5046] bg-[#E8DEC9] hover:bg-[#DFD2BA] px-2.5 py-0.5 rounded-full border border-[#C5B59C]"
              >
                지우기 ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* 월별 / 특정일 필터 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setFilterDate('');
                  setCurrentPage(1);
                }}
                className="px-3 py-1 rounded-full border border-[#D6CBB9] bg-[#FAF6F0] text-[#5A5046] hover:border-[#8C7D6B] text-[11.5px] outline-none cursor-pointer"
              >
                <option value="all">전체 기간</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m.split('-')[0]}년 {Number(m.split('-')[1])}월
                  </option>
                ))}
              </select>

              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-[#D6CBB9] bg-[#FAF6F0] text-[11.5px] text-[#5A5046]">
                <span>날짜 선택:</span>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    if (e.target.value) setSelectedMonth('all');
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-[#2C241D] outline-none cursor-pointer"
                />
                {filterDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDate('');
                      setCurrentPage(1);
                    }}
                    className="text-[10.5px] text-[#2F2720] bg-[#E8DEC9] px-1.5 py-0.2 rounded-full"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setOnlyImportant((prev) => !prev);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-[11.5px] transition-colors ${
                  onlyImportant
                    ? 'border border-[#B8A68E] bg-[#E8DEC9] text-[#2F2720]'
                    : 'border border-[#D6CBB9] bg-[#FAF6F0] text-[#5A5046] hover:border-[#8C7D6B]'
                }`}
              >
                ★ 중요만
              </button>

              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                className="px-2.5 py-1 rounded-full border border-[#D6CBB9] bg-[#FAF6F0] text-[#5A5046] hover:border-[#8C7D6B] text-[11.5px] transition-colors"
              >
                {sortOrder === 'desc' ? '최신순 ↓' : '오래된순 ↑'}
              </button>
            </div>

            {/* 태그별 필터 */}
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setFilterTag('all');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-[11.5px] transition-colors ${
                  filterTag === 'all'
                    ? 'border border-[#B8A68E] bg-[#E8DEC9] text-[#2F2720]'
                    : 'border border-[#D6CBB9] bg-[#FAF6F0] text-[#5A5046] hover:border-[#8C7D6B]'
                }`}
              >
                전체
              </button>
              {DIARY_TAGS.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => {
                    setFilterTag(filterTag === t.name ? 'all' : t.name);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11.5px] transition-colors ${
                    filterTag === t.name
                      ? 'border border-[#B8A68E] bg-[#E8DEC9] text-[#2F2720]'
                      : 'border border-[#D6CBB9] bg-[#FAF6F0] text-[#5A5046] hover:border-[#8C7D6B]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== 심플 한 줄 목차 리스트 (클릭하거나 검색 시 본문 펼침) ==================== */}
      {loading ? (
        <div className="bg-[#F7F2E9] rounded-2xl p-10 text-center border border-[#E3D9C8] text-xs text-[#7A6F63] tracking-[0.08em]">
          기록을 불러오는 중입니다...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-[#F7F2E9] rounded-2xl p-10 text-center border border-[#E3D9C8]">
          <p className="text-[13px] text-[#4A3F35] tracking-[0.08em] mb-1">
            {searchQuery.trim() ||
            filterDate ||
            selectedMonth !== 'all' ||
            filterTag !== 'all' ||
            onlyImportant
              ? '찾으시는 조건에 맞는 기록이 없습니다.'
              : '첫 번째 이야기를 준비하고 있습니다.'}
          </p>
          <p className="text-[11.5px] text-[#8C7F70] leading-relaxed tracking-[0.04em]">
            {searchQuery.trim()
              ? '다른 단어로 검색해 보시거나 날짜 필터를 해제해 보세요.'
              : '매일의 정갈한 일상과 기억하고 싶은 중요한 순간들이 이곳에 담깁니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-[#FDFBF7] rounded-2xl overflow-hidden border border-[#D4C5B0] shadow-[0_6px_22px_rgba(55,42,28,0.05)] divide-y divide-[#EAE0D0]">
            {pagedEntries.map((item) => {
              // 검색어가 입력된 상태이거나 사용자가 클릭해 펼친 상태일 때만 본문 표시
              const isSearching = searchQuery.trim().length > 0;
              const isExpanded = isSearching || !!expandedIds[item.id];
              const urls = (item.content || '').match(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi);
              const displayTitle =
                item.title?.trim() ||
                item.content?.trim().split('\n')[0]?.slice(0, 45) ||
                `${formatDotDate(item.date)}의 기록`;

              return (
                <div key={item.id} className="transition-colors hover:bg-[#FAF6F0]/70">
                  {/* 심플 한 줄 목차 행 */}
                  <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleImportant(item.id)}
                        className={`text-xs leading-none shrink-0 ${
                          item.isImportant ? 'text-[#8C6D46]' : 'text-[#D4C5B0]'
                        }`}
                        title="중요 표시"
                      >
                        {item.isImportant ? '★' : '☆'}
                      </button>

                      {/* 날짜 + 분류 + 제목 클릭 시 본문 펼침/접기 */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 text-left group cursor-pointer"
                      >
                        <span className="text-[11.5px] sm:text-xs text-[#7A6F63] tracking-[0.06em] shrink-0 whitespace-nowrap">
                          {formatDotDate(item.date)}
                        </span>
                        <span className="text-[10.5px] px-2 py-0.5 rounded-full border border-[#DFD5C5] bg-[#F7F2E9] text-[#7A6F63] tracking-[0.03em] shrink-0 whitespace-nowrap">
                          {item.tag}
                        </span>
                        <span className="text-[13px] sm:text-[13.5px] text-[#2C241D] group-hover:text-[#6E5D4B] tracking-[0.04em] truncate min-w-0">
                          {renderHighlightedText(displayTitle)}
                        </span>
                        <span className="text-[10px] text-[#9E9080] shrink-0 ml-0.5">
                          {isExpanded ? '▴' : '▾'}
                        </span>
                      </button>
                    </div>

                    {/* 우측 액션 버튼 (인쇄 / 수정 / 삭제) */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePrintSingleEntry(item)}
                        className="px-2 py-0.5 rounded-full border border-[#D6CBB9] bg-[#FAF6F0] hover:bg-[#EFE7DA] text-[#6E6358] text-[10.5px] transition-colors whitespace-nowrap"
                        title="이 기록 종이 인쇄"
                      >
                        🖨️ 인쇄
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="px-2 py-0.5 rounded-full border border-[#D6CBB9] bg-[#FAF6F0] hover:bg-[#E8DEC9] text-[#4A3F35] text-[10.5px] transition-colors whitespace-nowrap"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="px-2 py-0.5 rounded-full border border-[#E6D2CC] bg-[#FDF9F8] hover:bg-[#F5E6E2] text-[#8C5347] text-[10.5px] transition-colors whitespace-nowrap"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {/* 클릭하거나 단어 검색 시 아래로 스르륵 펼쳐지는 본문 */}
                  {isExpanded && (
                    <div className="px-5 sm:px-11 pb-4 pt-1 bg-[#FAF6F0]/60 border-t border-[#F0E8DA]">
                      <p className="text-[13px] sm:text-[13.5px] text-[#3E3630] leading-[1.95] tracking-[0.04em] whitespace-pre-line font-normal break-keep">
                        {renderHighlightedText(item.content)}
                      </p>

                      {urls && urls.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-[#EAE0D0] flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-[#857768]">바로가기 :</span>
                          {Array.from(new Set(urls)).map((rawUrl, i) => {
                            const href = /^https?:\/\//i.test(rawUrl)
                              ? rawUrl
                              : `https://${rawUrl}`;
                            return (
                              <a
                                key={i}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11.5px] text-[#4A3F35] hover:text-[#1C1612] bg-[#F7F2E9] border border-[#D6CBB9] px-2.5 py-0.5 rounded-full underline underline-offset-2 break-all"
                              >
                                {rawUrl} ↗
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 페이지네이션 (기록이 많아져도 깔끔하게 페이지별로 이동) */}
          {totalPages > 1 &&
            (() => {
              const pageBlockSize = 5;
              const currentBlock = Math.floor((safePage - 1) / pageBlockSize);
              const startPage = currentBlock * pageBlockSize + 1;
              const endPage = Math.min(totalPages, startPage + pageBlockSize - 1);
              const visiblePages = Array.from(
                { length: endPage - startPage + 1 },
                (_, i) => startPage + i
              );

              return (
                <div className="flex items-center justify-center gap-1.5 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={safePage === 1}
                    className="px-2.5 py-1 rounded-full text-[11.5px] border border-[#D6CBB9] bg-[#FAF6F0] text-[#5A5046] hover:bg-[#E8DEC9] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    « 처음
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="px-2.5 py-1 rounded-full text-[11.5px] border border-[#D6CBB9] bg-[#FAF6F0] text-[#5A5046] hover:bg-[#E8DEC9] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    ‹ 이전
                  </button>
                  {visiblePages.map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-full text-xs transition-colors ${
                        safePage === pageNum
                          ? 'bg-[#E8DEC9] text-[#2F2720] border border-[#B8A68E]'
                          : 'bg-[#FAF6F0] text-[#6E6358] border border-[#D6CBB9] hover:bg-[#EFE7DA]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="px-2.5 py-1 rounded-full text-[11.5px] border border-[#D6CBB9] bg-[#FAF6F0] text-[#5A5046] hover:bg-[#E8DEC9] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    다음 ›
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safePage === totalPages}
                    className="px-2.5 py-1 rounded-full text-[11.5px] border border-[#D6CBB9] bg-[#FAF6F0] text-[#5A5046] hover:bg-[#E8DEC9] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    끝 »
                  </button>
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
}
