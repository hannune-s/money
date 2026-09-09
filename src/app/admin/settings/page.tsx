"use client";
import { useState } from 'react';
import { changePin } from '../actions';

export default function AdminSettings() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPin !== confirmPin) {
      setErrorMsg('새 비밀번호가 서로 일치하지 않습니다.');
      return;
    }
    if (newPin.length !== 4) {
      setErrorMsg('새 비밀번호는 4자리 숫자로 입력해주세요.');
      return;
    }
    if (currentPin === newPin) {
      setErrorMsg('기존 비밀번호와 동일합니다.');
      return;
    }

    setLoading(true);
    try {
      const result = await changePin(currentPin, newPin);
      if (result.success) {
        // 브라우저의 로컬스토리지 로그인 세션값도 새 비밀번호로 업데이트
        localStorage.setItem('admin_pin', newPin);
        setSuccessMsg('비밀번호가 성공적으로 변경되었습니다!');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        setErrorMsg(result.error || '비밀번호 변경에 실패했습니다.');
      }
    } catch (err) {
      setErrorMsg('서버와 통신하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">보안 설정</h1>
      <p className="text-gray-500 mb-8">관리자 접속용 비밀번호(PIN)를 변경합니다.</p>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-lg font-bold text-gray-800 mb-6">비밀번호 변경</h2>

        {errorMsg && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-xl text-sm font-medium border border-green-100">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">현재 비밀번호</label>
            <input 
              type="password"
              maxLength={4}
              value={currentPin}
              onChange={e => setCurrentPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
              placeholder="****"
              required
            />
          </div>

          <div className="border-t border-gray-100 my-2"></div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">새 비밀번호 (4자리 숫자)</label>
            <input 
              type="password"
              maxLength={4}
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
              placeholder="****"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">새 비밀번호 확인</label>
            <input 
              type="password"
              maxLength={4}
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
              placeholder="****"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl transition-colors shadow-sm"
          >
            {loading ? '변경 중...' : '비밀번호 변경하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
