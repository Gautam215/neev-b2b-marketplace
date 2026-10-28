import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50 active:scale-[.98]',
  {
    variants: {
      variant: {
        primary: 'bg-cobalt text-white shadow-[0_10px_30px_rgba(77,107,255,.15)] hover:-translate-y-0.5 hover:bg-cobalt-light',
        secondary: 'border border-white/15 bg-white/[.06] text-white hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[.1]',
        ghost: 'text-ink-2 hover:bg-white/[.06] hover:text-white',
      },
      size: {
        default: 'min-h-11',
        sm: 'min-h-9 rounded-lg px-3 text-xs',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
