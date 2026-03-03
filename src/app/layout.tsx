import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, M_PLUS_Rounded_1c, Noto_Serif_JP, Hachi_Maru_Pop, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import AuthProvider from "@/components/AuthProvider";
import WalletProvider from "@/components/WalletProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { FontProvider } from "@/components/FontProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const mPlusRounded = M_PLUS_Rounded_1c({
  weight: ['100', '300', '400', '500', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-mplus-rounded',
  display: 'swap',
});

const notoSerifJP = Noto_Serif_JP({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-noto-serif',
  display: 'swap',
});

const hachiMaruPop = Hachi_Maru_Pop({
  weight: ['400'],
  subsets: ['latin'],
  variable: '--font-hachi-maru',
  display: 'swap',
});

const zenKakuGothic = Zen_Kaku_Gothic_New({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-zen-kaku',
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
        className={`${geistSans.variable} ${geistMono.variable} ${mPlusRounded.variable} ${notoSerifJP.variable} ${hachiMaruPop.variable} ${zenKakuGothic.variable} antialiased min-h-screen flex text-gray-900 bg-gray-50`}
      >
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
          <FontProvider>
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
          </FontProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
