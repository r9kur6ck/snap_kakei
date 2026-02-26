import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// メールアドレスがホワイトリストに登録されているかチェック
export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { error: 'メールアドレスが必要です' },
                { status: 400 }
            );
        }

        const admin = createAdminClient();
        const { data, error } = await admin
            .from('allowed_emails')
            .select('id')
            .eq('email', email.toLowerCase().trim())
            .limit(1);

        if (error) {
            console.error('Allowed emails check error:', error);
            return NextResponse.json(
                { error: '検証中にエラーが発生しました' },
                { status: 500 }
            );
        }

        if (!data || data.length === 0) {
            return NextResponse.json(
                { allowed: false, error: 'このメールアドレスは招待されていません' },
                { status: 403 }
            );
        }

        return NextResponse.json({ allowed: true });
    } catch (err: any) {
        console.error('Validate email error:', err);
        return NextResponse.json(
            { error: 'サーバーエラーが発生しました' },
            { status: 500 }
        );
    }
}
