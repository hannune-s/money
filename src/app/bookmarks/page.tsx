"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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

const BOOKMARK_STORAGE_DATE = '1970-01-04';

const formatExternalUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '#';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export default function BookmarksSharePage() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');

  const loadBookmarks = async () => {
    try {
      const { data, error } = await supabase
        .from('money_finances')
        .select('memo')
        .eq('target_date', BOOKMARK_STORAGE_DATE)
        .single();

      if (!error && data && data.memo) {
        const parsed = JSON.parse(data.memo);
        if (Array.isArray(parsed)) {
          setBookmarks(parsed);
          setLoading(false);
          return;
        }
      }

      const local = localStorage.getItem('money_bookmarks');
      if (local) {
        setBookmarks(JSON.parse(local));
      }
    } catch (e) {
      console.error('Failed to load bookmarks:', e);
      const local = localStorage.getItem('money_bookmarks');
      if (local) {
        setBookmarks(JSON.parse(local));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookmarks();

    const channel = supabase
      .channel('bookmarks-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'money_finances' },
        (payload) => {
          if (payload.new && (payload.new as any).target_date === BOOKMARK_STORAGE_DATE) {
            loadBookmarks();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const allCategories = [
    ...DEFAULT_BOOKMARK_CATEGORIES.map((c) => c.name),
    ...Array.from(
      new Set(
        bookmarks
          .map((item) => getBookmarkCategory(item))
          .filter((cat) => !DEFAULT_BOOKMARK_CATEGORIES.some((d) => d.name === cat))
      )
    ),
  ];

  const filteredBookmarks = bookmarks.filter((item) => {
    const itemCat = getBookmarkCategory(item);
    if (selectedCategory !== '전체' && itemCat !== selectedCategory) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q) ||
      itemCat.toLowerCase().includes(q) ||
      (item.note && item.note.toLowerCase().includes(q))
    );
  });

  return (
    <main className="min-h-screen bg-gray-50 py-5 px-3 sm:px-5 font-sans">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* 상단 헤더 + 카테고리 필터 탭 */}
        <div className="bg-white rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 shadow-sm border border-gray-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-amber-50 text-amber-600 text-lg shrink-0 border border-amber-100">
                🔖
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight leading-tight">
                  공유 북마크 모음
                </h1>
                <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
                  자주 쓰는 사이트를 클릭하면 바로 이동합니다 ({filteredBookmarks.length}개)
                </p>
              </div>
            </div>

            {/* 검색창 */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="사이트명, 분류, 주소, 비고 검색..."
                className="w-full pl-8 pr-7 py-2 bg-gray-100 text-gray-800 rounded-xl text-xs sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
              />
              <span className="absolute left-2.5 top-2 text-gray-400 text-sm">🔍</span>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 font-bold text-xs"
                  aria-label="검색어 지우기"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 분류 탭 */}
          <div className="flex flex-wrap gap-1.5 pt-2.5 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setSelectedCategory('전체')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedCategory === '전체'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              전체 ({bookmarks.length})
            </button>
            {allCategories.map((catName) => {
              const count = bookmarks.filter((b) => getBookmarkCategory(b) === catName).length;
              if (count === 0) return null;
              const meta = getCategoryMeta(catName);
              const isActive = selectedCategory === catName;
              return (
                <button
                  key={catName}
                  type="button"
                  onClick={() => setSelectedCategory(catName)}
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

        {/* 분류별 북마크 리스트 (1줄에 2~3개 컴팩트 그리드) */}
        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-gray-100 shadow-sm">
            <div className="animate-spin inline-block w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full mb-2"></div>
            <p className="text-xs sm:text-sm font-medium">북마크 목록을 불러오는 중입니다...</p>
          </div>
        ) : filteredBookmarks.length > 0 ? (
          <div className="space-y-4">
            {allCategories.map((catName) => {
              const itemsInCat = filteredBookmarks.filter(
                (item) => getBookmarkCategory(item) === catName
              );
              if (itemsInCat.length === 0) return null;
              const meta = getCategoryMeta(catName);

              return (
                <section key={catName} className="space-y-2">
                  {/* 분류 섹션 헤더 */}
                  <div className="flex items-center gap-2 px-1">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${meta.badgeClass}`}>
                      <span>{meta.icon}</span>
                      <span>{catName}</span>
                    </span>
                    <span className="text-xs font-bold text-gray-400">{itemsInCat.length}개</span>
                  </div>

                  {/* 해당 분류의 카드 그리드 (모바일 1줄 2개, PC 1줄 3개) */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
                    {itemsInCat.map((item) => {
                      const targetUrl = formatExternalUrl(item.url);
                      return (
                        <a
                          key={item.id}
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col justify-between bg-white hover:bg-amber-50/40 rounded-xl p-2.5 sm:px-3.5 sm:py-2.5 shadow-xs border border-gray-200 hover:border-amber-300 transition-all group min-w-0"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[13px] sm:text-[15px] font-extrabold text-gray-900 group-hover:text-amber-700 transition-colors truncate">
                                {item.title}
                              </span>
                              <span className="shrink-0 flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white font-extrabold text-[11px] sm:text-xs transition-colors">
                                ↗
                              </span>
                            </div>

                            {item.note && (
                              <p className="text-[11px] sm:text-xs text-gray-600 mt-1 line-clamp-1 bg-gray-50 group-hover:bg-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-gray-100">
                                {item.note}
                              </p>
                            )}
                          </div>

                          <p className="text-[10px] sm:text-[11px] text-blue-500 font-mono truncate mt-1.5 opacity-80 group-hover:opacity-100">
                            🔗 {item.url}
                          </p>
                        </a>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400 border border-gray-100 shadow-sm">
            <div className="text-2xl mb-1.5">📭</div>
            <p className="text-xs sm:text-sm font-semibold">
              {searchTerm ? `'${searchTerm}'에 해당하는 북마크가 없습니다.` : '아직 등록된 북마크가 없습니다.'}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
