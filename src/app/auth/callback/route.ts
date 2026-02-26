import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// メール確認後のコールバック処理
export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await createServerSupabaseClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data?.user) {
            // 新規登録（メール確認）の場合: created_at と email_confirmed_at がほぼ同時
            // → ウェルカムページへリダイレクト
            const createdAt = new Date(data.user.created_at).getTime();
            const confirmedAt = data.user.email_confirmed_at
                ? new Date(data.user.email_confirmed_at).getTime()
                : 0;

            // created_at と email_confirmed_at の差が60秒以内 → 新規登録直後のメール確認
            const isNewSignUp = confirmedAt > 0 && Math.abs(confirmedAt - createdAt) < 60_000;

            if (isNewSignUp) {
                return NextResponse.redirect(`${origin}/welcome`);
            }

            return NextResponse.redirect(`${origin}${next}`);
        }

        if (!error) {
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // エラー時はログインページにリダイレクト
    return NextResponse.redirect(`${origin}/login?error=auth`);
}
