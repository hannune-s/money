import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// 빌드 타임에 환경변수가 없어서 발생하는 에러 방지
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@ssakdamoa.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, message, url, adminPin } = body;

    if (!title || !message) {
      return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });
    }

    // 어드민 핀 검증 (기본적인 보안)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: config } = await supabaseAdmin.from('ssakdamoa_admin_config').select('admin_pin').eq('id', 1).single();
    const validPin = config ? config.admin_pin : '1234';

    if (adminPin !== validPin) {
      return NextResponse.json({ error: '권한이 없습니다 (잘못된 PIN).' }, { status: 403 });
    }

    // 전체 구독자 목록 조회
    const { data: subscribers, error: dbError } = await supabaseAdmin
      .from('ssakdamoa_push_subscribers')
      .select('*');

    if (dbError) {
      return NextResponse.json({ error: '구독자 조회 실패' }, { status: 500 });
    }

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: '발송할 대상(구독자)이 없습니다.' });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: url || '/',
      icon: '/icons/icon-192x192.png', // PWA 기본 아이콘
      badge: '/icons/icon-72x72.png' // 작은 뱃지 아이콘
    });

    let successCount = 0;
    let failCount = 0;

    const promises = subscribers.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        successCount++;
      } catch (err: any) {
        failCount++;
        // 권한 취소, 삭제된 기기 등 (410 Gone) -> DB에서 자동 삭제
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from('ssakdamoa_push_subscribers').delete().eq('id', sub.id);
        }
      }
    });

    await Promise.all(promises);

    return NextResponse.json({
      success: true,
      count: successCount,
      failed: failCount,
      message: `발송 완료: 성공 ${successCount}건, 실패(삭제된기기등) ${failCount}건`
    });

  } catch (error: any) {
    console.error('Push Notification Error:', error);
    return NextResponse.json({ error: '내부 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
