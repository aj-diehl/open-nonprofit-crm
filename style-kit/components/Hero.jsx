export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex justify-center opacity-5 sm:opacity-10"
      >
        <img
          src="/agents_for_good.svg"
          alt=""
          className="h-full w-[900px] max-w-none translate-y-10 object-contain blur-sm sm:w-[1100px] lg:w-[1300px]"
        />
      </div>
      <div className="relative mx-auto max-w-4xl px-6 py-20 text-center lg:py-24">
        <div className="relative z-10 lg:text-left">
          <p className="badge mb-4">Donor Relations - Agentic Systems</p>
          <h1 className="font-display text-5xl font-extrabold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            Donor relations agents for nonprofits that unify data and stewardship.
          </h1>
          <p className="mt-5 text-lg leading-8 text-foreground/80">
            Unify giving, email, events, and spreadsheet data into living donor profiles. Agents draft stewardship updates, keep lists clean, and surface next steps without a full CRM rebuild.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            <a className="btn btn-primary" href="https://forms.gle/mVdCXDs6Fcu1fzVe9" target="_blank" rel="noreferrer">Fill out the lead form</a>
            <a className="btn btn-ghost" href="#services">Browse donor services</a>
          </div>
        </div>
      </div>
    </section>
  );
}
