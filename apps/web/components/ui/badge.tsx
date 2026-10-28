import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full border border-cobalt/30 bg-cobalt/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[.12em] text-amber', className)}>{children}</span>
}
