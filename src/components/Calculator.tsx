"use client";
import { useState } from 'react';

export default function Calculator() {
  const [price, setPrice] = useState<number | ''>('');
  const [cost, setCost] = useState<number | ''>('');
  const [feeRate, setFeeRate] = useState<number | ''>('');
  const [fixedFee, setFixedFee] = useState<number | ''>('');

  const numPrice = Number(price) || 0;
  const numCost = Number(cost) || 0;
  const numFeeRate = Number(feeRate) || 0;
  const numFixedFee = Number(fixedFee) || 0;

  // 계산 로직
  const totalFee = (numPrice * (numFeeRate / 100)) + numFixedFee;
  const settlement = numPrice - totalFee;
  const netProfit = settlement - numCost;

  const netProfitPercent = numPrice > 0 ? (netProfit / numPrice) * 100 : 0;
  const costPercent = numPrice > 0 ? (numCost / numPrice) * 100 : 0;
  const feePercent = numPrice > 0 ? (totalFee / numPrice) * 100 : 0;

  return (
    <div className="w-full max-w-2xl flex flex-col items-center">
      <div className="w-full bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4 sm:gap-6">
        <div className="text-center mb-1">
          <h2 className="text-lg sm:text-xl font-extrabold text-blue-600 mb-1">마진율/원가율 간이 계산기</h2>
          <p className="text-gray-500 text-[11px] sm:text-sm">복잡한 플랫폼 수수료와 순이익을 한눈에 확인해보세요.</p>
        </div>
        
        {/* 입력 영역 (모바일 1화면 최적화) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-bold text-gray-800">판매가 (원)</label>
            <input 
              type="number" 
              placeholder="예: 20000"
              value={price}
              onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-bold text-gray-800">재료/포장 원가 (원)</label>
            <input 
              type="number" 
              placeholder="예: 6000"
              value={cost}
              onChange={(e) => setCost(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-bold text-gray-800">플랫폼/카드 수수료율 (%)</label>
            <input 
              type="number" 
              placeholder="예: 6.8"
              step="0.1"
              value={feeRate}
              onChange={(e) => setFeeRate(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-bold text-gray-800 truncate">건당 고정 수수료 <span className="text-gray-400 font-normal">선택</span></label>
            <input 
              type="number" 
              placeholder="예: 2500"
              value={fixedFee}
              onChange={(e) => setFixedFee(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 결과 영역 */}
        <div className="mt-2 border-t border-gray-100 pt-4">
          <div className="bg-blue-50/50 p-4 sm:p-5 rounded-2xl border border-blue-100 flex flex-col gap-3">
            
            <div className="flex justify-between items-center pb-3 border-b border-blue-200/50">
              <span className="text-gray-600 font-bold text-sm sm:text-base">통장 입금액 (정산금)</span>
              <span className="text-xl sm:text-2xl font-extrabold text-gray-800">
                {Math.round(settlement).toLocaleString()}원
              </span>
            </div>

            <div className="flex justify-between items-center pb-2">
              <span className="text-base sm:text-lg font-extrabold text-blue-700">최종 순이익</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-blue-700">
                {Math.round(netProfit).toLocaleString()}원
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-white py-2 px-1 rounded-lg border border-gray-100 text-center flex flex-col justify-center">
                <span className="text-[10px] sm:text-xs text-gray-500 mb-0.5">원가 비중</span>
                <span className="text-sm sm:text-base font-bold text-gray-700">{costPercent.toFixed(1)}%</span>
              </div>
              <div className="bg-white py-2 px-1 rounded-lg border border-gray-100 text-center flex flex-col justify-center">
                <span className="text-[10px] sm:text-xs text-gray-500 mb-0.5">수수료 비중</span>
                <span className="text-sm sm:text-base font-bold text-red-500">{feePercent.toFixed(1)}%</span>
              </div>
              <div className="bg-white py-2 px-1 rounded-lg border border-blue-100 text-center flex flex-col justify-center shadow-sm">
                <span className="text-[10px] sm:text-xs text-blue-600 mb-0.5">순이익 비중</span>
                <span className="text-sm sm:text-base font-bold text-blue-700">{netProfitPercent.toFixed(1)}%</span>
              </div>
            </div>

          </div>
        </div>

        <p className="text-center font-bold text-gray-700 mt-1 text-xs sm:text-sm">
          💡 플랫폼 수수료로 새어나가는 돈을 확인해보세요.
        </p>
      </div>
    </div>
  );
}
