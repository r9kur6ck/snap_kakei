# Snap Kakei (スナップ家計簿) 詳細設計書

## 1. システム概要
**Snap Kakei** は、スマートフォンでの利用を主眼に置いた（モバイルファーストな）家計簿アプリケーションです。AI（Gemini API）によるレシート読み取り機能（OCR）を備え、支出の入力負担を軽減するとともに、予算管理や固定費の自動集計などの直感的なダッシュボード機能を提供します。

## 2. 技術スタック
- **フロントエンド・フレームワーク**: Next.js 16 (App Router)
- **UIライブラリ**: React 19, Tailwind CSS v4, Lucide React (アイコン)
- **グラフ描画**: Recharts
- **バックエンド・データベース**: Supabase (PostgreSQL, 認証機能, Row Level Security)
- **AI / OCR処理**: Google Gemini API (`@google/generative-ai`)
- **画像圧縮**: `browser-image-compression`
- **日付処理**: `date-fns`

---

## 3. データベース設計 (Supabase スキーマ)

システムのコアとなるデータモデルは以下の通りです。

### 3.1. `profiles` テーブル
ユーザー設定や基本情報を保持します。
- `id` (UUID): ユーザーID (Primary Key)
- `monthly_budget` (Number): 月々の設定予算（デフォルト：150,000円など）
- `created_at` / `updated_at` (Timestamp): 作成日・更新日

### 3.2. `categories` テーブル
支出（および収入）のカテゴリを管理します。
- `id` (UUID): カテゴリID
- `user_id` (UUID) / `wallet_id` (UUID): 紐づくユーザーまたはウォレットID
- `name` (String): カテゴリ名 (例: "食費", "交通費")
- `type` (Enum): 'expense' | 'income'
- `icon` (String), `color` (String): UI表示用のアイコンおよびカラーコード表示

### 3.3. `transactions` テーブル
日々の支出または収入のトランザクション（エントリ）履歴です。
- `id` (UUID): トランザクションID
- `user_id` / `wallet_id` (UUID): 所有者
- `amount` (Number): 金額
- `date` (Date): 発生日
- `store_name` (String): 購入店舗名
- `item_name` (String): 購入品名
- `category_id` (UUID): 紐づくカテゴリ (`categories` テーブル)
- `memo` (String): 自由記述メモ
- `receipt_image_url` (String): レシート画像のStorage URL

### 3.4. `fixed_costs` テーブル
毎月決まって発生する固定費（サブスクリプション、家賃など）を管理します。
- `id` (UUID): 固定費ID
- `name` (String): 固定費名 (例: "家賃", "Netflix")
- `amount` (Number): 金額
- `date_of_month` (Number): 毎月の支払日 (1〜31)

---

## 4. 主要機能とコンポーネント構成

### 4.1. ダッシュボード機能 (`src/app/page.tsx`)
ユーザーログイン直後に表示されるメイン画面です。
- **予算進捗可視化**: 月ごとの `monthly_budget` （予算）に対する現在の支出額（変動費＋固定費）を `ProgressBar` を用いて視覚化。
- **データ集計**: 対象月の `transactions` と `fixed_costs` をSupabaseから並列で取得（`Promise.all`）し集計。
- **カテゴリ別支出**: `CategoryPieChart` (Recharts) を用いて、何にいくら使っているかカテゴリごとの内訳を円グラフ表示。
- **固定費リマインダー**: 当月内でこれから支払い予定の固定費 (`date_of_month` >= 今日) を抽出し、通知のようにリスト表示。

### 4.2. スマートレシートスキャナー (`src/components/ReceiptScanner.tsx`)
Gemini API を活用したOCR抽出機能です。
- **入力ソースの多様化**: カメラ撮影、アルバムからの複数選択、PDFやファイルの選択に対応。
- **クライアントサイド画像圧縮**: `browser-image-compression` により、Web Workerを用いてアップロード前に画像を圧縮（最大1MB・1600px）し、通信量およびAPI呼び出しのペイロードを削減。
- **逐次OCR処理**: 複数枚画像を選択した際、ループ処理で1枚ずつサーバーサイドAPI (`/api/ocr`) へBase64形式で送信。
- **進捗UI**: 圧縮中・読み取り中のプログレス表示（何枚目/全何枚）を行い、ユーザーの体感待機時間を緩和。

### 4.3. バックエンド API (`src/app/api/ocr/route.ts`)
- **Gemini API 連携**: フロントエンドから提供されたBase64画像を受け取り、Google Generative AI モデルへプロンプトとともに送信。
- JSON形式で「店舗名 (`storeName`)」「日付 (`date`)」「合計金額 (`totalAmount`)」「品目リスト (`items`)」を構造化データとして抽出して返却。

### 4.4. 認証・ウォレット管理 (`src/components/AuthProvider.tsx`, `WalletProvider.tsx`)
- Supabase Authを使用したユーザー認証（サインアップ、ログイン、ログアウト）。
- **ウォレットプロバイダ**: 認証済みユーザーに紐づく「ウォレット（家計簿データベース単位）」をグローバルステートとして提供。個人の支出だけでなく、家族やパートナーとの共有家計簿などの将来的な拡張への土台。

---

## 5. UI/UX 設計方針

- **モバイルファースト**: スマートフォンの画面サイズに最適化されたカードレイアウト、大きなタップ領域（ボタン）。
- **ユーザーフレンドリーなフィードバック**:
  - Tailwind CSSの `animate-fade-in` や `transition-colors` などを活用したマイクロインタラクション。
  - データ取得中のローディングスピナーや半透明マスク処理。
- **カラーリング**:
  - 情報の重要度に応じた色使い（予算超過時は赤 `text-red-600`、安全圏は青やグラデーション）。
  - 各カテゴリごとに識別しやすい固有のカラー（`color` カラム）を動的に適用。

---

## 6. 今後の課題と拡張性
1. **パフォーマンス最適化**: ダッシュボードのトランザクション量が増加した際のクエリ最適化（ページネーションや、集計テーブルの導入）。
2. **共有機能 (Shareable Wallet)**: `wallet_id` ベースの設計を活かし、複数ユーザーでの同一ウォレットの招待・共有機能の解放。
3. **オフライン対応**: PWA（Progressive Web App）化によるオフライン時の閲覧・入力対応とバックグラウンド同期。
