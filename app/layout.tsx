import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import { Toaster } from "sonner";
import { ConfigProvider } from "@/components/config-provider";
import { getConfig } from "@/lib/config-server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const c = await getConfig();
  return {
    title: `${c.siteName} · ${c.organizationName}`,
    description: `Applications, eligibility, campaigns and results for the ${c.organizationName} ${c.tagline.toLowerCase() || "elections"}.`,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = await getConfig();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ConfigProvider value={config}>{children}</ConfigProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}