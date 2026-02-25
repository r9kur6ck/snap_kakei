'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, UserPlus, LogIn } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsSubmitting(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                    },
                });
                if (error) throw error;
                setMessage('確認メールを送信しました。メールのリンクをクリックしてください。');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                window.location.href = '/';
            }
        } catch (err: any) {
            const message = err?.message || '不明なエラーが発生しました';
            if (message.includes('Invalid login credentials')) {
                setError('メールアドレスまたはパスワードが正しくありません');
            } else if (message.includes('already registered')) {
                setError('このメールアドレスは既に登録されています');
            } else if (message.includes('Password should be at least')) {
                setError('パスワードは6文字以上で入力してください');
            } else {
                setError(message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
            <div className="w-full max-w-sm">
                {/* ロゴ・タイトル */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                        <span className="text-3xl">📸</span>
                    </div>
                    <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
                        Snap Kakei
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        スマート家計簿アプリ
                    </p>
                </div>

                {/* フォーム */}
                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 text-center mb-5">
                        {isSignUp ? 'アカウント作成' : 'ログイン'}
                    </h2>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {/* メールアドレス */}
                        <div className="relative">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="メールアドレス"
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-gray-800 placeholder-gray-400"
                                required
                                autoComplete="email"
                            />
                        </div>

                        {/* パスワード */}
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="パスワード（6文字以上）"
                                className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-gray-800 placeholder-gray-400"
                                required
                                minLength={6}
                                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        {/* エラーメッセージ */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-medium rounded-xl px-4 py-3 animate-fade-in">
                                {error}
                            </div>
                        )}

                        {/* 成功メッセージ */}
                        {message && (
                            <div className="bg-green-50 border border-green-200 text-green-600 text-xs font-medium rounded-xl px-4 py-3 animate-fade-in">
                                {message}
                            </div>
                        )}

                        {/* ボタン */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : isSignUp ? (
                                <>
                                    <UserPlus size={18} />
                                    アカウント作成
                                </>
                            ) : (
                                <>
                                    <LogIn size={18} />
                                    ログイン
                                </>
                            )}
                        </button>
                    </form>

                    {/* 切り替え */}
                    <div className="mt-5 text-center">
                        <button
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError('');
                                setMessage('');
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                            {isSignUp
                                ? '既にアカウントをお持ちの方はこちら'
                                : 'アカウントをお持ちでない方はこちら'
                            }
                        </button>
                    </div>
                </div>

                <p className="text-center text-[10px] text-gray-400 mt-6">
                    © 2026 Snap Kakei. All rights reserved.
                </p>
            </div>
        </div>
    );
}
