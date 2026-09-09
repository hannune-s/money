"use server";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}

export async function verifyDashboardPin(pin: string) {
  if (!supabaseServiceKey) return true; // 테스트 환경 우회

  const supabaseAdmin = getAdminClient();
  const { data, error } = await supabaseAdmin
    .from('ssakdamoa_admin_config')
    .select('dashboard_pin')
    .eq('id', 1)
    .single();
  
  if (error || !data || !data.dashboard_pin) return pin === '0000'; 
  return pin === data.dashboard_pin;
}

export async function setDashboardPin(newPin: string) {
  if (!supabaseServiceKey) {
    return { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY가 등록되지 않았습니다.' };
  }

  const supabaseAdmin = getAdminClient();
  
  const { error } = await supabaseAdmin
    .from('ssakdamoa_admin_config')
    .update({ dashboard_pin: newPin })
    .eq('id', 1);

  if (error) {
    console.error('setDashboardPin error:', error);
    return { success: false, error: 'DB 오류: 먼저 SQL 스크립트로 dashboard_pin 컬럼을 추가해주세요.' };
  }
  
  return { success: true };
}
