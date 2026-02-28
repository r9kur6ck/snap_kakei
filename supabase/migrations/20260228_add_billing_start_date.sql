-- wallets テーブルに billing_start_date カラムを追加（デフォルトは1日＝従来通り月初）
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS billing_start_date INTEGER DEFAULT 1;

-- 1〜28日の範囲に制限（29〜31日は月によって存在しないため）
ALTER TABLE wallets ADD CONSTRAINT check_billing_start_date CHECK (billing_start_date BETWEEN 1 AND 28);
