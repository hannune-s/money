"use server";
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

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
  
  // 호환성: 기존에 저장된 평문(길이 4)인 경우 직접 비교, 아니면 해시 비교
  if (data.dashboard_pin.length === 4) {
    return pin === data.dashboard_pin;
  }
  
  return bcrypt.compareSync(pin, data.dashboard_pin);
}

export async function setDashboardPin(newPin: string) {
  if (!supabaseServiceKey) {
    return { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY가 등록되지 않았습니다.' };
  }

  // 비밀번호 해싱 처리 (Bcrypt)
  const salt = bcrypt.genSaltSync(10);
  const hashedPin = bcrypt.hashSync(newPin, salt);

  const supabaseAdmin = getAdminClient();
  
  const { error } = await supabaseAdmin
    .from('ssakdamoa_admin_config')
    .update({ dashboard_pin: hashedPin })
    .eq('id', 1);

  if (error) {
    console.error('setDashboardPin error:', error);
    return { success: false, error: 'DB 업데이트 중 오류가 발생했습니다.' };
  }
  
  return { success: true };
}
