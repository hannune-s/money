"use client";
import { useEffect, useState } from 'react';
import { fetchAdminAnalytics } from './actions';

interface VisitorStat {
  id: string;
  visited_at: string;
  referrer: string;
  is_instagram: boolean;
  path: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<any[]>([]);
  const [todayTotal, setTodayTotal] = useState<number>(0);
  const [instagramCount, setInstagramCount] = useState<number>(0);
  const [installCount, setInstallCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const pin = localStorage.getItem('admin_pin') || '';
    if (pin) {
      fetchAnalytics(pin);
    } else {
      setLoading(false);
      setErrorMsg('관리자 인증이 필요합니다.');
    }
  }, []);

  const fetchAnalytics = async (pin: string) => {
    setLoading(true);
    try {
      const result = await fetchAdminAnalytics(pin);
      if (result.error) {
        setErrorMsg(result.message || '권한이 없습니다.');
        return;
      }
      setTodayTotal(result.totalCount!);
      setInstagramCount(result.instaCount!);
      setInstallCount(result.installCount!);
      setStats(result.recentVisits!);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setErrorMsg('통계 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="bg-red-50 border border-red-200 text-red-700 p-8 rounded-3xl flex flex-col items-center text-center max-w-lg">
          <span className="text-4xl mb-4">⚠️</span>
          <p className="font-extrabold text-xl mb-2">{errorMsg}</p>
          {errorMsg.includes('SUPABASE_SERVICE_ROLE_KEY') && (
            <p className="text-sm mt-2 text-red-600/80 leading-relaxed">
              보안 강화를 위해 일반 유저의 통계 조회가 차단되었습니다.<br/>
              관리자가 통계를 보려면 <b>Vercel과 로컬(.env.local)</b> 환경변수에<br/>
              <code className="bg-red-100 px-1 py-0.5 rounded mx-1">SUPABASE_SERVICE_ROLE_KEY</code>를 등록해야 합니다.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">방문자 접속 통계</h1>
      <p className="text-gray-500 mb-8">싹다모아 플랫폼의 통합 관리자 시스템입니다.</p>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* 오늘 총 방문자 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-500 flex flex-col justify-center">
          <h3 className="text-gray-500 font-semibold mb-2">오늘 총 방문자</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-blue-600">{loading ? '-' : todayTotal}</span>
            <span className="text-gray-500">명</span>
          </div>
        </div>

        {/* 인스타그램 유입 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-pink-500 flex flex-col justify-center">
          <h3 className="text-gray-500 font-semibold mb-2">인스타그램 유입 (오늘)</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-pink-600">{loading ? '-' : instagramCount}</span>
            <span className="text-gray-500">명</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            비중: {todayTotal > 0 ? Math.round((instagramCount / todayTotal) * 100) : 0}%
          </p>
        </div>
        {/* 앱 설치 횟수 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-green-500 flex flex-col justify-center">
          <h3 className="text-gray-500 font-semibold mb-2">앱 설치 횟수 (오늘)</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-green-600">{loading ? '-' : installCount}</span>
            <span className="text-gray-500">건</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            '홈 화면 추가'를 통해 설치된 기기 수
          </p>
        </div>
      </div>

      {/* 최근 접속 기록 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-bold">최근 접속/설치 기록 (최근 5건)</h3>
        </div>
        <div className="overflow-x-auto pb-4">
          <table className="w-full min-w-[600px] text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm">
                <th className="px-6 py-3 font-semibold">분류 / 접속 시간</th>
                <th className="px-6 py-3 font-semibold">유입 경로 (Referrer)</th>
                <th className="px-6 py-3 font-semibold">인스타그램 여부</th>
                <th className="px-6 py-3 font-semibold">접속 페이지</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">불러오는 중...</td>
                </tr>
              ) : stats.map((stat, idx) => (
                <tr key={stat.id || idx} className={`border-t border-gray-50 ${stat.path === 'APP_INSTALL' ? 'bg-green-50/30' : ''}`}>
                  <td className="px-6 py-3 text-gray-600 flex flex-col gap-1 items-start">
                    {stat.path === 'APP_INSTALL' ? (
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">앱 설치</span>
                    ) : (
                      <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">웹 방문</span>
                    )}
                    <span className="text-xs">{new Date(stat.visited_at).toLocaleString('ko-KR')}</span>
                  </td>
                  <td className="px-6 py-3 text-gray-800">{stat.referrer || '알 수 없음'}</td>
                  <td className="px-6 py-3">
                    {stat.path !== 'APP_INSTALL' && stat.is_instagram ? (
                      <span className="text-pink-600 font-bold bg-pink-50 px-2 py-1 rounded text-xs">Instagram</span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-500 truncate max-w-[150px]">
                    {stat.path === 'APP_INSTALL' ? '-' : stat.path}
                  </td>
                </tr>
              ))}
              {!loading && stats.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">최근 기록이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
