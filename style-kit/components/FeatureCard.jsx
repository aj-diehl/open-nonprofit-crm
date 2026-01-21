export function FeatureCard({kicker, title, body}) {
  return (
    <div className="card p-6">
      <p className="text-sm uppercase tracking-wide text-foreground/60">{kicker}</p>
      <h3 className="mt-2 font-display text-2xl font-bold">{title}</h3>
      <p className="mt-3 text-foreground/80">{body}</p>
    </div>
  )
}