"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

import { verifyPin } from './actions';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [isChecking, setIsChecking] = useState(true);

  // 페이지 이동 시 모바일 메뉴 자동으로 닫기
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // 접속 시 인증 여부 확인 (서버 액션 통해 확인)
  useEffect(() => {
    const checkAuth = async () => {
      const storedPin = localStorage.getItem('admin_pin');
      if (storedPin) {
        const isValid = await verifyPin(storedPin);
        if (isValid) {
          setIsAuthed(true);
        } else {
          localStorage.removeItem('admin_pin');
        }
      }
      setIsChecking(false);
    };
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    const isValid = await verifyPin(pin);
    if (isValid) {
      localStorage.setItem('admin_pin', pin);
      setIsAuthed(true);
    } else {
      alert('비밀번호가 일치하지 않습니다.');
      setPin('');
    }
    setIsChecking(false);
  };

  if (isChecking) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 w-full max-w-sm flex flex-col items-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">싹다모아 Admin</h2>
          <p className="text-sm text-gray-500 mb-8 text-center">관리자 전용 페이지입니다.<br/>비밀번호 4자리를 입력해주세요.</p>
          
          <input 
            type="password" 
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-full text-center text-3xl tracking-[0.5em] p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6 font-mono transition-shadow"
            placeholder="****"
            autoFocus
          />
          <button type="submit" disabled={isChecking || pin.length < 4} className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-2xl transition-colors shadow-sm">
            관리자 접속하기
          </button>
        </form>
      </div>
    );
  }

  const menuItems = [
    { name: '대시보드', path: '/admin', icon: '📊' },
    { name: '제휴·문의 내역', path: '/admin/inquiries', icon: '✉️' },
    { name: '푸시 발송', path: '/admin/push', icon: '🔔' },
    { name: '서식 관리', path: '/admin/forms', icon: '📄' },
    { name: '공지사항 관리', path: '/admin/notices', icon: '📢' },
    { name: '보안 설정', path: '/admin/settings', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-800">
      {/* Desktop Sidebar (PC에서는 항상 보임) */}
      <aside className="w-64 bg-white shadow-sm flex-col hidden md:flex border-r border-gray-200 z-10 shrink-0">
        <div className="p-6 border-b border-gray-100 flex items-center gap-2">
          <span className="text-2xl font-extrabold text-blue-600 tracking-tight">싹다모아</span>
          <span className="text-sm font-bold text-gray-400 mt-1">Admin</span>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <a 
            href="/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-3 mb-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold shadow-sm hover:shadow-md transition-all text-sm"
          >
            📱 싹다모아 앱 바로가기
          </a>
          {menuItems.map(item => {
            const isActive = pathname === item.path;
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-semibold ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-100 text-xs text-gray-400 text-center">
          © 2026 싹다모아
        </div>
      </aside>

      {/* Mobile Overlay (배경 어둡게) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Mobile Drawer Sidebar (모바일 슬라이드 메뉴) */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-blue-600 tracking-tight">싹다모아</span>
            <span className="text-xs font-bold text-gray-400 mt-1">Admin</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors">
            ✕
          </button>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
          <a 
            href="/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-3 mb-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold shadow-sm hover:shadow-md transition-all text-sm"
          >
            📱 싹다모아 앱 바로가기
          </a>
          {menuItems.map(item => {
            const isActive = pathname === item.path;
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-semibold ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto min-w-0">
        {/* Mobile Header (햄버거 버튼 포함) */}
        <header className="md:hidden bg-white shadow-sm p-4 flex justify-between items-center border-b border-gray-200 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1 -ml-1 text-gray-500 hover:text-blue-600 focus:outline-none"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-lg font-extrabold text-blue-600 tracking-tight">싹다모아</span>
            <span className="text-[10px] font-bold text-gray-400 mt-1">Admin</span>
          </div>
        </header>
        
        {/* 본문 영역 (모바일 여백 최적화) */}
        <div className="p-4 sm:p-6 md:p-10 flex-1 w-full max-w-full overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
