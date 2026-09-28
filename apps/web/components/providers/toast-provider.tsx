'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type Toast = { id: number; title: string; description: string; tone: 'success' | 'error' }
type ToastContextValue = { toast: (input: Omit<Toast, 'id'>) => void }

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([])

  const toast = (input: Omit<Toast, 'id'>) => {
    const id = Date.now()
    setItems((current) => [...current, { ...input, id }])
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4200)
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 grid w-[min(380px,calc(100vw-2rem))] gap-3" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div key={item.id} role="status" className={cn('rounded-2xl border p-4 shadow-glass backdrop-blur-xl', item.tone === 'error' ? 'border-red-300/20 bg-red-950/80 text-red-50' : 'border-lime/20 bg-[#182017]/90 text-white')}>
            <strong className="block text-sm">{item.title}</strong>
            <span className="mt-1 block text-xs text-white/65">{item.description}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
