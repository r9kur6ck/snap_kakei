import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const DEFAULT_CATEGORIES = [
    { name: '食費', type: 'expense', color: '#ef4444' },
    { name: '日用品', type: 'expense', color: '#f59e0b' },
    { name: '交通費', type: 'expense', color: '#3b82f6' },
    { name: '交際費', type: 'expense', color: '#8b5cf6' },
    { name: '衣服', type: 'expense', color: '#ec4899' },
    { name: '医療費', type: 'expense', color: '#10b981' },
    { name: '特別費', type: 'expense', color: '#6366f1' },
    { name: '趣味', type: 'expense', color: '#14b8a6' },
];

// ログイン済みユーザーのウォレットを初期化するAPI（冪等）
export async function POST() {
    try {
        // 認証チェック
        const supabase = await createServerSupabaseClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: '認証されていません' }, { status: 401 });
        }

        const admin = createAdminClient();
        let walletId: string;

        // 1. wallet_members から確認
        const { data: members } = await admin
            .from('wallet_members')
            .select('wallet_id')
            .eq('user_id', user.id)
            .limit(1);

        if (members && members.length > 0) {
            walletId = members[0].wallet_id as string;
        } else {
            // 2. wallets テーブルから owner_id で確認（トリガーで作成済みの孤立ウォレット対応）
            const { data: ownedWallets } = await admin
                .from('wallets')
                .select('id')
                .eq('owner_id', user.id)
                .limit(1);

            if (ownedWallets && ownedWallets.length > 0) {
                // 孤立ウォレットを発見 → wallet_members に登録
                walletId = ownedWallets[0].id;
                await admin
                    .from('wallet_members')
                    .upsert({ wallet_id: walletId, user_id: user.id, role: 'owner' },
                        { onConflict: 'wallet_id,user_id' });
            } else {
                // 3. 完全に新規作成
                const { data: wallet, error: walletError } = await admin
                    .from('wallets')
                    .insert({ name: '個人の家計簿', owner_id: user.id, monthly_budget: 150000 })
                    .select()
                    .single();

                if (walletError) {
                    console.error('Wallet creation error:', walletError);
                    return NextResponse.json({ error: walletError.message }, { status: 500 });
                }

                walletId = wallet.id;

                await admin
                    .from('wallet_members')
                    .insert({ wallet_id: walletId, user_id: user.id, role: 'owner' });
            }
        }

        // カテゴリが存在するか確認し、無ければ作成
        const { data: existingCats } = await admin
            .from('categories')
            .select('id')
            .eq('wallet_id', walletId)
            .limit(1);

        if (!existingCats || existingCats.length === 0) {
            const categories = DEFAULT_CATEGORIES.map(c => ({
                ...c,
                wallet_id: walletId,
                user_id: user.id,
            }));
            const { error: catError } = await admin.from('categories').insert(categories);
            if (catError) {
                console.error('Category creation error:', catError);
                // type/user_id カラムが無い場合のフォールバック（最小限のカラムで再試行）
                const minCategories = DEFAULT_CATEGORIES.map(c => ({
                    name: c.name,
                    color: c.color,
                    wallet_id: walletId,
                }));
                const { error: fallbackError } = await admin.from('categories').insert(minCategories);
                if (fallbackError) {
                    console.error('Category fallback creation error:', fallbackError);
                }
            }
        }

        // ウォレットの完全なデータを返す
        const { data: walletData } = await admin
            .from('wallets')
            .select('id, name, owner_id, monthly_budget')
            .eq('id', walletId)
            .single();

        return NextResponse.json({ message: 'OK', walletId, wallet: walletData });
    } catch (error: any) {
        console.error('Init wallet error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


