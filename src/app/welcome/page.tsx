'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function WelcomePage() {
    const router = useRouter();
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        // マウント後にアニメーション開始
        const timer = setTimeout(() => setShowContent(true), 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen bg-blue-50 flex items-center justify-center p-6 overflow-hidden relative">
            {/* 背景の装飾パーティクル */}
            <div className="absolute inset-0 pointer-events-none">
                {['🎉', '✨', '🎊', '⭐', '💫', '🌟', '🎉', '✨', '🎊', '⭐'].map((emoji, i) => (
                    <span
                        key={i}
                        className="absolute text-2xl animate-bounce"
                        style={{
                            left: `${10 + (i * 9) % 80}%`,
                            top: `${5 + (i * 13) % 70}%`,
                            animationDelay: `${i * 0.3}s`,
                            animationDuration: `${2 + (i % 3)}s`,
                            opacity: 0.6,
                        }}
                    >
                        {emoji}
                    </span>
                ))}
            </div>

            <div
                className={`w-full max-w-sm text-center transition-all duration-700 ease-out ${showContent
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 translate-y-8 scale-95'
                    }`}
            >
                {/* アイコン */}
                <div className="relative mx-auto mb-6 w-24 h-24">
                    <div className="absolute inset-0 bg-blue-400 rounded-3xl rotate-6 opacity-20" />
                    <div className="relative w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-200">
                        <span className="text-5xl">🎉</span>
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                        <Sparkles size={16} className="text-white" />
                    </div>
                </div>

                {/* メッセージ */}
                <h1 className="text-2xl font-extrabold text-blue-600 mb-2">
                    Snap Kakeiへようこそ！
                </h1>
                <p className="text-gray-600 text-sm mb-2">
                    アカウントの登録が完了しました 🎊
                </p>
                <p className="text-gray-500 text-xs mb-8 leading-relaxed">
                    レシートを撮影するだけで、AIが自動で<br />
                    家計簿をつけてくれます。さっそく始めましょう！
                </p>

                {/* カード */}
                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 mb-6">
                    <div className="flex items-center gap-3 text-left mb-4">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                            <span className="text-lg">✅</span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-800">準備完了！</p>
                            <p className="text-[11px] text-gray-500">ウォレットとカテゴリが自動で作成されます</p>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push('/')}
                        className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group"
                    >
                        家計簿を使い始める
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                <p className="text-[10px] text-gray-400">
                    © 2026 Snap Kakei. All rights reserved.
                </p>
            </div>
        </div>
    );
}
