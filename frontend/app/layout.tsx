import './globals.css'
import type { ReactNode } from 'react'
import { Inter, Space_Grotesk } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' })

export const metadata = {
  title: 'Codex Repo Unroller',
  description: 'Explore and copy entire public repos or local zips with a FastAPI-powered reader.'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} min-h-screen bg-[#0a0a0a] text-[#f5f5f7] antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
