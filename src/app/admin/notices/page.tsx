"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface NoticeItem {
  id: string;
  type: 'notice' | 'news';
  title: string;
  content: string;
  created_at: string;
}

export default function AdminNotices() {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 폼 입력 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'notice' | 'news'>('notice');
  const [uploading, setUploading] = useState(false);

  // 수정 모드 상태
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ssakdamoa_notices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setNotices(data);
    } catch (error) {
      console.error('Error fetching notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setType('notice');
  };

  const handleEditClick = (notice: NoticeItem) => {
    setEditingId(notice.id);
    setTitle(notice.title);
    setContent(notice.content);
    setType(notice.type);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }

    setUploading(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('ssakdamoa_notices')
          .update({ title, content, type })
          .eq('id', editingId);

        if (error) throw error;
        alert('게시글이 성공적으로 수정되었습니다!');
      } else {
        const { error } = await supabase
          .from('ssakdamoa_notices')
          .insert([{ title, content, type }]);

        if (error) throw error;
        alert('게시글이 성공적으로 등록되었습니다!');
      }

      handleCancelEdit();
      fetchNotices();
    } catch (error: any) {
      console.error('Submit Error:', error);
      alert('처리 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase.from('ssakdamoa_notices').delete().eq('id', id);
      if (error) throw error;

      fetchNotices();
      if (editingId === id) handleCancelEdit();
    } catch (error: any) {
      console.error('Delete Error:', error);
      alert('삭제 중 오류가 발생했습니다: ' + error.message);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">공지·안내 관리</h1>
      <p className="text-gray-500 mb-8">앱 하단의 [공지·안내] 메뉴와 실시간으로 연동됩니다.</p>

      {/* Upload & Edit Form */}
      <div className={`rounded-2xl shadow-sm border p-4 sm:p-6 mb-8 transition-colors ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">
            {editingId ? '✍️ 게시글 수정 모드' : '새 게시글 작성'}
          </h3>
          {editingId && (
            <button 
              onClick={handleCancelEdit}
              className="text-sm font-semibold text-gray-500 hover:text-gray-800 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-200"
            >
              수정 취소
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-2xl">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">게시판 선택</label>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="type" 
                  value="notice" 
                  checked={type === 'notice'}
                  onChange={() => setType('notice')}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-800 font-medium">공지사항 (공식 안내용)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="type" 
                  value="news" 
                  checked={type === 'news'}
                  onChange={() => setType('news')}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-800 font-medium">소식 (팁, 이야기)</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">제목</label>
            <input 
              type="text" 
              placeholder="게시글 제목을 입력하세요" 
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">내용</label>
            <textarea 
              placeholder="게시글 내용을 자유롭게 입력하세요. 줄바꿈이 그대로 반영됩니다." 
              rows={6}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-y"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={uploading}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={uploading}
            className={`mt-2 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {uploading ? '처리 중...' : (editingId ? '수정 내용 저장하기' : '게시글 등록하기')}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold">등록된 게시글 목록</h3>
          <span className="text-sm text-gray-500">총 {notices.length}건</span>
        </div>
        <div className="overflow-x-auto pb-4">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm">
                <th className="px-6 py-3 font-semibold w-24 text-center">분류</th>
                <th className="px-6 py-3 font-semibold">제목</th>
                <th className="px-6 py-3 font-semibold w-32">작성일</th>
                <th className="px-6 py-3 font-semibold text-center w-36">관리</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">데이터를 불러오는 중입니다...</td>
                </tr>
              ) : notices.map((notice) => (
                <tr key={notice.id} className={`border-t border-gray-100 hover:bg-gray-50 ${editingId === notice.id ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${notice.type === 'notice' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {notice.type === 'notice' ? '공지사항' : '소식'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-800 truncate max-w-[200px]">{notice.title}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(notice.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <button 
                      onClick={() => handleEditClick(notice)}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold px-3 py-1 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors mr-2"
                    >
                      수정
                    </button>
                    <button 
                      onClick={() => handleDelete(notice.id)}
                      className="text-red-500 hover:text-red-700 font-semibold px-3 py-1 bg-red-50 hover:bg-red-100 rounded transition-colors"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && notices.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">등록된 게시글이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
