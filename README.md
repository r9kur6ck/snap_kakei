# 📸 Snap Kakei

> 入力の手間を極限まで減らし、今の懐事情を瞬時に把握できるスマホ家計簿アプリ

## ✨ 主な機能

| 機能 | 説明 |
|------|------|
| 📊 **ダッシュボード** | 予算進捗、カテゴリ別円グラフ、固定費引落予定を一目で確認 |
| 📷 **レシートスキャン** | カメラでレシートを撮影→AIが店名・品目・金額を自動読み取り |
| ✏️ **手動入力** | 複数明細の一括入力、AIカテゴリ自動提案 |
| 📈 **分析** | 月別推移、日別棒グラフ、年間トレンド、支出ランキング |
| ⚙️ **設定** | 固定費管理（CRUD）、月間予算設定、CSV エクスポート |

## 🛠 技術スタック

- **フロントエンド**: Next.js 16 (App Router) / React / TypeScript
- **スタイリング**: Tailwind CSS v4
- **認証**: Supabase Auth (Email / Password)
- **データベース**: Supabase (PostgreSQL) + RLS (Row Level Security)
- **OCR / AI**: Google Gemini API
- **グラフ**: Recharts
- **デプロイ**: Cloudflare Pages
- **PWA**: ホーム画面追加対応

## 🔒 セキュリティ & アーキテクチャ

- **マルチユーザー対応**: Supabase Auth によりユーザーごとにデータを分離。
- **ウォレットシステム**: `wallets` と `wallet_members` テーブルにより家計簿を管理。ユーザー登録時に自動で専用のウォレットとデフォルトカテゴリが初期化されます。
- **RLS (Row Level Security)**: データベースレベルで強力なアクセス制御を行い、他のユーザーのデータには絶対にアクセスできない設計になっています。
- **データマイグレーションAPI**: サポート用として孤立したデータを現在のウォレットに紐付けるリカバリー機能も実装済み。

## 🚀 セットアップ

### 1. クローン & インストール
```bash
git clone https://github.com/r9kur6ck/snap_kakei.git
cd snap_kakei
npm install
```

### 2. 環境変数
`.env.local` を作成し、各種キーを設定します:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Supabase マイグレーション
Supabase の SQL Editor にて、本リポジトリ直下の `supabase_migration.sql` を全文コピペして実行し、テーブル、RLSポリシー、およびトリガーを作成してください。

### 4. 起動
```bash
npm run dev
```
http://localhost:3000 でアクセス

## 📱 モバイル最適化

- iOS / Android のホーム画面に追加してアプリとして利用可能
- 48px 最小タッチターゲット
- iOS セーフエリア対応
- 16px 入力フィールド（自動ズーム防止）

## 📁 ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx          # ホーム（ダッシュボード）
│   ├── analytics/        # 分析ページ
│   ├── input/            # 手動入力ページ
│   ├── scan/             # レシートスキャンページ
│   ├── settings/         # 設定ページ
│   └── api/ocr/          # OCR API Route
├── components/
│   ├── BottomNav.tsx      # ボトムナビゲーション
│   ├── ReceiptScanner.tsx # レシート読み取りコンポーネント
│   ├── charts/           # Recharts グラフ群
│   └── ui/               # 汎用UIコンポーネント
├── lib/supabase/         # Supabaseクライアント
└── types/                # TypeScript型定義
```

## ライセンス

MIT
