/**
 * SEO Metadata Route File for Xpose
 * Provides dynamic Open Graph metadata generation
 */

export const metadata = {
  title: 'Xpose - Repository Explorer & Unroller',
  description: 'Explore and copy entire public repositories or local project files with ease. Fast, efficient, and powerful repository management tool.',
  keywords: 'repository explorer, code viewer, repo unroller, github, project explorer, code management',
  authors: [{ name: 'Anup Bhat', url: 'https://anupbhat.me' }],
  creator: 'Anup Bhat',
  publisher: 'Anup Bhat',
  
  // Open Graph
  openGraph: {
    title: 'Xpose - Repository Explorer & Unroller',
    description: 'Explore and copy entire public repositories or local project files with ease.',
    url: 'https://xpose.anupbhat.me',
    siteName: 'Xpose',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: 'https://xpose.anupbhat.me/web-app-manifest-512x512.png',
        width: 512,
        height: 512,
        alt: 'Xpose - Repository Explorer Logo',
        type: 'image/png',
      },
    ],
  },

  // Twitter
  twitter: {
    card: 'summary_large_image',
    site: '@xpose',
    creator: '@anupbhat30',
    title: 'Xpose - Repository Explorer & Unroller',
    description: 'Explore and copy entire public repositories or local project files.',
    images: ['https://xpose.anupbhat.me/web-app-manifest-512x512.png'],
  },

  // Verification and indexing
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },

  // Icons and manifest
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    other: [
      {
        rel: 'mask-icon',
        url: '/favicon.svg',
        color: '#0a0a0a',
      },
    ],
  },

  manifest: '/site.webmanifest',

  // Theme and viewport
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],

  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },

  // Canonical and alternates
  alternates: {
    canonical: 'https://xpose.anupbhat.me',
    languages: {
      'en-US': 'https://xpose.anupbhat.me',
    },
  },

  // Additional SEO
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Xpose',
  },

  category: 'productivity',
};

export default metadata;
