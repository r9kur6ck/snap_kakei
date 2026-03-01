import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 全ウォレットに「美容」カテゴリを追加するマイグレーションスクリプト
export async function GET() {
    try {
        const admin = createAdminClient();

        console.log("Starting migration to add '美容' category...");

        // 1. 全ての wallet_id を取得
        const { data: wallets, error: walletsError } = await admin
            .from('wallets')
            .select('id, owner_id');

        if (walletsError) {
            console.error('Failed to fetch wallets:', walletsError);
            return NextResponse.json({ error: walletsError.message }, { status: 500 });
        }

        if (!wallets || wallets.length === 0) {
            return NextResponse.json({ message: 'No wallets found to migrate.' });
        }

        let addedCount = 0;

        // 2. 各ウォレットに対して「美容」カテゴリが存在するか確認し、なければ追加
        for (const wallet of wallets) {
            const { data: existingCat, error: catError } = await admin
                .from('categories')
                .select('id')
                .eq('wallet_id', wallet.id)
                .eq('name', '美容')
                .limit(1);

            if (catError) {
                console.error(`Error checking category for wallet ${wallet.id}:`, catError);
                continue; // エラーがあっても次のウォレットへ進む
            }

            if (!existingCat || existingCat.length === 0) {
                // 美容カテゴリを作成
                const newCategory = {
                    name: '美容',
                    type: 'expense',
                    color: '#db2777', // ピンク系
                    target_type: 'transaction',
                    wallet_id: wallet.id,
                    user_id: wallet.owner_id // categories テーブルは user_id も必要
                };

                const { error: insertError } = await admin
                    .from('categories')
                    .insert(newCategory);

                if (insertError) {
                    // もし user_id や type カラムが存在しない古いスキーマの場合は最小構成で試行
                    console.warn(`Failed to insert with full columns for wallet ${wallet.id}, trying minimal columns. Error:`, insertError);
                    const { error: fallbackError } = await admin
                        .from('categories')
                        .insert({
                            name: '美容',
                            color: '#db2777',
                            target_type: 'transaction',
                            wallet_id: wallet.id,
                        });

                    if (fallbackError) {
                        console.error(`Fallback insert failed for wallet ${wallet.id}:`, fallbackError);
                    } else {
                        addedCount++;
                    }
                } else {
                    addedCount++;
                }
            }
        }

        console.log(`Migration completed. Added '美容' category to ${addedCount} wallets.`);

        return NextResponse.json({
            success: true,
            message: `Migration completed. Added '美容' to ${addedCount} wallets.`,
            totalWallets: wallets.length,
            addedCount: addedCount
        });

    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
