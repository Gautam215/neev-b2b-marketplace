import type { Metadata } from 'next'
import { NavigationHeader } from '@/components/navigation-header'
import './globals.css'

export const metadata: Metadata = {
  title: 'Neev | Executive Summary',
  description: 'A calm, explainable operating view for red-brick supply.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body><NavigationHeader />{children}</body></html>
}
