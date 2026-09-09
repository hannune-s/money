import { createClient } from '@supabase/supabase-js';

// .env.local 파일에 정의된 환경변수 사용
// 빌드 시 에러 방지를 위해 환경변수가 없을 경우 임시(dummy) URL을 fallback으로 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Hannune-Dev Supabase 프로젝트와 연결될 클라이언트 인스턴스
export const supabase = createClient(supabaseUrl, supabaseKey);
