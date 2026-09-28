import type { Metadata, Viewport } from "next";
import { Barlow, Teko } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  variable: "--font-barlow",
  weight: ["400", "500", "600", "700"]
});

const teko = Teko({
  subsets: ["latin"],
  variable: "--font-teko",
  weight: ["300", "400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "RankTheGames — Which Game Is More Popular?",
  description:
    "A higher-lower arcade game where you guess which video game is more popular. How long can you keep your streak alive?"
};

export const viewport: Viewport = {
  themeColor: "#070B14"
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${barlow.variable} ${teko.variable}`}>
      <body className="text-text-primary min-h-screen font-body antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
