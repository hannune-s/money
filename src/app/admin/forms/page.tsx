"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface FormItem {
  id: string;
  title: string;
  description: string;
  file_url: string;
  downloads: number;
  created_at: string;
}

export default function AdminForms() {
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 폼 입력 상태
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // 수정 모드 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFileUrl, setEditingFileUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ssakdamoa_forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setForms(data);
    } catch (error) {
      console.error('Error fetching forms:', error);
    } finally {
      setLoading(false);
    }
  };

  // 수정 취소 및 폼 초기화
  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setEditingFileUrl(null);
    setFile(null);
    
    // 파일 input 필드 시각적 초기화를 위해 (꼼수)
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // 테이블에서 수정 버튼 클릭 시
  const handleEditClick = (form: FormItem) => {
    setEditingId(form.id);
    setTitle(form.title);
    setDescription(form.description);
    setEditingFileUrl(form.file_url);
    setFile(null); // 기존 파일이 있으므로 비워둠
    
    // 화면 맨 위로 부드럽게 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 양식 등록 및 수정(Submit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      alert('제목과 설명을 모두 입력해주세요.');
      return;
    }
    // 신규 등록일 때만 파일 필수
    if (!editingId && !file) {
      alert('업로드할 파일을 선택해주세요.');
      return;
    }

    setUploading(true);
    try {
      let finalFileUrl = editingFileUrl;

      // 새 파일이 첨부된 경우 (신규 등록이거나 기존 파일 교체)
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `forms/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('ssakdamoa-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('ssakdamoa-files')
          .getPublicUrl(filePath);

        finalFileUrl = publicUrl;

        // 파일이 교체된 거라면, 기존 파일은 스토리지에서 깨끗하게 삭제
        if (editingId && editingFileUrl) {
          const oldUrlParts = editingFileUrl.split('/');
          const oldFileName = oldUrlParts[oldUrlParts.length - 1];
          await supabase.storage.from('ssakdamoa-files').remove([`forms/${oldFileName}`]);
        }
      }

      if (editingId) {
        // [수정 모드] DB 업데이트
        const { error: updateError } = await supabase
          .from('ssakdamoa_forms')
          .update({ title, description, file_url: finalFileUrl })
          .eq('id', editingId);

        if (updateError) throw updateError;
        alert('양식이 성공적으로 수정되었습니다!');
      } else {
        // [신규 모드] DB 추가
        const { error: insertError } = await supabase
          .from('ssakdamoa_forms')
          .insert([{ title, description, file_url: finalFileUrl }]);

        if (insertError) throw insertError;
        alert('양식이 성공적으로 등록되었습니다!');
      }

      // 등록/수정 완료 후 폼 초기화 및 새로고침
      handleCancelEdit();
      fetchForms();

    } catch (error: any) {
      console.error('Submit Error:', error);
      alert('처리 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, fileUrl: string) => {
    if (!confirm('정말로 삭제하시겠습니까? (파일도 스토리지에서 영구 삭제됩니다)')) return;

    try {
      // DB에서 먼저 삭제
      const { error: dbError } = await supabase.from('ssakdamoa_forms').delete().eq('id', id);
      if (dbError) throw dbError;

      // Storage에서 파일 삭제
      const urlParts = fileUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `forms/${fileName}`;
      
      const { error: storageError } = await supabase.storage
        .from('ssakdamoa-files')
        .remove([filePath]);
        
      if (storageError) {
         console.warn('DB는 삭제되었으나, 스토리지 파일 삭제에 실패했습니다.', storageError);
      }

      fetchForms();
      // 혹시 삭제한 항목을 수정 중이었다면 폼 초기화
      if (editingId === id) handleCancelEdit();

    } catch (error: any) {
      console.error('Delete Error:', error);
      alert('삭제 중 오류가 발생했습니다: ' + error.message);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">실무 서식·양식함 관리</h1>
      <p className="text-gray-500 mb-8">메인 페이지의 서식 리스트와 실시간으로 연동됩니다.</p>

      {/* Upload & Edit Form */}
      <div className={`rounded-2xl shadow-sm border p-4 sm:p-6 mb-8 transition-colors ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">
            {editingId ? '✍️ 양식 수정 모드' : '새 양식 업로드'}
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
            <label className="block text-sm font-semibold text-gray-700 mb-1">양식 제목</label>
            <input 
              type="text" 
              placeholder="예) 근태일지 (출퇴근 기록부)" 
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">설명 (가이드)</label>
            <input 
              type="text" 
              placeholder="예) 직원/알바 출퇴근 및 근무시간 기록 양식" 
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {editingId ? '새 파일로 교체 (기존 파일을 유지하려면 비워두세요)' : '파일 선택 (PDF, HWP, DOCX 등)'}
            </label>
            <input 
              id="file-upload"
              type="file" 
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              disabled={uploading}
            />
          </div>
          <button 
            type="submit" 
            disabled={uploading}
            className={`mt-2 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {uploading ? '처리 중...' : (editingId ? '수정 내용 저장하기' : '서식 등록하기')}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold">등록된 서식 목록</h3>
          <span className="text-sm text-gray-500">총 {forms.length}건</span>
        </div>
        <div className="overflow-x-auto pb-4">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm">
                <th className="px-6 py-3 font-semibold">제목</th>
                <th className="px-6 py-3 font-semibold">설명</th>
                <th className="px-6 py-3 font-semibold text-center">다운로드 수</th>
                <th className="px-6 py-3 font-semibold text-center">관리</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">데이터를 불러오는 중입니다...</td>
                </tr>
              ) : forms.map((form) => (
                <tr key={form.id} className={`border-t border-gray-100 hover:bg-gray-50 ${editingId === form.id ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-6 py-4 font-semibold text-gray-800">{form.title}</td>
                  <td className="px-6 py-4 text-gray-500">{form.description}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">
                      {form.downloads}회
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <button 
                      onClick={() => handleEditClick(form)}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold px-3 py-1 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors mr-2"
                    >
                      수정
                    </button>
                    <button 
                      onClick={() => handleDelete(form.id, form.file_url)}
                      className="text-red-500 hover:text-red-700 font-semibold px-3 py-1 bg-red-50 hover:bg-red-100 rounded transition-colors"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && forms.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">등록된 서식이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
