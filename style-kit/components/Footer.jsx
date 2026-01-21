export default function Footer() {
  return (
    <footer className="border-t border-foreground/10 bg-background">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 md:grid-cols-3">
        <div>
          <img
            src="/logo_horizontal.png"
            alt="Agents for Good logo"
            className="h-10 w-auto object-contain"
          />
          <p className="mt-3 text-sm text-foreground/70">
            Donor relations systems for nonprofits, foundations, and the partners who support them.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-foreground/60">Contact</p>
          <p className="mt-3 text-sm text-foreground/80">
            <a href="https://forms.gle/mVdCXDs6Fcu1fzVe9" className="underline" target="_blank" rel="noreferrer">Fill out the lead form</a>
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-foreground/60">Stay in touch</p>
          <p className="mt-3 text-sm text-foreground/80">
            Share your biggest donor relations challenge via our <a href="https://forms.gle/mVdCXDs6Fcu1fzVe9" className="underline" target="_blank" rel="noreferrer">lead form</a> and we will respond within two business days.
          </p>
        </div>
      </div>
      <div className="border-t border-foreground/10 bg-background/80 py-4 text-center text-xs text-foreground/60">
        © {new Date().getFullYear()} AI Agents for Good. All rights reserved.
      </div>
    </footer>
  );
}
