import Image from 'next/image'
import Link from 'next/link'
import { Command } from 'lucide-react'

export function NavigationHeader() {
  return (
    <header className="sticky top-4 z-50 mx-auto mt-4 max-w-6xl rounded-full border border-white/10 bg-surface/80 shadow-cinematic backdrop-blur-xl">
      <div className="flex min-h-[60px] items-center justify-between gap-4 px-6 md:px-8">
        <Link
          href="/"
          className="flex items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
          aria-label="Neev home"
        >
          <span className="overflow-hidden rounded-xl bg-[#f4f1e9] shadow-[0_8px_24px_rgba(0,0,0,.18)] ring-1 ring-black/10">
            <Image
              src="/neev-logo.jpg"
              alt="Neev"
              width={830}
              height={390}
              priority
              sizes="(max-width: 640px) 94px, 108px"
              className="h-10 w-[94px] object-cover sm:h-11 sm:w-[108px]"
            />
          </span>
          <span className="sr-only">Neev</span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-7 text-sm text-white/55 md:flex">
          <Link className="transition hover:text-white" href="/#executive-summary">Summary</Link>
          <Link className="transition hover:text-white" href="/workspace">Workspace</Link>
        </nav>

        <Link
          href="/workspace"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[.05] px-3 text-xs font-semibold transition hover:-translate-y-0.5 hover:border-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
        >
          <Command className="h-4 w-4" />
          Open workspace
        </Link>
      </div>
    </header>
  )
}
