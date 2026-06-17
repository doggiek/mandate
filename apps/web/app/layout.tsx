import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mandate',
  description:
    'Mandate lets you grant AI agents limited, revocable spending authority on Sui — with budget ceilings, protocol restrictions, and expiration windows.',
  icons: {
    icon: [
      {
        url: '/brand/mandate-logo-dark.png',
        type: 'image/png',
      },
    ],
    apple: '/brand/mandate-logo-dark.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark bg-background">
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
