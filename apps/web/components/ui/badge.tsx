import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full border border-lime/30 bg-lime/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-lime', className)}>{children}</span>
}
