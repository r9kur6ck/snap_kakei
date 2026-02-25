// ログインページ用のレイアウト (BottomNavなし)
export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="w-full min-h-screen">
            {children}
        </div>
    );
}
