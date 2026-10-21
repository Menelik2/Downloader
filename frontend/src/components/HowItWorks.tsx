import { Link2, Search, Download } from 'lucide-react'

const steps = [
  {
    icon: Link2,
    title: 'Paste a link',
    description: 'Copy a public media URL from a supported platform and paste it into the box above.',
  },
  {
    icon: Search,
    title: 'Analyze',
    description:
      'We check the link, identify the platform, and show only the formats that are available and authorized.',
  },
  {
    icon: Download,
    title: 'Download or watch',
    description:
      'When a direct download is permitted, download the file. Otherwise use the official viewing link.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border bg-surface-2/40 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How It Works</h2>
          <p className="mt-2 text-muted">Three simple steps. No account needed.</p>
        </div>

        <ol className="mt-12 grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="relative text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/20">
                <step.icon className="h-6 w-6" aria-hidden />
              </div>
              <span className="mt-4 inline-block text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Step {i + 1}
              </span>
              <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
