import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen flex text-gray-900`}
      >
        {/* モバイルアプリのレイアウトを模倣するため、最大幅を制限して中央配置 */}
        <div className="w-full max-w-md mx-auto bg-white flex flex-col min-h-screen relative shadow-2xl overflow-hidden">
          <main className="flex-1 overflow-y-auto pb-20">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
