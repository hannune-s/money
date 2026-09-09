"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PushAdminPage() {
  const [subCount, setSubCount] = useState(0);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('/');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{success: boolean, msg: string} | null>(null);

  useEffect(() => {
    // 현재 구독자 수 조회
    const fetchCount = async () => {
      const { count } = await supabase
        .from('ssakdamoa_push_subscribers')
        .select('*', { count: 'exact', head: true });
      if (count !== null) setSubCount(count);
    };
    fetchCount();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(`총 ${subCount}명의 사용자에게 푸시를 발송하시겠습니까?`)) return;

    setLoading(true);
    setResult(null);
    const adminPin = localStorage.getItem('admin_pin') || '';

    try {
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, url, adminPin })
      });
      const data = await res.json();
      
      if (res.ok) {
        setResult({ success: true, msg: data.message });
        setTitle('');
        setMessage('');
      } else {
        setResult({ success: false, msg: data.error || '발송 실패' });
      }
    } catch (err: any) {
      setResult({ success: false, msg: '네트워크 에러가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in-up max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          🔔 마케팅/공지 푸시 발송
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          PWA 앱을 설치하고 알림을 허용한 사용자들에게 실시간 푸시 알림을 발송할 수 있습니다.
        </p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-600 mb-1">현재 발송 가능한 구독자 수</p>
            <p className="text-2xl font-extrabold text-blue-800">{subCount}명</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-3 py-2 bg-white text-blue-600 text-xs font-bold rounded-lg shadow-sm hover:bg-blue-50"
          >
            🔄 새로고침
          </button>
        </div>

        <form onSubmit={handleSend} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-800">알림 제목 <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required 
              maxLength={40}
              placeholder="예: 싹다모아에 새로운 기능이 추가되었어요!"
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-800">알림 내용 <span className="text-red-500">*</span></label>
            <textarea 
              required 
              rows={3}
              maxLength={100}
              placeholder="예: 지금 바로 접속해서 새로운 무료 서식을 확인해보세요."
              value={message} 
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-800">랜딩 URL (선택)</label>
            <input 
              type="text" 
              placeholder="예: /notices (입력하지 않으면 홈으로 이동합니다)"
              value={url} 
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
            <p className="text-xs text-gray-400">알림을 클릭했을 때 이동할 경로를 입력합니다.</p>
          </div>

          {result && (
            <div className={`p-4 rounded-xl text-sm font-bold mt-2 ${result.success ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              {result.success ? '✅ ' : '⚠️ '}{result.msg}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || subCount === 0}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-2xl transition-all shadow-sm mt-4 flex items-center justify-center gap-2"
          >
            {loading ? '발송 중...' : '🚀 전체 발송하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
