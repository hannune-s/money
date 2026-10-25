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
    <main className="min-h-screen bg-white sm:bg-gray-50/60 py-6 px-3 sm:px-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 상단 검색창 + 분류 탭 */}
        <div className="bg-white sm:rounded-2xl sm:px-5 sm:py-4 sm:shadow-xs sm:border sm:border-gray-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔖</span>
              <h1 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
                북마크
              </h1>
              <span className="text-xs font-semibold text-gray-400">
                {filteredBookmarks.length}
              </span>
            </div>

            {/* 크롬 스타일 둥근 검색바 */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="북마크 검색..."
                className="w-full pl-9 pr-8 py-2 bg-gray-100 hover:bg-gray-200/60 focus:bg-white text-gray-800 rounded-full text-xs sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 border border-transparent focus:border-amber-300 transition-all"
              />
              <span className="absolute left-3 top-2 text-gray-400 text-sm">🔍</span>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 font-bold text-xs"
                  aria-label="검색어 지우기"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 분류 탭 */}
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setSelectedCategory('전체')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
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
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
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

        {/* 크롬 새 탭 바로가기 스타일 아이콘 그리드 */}
        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <div className="animate-spin inline-block w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full mb-2"></div>
            <p className="text-xs sm:text-sm font-medium">북마크 불러오는 중...</p>
          </div>
        ) : filteredBookmarks.length > 0 ? (
          <div className="space-y-6">
            {allCategories.map((catName) => {
              const itemsInCat = filteredBookmarks.filter(
                (item) => getBookmarkCategory(item) === catName
              );
              if (itemsInCat.length === 0) return null;
              const meta = getCategoryMeta(catName);

              return (
                <section
                  key={catName}
                  className="bg-white rounded-2xl p-4 sm:p-5 sm:shadow-xs sm:border sm:border-gray-100"
                >
                  {/* 분류 섹션 헤더 */}
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${meta.badgeClass}`}>
                      <span>{meta.icon}</span>
                      <span>{catName}</span>
                    </span>
                    <span className="text-xs font-bold text-gray-400">{itemsInCat.length}</span>
                  </div>

                  {/* 크롬 바로가기 스타일 원형 아이콘 + 사이트명 그리드 */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
                    {itemsInCat.map((item) => {
                      const targetUrl = formatExternalUrl(item.url);
                      const faviconUrl = getFaviconUrl(item.url);
                      const firstLetter = (item.title || '?').trim().charAt(0).toUpperCase();

                      return (
                        <a
                          key={item.id}
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={item.note ? `${item.title} - ${item.note}` : item.title}
                          className="flex flex-col items-center justify-start p-2.5 sm:p-3 rounded-2xl hover:bg-gray-100/80 active:scale-95 transition-all group text-center min-w-0"
                        >
                          {/* 원형 아이콘 영역 (크롬 새 탭 스타일) */}
                          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-gray-100 group-hover:bg-white group-hover:shadow-sm border border-gray-200/60 flex items-center justify-center mb-2 transition-all overflow-hidden shrink-0">
                            {faviconUrl ? (
                              <img
                                src={faviconUrl}
                                alt={item.title}
                                className="w-6 h-6 sm:w-7 sm:h-7 object-contain rounded-xs"
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

                          {/* 사이트 이름 */}
                          <span className="text-xs sm:text-[13px] font-medium text-gray-800 group-hover:text-black truncate w-full px-0.5">
                            {item.title}
                          </span>

                          {/* 비고 (있을 경우에만 작고 은은하게 표시) */}
                          {item.note && (
                            <span className="text-[10px] text-gray-400 truncate w-full mt-0.5 px-0.5">
                              {item.note}
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400 border border-gray-100 shadow-xs">
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
