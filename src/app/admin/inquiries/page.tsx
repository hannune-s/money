"use client";
import React, { useEffect, useState } from 'react';
import { fetchAdminInquiries, deleteAdminInquiry } from '../actions';

interface Inquiry {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  message: string;
  created_at: string;
}

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  useEffect(() => {
    const pin = localStorage.getItem('admin_pin') || '';
    if (pin) {
      loadInquiries(pin);
    } else {
      setLoading(false);
      setErrorMsg('관리자 인증이 필요합니다.');
    }
  }, []);

  const loadInquiries = async (pin: string) => {
    setLoading(true);
    try {
      const result = await fetchAdminInquiries(pin);
      if (result.error) {
        setErrorMsg(result.message || '데이터를 불러오지 못했습니다.');
        return;
      }
      setInquiries(result.inquiries!);
    } catch (err) {
      setErrorMsg('네트워크 에러가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 문의 내역을 정말 삭제하시겠습니까?')) return;
    
    const pin = localStorage.getItem('admin_pin') || '';
    const result = await deleteAdminInquiry(pin, id);
    if (result.success) {
      setInquiries(prev => prev.filter(item => item.id !== id));
      alert('삭제되었습니다.');
    } else {
      alert('삭제에 실패했습니다.');
    }
  };

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-red-500 font-bold">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">제휴·문의 내역</h1>
      <p className="text-gray-500 mb-8">고객들이 남긴 제휴 및 문의 내용을 확인하고 관리합니다.</p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm">
                <th className="px-6 py-4 font-semibold w-40">작성일시</th>
                <th className="px-6 py-4 font-semibold w-32">이름</th>
                <th className="px-6 py-4 font-semibold w-32">상호명</th>
                <th className="px-6 py-4 font-semibold w-40">연락처/이메일</th>
                <th className="px-6 py-4 font-semibold">문의 내용</th>
                <th className="px-6 py-4 font-semibold w-20 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">불러오는 중...</td>
                </tr>
              ) : inquiries.map((item) => (
                <React.Fragment key={item.id}>
                  <tr 
                    onClick={() => toggleExpand(item.id)}
                    className={`border-t border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                      expandedId === item.id ? 'bg-gray-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(item.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-800">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {item.company}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-blue-600 font-medium whitespace-nowrap">{item.phone}</span>
                        <span className="text-gray-500 text-xs whitespace-nowrap">{item.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[150px] inline-block">
                          {item.message}
                        </span>
                        <span className="text-xs text-gray-500 font-bold whitespace-nowrap">
                          {expandedId === item.id ? '접기 ▲' : '펼쳐보기 ▼'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-medium text-xs"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                  
                  {/* 펼쳐지는 세부 내용 영역 (일반 게시판 스타일) */}
                  {expandedId === item.id && (
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <td colSpan={6} className="px-10 py-10 border-t border-gray-200/60">
                        <div className="text-gray-800 whitespace-pre-wrap leading-relaxed text-[15px] max-w-4xl">
                          {item.message}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!loading && inquiries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">접수된 제휴·문의 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
