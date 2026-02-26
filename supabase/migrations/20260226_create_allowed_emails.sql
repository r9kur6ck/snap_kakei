-- 許可メールアドレス（ホワイトリスト）テーブル
CREATE TABLE IF NOT EXISTS public.allowed_emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLSを有効化（一般ユーザーからのアクセスを遮断）
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- service_role（Admin Client）のみアクセス可能
-- ポリシーを作成しないことで、anon/authenticated ユーザーからの
-- SELECT/INSERT/UPDATE/DELETE をすべてブロック

-- ========================================
-- 初期データ: 許可するメールアドレスをここに追加
-- ========================================
-- INSERT INTO public.allowed_emails (email) VALUES
--     ('your-email@example.com'),
--     ('family-member@example.com');
