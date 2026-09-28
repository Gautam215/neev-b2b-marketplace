import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Neev | Executive Summary',
  description: 'A calm, explainable operating view for red-brick supply.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body>{children}</body></html>
}
