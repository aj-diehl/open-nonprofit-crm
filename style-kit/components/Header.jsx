import Link from 'next/link';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' }
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-foreground/10 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Agents for Good home">
          <img
            src="/logo_horizontal.png"
            alt="Agents for Good"
            className="h-10 w-auto md:h-12 lg:h-14"
          />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-foreground/80 transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <a href="https://forms.gle/mVdCXDs6Fcu1fzVe9" className="btn btn-primary text-sm" target="_blank" rel="noreferrer">
            Lead form
          </a>
        </nav>
        <a
          href="https://forms.gle/mVdCXDs6Fcu1fzVe9"
          className="btn btn-ghost px-3 py-2 text-xs md:hidden"
          aria-label="Lead form"
          target="_blank"
          rel="noreferrer"
        >
          Lead form
        </a>
      </div>
    </header>
  );
}
