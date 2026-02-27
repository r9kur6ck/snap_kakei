-- =============================================
-- Snap Kakei: マルチユーザー対応マイグレーション
-- =============================================
-- Supabase SQL Editor で実行してください
-- =============================================

-- 1. ウォレットテーブル
CREATE TABLE IF NOT EXISTS wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '個人の家計簿',
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    monthly_budget INTEGER DEFAULT 150000,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ウォレットメンバーテーブル
CREATE TABLE IF NOT EXISTS wallet_members (
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (wallet_id, user_id)
);

-- 3. 既存テーブルに wallet_id を追加
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'expense';
ALTER TABLE fixed_costs ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE;
ALTER TABLE fixed_costs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. インデックス作成
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_categories_wallet_id ON categories(wallet_id);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_wallet_id ON fixed_costs(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_members_user_id ON wallet_members(user_id);

-- =============================================
-- 5. RLS (Row Level Security) の設定
-- =============================================

-- wallets テーブル
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ユーザーは自分が所属するウォレットを閲覧可能" ON wallets;
CREATE POLICY "ユーザーは自分が所属するウォレットを閲覧可能" ON wallets
    FOR SELECT USING (
        id IN (SELECT wallet_id FROM wallet_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ユーザーはウォレットを作成可能" ON wallets;
CREATE POLICY "ユーザーはウォレットを作成可能" ON wallets
    FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "オーナーはウォレットを更新可能" ON wallets;
CREATE POLICY "オーナーはウォレットを更新可能" ON wallets
    FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "オーナーはウォレットを削除可能" ON wallets;
CREATE POLICY "オーナーはウォレットを削除可能" ON wallets
    FOR DELETE USING (owner_id = auth.uid());

-- wallet_members テーブル
ALTER TABLE wallet_members ENABLE ROW LEVEL SECURITY;

-- ★ 重要: wallet_members のSELECTポリシーは自分自身を参照しないこと（無限再帰防止）
DROP POLICY IF EXISTS "メンバーは自分のウォレットメンバーを閲覧可能" ON wallet_members;
CREATE POLICY "メンバーは自分のウォレットメンバーを閲覧可能" ON wallet_members
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "オーナーはメンバーを追加可能" ON wallet_members;
CREATE POLICY "オーナーはメンバーを追加可能" ON wallet_members
    FOR INSERT WITH CHECK (
        wallet_id IN (SELECT id FROM wallets WHERE owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "オーナーはメンバーを削除可能" ON wallet_members;
CREATE POLICY "オーナーはメンバーを削除可能" ON wallet_members
    FOR DELETE USING (
        wallet_id IN (SELECT id FROM wallets WHERE owner_id = auth.uid())
    );

-- transactions テーブル (RLSを更新)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "全データ閲覧" ON transactions;
DROP POLICY IF EXISTS "全データ挿入" ON transactions;
DROP POLICY IF EXISTS "全データ更新" ON transactions;
DROP POLICY IF EXISTS "全データ削除" ON transactions;
DROP POLICY IF EXISTS "Enable read for all users" ON transactions;
DROP POLICY IF EXISTS "Enable insert for all users" ON transactions;
DROP POLICY IF EXISTS "Enable update for all users" ON transactions;
DROP POLICY IF EXISTS "Enable delete for all users" ON transactions;

DROP POLICY IF EXISTS "ウォレットメンバーはトランザクションを閲覧可能" ON transactions;
CREATE POLICY "ウォレットメンバーはトランザクションを閲覧可能" ON transactions
    FOR SELECT USING (
        wallet_id IN (SELECT wallet_id FROM wallet_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ウォレットメンバーはトランザクションを追加可能" ON transactions;
CREATE POLICY "ウォレットメンバーはトランザクションを追加可能" ON transactions
    FOR INSERT WITH CHECK (
        wallet_id IN (SELECT wallet_id FROM wallet_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ウォレットメンバーはトランザクションを更新可能" ON transactions;
CREATE POLICY "ウォレットメンバーはトランザクションを更新可能" ON transactions
    FOR UPDATE USING (
        wallet_id IN (SELECT wallet_id FROM wallet_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ウォレットメンバーはトランザクションを削除可能" ON transactions;
CREATE POLICY "ウォレットメンバーはトランザクションを削除可能" ON transactions
    FOR DELETE USING (
        wallet_id IN (SELECT wallet_id FROM wallet_members WHERE user_id = auth.uid())
    );

-- categories テーブル
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "全データ閲覧" ON categories;
DROP POLICY IF EXISTS "全データ挿入" ON categories;
DROP POLICY IF EXISTS "全データ更新" ON categories;
DROP POLICY IF EXISTS "全データ削除" ON categories;
DROP POLICY IF EXISTS "Enable read for all users" ON categories;
DROP POLICY IF EXISTS "Enable insert for all users" ON categories;
DROP POLICY IF EXISTS "Enable update for all users" ON categories;
DROP POLICY IF EXISTS "Enable delete for all users" ON categories;

DROP POLICY IF EXISTS "ウォレットメンバーはカテゴリを閲覧可能" ON categories;
CREATE POLICY "ウォレットメンバーはカテゴリを閲覧可能" ON categories
    FOR SELECT USING (
        wallet_id IN (SELECT wallet_id FROM wallet_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ウォレットメンバーはカテゴリを追加可能" ON categories;
CREATE POLICY "ウォレットメンバーはカテゴリを追加可能" ON categories
    FOR INSERT WITH CHECK (
        wallet_id IN (SELECT wallet_id FROM wallet_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ウォレットメンバーはカテゴリを更新可能" ON categories;
CREATE POLICY "ウォレットメンバーはカテゴリを更新可能" ON categories
    FOR UPDATE USING (
        wallet_id IN (SELECT wallet_id FROM wallet_members WHERE user_id = auth.uid())
    );

-- fixed_costs テーブル
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "全データ閲覧" ON fixed_costs;
DROP POLICY IF EXISTS "全データ挿入" ON fixed_costs;
DROP POLICY IF EXISTS "全データ更新" ON fixed_costs;
DROP POLICY IF EXISTS "全データ削除" ON fixed_costs;
DROP POLICY IF EXISTS "Enable read for all users" ON fixed_costs;
DROP POLICY IF EXISTS "Enable insert for all users" ON fixed_costs;
DROP POLICY IF EXISTS "Enable update for all users" ON fixed_costs;
DROP POLICY IF EXISTS "Enable delete for all users" ON fixed_costs;

DROP POLICY IF EXISTS "ウォレットメンバーは固定費を閲覧可能" ON fixed_costs;
CREATE POLICY "ウォレットメンバーは固定費を閲覧可能" ON fixed_costs
    FOR SELECT USING (
        wallet_id IN (SELECT wallet_id FROM wallet_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ウォレットメンバーは固定費を追加可能" ON fixed_costs;
CREATE POLICY "ウォレットメンバーは固定費を追加可能" ON fixed_costs
    FOR INSERT WITH CHECK (
        wallet_id IN (SELECT wallet_id FROM wallet_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ウォレットメンバーは固定費を更新可能" ON fixed_costs;
CREATE POLICY "ウォレットメンバーは固定費を更新可能" ON fixed_costs
    FOR UPDATE USING (
        wallet_id IN (SELECT wallet_id FROM wallet_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "ウォレットメンバーは固定費を削除可能" ON fixed_costs;
CREATE POLICY "ウォレットメンバーは固定費を削除可能" ON fixed_costs
    FOR DELETE USING (
        wallet_id IN (SELECT wallet_id FROM wallet_members WHERE user_id = auth.uid())
    );

-- =============================================
-- 6. 新規ユーザー登録時の自動ウォレット作成トリガー
-- =============================================

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

-- 既存のトリガーがあればドロップ
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- トリガーを作成
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

