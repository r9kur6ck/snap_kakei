import { createClient } from '@supabase/supabase-js';

// 管理者権限クライアント（サーバーサイドのみ使用）
// RLSをバイパスして管理操作を実行できる
export const createAdminClient = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!serviceKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY が設定されていません');
    }

    return createClient(url, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
};
