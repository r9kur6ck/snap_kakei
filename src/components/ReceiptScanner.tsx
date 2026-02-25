'use client';

import { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, FolderOpen, X } from 'lucide-react';

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
    onScanComplete?: (results: OcrResult[]) => void;
    onCancel?: () => void;
}

export default function ReceiptScanner({ onScanComplete, onCancel }: ReceiptScannerProps) {
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const cameraInputRef = useRef<HTMLInputElement>(null);
    const albumInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ファイル選択ハンドラ（共通）
    const handleFilesSelected = (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newFiles = Array.from(files);
        const newPreviews = newFiles.map(file => URL.createObjectURL(file));

        setImages(prev => [...prev, ...newFiles]);
        setPreviews(prev => [...prev, ...newPreviews]);
    };

    // 個別の画像を削除
    const handleRemoveImage = (index: number) => {
        URL.revokeObjectURL(previews[index]);
        setImages(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    // 全クリア
    const handleClearAll = () => {
        previews.forEach(url => URL.revokeObjectURL(url));
        setImages([]);
        setPreviews([]);
    };

    // Base64変換
    const toBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            };
            reader.onerror = (error) => reject(error);
        });

    // OCR実行（逐次処理）
    const handleScan = async () => {
        if (images.length === 0) return;

        setLoading(true);
        setProgress({ current: 0, total: images.length });

        const results: OcrResult[] = [];
        const errors: number[] = [];

        for (let i = 0; i < images.length; i++) {
            setProgress({ current: i + 1, total: images.length });

            try {
                const base64 = await toBase64(images[i]);
                const res = await fetch('/api/ocr', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64: base64 }),
                });

                if (!res.ok) {
                    const errBody = await res.json().catch(() => ({}));
                    throw new Error(errBody.error || `スキャンに失敗しました (HTTP ${res.status})`);
                }

                const data: OcrResult = await res.json();
                results.push(data);
            } catch (err) {
                console.error(`Image ${i + 1} OCR failed:`, err);
                errors.push(i + 1);
            }
        }

        setLoading(false);

        if (results.length === 0) {
            alert('すべてのレシートの読み取りに失敗しました。画像を確認してください。');
            return;
        }

        if (errors.length > 0) {
            alert(`${errors.length}枚のレシートの読み取りに失敗しました（${errors.join(', ')}枚目）。成功した分を反映します。`);
        }

        if (onScanComplete) {
            onScanComplete(results);
        }
    };

    return (
        <div className="p-5 bg-white rounded-2xl shadow-xl flex flex-col items-center">
            <h2 className="text-lg font-bold mb-1">📸 レシートをスキャン</h2>
            <p className="text-[11px] text-gray-500 mb-5 text-center">
                AIが金額や日付を自動で読み取ります
            </p>

            {/* 3つの入力方法 */}
            <div className="w-full grid grid-cols-3 gap-2.5 mb-5">
                {/* カメラ */}
                <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                        <Camera size={20} className="text-white" />
                    </div>
                    <span className="text-[11px] font-semibold text-blue-700">カメラ</span>
                </button>
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    className="hidden"
                />

                {/* アルバム */}
                <button
                    type="button"
                    onClick={() => albumInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
                >
                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                        <ImageIcon size={20} className="text-white" />
                    </div>
                    <span className="text-[11px] font-semibold text-purple-700">アルバム</span>
                </button>
                <input
                    ref={albumInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    className="hidden"
                />

                {/* ファイル */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                >
                    <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                        <FolderOpen size={20} className="text-white" />
                    </div>
                    <span className="text-[11px] font-semibold text-amber-700">ファイル</span>
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    className="hidden"
                />
            </div>

            {/* プレビューグリッド */}
            {previews.length > 0 && (
                <div className="w-full mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-600">
                            {images.length}枚のレシート
                        </p>
                        <button
                            onClick={handleClearAll}
                            className="text-[10px] text-red-400 hover:text-red-500 font-medium"
                        >
                            すべて削除
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {previews.map((url, i) => (
                            <div key={i} className="relative group aspect-[3/4] rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                <img
                                    src={url}
                                    alt={`Receipt ${i + 1}`}
                                    className="w-full h-full object-cover"
                                />
                                <button
                                    onClick={() => handleRemoveImage(i)}
                                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={12} className="text-white" />
                                </button>
                                <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                                    {i + 1}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 進捗表示 */}
            {loading && (
                <div className="w-full mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                        <p className="text-xs font-semibold text-blue-600">
                            {progress.total > 1
                                ? `${progress.current} / ${progress.total} 枚目を読み取り中...`
                                : '読み取り中...'
                            }
                        </p>
                    </div>
                    {progress.total > 1 && (
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                                className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* アクションボタン */}
            <div className="flex w-full gap-3 mt-2">
                <button
                    onClick={onCancel}
                    disabled={loading}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold disabled:opacity-50 transition-colors"
                >
                    キャンセル
                </button>
                <button
                    onClick={handleScan}
                    disabled={images.length === 0 || loading}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:bg-gray-300 disabled:shadow-none shadow-md transition-colors"
                >
                    {loading
                        ? `処理中 (${progress.current}/${progress.total})`
                        : images.length > 1
                            ? `${images.length}枚を読み取る`
                            : '抽出を実行'
                    }
                </button>
            </div>
        </div>
    );
}
