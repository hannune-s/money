"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Calculator from '@/components/Calculator';

const CATEGORIES = ['전체', '페이·가맹', '결제·POS', '배달·입점 관리', '디자인·제작 툴', '필수 실무 링크', '실무 서식·양식', '마진 계산기', '매장관리 추천앱'];

// 정적 링크 데이터 (실무 서식·양식 제외)
const STATIC_LINKS = [
  // 전국 단위 (페이·가맹)
  { id: 'static-1', title: '제로페이 가맹 신청', desc: '소상공인 수수료 부담을 낮춘 간편결제', category: '페이·가맹', keywords: ['제로페이', '페이', '가맹'], url: 'https://www.zeropay.or.kr/UI_HP_001.act' },
  { id: 'static-2', title: '온누리 가맹 신청', desc: '전통시장 및 상점가 전용 상품권', category: '페이·가맹', keywords: ['온누리', '가맹', '신청', '온누리상품권'], url: 'https://frc.sbiz.or.kr/afms/afm/SMMDL0001M01/page.do' },
  { id: 'static-14', title: '농할상품권 가맹 신청', desc: '우리 농수축산물 전용 할인 상품권', category: '페이·가맹', keywords: ['농할상품권', '농할', '가맹', '신청'], url: 'https://app.catchsecu.com/projects/2816edfa3b5d25f/form' },
  
  // 핵심 인구 밀집 지역화폐 (페이·가맹)
  { id: 'static-10', title: '서울페이+ 가맹 신청', desc: '서울 지역 전용 모바일 결제', category: '페이·가맹', keywords: ['서울페이', '서울페이플러스', '서울', '지역화폐'], url: 'https://seoulpay.shinhancard.com/' },
  { id: 'static-11', title: '경기지역화폐 가맹 신청', desc: '경기도 시·군별 지역화폐', category: '페이·가맹', keywords: ['경기지역화폐', '경기', '경기도', '지역화폐'], url: 'https://www.gmoney.or.kr/' },
  { id: 'static-3', title: '인천이음카드 가맹 신청', desc: '인천광역시 지역화폐', category: '페이·가맹', keywords: ['인천이음', '지역화폐', '이음', '인천이음카드', '인천'], url: 'https://with.konacard.co.kr/8-1' },
  { id: 'static-12', title: '부산 동백전 가맹 신청', desc: '부산광역시 지역화폐', category: '페이·가맹', keywords: ['동백전', '부산', '지역화폐'], url: 'https://busandong100.kr/' },
  { id: 'static-13', title: '대구로페이 가맹 신청', desc: '대구광역시 지역화폐', category: '페이·가맹', keywords: ['대구로페이', '대구', '대구행복페이', '지역화폐'], url: 'https://minwon.daegu.go.kr/cvpl/AUTN-009/info' },
  { id: 'static-9', title: '김포페이 가맹 신청', desc: '경기도 김포시 지역화폐', category: '페이·가맹', keywords: ['김포페이', '지역화폐', '김포'], url: 'https://gppay.merchant-portal.co.kr/bridge/' },
  
  // 결제·POS
  { id: 'static-36', title: '페이히어 (모바일 POS)', desc: '스마트폰/태블릿으로 가볍게 쓰는 무료 포스기', category: '결제·POS', keywords: ['페이히어', '포스', 'POS', '결제', '카드결제', '원격결제', '간편결제'], url: 'https://payhere.in/' },
  { id: 'static-37', title: '페이앱 (원격/링크 결제)', desc: '단말기 없이 스마트폰으로 링크 및 원격 간편결제', category: '결제·POS', keywords: ['페이앱', '링크결제', '원격결제', '스마트폰결제', '간편결제', '수기결제'], url: 'https://www.payapp.kr/' },
  { id: 'static-38', title: '토스페이먼츠 (PG/간편결제)', desc: '온라인 쇼핑몰 및 매장의 빠르고 쉬운 간편결제', category: '결제·POS', keywords: ['토스', '토스페이먼츠', 'PG', '간편결제', '결제연동'], url: 'https://www.tosspayments.com/' },
  { id: 'static-39', title: 'IBK 박스포스 (스마트폰 카드결제)', desc: '스마트폰을 카드 결제기로 만들어주는 앱', category: '결제·POS', keywords: ['박스포스', 'IBK', '기업은행', '스마트폰결제', '포스', '간편결제', '원격결제'], url: 'https://pos.ibkbox.net/main/index.do' },

  // 배달·입점 관리
  { id: 'static-27', title: '배달의민족 (배민사장님광장)', desc: '배달의민족 입점 신청 및 가게 관리', category: '배달·입점 관리', keywords: ['배달의민족', '배민', '배달', '입점', '사장님광장'], url: 'https://ceo.baemin.com/' },
  { id: 'static-28', title: '쿠팡이츠 스토어 (입점/관리)', desc: '쿠팡이츠 입점 신청 및 가게 관리', category: '배달·입점 관리', keywords: ['쿠팡이츠', '쿠팡', '이츠', '배달', '입점', '스토어'], url: 'https://store.coupangeats.com/' },
  { id: 'static-29', title: '요기요 파트너스 (입점/관리)', desc: '요기요 입점 신청 및 가게 관리', category: '배달·입점 관리', keywords: ['요기요', '요기요파트너스', '배달', '입점'], url: 'https://partner.yogiyo.co.kr/' },
  { id: 'static-31', title: '신한 땡겨요 사장님라운지 (입점/관리)', desc: '신한은행의 착한 수수료 배달앱 입점 관리', category: '배달·입점 관리', keywords: ['신한', '땡겨요', '신한땡겨요', '배달', '입점', '사장님라운지'], url: 'https://boss.ddangyo.com/' },
  { id: 'static-30', title: '배달특급 가맹점 신청', desc: '수수료 부담 없는 경기도 공공배달앱', category: '배달·입점 관리', keywords: ['배달특급', '경기도배달앱', '공공배달앱', '배달', '입점'], url: 'https://www.specialdelivery.co.kr/' },
  
  // 디자인·제작 툴
  { id: 'static-17', title: '미리캔버스 (포스터/메뉴판 등)', desc: '누구나 쉬운 무료 디자인 템플릿 제작', category: '디자인·제작 툴', keywords: ['미리캔버스', '디자인', '포스터', '메뉴판', '배너', '제작'], url: 'https://www.miricanvas.com/' },
  { id: 'static-18', title: '망고보드 (카드뉴스/홍보물 등)', desc: '포스터, 카드뉴스 등 전문적인 홍보물 제작', category: '디자인·제작 툴', keywords: ['망고보드', '디자인', '카드뉴스', '홍보물', '배너', '제작'], url: 'https://www.mangoboard.net/' },
  { id: 'static-22', title: '캔바 (글로벌 디자인/로고 제작)', desc: '전 세계 1위 무료 디자인 플랫폼', category: '디자인·제작 툴', keywords: ['캔바', 'canva', '디자인', '포스터', '로고', '제작'], url: 'https://www.canva.com/ko_kr/' },
  { id: 'static-23', title: '픽사베이 (상업용 무료 이미지)', desc: '저작권 걱정 없는 고화질 이미지 무료 다운로드', category: '디자인·제작 툴', keywords: ['픽사베이', 'pixabay', '무료이미지', '사진', '디자인소스', '상업용무료'], url: 'https://pixabay.com/ko/' },
  { id: 'static-19', title: '아임웹 (쇼핑몰/홈페이지 제작)', desc: '코딩 없이 클릭만으로 만드는 웹사이트', category: '디자인·제작 툴', keywords: ['아임웹', '쇼핑몰', '홈페이지', '웹사이트', '제작'], url: 'https://imweb.me/' },
  { id: 'static-20', title: '식스샵 (쇼핑몰 제작)', desc: '쉽고 직관적인 자사 쇼핑몰 제작 솔루션', category: '디자인·제작 툴', keywords: ['식스샵', '쇼핑몰', '제작', '자사몰'], url: 'https://www.sixshop.com/' },
  { id: 'static-21', title: '카페24 (쇼핑몰 제작)', desc: '전문적인 글로벌 쇼핑몰 구축 솔루션', category: '디자인·제작 툴', keywords: ['카페24', '쇼핑몰', '제작', '자사몰', 'cafe24'], url: 'https://www.cafe24.com/' },

  // 필수 실무 링크 (안내/접수용 사이트 연결)
  { id: 'static-24', title: '정부24 (각종 민원/증명서 발급)', desc: '사업자등록증명·민원 서류 발급', category: '필수 실무 링크', keywords: ['정부24', '민원24', '민원', '증명서', '등본', '행정'], url: 'https://www.gov.kr/' },
  { id: 'static-25', title: '식품안전나라 (식품/위생 관련)', desc: '위생교육 및 식품 안전 허가', category: '필수 실무 링크', keywords: ['식품안전나라', '식품', '위생', '식약처', '영업신고'], url: 'https://www.foodsafetykorea.go.kr/' },
  { id: 'static-26', title: '세움터 (건축물대장/용도변경 등)', desc: '건축물대장 열람 및 용도변경 신청', category: '필수 실무 링크', keywords: ['세움터', '건축물대장', '건축', '용도변경', '건축행정'], url: 'https://cloud.eais.go.kr/' },
  { id: 'static-4', title: '보건증(건강진단결과서) 발급 안내', desc: '외식업 종사자 필수 건강진단 서류', category: '필수 실무 링크', keywords: ['보건증', '건강진단', '건강진단결과서'], url: 'https://www.gov.kr/portal/service/serviceInfo/135200000129' },
  { id: 'static-16', title: '4대보험통합징수포털', desc: '직원 및 알바생 4대보험 신고/납부', category: '필수 실무 링크', keywords: ['4대보험', '사대보험', '통합징수포털', '국민건강보험'], url: 'https://si4n.nhis.or.kr/jpza/JpZaa00101.do' },
  { id: 'static-40', title: '통신판매업 신고', desc: '온라인 판매 및 스마트스토어 필수 행정 절차', category: '필수 실무 링크', keywords: ['통신판매업', '통신판매', '신고', '정부24', '온라인판매', '쇼핑몰'], url: 'https://www.gov.kr/main?a=AA020InfoCappViewApp&HighCtgCD=A09006&CappBizCD=11300000006' },
  { id: 'static-41', title: '인터넷등기소 (법인등기 등)', desc: '부동산 및 법인 등기부등본 열람·발급', category: '필수 실무 링크', keywords: ['인터넷등기소', '등기소', '법인등기', '등기부등본', '부동산등기'], url: 'https://www.iros.go.kr/index.jsp' },
  
  // 매장관리 추천앱
  { id: 'static-33', title: '한고세쏙 (일상 기록/정산 관리)', desc: '계좌, 구독, 돈거래 등 흩어진 내 정보를 한곳에', category: '매장관리 추천앱', keywords: ['한고세쏙', '기록', '메모', '장부', '정산', '일정', '관리앱', '추천앱', '매장관리 추천앱'], url: 'https://hangose-me.vercel.app/landing.html' },
  { id: 'static-34', title: '당근비즈니스 (동네 홍보)', desc: '우리 동네 단골 만들기 및 매장 지역 광고', category: '매장관리 추천앱', keywords: ['당근', '당근마켓', '비즈니스', '광고', '홍보', '추천앱', '매장관리 추천앱'], url: 'https://business.daangn.com/' },
  { id: 'static-35', title: '알바몬 / 알바천국 (구인구직)', desc: '빠르고 확실한 매장 아르바이트생 구인', category: '매장관리 추천앱', keywords: ['알바몬', '알바천국', '알바', '구인', '채용', '추천앱', '매장관리 추천앱'], url: 'https://www.albamon.com/' },
];

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [hangoseUrl, setHangoseUrl] = useState('https://hangose-me.vercel.app/landing.html');
  const [dbForms, setDbForms] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  const urlB64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) return;

      // Vercel 환경변수에 추가될 Public Key 우선 사용
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BPSIMaexeMfcpWWslN3VpLDVWJVWJqvQvfG2y14bWM6Fu6IegevXAhVOFZ5_4T_ZpjYyEAuckPVyZuPoeeGYJgo';
      const convertedKey = urlB64ToUint8Array(vapidKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      const subObj = subscription.toJSON();
      
      await supabase.from('ssakdamoa_push_subscribers').insert([{
        endpoint: subObj.endpoint,
        p256dh: subObj.keys?.p256dh,
        auth: subObj.keys?.auth
      }]);
    } catch (err) {
      console.error('푸시 구독 실패:', err);
    }
  };

  // PWA 앱 설치 프롬프트 및 모바일(iOS/Android) 감지
  useEffect(() => {
    // Service Worker 등록 및 푸시 알림 확인
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => {
        // 앱으로 실행 중인지(standalone) 확인하여, 앱 사용자면 푸시 구독 시도
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        if (isStandalone) {
          setTimeout(subscribeToPush, 2000); // 사용자 방해되지 않게 약간 지연
        }
      }).catch(err => console.log('SW err:', err));
    }

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // 브라우저가 지원할 때 (PC 크롬, 안드로이드 크롬 등)
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        
        // 앱 설치 통계 기록 (비동기)
        try {
          const ua = navigator.userAgent.toLowerCase();
          const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);
          const platform = isMobile ? 'Mobile Web' : 'PC Web';
          
          await supabase.from('ssakdamoa_analytics').insert([{
            path: 'APP_INSTALL',
            referrer: `[${platform}] 홈 화면 추가 버튼`,
            is_instagram: false,
            visited_at: new Date().toISOString()
          }]);

          // 설치 허용 시 알림 권한도 연이어 요청
          await subscribeToPush();
        } catch (e) {
          console.error('Failed to log install event or subscribe push', e);
        }
      }
    } else {
      // 팝업이 차단되는 환경(카카오톡 인앱, 아이폰 등)에서 버튼이 '먹통'처럼 느껴지지 않게 예외 처리
      const ua = navigator.userAgent.toLowerCase();
      
      if (ua.includes('kakaotalk')) {
        // 카카오톡 내부에선 외부 브라우저(크롬/사파리)로 강제 연결
        window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(window.location.href);
      } else if (/iphone|ipad|ipod/.test(ua)) {
        alert('애플 정책상 아이폰은 사파리(Safari) 브라우저 하단의 [공유] 버튼을 통해서만 설치할 수 있습니다.');
      } else {
        alert('이미 앱이 바탕화면에 설치되어 있거나, 현재 환경에서 설치 기능을 지원하지 않습니다.\n(크롬이나 삼성 인터넷 앱을 이용해주세요!)');
      }
    }
  };

  // 검색어나 카테고리가 변경되면 표시 개수를 다시 10개로 초기화
  useEffect(() => {
    setVisibleCount(10);
  }, [selectedCategory, searchTerm]);

  // 방문자 통계 기록 및 디바이스 체크
  useEffect(() => {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
    if (isMobile) {
      setHangoseUrl('https://hangose-me.vercel.app/m_landing.html');
    }

    // 통계 기록 (중복 방지 완벽 차단 - 새로고침 뻥튀기 방지)
    const trackVisit = async () => {
      try {
        // 날짜 포맷팅 에러 방지를 위해 수동으로 KST(한국 시간) YYYY-MM-DD 문자열 생성
        const now = new Date();
        const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        const today = kstNow.toISOString().split('T')[0];
        
        const visitedToday = localStorage.getItem('ssakdamoa_visited_today');
        const sessionVisited = sessionStorage.getItem('ssakdamoa_visited_session');

        // 1. 현재 창(탭)에서 이미 기록했다면 즉시 차단 (새로고침 무한 카운트 방지)
        if (sessionVisited) return;
        
        // 2. 오늘 하루 이미 기록했다면 즉시 차단 (브라우저 재실행 카운트 방지)
        if (visitedToday === today) return;

        // 통과했다면 즉시 로컬/세션 스토리지에 못 박음 (네트워크 지연 중 중복 실행 방지)
        sessionStorage.setItem('ssakdamoa_visited_session', 'true');
        localStorage.setItem('ssakdamoa_visited_today', today);

        const rawReferrer = document.referrer;
        const ua = navigator.userAgent.toLowerCase();
        
        // 1. 접속 기기(환경) 판별
        const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);
        const platform = isMobile ? 'Mobile Web' : 'PC Web';

        // 2. 유입 출처 판별 (인앱 브라우저 우선 체크)
        let source = rawReferrer || 'Direct';
        let isInstagram = false;

        if (ua.includes('instagram') || rawReferrer.includes('instagram.com') || rawReferrer.includes('l.instagram.com')) {
          source = 'Instagram';
          isInstagram = true;
        } else if (ua.includes('kakaotalk')) {
          source = 'KakaoTalk';
        } else if (ua.includes('naver')) {
          source = 'Naver App';
        } else if (rawReferrer.includes('naver.com')) {
          source = 'Naver 검색';
        } else if (rawReferrer.includes('google.com')) {
          source = 'Google 검색';
        } else if (rawReferrer.includes('daum.net')) {
          source = 'Daum 검색';
        } else if (source === 'Direct') {
          source = '직접 접속 (Direct)';
        }

        const finalReferrer = `[${platform}] ${source}`;
        const path = window.location.pathname;

        // DB에 조용히 비동기 기록
        await supabase.from('ssakdamoa_analytics').insert([{ 
          referrer: finalReferrer, 
          is_instagram: isInstagram, 
          path 
        }]);
      } catch (err) {
        console.error('Failed to track visit', err);
      }
    };
    trackVisit();
  }, []);

  // Supabase에서 동적 폼(실무 서식) 데이터 불러오기
  useEffect(() => {
    const fetchForms = async () => {
      try {
        const { data, error } = await supabase
          .from('ssakdamoa_forms')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        if (data) {
          const formattedForms = data.map(form => ({
            id: form.id,
            title: form.title,
            desc: form.description,
            category: '실무 서식·양식',
            keywords: [form.title, '다운로드', '서식', '양식'],
            url: form.file_url,
            isDbForm: true,
          }));
          setDbForms(formattedForms);
        }
      } catch (err) {
        console.error('Failed to fetch forms from Supabase', err);
      }
    };
    fetchForms();
  }, []);

  const handleFormDownload = async (e: React.MouseEvent<HTMLButtonElement>, formId: string, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 1. 새 창이 아닌 '강제 파일 다운로드' 모드로 실행
    const forceDownloadUrl = url + (url.includes('?') ? '&' : '?') + 'download=';
    const link = document.createElement('a');
    link.href = forceDownloadUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 2. 백그라운드에서 다운로드 수 증가 (실제 다운로드 버튼을 눌렀을 때만!)
    try {
      const { data } = await supabase.from('ssakdamoa_forms').select('downloads').eq('id', formId).single();
      if (data) {
        await supabase.from('ssakdamoa_forms').update({ downloads: data.downloads + 1 }).eq('id', formId);
      }
    } catch (err) {
      console.error('Failed to increment download count', err);
    }
  };

  // 정적 링크와 동적 서식 링크 결합
  const ALL_LINKS = [...STATIC_LINKS, ...dbForms];

  // 향상된 검색 및 필터링 로직
  const filteredLinks = ALL_LINKS.filter(link => {
    const term = searchTerm.trim().toLowerCase().replace(/\s+/g, '');
    
    if (term) {
      const title = link.title.toLowerCase().replace(/\s+/g, '');
      return title.includes(term) || link.keywords.some((kw: string) => kw.toLowerCase().replace(/\s+/g, '').includes(term));
    }
    
    return selectedCategory === '전체' || link.category === selectedCategory;
  });

  // 화면에 렌더링할 10개 이하의 링크만 잘라내기
  const displayedLinks = filteredLinks.slice(0, visibleCount);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center pt-8 pb-28 px-4 font-sans">
      {/* Header */}
      <div className="w-full max-w-2xl text-center mb-6">
        <h1 className="text-3xl font-extrabold text-blue-600 mb-2 tracking-tight">싹다모아</h1>
        <p className="text-gray-500 text-sm mb-4">자영업자 필수 링크 & 서식 종합 허브</p>
        <button 
          onClick={handleInstallClick}
          className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-2 px-4 rounded-full text-[13px] transition-colors border border-blue-100 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          홈 화면에 앱 추가하기 (1초 설치)
        </button>
      </div>

      {/* Search & Filter Area */}
      <div className="w-full max-w-2xl bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6">
        <div className="relative mb-4">
          <input 
            type="text" 
            placeholder="'보건증', '제로페이', '메뉴판' 등 키워드 검색" 
            className="w-full bg-gray-100 text-gray-800 rounded-xl pl-4 pr-16 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-400 text-sm"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (selectedCategory === '마진 계산기') {
                setSelectedCategory('전체');
              }
            }}
          />
          <div className="absolute right-3 top-2.5 flex items-center gap-2">
            {searchTerm.length > 0 && (
              <button 
                onClick={() => setSearchTerm('')}
                className="w-5 h-5 flex items-center justify-center bg-gray-300 hover:bg-gray-400 text-white rounded-full text-xs transition-colors"
                aria-label="검색어 지우기"
              >
                ✕
              </button>
            )}
            <span className="text-gray-400 text-lg mr-1">🔍</span>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 pb-1">
          {CATEGORIES.map(category => (
            <button
              key={category}
              onClick={() => {
                setSelectedCategory(category);
                setSearchTerm('');
              }}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-[13px] sm:text-sm font-semibold transition-colors ${
                selectedCategory === category && !searchTerm
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full max-w-2xl flex flex-col gap-2.5">
        {selectedCategory === '마진 계산기' ? (
          <Calculator />
        ) : displayedLinks.length > 0 ? (
          displayedLinks.map(link => {
            const currentUrl = link.id === 'static-33' ? hangoseUrl : link.url;
            
            // DB 서식인 경우: 미리보기(좌측)와 다운로드(우측 버튼)를 분리
            if (link.isDbForm) {
              return (
                <div 
                  key={link.id} 
                  className="w-full bg-white text-gray-800 py-3 px-4 rounded-xl border border-gray-200 font-medium transition-all text-left flex justify-between items-center shadow-sm hover:shadow"
                >
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col gap-1 flex-1 cursor-pointer group pr-4"
                  >
                    <span className="text-[15px] leading-tight group-hover:text-blue-600 transition-colors">{link.title}</span>
                    <span className="text-xs text-blue-500 font-medium">{link.desc}</span>
                  </a>
                  <button
                    onClick={(e) => handleFormDownload(e, link.id, link.url)}
                    className="flex items-center justify-center bg-gray-50 border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-gray-500 w-11 h-11 rounded-xl transition-colors shrink-0"
                    title="파일 강제 다운로드"
                  >
                    ↓
                  </button>
                </div>
              );
            }

            // 일반 링크인 경우 (기존 유지)
            return (
              <a 
                key={link.id} 
                href={currentUrl}
                target={currentUrl === '#' ? '_self' : '_blank'}
                rel="noopener noreferrer"
                className="w-full bg-white hover:bg-gray-50 text-gray-800 py-3.5 px-5 rounded-xl border border-gray-200 font-medium transition-all text-left flex justify-between items-center group shadow-sm hover:shadow"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] leading-tight">{link.title}</span>
                  <span className="text-xs text-blue-500 font-medium">{link.desc}</span>
                </div>
                <span className="text-gray-300 group-hover:text-blue-500 transition-colors text-xl ml-3 shrink-0">
                  {link.category === '실무 서식·양식' ? '↓' : '→'}
                </span>
              </a>
            );
          })
        ) : (
          <div className="text-center text-gray-500 py-12 bg-white rounded-2xl border border-gray-200">
            검색 결과가 없습니다. 다른 키워드를 입력해보세요!
          </div>
        )}
      </div>

      {/* 더보기 버튼 */}
      {filteredLinks.length > visibleCount && (
        <button 
          onClick={() => setVisibleCount(prev => prev + 10)}
          className="w-full max-w-2xl mt-4 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
        >
          더보기 ({visibleCount} / {filteredLinks.length}) ⬇️
        </button>
      )}

      {/* Cross Promotion Banner */}
      <a 
        href={hangoseUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="block w-full max-w-2xl mt-10 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-6 text-white shadow-lg text-center transform hover:scale-[1.02] transition-transform cursor-pointer"
      >
        <h3 className="text-lg font-extrabold mb-1.5">복잡한 일상 기록, 한곳에 쏙! 🚀</h3>
        <p className="text-green-50 text-sm mb-4">계좌, 구독, 돈거래 장부, 아이디까지 흩어진 내 정보를 직관적으로 관리하세요.</p>
        <div className="inline-block bg-white text-green-700 font-bold py-2.5 px-6 rounded-full hover:bg-green-50 transition-colors shadow-sm text-sm">
          한고세쏙 무료로 시작하기
        </div>
      </a>
      
    </main>
  );
}
