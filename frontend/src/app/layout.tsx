import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import LayoutClient from './layout-client'
import { Toaster } from 'sonner' // Assuming sonner is installed or we use standard toast later

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DeepSave Pro',
  description: 'AI Knowledge Base for NAS',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {/* We wrap everything in LayoutClient - simplistic for MVP */}
        <LayoutClient>
          {children}
        </LayoutClient>
      </body>
    </html>
  )
}
