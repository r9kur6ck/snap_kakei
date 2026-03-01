import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, M_PLUS_Rounded_1c } from "next/font/google"; // 変更
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AuthProvider from "@/components/AuthProvider";
import WalletProvider from "@/components/WalletProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 新しいフォントを追加
const mPlusRounded = M_PLUS_Rounded_1c({
  weight: ['100', '300', '400', '500', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-mplus-rounded',
  display: 'swap',
});


export const metadata: Metadata = {
  title: "Snap Kakei",
  description: "入力の手間を極限まで減らし、今の懐事情を瞬時に把握できる家計簿",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Snap Kakei",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${mPlusRounded.variable} font-mplus antialiased bg-gray-50 min-h-screen flex text-gray-900`}
      >
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
          <AuthProvider>
            <WalletProvider>
              {/* モバイルアプリのレイアウトを模倣するため、最大幅を制限して中央配置 */}
              <div className="w-full max-w-md mx-auto bg-blue-50 flex flex-col min-h-screen relative shadow-2xl overflow-hidden">
                <main className="flex-1 overflow-y-auto pb-20">
                  {children}
                </main>
                <BottomNav />
              </div>
            </WalletProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
