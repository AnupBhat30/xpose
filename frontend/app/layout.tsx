import "./globals.css";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata = {
  title: "Xpose - Repository Explorer & Unroller",
  description:
    "Explore and copy entire public repositories or local project files with ease. Fast, efficient, and powerful repository management tool.",
  keywords:
    "repository explorer, code viewer, repo unroller, github, project explorer",
  authors: [{ name: "Anup Bhat" }],
  creator: "Anup Bhat",
  openGraph: {
    title: "Xpose - Repository Explorer & Unroller",
    description:
      "Explore and copy entire public repositories or local project files with ease.",
    url: "https://xpose.anupbhat.me",
    siteName: "Xpose",
    images: [
      {
        url: "/web-app-manifest-512x512.png",
        width: 512,
        height: 512,
        alt: "Xpose Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Xpose - Repository Explorer & Unroller",
    description:
      "Explore and copy entire public repositories or local project files.",
    images: ["/web-app-manifest-512x512.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  themeColor: "#0a0a0a",
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
  robots:
    "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  alternates: {
    canonical: "https://xpose.anupbhat.me",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} min-h-screen bg-[#0a0a0a] text-[#f5f5f7] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
