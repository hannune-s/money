"use server";
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const PIN_CONFIG_DATE = '1970-01-02';

function getDbClient() {
  const key = supabaseServiceKey || supabaseAnonKey;
  return createClient(supabaseUrl, key, {
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}

interface PinConfigData {
  dashboardPinHash?: string;
  adminPinHash?: string;
}

async function getStoredPinConfig(): Promise<PinConfigData> {
  if (!supabaseUrl || (!supabaseServiceKey && !supabaseAnonKey)) return {};
  try {
    const client = getDbClient();
    const { data } = await client
      .from('money_finances')
      .select('memo')
      .eq('target_date', PIN_CONFIG_DATE)
      .single();

    if (data?.memo) {
      const parsed = JSON.parse(data.memo);
      if (parsed && typeof parsed === 'object') {
        return parsed as PinConfigData;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

async function saveStoredPinConfig(patch: Partial<PinConfigData>): Promise<{ success: boolean; error?: string }> {
  if (!supabaseUrl || (!supabaseServiceKey && !supabaseAnonKey)) {
    return { success: false, error: 'Supabase 환경변수가 설정되지 않았습니다.' };
  }
  const client = getDbClient();
  const current = await getStoredPinConfig();
  const next: PinConfigData = { ...current, ...patch };

  const { error } = await client
    .from('money_finances')
    .upsert(
      [
        {
          target_date: PIN_CONFIG_DATE,
          accounts: [],
          expenditures: [],
          total_account_balance: 0,
          total_expenditure: 0,
          final_balance: 0,
          memo: JSON.stringify(next),
        },
      ],
      { onConflict: 'target_date' }
    );

  if (error) {
    console.error('saveStoredPinConfig error:', error);
    return { success: false, error: 'DB 업데이트 중 오류가 발생했습니다.' };
  }
  return { success: true };
}

function comparePinValue(pin: string, storedValue: string): boolean {
  if (storedValue.length === 4) {
    return pin === storedValue;
  }
  return bcrypt.compareSync(pin, storedValue);
}

export async function verifyDashboardPin(pin: string) {
  const config = await getStoredPinConfig();
  if (config.dashboardPinHash) {
    return comparePinValue(pin, config.dashboardPinHash);
  }

  if (supabaseServiceKey) {
    const client = getDbClient();
    const { data, error } = await client
      .from('ssakdamoa_admin_config')
      .select('dashboard_pin')
      .eq('id', 1)
      .single();

    if (!error && data?.dashboard_pin) {
      return comparePinValue(pin, data.dashboard_pin);
    }
  }

  return pin === '0000' || pin === '1234';
}

export async function setDashboardPin(newPin: string) {
  const salt = bcrypt.genSaltSync(10);
  const hashedPin = bcrypt.hashSync(newPin, salt);

  const res = await saveStoredPinConfig({ dashboardPinHash: hashedPin });
  if (!res.success) return res;

  if (supabaseServiceKey) {
    const client = getDbClient();
    await client
      .from('ssakdamoa_admin_config')
      .update({ dashboard_pin: hashedPin })
      .eq('id', 1);
  }

  return { success: true };
}

export async function verifyAdminPin(pin: string) {
  const config = await getStoredPinConfig();
  if (config.adminPinHash) {
    return comparePinValue(pin, config.adminPinHash);
  }

  if (supabaseServiceKey) {
    const client = getDbClient();
    const { data, error } = await client
      .from('ssakdamoa_admin_config')
      .select('admin_pin')
      .eq('id', 1)
      .single();

    if (!error && data?.admin_pin) {
      return comparePinValue(pin, data.admin_pin);
    }
  }

  return pin === '1234' || pin === '0000';
}

export async function setAdminPin(newPin: string) {
  const salt = bcrypt.genSaltSync(10);
  const hashedPin = bcrypt.hashSync(newPin, salt);

  const res = await saveStoredPinConfig({ adminPinHash: hashedPin });
  if (!res.success) return res;

  if (supabaseServiceKey) {
    const client = getDbClient();
    await client
      .from('ssakdamoa_admin_config')
      .update({ admin_pin: hashedPin })
      .eq('id', 1);
  }

  return { success: true };
}

