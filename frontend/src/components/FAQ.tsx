import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  {
    q: 'Is LinkFetch really free?',
    a: 'Yes. There is no account, no subscription, and no application-imposed daily download quota. Free hosting providers still have their own capacity limits, so the service may occasionally be busy.',
  },
  {
    q: 'Why can’t I download some videos?',
    a: 'Many platforms prohibit unauthorized downloading of their content. LinkFetch only offers direct downloads when the media is publicly served in a way that does not require bypassing DRM, logins, or other protections. For other cases we provide the official viewing link.',
  },
  {
    q: 'Do you store my downloads or history?',
    a: 'No. Jobs and temporary files are kept only for a short time in memory and on ephemeral storage, then automatically deleted. There is no permanent download history and no user accounts.',
  },
  {
    q: 'Is this legal?',
    a: 'LinkFetch is designed for public or authorized media only. You are responsible for ensuring you have the right to download any content. We do not bypass platform restrictions, DRM, or private content access controls.',
  },
  {
    q: 'Why does a platform show as “limited” or “unavailable”?',
    a: 'Platforms change their APIs and policies frequently. When we cannot offer a reliable, authorized download path, we mark the provider accordingly and still try to give you useful metadata or an official link.',
  },
  {
    q: 'Can I add more platforms?',
    a: 'The backend uses a modular provider registry. Developers can add new providers that respect the same security and authorization rules without rewriting the whole application.',
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="border-t border-border bg-surface-2/40 py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">FAQ</h2>
          <p className="mt-2 text-muted">Common questions about LinkFetch.</p>
        </div>

        <div className="mt-10 space-y-3">
          {items.map((item, i) => {
            const isOpen = open === i
            return (
              <div
                key={item.q}
                className="overflow-hidden rounded-xl border border-border bg-surface"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium"
                  aria-expanded={isOpen}
                >
                  {item.q}
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 shrink-0 text-muted transition-transform',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>
                <div
                  className={cn(
                    'grid transition-all',
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="border-t border-border px-5 py-4 text-sm text-muted">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
