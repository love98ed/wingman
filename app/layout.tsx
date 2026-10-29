import "./globals.css";

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

/* Panchang (display) and Switzer (text), Fontshare, ITF Free Font License */
const panchang = localFont({
  src: "./fonts/Panchang-Bold.woff2",
  weight: "700",
  variable: "--font-panchang",
  display: "swap",
});

const switzer = localFont({
  src: [
    { path: "./fonts/Switzer-Regular.woff2", weight: "400" },
    { path: "./fonts/Switzer-Medium.woff2", weight: "500" },
  ],
  variable: "--font-switzer",
  display: "swap",
});

const DESCRIPTION =
  "Tell Wingman the occasion and see yourself ready: a full look from real Singapore stores, tried on your photo and one tap from checkout.";

export const metadata: Metadata = {
  metadataBase: new URL("https://wingman-eight-beta.vercel.app"),
  title: { default: "Wingman: see the look on you", template: "%s · Wingman" },
  description: DESCRIPTION,
  openGraph: { title: "Wingman: see the look on you", description: DESCRIPTION, siteName: "Wingman", type: "website" },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "Wingman", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${panchang.variable} ${switzer.variable}`} suppressHydrationWarning>
      <head>
        {/* Entrance motion only runs when script does, so nothing stays hidden without it */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
