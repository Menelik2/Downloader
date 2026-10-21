export function Footer() {
  return (
    <footer className="border-t border-border bg-surface py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div>
            <p className="text-lg font-semibold">
              Link<span className="text-brand-600 dark:text-brand-400">Fetch</span>
            </p>
            <p className="mt-1 text-sm text-muted">Your Links. Your Media. Simply.</p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted">
            <a href="#platforms" className="hover:text-foreground">
              Platforms
            </a>
            <a href="#how-it-works" className="hover:text-foreground">
              How it works
            </a>
            <a href="#faq" className="hover:text-foreground">
              FAQ
            </a>
            <a
              href="https://github.com/Menelik2/Downloader"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>

        <div className="mt-10 space-y-3 border-t border-border pt-8 text-xs leading-relaxed text-muted">
          <p>
            <strong className="text-foreground">Important limitations.</strong> LinkFetch only
            processes public or otherwise authorized media. We do not bypass DRM, private content
            restrictions, authentication walls, or platform protections. Support for any given
            platform can change without notice.
          </p>
          <p>
            You are solely responsible for ensuring you have the legal right to download and use
            any content obtained through this service. Temporary files are deleted automatically;
            there is no permanent storage of your links or downloads.
          </p>
          <p className="pt-2">
            © {new Date().getFullYear()} LinkFetch. Built for responsible, authorized media access.
          </p>
        </div>
      </div>
    </footer>
  )
}
