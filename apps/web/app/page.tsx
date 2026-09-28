'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowUpRight, Command } from 'lucide-react'
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
        <header className="border-b border-white/10 bg-graphite/80 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[74px] max-w-6xl items-center justify-between gap-4 px-6 md:px-10">
            <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime" aria-label="Neev home">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-clay text-lg font-bold">n</span>
              <span><strong className="block text-lg tracking-[-.05em]">Neev</strong><small className="block text-[9px] font-bold uppercase tracking-[.16em] text-white/45">Build with certainty</small></span>
            </Link>
            <nav aria-label="Primary navigation" className="hidden items-center gap-7 text-sm text-white/55 md:flex"><a className="transition hover:text-white" href="#executive-summary">Summary</a><Link className="transition hover:text-white" href="/workspace">Workspace</Link></nav>
            <Link href="/workspace" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[.05] px-3 text-xs font-semibold transition hover:-translate-y-0.5 hover:border-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"><Command className="h-4 w-4" /> Open workspace</Link>
          </div>
        </header>
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
