export const LEDGER_STORAGE_DATE = '1970-01-06';

export type LedgerScope = 'store' | 'home' | 'income';
export type LedgerCostType = 'fixed' | 'variable';

export interface LedgerEntry {
  id: string;
  date: string; // YYYY-MM-DD
  scope: LedgerScope; // 'store': 매장 지출, 'home': 집 지출, 'income': 매장 수입
  costType: LedgerCostType; // 'fixed': 고정, 'variable': 변동
  description: string; // 적요
  amount: number; // 금액
  category: string; // 자동 또는 수동 분류된 항목명
  createdAt: string;
}

export interface LedgerCategoryMeta {
  name: string;
  icon: string;
  badgeClass: string;
  barClass: string;
  keywords: string[];
}

export const LEDGER_CATEGORIES: LedgerCategoryMeta[] = [
  {
    name: '매입·물품대금',
    icon: '🛍️',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    barClass: 'bg-blue-600',
    keywords: [
      '매입',
      '매입대금',
      '물품대금',
      '물대',
      '상품대금',
      '결제대금',
      '외상대금',
      '미수금',
      '거래처',
      '납품',
      '발주',
      '사입',
      '도매',
      '입고',
      '두올',
    ],
  },
  {
    name: '통신비',
    icon: '📡',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    barClass: 'bg-sky-500',
    keywords: ['통신', '인터넷', '휴대폰', '핸드폰', '폰요금', '통신비', 'kt', 'skt', 'lg', '유플러스', '알뜰폰', '전화', '와이파이'],
  },
  {
    name: '임대·관리·렌탈',
    icon: '🏢',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    barClass: 'bg-indigo-500',
    keywords: ['월세', '임대', '관리비', '아파트관리비', '상가관리비', '정수기', '코웨이', '세스코', '캡스', '에스원', '세콤', '청호', '쿠쿠', 'SK매직', '하우스쿡', '렌탈', '렌털', '포스기', '포스', 'pos', '사용료'],
  },
  {
    name: '공과금·세금',
    icon: '⚡',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    barClass: 'bg-amber-500',
    keywords: ['전기', '전기세', '전기요금', '한전', '수도', '수도세', '가스', '도시가스', '공과금', '세금', '부가세', '종합소득세', '원천세', '지방세', '건강보험', '국민연금', '고용보험', '산재보험', '4대보험', '세무사', '기장료'],
  },
  {
    name: '식자재·원부자재',
    icon: '🥩',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    barClass: 'bg-emerald-500',
    keywords: ['식자재', '푸드팡', '금천미트', '그린팜', '이왕마트', '식자재왕', '머쉬러브', '신영', '간편한식', '경일포장', '새로피엔엘', '포장일번지', '핑거데이', '신식상점', '헬로우모리스', '공방툴', '골드프린터', '나비꽃', '포장', '패키지', '박스', '상자', '비닐', '봉투', '스티커', '리본', '도라지', '오란다', '버터', '설탕', '조청', '물엿', '견과', '쌀', '고기', '정육', '야채', '채소', '과일', '버섯', '우유', '계란', '밀가루', '원두', '재료', '원재료', '부자재'],
  },
  {
    name: '인건비·알바',
    icon: '👥',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    barClass: 'bg-purple-500',
    keywords: ['알바', '아르바이트', '인건비', '급여', '월급', '주급', '일당', '시급', '주휴', '퇴직금', '직원', '파트타임'],
  },
  {
    name: '배달·수수료·광고',
    icon: '🛵',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    barClass: 'bg-orange-500',
    keywords: ['배민', '배달의민족', '배달대행', '부릉', '생각대로', '바로고', '쿠팡이츠', '요기요', '땡겨요', '스마트스토어', '수수료', '광고', '광고비', '마케팅', '인스타', '네이버광고', '당근광고', '간판', '현수막', '인쇄'],
  },
  {
    name: '식비·생활·마트',
    icon: '🛒',
    badgeClass: 'bg-pink-50 text-pink-700 border-pink-200',
    barClass: 'bg-pink-500',
    keywords: ['마트', '이마트', '트레이더스', '홈플러스', '롯데마트', '코스트코', '다이소', '쿠팡', '컬리', '생필품', '생활비', '식비', '점심', '저녁', '아침', '식사', '간식', '외식', '배달음식', '치킨', '피자', '카페', '커피', '편의점', '세탁', '미용실'],
  },
  {
    name: '차량·주유·교통',
    icon: '🚗',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    barClass: 'bg-cyan-500',
    keywords: ['주유', '주유소', '기름', '휘발유', '경유', '톨게이트', '하이패스', '주차', '주차비', '택시', '버스', '지하철', '기차', '교통', '교통비', '자동차', '세차', '카센터', '정비', '타이어', '대리운전'],
  },
  {
    name: '교육·육아·병원',
    icon: '🏥',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    barClass: 'bg-rose-500',
    keywords: ['학원', '학원비', '학교', '교육', '교육비', '교재', '문제집', '책', '아이', '육아', '어린이집', '유치원', '병원', '병원비', '약국', '약값', '치과', '한의원', '진료', '의료'],
  },
  {
    name: '금융·이자·보험',
    icon: '🏦',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
    barClass: 'bg-teal-500',
    keywords: ['이자', '대출', '대출이자', '원리금', '상환', '보험', '보험료', '화재보험', '자동차보험', '실비', '적금', '카드값', '연회비', '할부'],
  },
  {
    name: '경조사·선물·모임',
    icon: '💌',
    badgeClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    barClass: 'bg-fuchsia-500',
    keywords: ['경조사', '축의금', '조의금', '부조', '결혼식', '장례식', '부고', '돌잔치', '생일', '생신', '선물', '용돈', '부모님', '모임', '회비'],
  },
  {
    name: '기타지출',
    icon: '📦',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
    barClass: 'bg-gray-500',
    keywords: [],
  },
];

export function getLedgerCategoryMeta(catName: string): LedgerCategoryMeta {
  if (catName === '매장수입·매출') {
    return {
      name: '매장수입·매출',
      icon: '💰',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      barClass: 'bg-emerald-500',
      keywords: [],
    };
  }
  const found = LEDGER_CATEGORIES.find((c) => c.name === catName);
  if (found) return found;
  return {
    name: catName || '기타지출',
    icon: '📌',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    barClass: 'bg-slate-500',
    keywords: [],
  };
}

export function autoClassifyLedgerCategory(
  description: string,
  scope: LedgerScope,
  customRules: Record<string, string> = {}
): string {
  if (scope === 'income') return '매장수입·매출';
  const clean = description.trim().toLowerCase();
  if (!clean) return '기타지출';

  // 1. 사용자가 직접 지정해 기억된 키워드 규칙 우선 적용 ('기타지출'로 잘못 저장된 규칙은 제외)
  const ruleKeys = Object.keys(customRules).sort((a, b) => b.length - a.length);
  for (const key of ruleKeys) {
    if (
      key &&
      customRules[key] &&
      customRules[key] !== '기타지출' &&
      clean.includes(key.toLowerCase())
    ) {
      return customRules[key];
    }
  }

  // 2. 기본 키워드 사전 매칭
  for (const cat of LEDGER_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (clean.includes(kw.toLowerCase())) {
        return cat.name;
      }
    }
  }

  return '기타지출';
}
