"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const HomeIcon = () => (
  <svg className="w-[22px] h-[22px] mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const NoticeIcon = () => (
  <svg className="w-[22px] h-[22px] mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const ContactIcon = () => (
  <svg className="w-[22px] h-[22px] mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

export default function BottomNav() {
  const pathname = usePathname();

  // 어드민 페이지에서는 네비게이션 바를 숨김
  if (pathname.startsWith('/admin')) {
    return null;
  }

  const tabs = [
    { name: '홈', path: '/', icon: <HomeIcon /> },
    { name: '공지·문의', path: '/support', icon: <ContactIcon /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-safe">
      <div className="max-w-2xl mx-auto flex justify-around items-center h-[70px] px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.path;
          return (
            <Link 
              key={tab.path} 
              href={tab.path}
              className={`flex flex-col items-center justify-center w-full h-full transition-all ${
                isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-500'
              }`}
            >
              {tab.icon}
              <span className={`text-[11px] ${isActive ? 'font-bold text-blue-600' : 'font-medium text-gray-400'}`}>
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
