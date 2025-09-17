import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { authOptions } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Synaplex",
  description:
    "Neuro-inspired personal insights companion that analyzes daily cognitive feedback, shaped with Apple Human Interface principles.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="ja" className="bg-surface text-ink">
      <body className={`${geistSans.variable} antialiased min-h-screen`}> 
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
