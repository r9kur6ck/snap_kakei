'use client';

import { useState } from 'react';

export type OcrItem = {
    itemName?: string;
    amount?: number;
    categoryName?: string;
};

export type OcrResult = {
    storeName?: string;
    date?: string;
    totalAmount?: number;
    items?: OcrItem[];
};

interface ReceiptScannerProps {
    onScanComplete?: (result: OcrResult) => void;
    onCancel?: () => void;
}

export default function ReceiptScanner({ onScanComplete, onCancel }: ReceiptScannerProps) {
    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // ファイル選択ハンドラ
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            // プレビュー用にURLを生成
            const objectUrl = URL.createObjectURL(file);
            setPreview(objectUrl);
        }
    };

    // Base64変換用のユーティリティ
    const toBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // "data:image/jpeg;base64,XXXX..." のXXXX以降を抽出
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            };
            reader.onerror = (error) => reject(error);
        });

    // OCR実行
    const handleScan = async () => {
        if (!image) return;

        setLoading(true);

        try {
            const base64 = await toBase64(image);

            const res = await fetch('/api/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64 }),
            });

            if (!res.ok) {
                throw new Error('スキャンに失敗しました');
            }

            const data: OcrResult = await res.json();

            // 呼び出し元に結果を渡す
            if (onScanComplete) {
                onScanComplete(data);
            }
        } catch (err) {
            console.error(err);
            alert('エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-white rounded-2xl shadow-xl flex flex-col items-center">
            <h2 className="text-xl font-bold mb-2">📸 レシートをスキャン</h2>
            <p className="text-xs text-gray-500 mb-6 text-center">AIが金額や日付を自動で読み取ります。明るい場所で撮影してください。</p>

            {/* カメラアクセスまたはファイル選択 */}
            <input
                type="file"
                accept="image/*"
                capture="environment" // スマートフォンの背面カメラを優先起動
                onChange={handleFileChange}
                className="mb-4 w-full text-sm text-gray-500
          file:mr-4 file:py-3 file:px-4
          file:rounded-xl file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100 cursor-pointer"
            />

            {preview && (
                <div className="mb-6 w-full flex justify-center">
                    <img
                        src={preview}
                        alt="Receipt Preview"
                        className="max-h-64 object-contain rounded-xl shadow-md border border-gray-100"
                    />
                </div>
            )}

            <div className="flex w-full gap-3 mt-4">
                <button
                    onClick={onCancel}
                    disabled={loading}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold disabled:opacity-50 transition-colors"
                >
                    キャンセル
                </button>
                <button
                    onClick={handleScan}
                    disabled={!image || loading}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:bg-gray-300 disabled:shadow-none shadow-md transition-colors"
                >
                    {loading ? '読み取り中...' : '抽出を実行'}
                </button>
            </div>
        </div>
    );
}
