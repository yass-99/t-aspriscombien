import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ServiceWorkerRegister } from './_components/ServiceWorkerRegister'
import { ToastProvider } from './_components/Toast'
import { FloatingUserButton } from './_components/FloatingUserButton'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: "T'asPrisCombien",
  description: 'Une séance guidée, série par série.',
  applicationName: "T'asPrisCombien",
  appleWebApp: {
    capable: true,
    title: "T'asPrisCombien",
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#09090B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <ServiceWorkerRegister />
        <ToastProvider>
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: '#BEF264',
              colorBackground: '#09090B',
              colorInputBackground: '#18181B',
              colorText: '#FAFAFA',
              colorTextSecondary: '#A1A1AA',
              colorInputText: '#FAFAFA',
              borderRadius: '12px',
              fontFamily: 'var(--font-inter)',
            },
            elements: {
              card: { background: '#18181B', border: '1px solid #27272A' },
            },
          }}
        >
          <FloatingUserButton />
          {children}
        </ClerkProvider>
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  )
}
