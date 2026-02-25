import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * 以下のパスを除くすべてのリクエストをマッチ:
         * - _next/static (静的ファイル)
         * - _next/image (画像最適化)
         * - favicon.ico, manifest.json, アイコン等
         */
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};
