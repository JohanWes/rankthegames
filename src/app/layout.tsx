import type { Metadata } from "next";
import { Inter, Teko } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

const teko = Teko({
  subsets: ["latin"],
  variable: "--font-teko",
  weight: ["300", "400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "ThisOrThat — Which Game Is More Popular?",
  description:
    "A higher-lower arcade game where you guess which video game is more popular. How long can you keep your streak alive?"
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${inter.variable} ${teko.variable}`}>
      <body className="bg-bg-deep text-text-primary min-h-screen font-body antialiased">
        {children}
      </body>
    </html>
  );
}
