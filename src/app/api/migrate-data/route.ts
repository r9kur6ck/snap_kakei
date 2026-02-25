import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// wallet_id が未設定の既存データを現在のユーザーのウォレットに紐付ける
export async function POST() {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: '認証されていません' }, { status: 401 });
        }

        const admin = createAdminClient();

        // ユーザーのウォレットを取得
        const { data: members } = await admin
            .from('wallet_members')
            .select('wallet_id')
            .eq('user_id', user.id)
            .limit(1);

        if (!members || members.length === 0) {
            return NextResponse.json({ error: 'ウォレットが見つかりません' }, { status: 404 });
        }

        const walletId = members[0].wallet_id;
        let migrated = { categories: 0, transactions: 0, fixedCosts: 0 };

        // wallet_id が NULL かつ自分のカテゴリを紐付け
        const { data: cats } = await admin
            .from('categories')
            .update({ wallet_id: walletId })
            .is('wallet_id', null)
            .eq('user_id', user.id)
            .select('id');
        migrated.categories = cats?.length || 0;

        // wallet_id が NULL かつ自分のトランザクションを紐付け
        const { data: txs } = await admin
            .from('transactions')
            .update({ wallet_id: walletId })
            .is('wallet_id', null)
            .eq('user_id', user.id)
            .select('id');
        migrated.transactions = txs?.length || 0;

        // wallet_id が NULL かつ自分の固定費を紐付け
        const { data: fcs } = await admin
            .from('fixed_costs')
            .update({ wallet_id: walletId })
            .is('wallet_id', null)
            .eq('user_id', user.id)
            .select('id');
        migrated.fixedCosts = fcs?.length || 0;

        return NextResponse.json({
            message: 'データ移行が完了しました',
            migrated,
        });
    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
