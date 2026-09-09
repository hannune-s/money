"use client";
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface NoticeItem {
  id: string;
  type: 'notice' | 'news';
  title: string;
  content: string;
  created_at: string;
}

type InquiryType = 'none' | 'general' | 'app';

export default function SupportPage() {
  const [mainTab, setMainTab] = useState<'notice' | 'inquiry'>('notice');
  const [noticeTab, setNoticeTab] = useState<'notice' | 'news'>('notice');
  const [openNoticeId, setOpenNoticeId] = useState<string | null>(null);
  
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(true);

  // Inquiry States
  const [inquiryType, setInquiryType] = useState<InquiryType>('none');
  const [formData, setFormData] = useState({ name: '', company: '', phone: '', email: '', message: '' });
  const [appData, setAppData] = useState({ type: '', industry: '', budget: '', schedule: '' });
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const { data, error } = await supabase
          .from('ssakdamoa_notices')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data) setNotices(data);
      } catch (err) {
        console.error('Failed to fetch notices:', err);
      } finally {
        setNoticesLoading(false);
      }
    };
    fetchNotices();
  }, []);

  useEffect(() => {
    if (inquiryType !== 'none' && formRef.current && mainTab === 'inquiry') {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [inquiryType, mainTab]);

  const filteredNotices = notices.filter(item => item.type === noticeTab);

  const toggleAccordion = (id: string) => {
    setOpenNoticeId(openNoticeId === id ? null : id);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryLoading(true);
    setErrorMsg('');
    
    const finalMessage = inquiryType === 'app'
      ? `[앱 제작 문의]\n- 희망 앱 형태: ${appData.type || '미입력'}\n- 매장 업종: ${appData.industry || '미입력'}\n- 예상 예산: ${appData.budget || '미입력'}\n- 희망 일정: ${appData.schedule || '미입력'}\n\n[상세 내용]\n${formData.message}`
      : `[기타 문의]\n${formData.message}`;

    const submitData = { ...formData, message: finalMessage };
    
    try {
      const { error } = await supabase.from('ssakdamoa_inquiries').insert([submitData]);
      if (error) throw error;
      
      setFormData({ name: '', company: '', phone: '', email: '', message: '' });
      setAppData({ type: '', industry: '', budget: '', schedule: '' });
      setInquiryType('none');
      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('전송 중 오류가 발생했습니다. 관리자에게 문의해주세요.');
    } finally {
      setInquiryLoading(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans pb-28">
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 text-center max-w-md w-full animate-fade-in-up">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">접수가 완료되었습니다</h2>
          <p className="text-gray-500 mb-6 text-sm">보내주신 소중한 문의 내용을 꼼꼼히 확인 후<br/>최대한 빠르게 연락드리겠습니다.</p>
          <button 
            onClick={() => setSubmitted(false)}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
          >
            새로운 문의 작성하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center pt-8 pb-32 px-4 font-sans">
      <div className="w-full max-w-2xl text-center mb-6">
        <h1 className="text-2xl font-extrabold text-blue-600 mb-2">공지·문의</h1>
        <p className="text-gray-500 text-sm">
          {mainTab === 'notice' ? '새로운 소식과 유용한 정보를 확인하세요.' : '어떤 도움이 필요하신가요? 목적에 맞는 항목을 선택해주세요.'}
        </p>
      </div>

      {/* Main Tabs */}
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 p-1 mb-6 flex">
        <button
          onClick={() => setMainTab('notice')}
          className={`flex-1 py-3 text-[15px] font-bold rounded-xl transition-colors ${
            mainTab === 'notice' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          공지게시판
        </button>
        <button
          onClick={() => setMainTab('inquiry')}
          className={`flex-1 py-3 text-[15px] font-bold rounded-xl transition-colors ${
            mainTab === 'inquiry' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          문의하기
        </button>
      </div>

      {mainTab === 'notice' && (
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
          <div className="flex border-b border-gray-100">
            <button 
              onClick={() => { setNoticeTab('notice'); setOpenNoticeId(null); }}
              className={`flex-1 py-3 font-bold text-sm transition-colors relative ${noticeTab === 'notice' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              공지사항
              {noticeTab === 'notice' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
            </button>
            <button 
              onClick={() => { setNoticeTab('news'); setOpenNoticeId(null); }}
              className={`flex-1 py-3 font-bold text-sm transition-colors relative ${noticeTab === 'news' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              소식
              {noticeTab === 'news' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
            </button>
          </div>

          <div className="flex flex-col min-h-[300px]">
            {noticesLoading ? (
              <div className="flex justify-center items-center h-40 text-gray-400 text-sm">
                게시글을 불러오는 중입니다...
              </div>
            ) : filteredNotices.length > 0 ? (
              filteredNotices.map((item) => (
                <div key={item.id} className="border-b border-gray-100 last:border-b-0">
                  <button 
                    onClick={() => toggleAccordion(item.id)}
                    className="w-full text-left px-5 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col gap-1 pr-4">
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full w-fit">
                        {item.type === 'notice' ? '공지' : '소식'}
                      </span>
                      <h3 className={`font-semibold text-[15px] leading-tight mt-1 ${openNoticeId === item.id ? 'text-blue-600' : 'text-gray-800'}`}>
                        {item.title}
                      </h3>
                      <span className="text-xs text-gray-400 mt-0.5">{formatDate(item.created_at)}</span>
                    </div>
                    <span className="text-gray-300 transform transition-transform duration-200">
                      {openNoticeId === item.id ? '▲' : '▼'}
                    </span>
                  </button>
                  <div 
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      openNoticeId === item.id ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="p-5 bg-gray-50 text-sm text-gray-700 leading-relaxed border-t border-gray-100 whitespace-pre-wrap">
                      {item.content}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col justify-center items-center h-40 text-gray-400 text-sm gap-2">
                <span className="text-3xl">📭</span>
                등록된 글이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {mainTab === 'inquiry' && (
        <div className="w-full animate-fade-in-up">
          <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8">
            <button
              onClick={() => setInquiryType('general')}
              className={`flex flex-col items-start p-4 md:p-6 rounded-2xl border-2 transition-all text-left ${
                inquiryType === 'general' 
                  ? 'border-blue-500 bg-blue-50 shadow-md' 
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <div className="text-2xl mb-2 md:mb-3">💬</div>
              <h3 className={`text-base md:text-lg font-bold mb-1 ${inquiryType === 'general' ? 'text-blue-700' : 'text-gray-800'}`}>
                기타 문의
              </h3>
              <p className="text-[11px] md:text-sm text-gray-500 leading-snug md:leading-relaxed break-keep">
                기타 서비스 이용 관련 궁금하신 점이나 건의사항을 남겨주세요.
              </p>
            </button>

            <button
              onClick={() => setInquiryType('app')}
              className={`flex flex-col items-start p-4 md:p-6 rounded-2xl border-2 transition-all text-left ${
                inquiryType === 'app' 
                  ? 'border-indigo-500 bg-indigo-50 shadow-md' 
                  : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
              }`}
            >
              <div className="text-2xl mb-2 md:mb-3">📱</div>
              <h3 className={`text-base md:text-lg font-bold mb-1 ${inquiryType === 'app' ? 'text-indigo-700' : 'text-gray-800'}`}>
                앱 제작 문의
              </h3>
              <p className="text-[11px] md:text-sm text-gray-500 leading-snug md:leading-relaxed break-keep">
                매장 전용 앱 개발, 예약/주문 프로그램 구축 상담을 도와드립니다.
              </p>
            </button>
          </div>

          <div 
            ref={formRef}
            className={`w-full max-w-2xl transition-all duration-500 ease-in-out origin-top ${
              inquiryType !== 'none' ? 'opacity-100 scale-y-100 h-auto' : 'opacity-0 scale-y-0 h-0 overflow-hidden'
            }`}
          >
            <div className={`bg-white p-6 md:p-8 rounded-3xl shadow-sm border ${inquiryType === 'app' ? 'border-indigo-100' : 'border-blue-100'}`}>
              
              <div className="mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">
                  {inquiryType === 'app' ? '📱 앱 제작 상세 문의' : '💬 기타 문의'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {inquiryType === 'app' ? '자세히 적어주실수록 더 정확하고 빠른 상담이 가능합니다.' : '빠른 시일 내에 담당자가 확인 후 연락드리겠습니다.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                
                {errorMsg && (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100">
                    ⚠️ {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-800">이름 <span className="text-red-500">*</span></label>
                    <input 
                      type="text" required placeholder="예: 홍길동"
                      value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-800">상호명 <span className="text-red-500">*</span></label>
                    <input 
                      type="text" required placeholder="예: 싹다식당"
                      value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-800">연락처 <span className="text-red-500">*</span></label>
                    <input 
                      type="tel" required placeholder="예: 010-1234-5678"
                      value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-gray-800">이메일 <span className="text-red-500">*</span></label>
                    <input 
                      type="email" required placeholder="예: ssakda@moa.com"
                      value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                    />
                  </div>
                </div>

                {inquiryType === 'app' && (
                  <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col gap-5 mt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-indigo-900">매장 업종</label>
                        <input 
                          type="text" placeholder="예: 카페, 식당, 미용실 등"
                          value={appData.industry} onChange={e => setAppData({...appData, industry: e.target.value})}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-indigo-900">원하시는 앱 형태</label>
                        <input 
                          type="text" placeholder="예: 배달앱, 예약앱, 포인트 적립앱"
                          value={appData.type} onChange={e => setAppData({...appData, type: e.target.value})}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-indigo-900">예산 (선택)</label>
                        <input 
                          type="text" placeholder="예: 300만원 이하, 미정"
                          value={appData.budget} onChange={e => setAppData({...appData, budget: e.target.value})}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-indigo-900">희망 일정 (선택)</label>
                        <input 
                          type="text" placeholder="예: 1개월 이내, 최대한 빨리"
                          value={appData.schedule} onChange={e => setAppData({...appData, schedule: e.target.value})}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-sm font-bold text-gray-800">문의 내용 <span className="text-red-500">*</span></label>
                  <textarea 
                    required
                    rows={5}
                    placeholder={inquiryType === 'app' ? "추가로 원하시는 기능이나 참고할 만한 앱(벤치마킹)이 있다면 적어주세요." : "자세한 문의 사항이나 건의 내용을 남겨주세요."}
                    value={formData.message}
                    onChange={e => setFormData({...formData, message: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow resize-none"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={inquiryLoading}
                  className={`w-full py-4 text-white font-bold rounded-xl transition-all shadow-md mt-2 ${
                    inquiryLoading ? 'bg-gray-400 cursor-not-allowed' : (inquiryType === 'app' ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg')
                  }`}
                >
                  {inquiryLoading ? '전송 중...' : (inquiryType === 'app' ? '앱 제작 문의 접수하기' : '문의 접수하기')}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
