import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Nunito_Sans, Baloo_2, JetBrains_Mono } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'

import { ServiceWorkerRegister } from './_components/ServiceWorkerRegister'
import { ToastProvider } from './_components/Toast'
import { FloatingUserButton } from './_components/FloatingUserButton'
import './globals.css'

const nunitoSans = Nunito_Sans({
  variable: '--font-nunito-sans',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
})

const baloo2 = Baloo_2({
  variable: '--font-baloo-2',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
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
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#FDFEFB',
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
      className={`${nunitoSans.variable} ${baloo2.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <ServiceWorkerRegister />
        <ToastProvider>
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: '#4FB81F',
              colorBackground: '#FDFEFB',
              colorInputBackground: '#F2F7EC',
              colorText: '#35414B',
              colorTextSecondary: '#52616D',
              colorInputText: '#35414B',
              borderRadius: '12px',
              fontFamily: 'var(--font-nunito-sans)',
            },
            elements: {
              card: { background: '#FFFFFF', border: '2px solid #E6EEF2' },
            },
          }}
        >
          <FloatingUserButton />
          {children}
        </ClerkProvider>
        </ToastProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
