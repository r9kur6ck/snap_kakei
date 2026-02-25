import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini APIを用いてレシート画像から必要なJSONデータを抽出するAPI
export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: '画像データが必要です' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY が設定されていません' }, { status: 500 });
    }

    // Gemini API クライアントの初期化
    const genAI = new GoogleGenerativeAI(apiKey);

    // 最新の gemini-2.5-flash モデルを使用
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      あなたは優秀な入力をアシストするデータ抽出AIです。
      ユーザーから送信されたレシートの画像から、以下の情報を抽出し、JSON形式でのみ回答してください。
      - storeName: 店名
      - date: 日付 (YYYY-MM-DD形式)
      - totalAmount: レシートの総合計金額（税込） (数値のみ, カンマなし)
      - items: レシートに記載されている個別の購入品目の配列。各品目は以下のプロパティを持つこと。
        - itemName: 品名
        - amount: その品目の金額 (数値のみ, カンマなし)
        - categoryName: その品目が一般的に属するカテゴリ名（例：「食費」「日用品」「交通費」「交際費」「衣服」「医療費」「特別費」などから最も適切なものを推測）
      
      ※合計金額、消費税のみの行、割引額のみの行などは除外し、具体的な購入品目（商品）のみを配列に含めてください。
      
      必ず以下のようなJSONのみを出力してください。Markdownブロック（\`\`\`json など）やその他の説明文は一切含めないでください。
      {"storeName": "スーパーA", "date": "2024-05-10", "totalAmount": 4580, "items": [{"itemName": "キャベツ", "amount": 150, "categoryName": "食費"}, {"itemName": "洗剤", "amount": 310, "categoryName": "日用品"}]}
    `;

    const imageParts = [
      {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg' // ここはフロントエンドから送られる画像形式に合わせて適宜調整
        },
      },
    ];

    // Geminiへリクエスト送信
    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();

    // 不要な空白やMarkdownブロックが混ざった場合の安全策として正規表現でパース
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`JSON format not found in response: ${responseText}`);
    }

    const parsedData = JSON.parse(jsonMatch[0]);

    return NextResponse.json(parsedData, { status: 200 });
  } catch (error) {
    console.error('OCR Route Error (Gemini):', error);
    return NextResponse.json({ error: 'OCR処理に失敗しました。画像の形式や解像度を確認してください。' }, { status: 500 });
  }
}
