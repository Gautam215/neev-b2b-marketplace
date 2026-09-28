'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { ToastProvider } from '@/components/providers/toast-provider'
import { Skeleton } from '@/components/ui/skeleton'

const ExecutiveSummary = dynamic(() => import('@/components/executive-summary').then((module) => module.ExecutiveSummary), {
  ssr: false,
  loading: () => <Skeleton className="h-[620px] w-full rounded-apple" />,
})

export default function HomePage() {
  return (
    <ToastProvider>
      <main className="min-h-screen overflow-hidden bg-graphite text-white">
        <a href="#executive-summary" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-lime focus:px-3 focus:py-2 focus:text-xs focus:font-bold focus:text-[#172008]">Skip to executive summary</a>
         <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 md:px-10 md:pb-24 md:pt-28" aria-labelledby="page-title">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-lime">NCR East / operating intelligence</p>
          <h1 id="page-title" className="mt-5 max-w-4xl text-5xl font-semibold leading-[.95] tracking-[-.075em] sm:text-7xl">A calmer read on what moves next.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/60 md:text-lg">Executive context for the people sourcing, supplying, and moving red brick. One high-signal view, with the next safe action close at hand.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#executive-summary" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-lime px-4 text-sm font-bold text-[#172008] transition hover:-translate-y-0.5 hover:bg-[#d9f686] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-graphite">View executive summary <ArrowUpRight className="h-4 w-4" /></a><Link href="/workspace" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[.05] px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime">Open full workspace</Link></div>
        </section>
        <section id="executive-summary" className="mx-auto max-w-6xl scroll-mt-8 px-6 pb-24 md:px-10" aria-labelledby="summary-heading"><h2 id="summary-heading" className="sr-only">Executive summary</h2><ExecutiveSummary /></section>
      </main>
    </ToastProvider>
  )
}
