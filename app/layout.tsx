import type { Metadata } from "next";
import { Outfit, Sora } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Neha HR | AI HR Agent",
  description: "AI-powered HR calling agent for SalesCode.ai",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${sora.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#09090f] text-[#ededf3]">
        {children}
      </body>
    </html>
  );
}
