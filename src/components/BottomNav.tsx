'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PieChart, PlusCircle, Settings, Camera } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function BottomNav() {
    const pathname = usePathname();
    const { user } = useAuth();

    // ログインページではナビゲーションを非表示
    if (pathname.startsWith('/login') || !user) {
        return null;
    }

    const navItems = [
        { name: 'ホーム', href: '/', icon: Home },
        { name: '分析', href: '/analytics', icon: PieChart },
        { name: '入力', href: '/input', icon: PlusCircle, highlight: true },
        { name: 'スキャン', href: '/scan', icon: Camera },
        { name: '設定', href: '/settings', icon: Settings },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-100 z-50">
            <div className="flex justify-around items-center h-16 max-w-md mx-auto pb-safe">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    if (item.highlight) {
                        return (
                            <div key={item.name} className="relative -top-4 flex flex-col items-center">
                                <Link
                                    href={item.href}
                                    className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all active:scale-95 ${isActive
                                        ? 'bg-blue-600 text-white shadow-blue-300'
                                        : 'bg-blue-600 text-white shadow-blue-200'
                                        }`}
                                >
                                    <Icon size={26} strokeWidth={2} />
                                </Link>
                                <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {item.name}
                                </span>
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] gap-0.5 transition-colors active:scale-95 ${isActive ? 'text-blue-600' : 'text-gray-400'
                                }`}
                        >
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                            <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
