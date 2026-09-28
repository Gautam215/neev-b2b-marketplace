'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, startTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowUpRight, Check, Clock3, Database, Leaf, PackageCheck, RefreshCw, ShieldCheck, Truck } from 'lucide-react'
import { useToast } from '@/components/providers/toast-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type Role = 'buyer' | 'supplier'

const requestSchema = z.object({
  quantity: z.coerce.number().int().min(1000, 'Use at least 1,000 pieces.').max(5000000, 'Use 5,000,000 pieces or fewer.'),
  deliveryArea: z.string().trim().min(3, 'Add a delivery area.'),
})

type RequestValues = z.infer<typeof requestSchema>

const journeyCopy: Record<Role, { title: string; description: string; steps: string[]; metrics: [string, string, string][] }> = {
  buyer: {
    title: 'Demand is moving with confidence.',
    description: 'Your active need is backed by a fresh shortlist, transparent landed cost, and a dispatch timeline that can be shared with finance.',
    steps: ['Search verified stock', 'Compare landed cost', 'Reserve through gateway'],
    metrics: [['Active need', '25,000', 'pieces / North Ring Road'], ['Best landed cost', 'Rs 7.38', 'material + freight'], ['Cash in motion', 'Rs 1.84L', 'reserved, not settled']],
  },
  supplier: {
    title: 'Supply is ready for the next handoff.',
    description: 'Your inventory is visible, the buyer request is structured, and dispatch ownership is explicit before a load leaves the yard.',
    steps: ['Refresh inventory', 'Accept current quote', 'Coordinate dispatch'],
    metrics: [['Available stock', '42,000', 'pieces / fresh snapshot'], ['Quote response', '04', 'requests awaiting action'], ['Dispatch confidence', '92%', 'status sync health']],
  },
}

const chartBars = [42, 57, 52, 67, 63, 81, 92]

export function ExecutiveSummary() {
  const [role, setRole] = useState<Role>('buyer')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { quantity: 25000, deliveryArea: 'Sector 18, Noida' },
  })
  const copy = journeyCopy[role]

  useEffect(() => {
    try {
      const savedRole = window.localStorage.getItem('neev-summary-role')
      const savedDraft = window.localStorage.getItem('neev-summary-draft')
      if (savedRole === 'buyer' || savedRole === 'supplier') setRole(savedRole)
      if (savedDraft) reset(JSON.parse(savedDraft) as RequestValues)
    } catch {
      toast({ title: 'Local draft unavailable', description: 'You can continue; this browser cannot persist the draft.', tone: 'error' })
    }
  }, [reset, toast])

  useEffect(() => {
    const subscription = watch((values) => {
      try { window.localStorage.setItem('neev-summary-draft', JSON.stringify(values)) } catch { /* persistence is optional */ }
    })
    return () => subscription.unsubscribe()
  }, [watch])

  const selectRole = (nextRole: Role) => {
    startTransition(() => setRole(nextRole))
    try { window.localStorage.setItem('neev-summary-role', nextRole) } catch { /* persistence is optional */ }
  }

  const refresh = () => {
    setLoading(true)
    window.setTimeout(() => {
      setLoading(false)
      toast({ title: 'Summary refreshed', description: 'Inventory, landed cost, and dispatch signals are current.', tone: 'success' })
    }, 650)
  }

  const submitRequest = async (values: RequestValues) => {
    setLoading(true)
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 500))
      toast({ title: 'Material request staged', description: `${values.quantity.toLocaleString('en-IN')} pieces for ${values.deliveryArea} are ready for supplier matching.`, tone: 'success' })
      reset(values)
    } catch {
      toast({ title: 'Request not sent', description: 'Your validated draft is safe locally. Retry when the connection is available.', tone: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-labelledby="summary-title" className="relative overflow-hidden rounded-apple border border-white/10 bg-panel p-5 shadow-glass sm:p-7">
      <div className="pointer-events-none absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-lime/10 blur-3xl" />
      <div className="relative z-10">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <Badge>Executive summary / live signal</Badge>
            <h2 id="summary-title" className="mt-5 max-w-3xl text-4xl font-semibold leading-[.98] tracking-[-.07em] sm:text-5xl">{copy.title}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-mist">{copy.description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={refresh} disabled={loading}><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />Refresh</Button><Button asChild size="sm"><Link href="/workspace">Full workspace <ArrowUpRight className="h-4 w-4" /></Link></Button></div>
        </div>

        <div className="mt-8 grid gap-2 rounded-2xl border border-white/10 bg-white/[.035] p-2 sm:grid-cols-2" role="tablist" aria-label="Executive role view">
          {(['buyer', 'supplier'] as Role[]).map((item) => <button key={item} type="button" role="tab" aria-selected={role === item} onClick={() => selectRole(item)} className={`flex min-h-14 items-center justify-between rounded-xl px-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime active:scale-[.99] ${role === item ? 'border border-lime/35 bg-lime/10 text-white' : 'border border-transparent text-white/55 hover:border-white/15 hover:text-white'}`}><span><strong className="block text-sm capitalize">{item} view</strong><span className="mt-1 block text-xs text-white/45">{item === 'buyer' ? 'Demand, landed cost, payment' : 'Inventory, quotes, dispatch'}</span></span>{role === item ? <Check className="h-4 w-4 text-lime" /> : <span className="h-2 w-2 rounded-full bg-white/20" />}</button>)}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {loading ? [0, 1, 2].map((item) => <Card key={item} className="border-white/10 bg-white/[.04] shadow-none"><CardContent className="p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-5 h-8 w-28" /><Skeleton className="mt-3 h-3 w-36" /></CardContent></Card>) : copy.metrics.map(([label, value, note]) => <Card key={label} className="border-white/10 bg-white/[.045] shadow-none transition duration-200 hover:-translate-y-1 hover:border-white/20"><CardContent className="p-5"><span className="text-xs text-white/45">{label}</span><strong className="mt-5 block text-3xl tracking-[-.06em] text-white">{value}</strong><small className="mt-2 block text-xs text-lime/80">{note}</small></CardContent></Card>)}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
          <Card className="overflow-hidden border-white/10 bg-white/[.035] shadow-none">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-clay">Next safe action</p>
                  <h3 className="mt-2 text-xl tracking-[-.04em]">{role === 'buyer' ? 'Stage a structured material request.' : 'Publish the stock buyers can trust.'}</h3>
                </div>
                <PackageCheck className="h-5 w-5 text-lime" aria-hidden="true" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-3">
                {copy.steps.map((step, index) => (
                  <div key={step} className="relative rounded-xl border border-white/10 bg-black/10 p-3">
                    <span className="text-[10px] font-bold text-lime">0{index + 1}</span>
                    <strong className="mt-7 block text-xs text-white">{step}</strong>
                    {index < copy.steps.length - 1 && <span className="absolute right-2 top-3 hidden text-white/25 sm:block" aria-hidden="true">{'->'}</span>}
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/45">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-lime" />Role-scoped access</span>
                <span className="inline-flex items-center gap-2"><Database className="h-4 w-4 text-lime" />Offline draft saved</span>
                <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-lime" />P95 signal &lt; 600 ms</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-white/10 bg-black/20 shadow-none">
            <Image src="https://images.unsplash.com/photo-1629608564457-5d74829a9e14?auto=format&fit=crop&w=1200&q=80" alt="Hand-formed red bricks stacked at a local kiln" fill loading="lazy" sizes="(max-width: 1024px) 100vw, 35vw" unoptimized className="object-cover opacity-35" />
            <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/55 to-transparent" />
            <CardContent className="relative flex min-h-[260px] flex-col justify-end p-5">
              <Leaf className="h-5 w-5 text-lime" aria-hidden="true" />
              <p className="mt-4 text-xs uppercase tracking-[.14em] text-white/45">Confidence trend / last 7 checks</p>
              <div className="mt-5 flex h-24 items-end gap-2" aria-label="Confidence improved from 42 to 92 percent">
                <span className="sr-only">Confidence improved from 42 to 92 percent over the last seven checks.</span>
                {chartBars.map((height, index) => <span key={index} className="min-h-3 flex-1 rounded-t-md bg-gradient-to-t from-[#6f9038] to-lime shadow-[0_0_18px_rgba(198,236,98,.12)]" style={{ height: `${height}%` }} />)}
              </div>
              <div className="mt-3 flex justify-between text-xs text-white/45"><span>7 checks ago</span><strong className="text-lime">92% / current</strong></div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-3 border-white/10 bg-white/[.035] shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-clay">Create a next action</p>
                <h3 className="mt-2 text-xl tracking-[-.04em]">Start with a validated demand signal.</h3>
              </div>
              <span className="hidden items-center gap-2 text-xs text-white/40 sm:flex"><Truck className="h-4 w-4 text-lime" />No payment is taken in demo mode</span>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(submitRequest)} noValidate className="grid gap-4 sm:grid-cols-[.75fr_1fr_auto] sm:items-end">
              <label className="grid gap-2 text-xs text-white/55">Quantity
                <input {...register('quantity')} type="number" min={1000} max={5000000} step={1000} aria-invalid={Boolean(errors.quantity)} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-lime focus:ring-2 focus:ring-lime/20" />
                {errors.quantity && <span role="alert" className="text-xs text-red-300">{errors.quantity.message}</span>}
              </label>
              <label className="grid gap-2 text-xs text-white/55">Delivery area
                <input {...register('deliveryArea')} aria-invalid={Boolean(errors.deliveryArea)} className="min-h-11 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-lime focus:ring-2 focus:ring-lime/20" />
                {errors.deliveryArea && <span role="alert" className="text-xs text-red-300">{errors.deliveryArea.message}</span>}
              </label>
              <Button type="submit" disabled={loading}>{loading ? 'Staging...' : 'Stage request'} <ArrowUpRight className="h-4 w-4" /></Button>
            </form>
            <p className="mt-4 text-xs text-white/35" aria-live="polite">Validated drafts persist locally for offline recovery. Sensitive payment information never enters this form.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
