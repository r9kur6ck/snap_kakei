-- =============================================
-- カテゴリの変動費/固定費 論理分離マイグレーション
-- =============================================
-- Supabase SQL Editor で実行してください
-- =============================================

-- 1. categories テーブルに target_type カラムを追加
-- 'transaction' = 変動費用カテゴリ, 'fixed_cost' = 固定費用カテゴリ
ALTER TABLE categories ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'transaction';

-- 2. CHECK制約を追加（有効な値のみ許可）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categories_target_type_check'
    ) THEN
        ALTER TABLE categories ADD CONSTRAINT categories_target_type_check
            CHECK (target_type IN ('transaction', 'fixed_cost'));
    END IF;
END $$;

-- 3. 既存の全カテゴリを 'transaction'（変動費用）にバックフィル
UPDATE categories SET target_type = 'transaction' WHERE target_type IS NULL;

-- 4. インデックスを追加（target_type でのフィルタリングを高速化）
CREATE INDEX IF NOT EXISTS idx_categories_target_type ON categories(target_type);

-- 5. 全既存ウォレットに固定費用のデフォルトカテゴリを挿入
-- （まだ固定費カテゴリが存在しないウォレットのみ）
INSERT INTO categories (wallet_id, user_id, name, type, color, target_type)
SELECT
    w.id,
    w.owner_id,
    cat.name,
    'expense',
    cat.color,
    'fixed_cost'
FROM wallets w
CROSS JOIN (VALUES
    ('住居費', '#78716c'),
    ('光熱費', '#f97316'),
    ('通信費', '#0ea5e9'),
    ('保険料', '#22c55e'),
    ('サブスク', '#a855f7')
) AS cat(name, color)
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.wallet_id = w.id AND c.target_type = 'fixed_cost'
);

-- 6. 新規ユーザー作成トリガーを更新（固定費カテゴリも自動作成）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_wallet_id UUID;
BEGIN
    -- SECURITY DEFINER でもRLSが効く場合があるのでバイパス
    SET LOCAL role = 'postgres';

    -- デフォルトウォレットを作成
    INSERT INTO public.wallets (name, owner_id, monthly_budget)
    VALUES ('個人の家計簿', NEW.id, 150000)
    RETURNING id INTO new_wallet_id;

    -- オーナーとしてウォレットメンバーに追加
    INSERT INTO public.wallet_members (wallet_id, user_id, role)
    VALUES (new_wallet_id, NEW.id, 'owner');

    -- デフォルトカテゴリを作成（変動費用）
    INSERT INTO public.categories (wallet_id, user_id, name, type, color, target_type) VALUES
        (new_wallet_id, NEW.id, '食費', 'expense', '#ef4444', 'transaction'),
        (new_wallet_id, NEW.id, '日用品', 'expense', '#f59e0b', 'transaction'),
        (new_wallet_id, NEW.id, '交通費', 'expense', '#3b82f6', 'transaction'),
        (new_wallet_id, NEW.id, '交際費', 'expense', '#8b5cf6', 'transaction'),
        (new_wallet_id, NEW.id, '衣服', 'expense', '#ec4899', 'transaction'),
        (new_wallet_id, NEW.id, '医療費', 'expense', '#10b981', 'transaction'),
        (new_wallet_id, NEW.id, '特別費', 'expense', '#6366f1', 'transaction'),
        (new_wallet_id, NEW.id, '趣味', 'expense', '#14b8a6', 'transaction');

    -- デフォルトカテゴリを作成（固定費用）
    INSERT INTO public.categories (wallet_id, user_id, name, type, color, target_type) VALUES
        (new_wallet_id, NEW.id, '住居費', 'expense', '#78716c', 'fixed_cost'),
        (new_wallet_id, NEW.id, '光熱費', 'expense', '#f97316', 'fixed_cost'),
        (new_wallet_id, NEW.id, '通信費', 'expense', '#0ea5e9', 'fixed_cost'),
        (new_wallet_id, NEW.id, '保険料', 'expense', '#22c55e', 'fixed_cost'),
        (new_wallet_id, NEW.id, 'サブスク', 'expense', '#a855f7', 'fixed_cost');

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- トリガーエラーでユーザー作成が失敗しないようにする
        RAISE WARNING 'handle_new_user error: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
