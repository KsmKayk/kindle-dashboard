import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AutumnFaun Dashboard',
  description: 'Kindle e-ink dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=600, initial-scale=1, user-scalable=no" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
