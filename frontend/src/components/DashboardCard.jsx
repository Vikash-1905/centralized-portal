function DashboardCard({ title, value, subtitle, accent = "bg-emerald-600" }) {
  return (
    <article className="rounded-2xl border border-emerald-100/80 bg-white/75 p-5 shadow-[0_20px_45px_-34px_rgba(15,118,110,0.65)] backdrop-blur-sm">
      <div className={`mb-4 h-2 w-16 rounded-full ${accent}`} />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="mt-2 text-3xl font-bold text-slate-900">{value}</h3>
      {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
    </article>
  );
}

export default DashboardCard;
