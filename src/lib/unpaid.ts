export const UNPAID_STORAGE_DATE = '1970-01-07';

export type UnpaidCategory = '세금·4대보험' | '매입·거래처' | '임대·공과금' | '기타미납';

export interface UnpaidTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'charge' | 'payment'; // 'charge': 미납 발생/추가 (+), 'payment': 납부/상환 (-)
  amount: number;
  memo: string;
  createdAt: string;
}

export interface UnpaidVendor {
  id: string;
  name: string; // 상호명 / 기관명 (예: 국세청 부가세, 두올, 건강보험공단)
  category: UnpaidCategory;
  note?: string;
  transactions: UnpaidTransaction[];
  createdAt: string;
}

export const UNPAID_CATEGORIES: {
  name: UnpaidCategory;
  badgeClass: string;
  dotClass: string;
  barClass: string;
}[] = [
  {
    name: '세금·4대보험',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
    barClass: 'bg-rose-500',
  },
  {
    name: '매입·거래처',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-600',
    barClass: 'bg-blue-600',
  },
  {
    name: '임대·공과금',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
    barClass: 'bg-amber-500',
  },
  {
    name: '기타미납',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-500',
    barClass: 'bg-slate-500',
  },
];

export function getUnpaidCategoryMeta(category: string) {
  return (
    UNPAID_CATEGORIES.find((c) => c.name === category) || UNPAID_CATEGORIES[3]
  );
}

export function calculateVendorStats(vendor: UnpaidVendor) {
  let totalCharged = 0;
  let totalPaid = 0;
  (vendor.transactions || []).forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'charge') totalCharged += amt;
    else if (t.type === 'payment') totalPaid += amt;
  });
  const remaining = Math.max(0, totalCharged - totalPaid);
  const rawRemaining = totalCharged - totalPaid;
  const paidRate =
    totalCharged > 0 ? Math.min(100, Math.round((totalPaid / totalCharged) * 100)) : 0;

  return {
    totalCharged,
    totalPaid,
    remaining,
    rawRemaining,
    paidRate,
  };
}
