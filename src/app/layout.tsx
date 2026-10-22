import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import { BRAND } from "@/config/brand";
import "./globals.css";

const display = Montserrat({
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

const serif = Cormorant_Garamond({
  variable: "--font-serif-face",
  weight: ["600", "700"],
  subsets: ["latin"],
});

// The event name depends on the operator's theme (set at runtime); the static title is the brand.
export const metadata: Metadata = {
  title: BRAND.name,
  description: `${BRAND.name}: join the wall with your selfie and share your answers on the big screen.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0B0D",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full bg-ink text-white">{children}</body>
    </html>
  );
}
