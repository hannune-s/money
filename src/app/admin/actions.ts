"use server";
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 

// Next.js의 강력한 fetch 캐시를 무력화하고 무조건 실시간 DB를 조회하도록 설정
function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}

export async function verifyPin(pin: string) {
  // 아직 환경변수 셋업이 안 되었을 때 관리자가 아예 튕기는 걸 방지하는 안전장치
  if (!supabaseServiceKey) {
    return pin === '1234';
  }

  const supabaseAdmin = getAdminClient();
  const { data, error } = await supabaseAdmin.from('ssakdamoa_admin_config').select('admin_pin').eq('id', 1).single();
  
  if (error || !data) return pin === '1234'; // 테이블 생성 전 기본값
  return pin === data.admin_pin;
}

export async function changePin(currentPin: string, newPin: string) {
  if (!supabaseServiceKey) {
    return { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY가 등록되지 않아 비밀번호를 변경할 수 없습니다.' };
  }

  const isValid = await verifyPin(currentPin);
  if (!isValid) return { success: false, error: '현재 비밀번호가 일치하지 않습니다.' };

  const supabaseAdmin = getAdminClient();
  
  // UPDATE 대신 UPSERT를 사용하여 DB에 1번 행이 없더라도 무조건 강제로 생성하며 저장하도록 수정
  const { error } = await supabaseAdmin
    .from('ssakdamoa_admin_config')
    .upsert({ id: 1, admin_pin: newPin });

  if (error) {
    console.error('changePin error:', error);
    return { success: false, error: 'DB 오류: 먼저 안내해 드린 SQL 스크립트를 실행했는지 확인해주세요.' };
  }
  
  // 성공 시 모든 어드민 페이지 캐시 즉각 삭제
  revalidatePath('/admin', 'layout');
  return { success: true };
}

export async function fetchAdminAnalytics(pin: string) {
  const isPinValid = await verifyPin(pin);
  if (!isPinValid) {
    return { error: 'Unauthorized' };
  }

  if (!supabaseServiceKey) {
    return { 
      error: 'MissingKey', 
      message: '서버 비밀키(SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다. Vercel 환경변수 및 .env.local에 추가해주세요.' 
    };
  }

  // 서버 환경에서 RLS를 우회하는 관리자(Service Role) 클라이언트 생성
  const supabaseAdmin = getAdminClient();

  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  kstNow.setUTCHours(0, 0, 0, 0);
  const startOfTodayIso = kstNow.toISOString();

  const { count: totalCount } = await supabaseAdmin
    .from('ssakdamoa_analytics')
    .select('*', { count: 'exact', head: true })
    .gte('visited_at', startOfTodayIso)
    .neq('path', 'APP_INSTALL');

  const { count: instaCount } = await supabaseAdmin
    .from('ssakdamoa_analytics')
    .select('*', { count: 'exact', head: true })
    .gte('visited_at', startOfTodayIso)
    .eq('is_instagram', true)
    .neq('path', 'APP_INSTALL');

  const { count: installCount } = await supabaseAdmin
    .from('ssakdamoa_analytics')
    .select('*', { count: 'exact', head: true })
    .gte('visited_at', startOfTodayIso)
    .eq('path', 'APP_INSTALL');

  const { data } = await supabaseAdmin
    .from('ssakdamoa_analytics')
    .select('*')
    .order('visited_at', { ascending: false })
    .limit(5);

  return {
    totalCount: totalCount || 0,
    instaCount: instaCount || 0,
    installCount: installCount || 0,
    recentVisits: data || []
  };
}

export async function fetchAdminInquiries(pin: string) {
  const isPinValid = await verifyPin(pin);
  if (!isPinValid) return { error: 'Unauthorized' };
  if (!supabaseServiceKey) return { error: 'MissingKey', message: '서버 비밀키가 없습니다.' };

  const supabaseAdmin = getAdminClient();
  const { data, error } = await supabaseAdmin
    .from('ssakdamoa_inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };
  return { inquiries: data || [] };
}

export async function deleteAdminInquiry(pin: string, id: string) {
  const isPinValid = await verifyPin(pin);
  if (!isPinValid) return { error: 'Unauthorized' };
  
  const supabaseAdmin = getAdminClient();
  const { error } = await supabaseAdmin.from('ssakdamoa_inquiries').delete().eq('id', id);
  if (error) return { error: error.message };
  
  revalidatePath('/admin', 'layout');
  return { success: true };
}
