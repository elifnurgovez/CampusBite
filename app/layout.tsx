import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CampusBite",
  description: "Kampüste israfsız lezzet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${inter.variable} h-full`}>
      <body
        className={`${inter.className} min-h-full flex flex-col antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
