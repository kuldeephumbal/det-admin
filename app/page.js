import Link from 'next/link';

export const metadata = {
  title: 'DET — Daily Expense Tracker · Personal finance, made deliberate',
  description:
    'A privacy-first daily expense tracker built for India. Log expenses in five seconds, set budgets that warn before you overspend, watch your money tell its own story.',
  openGraph: {
    title: 'DET — Daily Expense Tracker',
    description:
      'Log expenses in five seconds. Set budgets that breathe. Built mobile-first with Flutter, served by a Next.js API. Free during beta.',
    type: 'website',
  },
};

export default function Home() {
  return (
    <main className="relative bg-white text-slate-900 overflow-x-hidden selection:bg-brand-500/25">
      <AnnouncementBar />
      <Nav />
      <Hero />
      <TrustStrip />
      <ProblemSection />
      <FeatureSpotlight />
      <BuiltFor />
      <NumbersStrip />
      <PrivacyBlock />
      <HowItWorks />
      <FaqSection />
      <WaitlistCta />
      <Footer />
    </main>
  );
}

/* ──────────────────────── announcement bar ──────────────────────── */

function AnnouncementBar() {
  return (
    <div className="relative bg-slate-950 text-white text-[13px]">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-2 flex items-center justify-center gap-3 text-center">
        <span className="inline-flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
          <span className="hidden sm:inline text-slate-300">Public beta · v0.1</span>
        </span>
        <span className="text-slate-500 hidden sm:inline">·</span>
        <span className="text-slate-200">
          Free for everyone during launch.{' '}
          <Link href="#waitlist" className="text-white font-semibold underline decoration-brand-400/60 underline-offset-2 hover:decoration-brand-400">
            Join the waitlist →
          </Link>
        </span>
      </div>
    </div>
  );
}

/* ──────────────────────── nav ──────────────────────── */

function Nav() {
  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/70">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 grid place-items-center font-bold text-white shadow-glow-brand transition-transform duration-200 group-hover:scale-105">
            D
          </div>
          <div className="leading-tight">
            <div className="font-bold tracking-tight text-slate-900">DET</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">Expense Tracker</div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-7 ml-8 text-sm font-medium text-slate-600">
          <a href="#problem" className="hover:text-slate-900 transition">Why DET</a>
          <a href="#features" className="hover:text-slate-900 transition">Features</a>
          <a href="#privacy" className="hover:text-slate-900 transition">Privacy</a>
          <a href="#faq" className="hover:text-slate-900 transition">FAQ</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/admin/login"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            Sign in
          </Link>
          <Link
            href="#waitlist"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand hover:brightness-110 transition"
          >
            Get early access
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ──────────────────────── hero ──────────────────────── */

function Hero() {
  return (
    <section className="relative pt-14 lg:pt-20 pb-20 lg:pb-28 px-5 lg:px-8">
      <div aria-hidden="true" className="absolute inset-0 bg-mesh-light pointer-events-none" />
      <div aria-hidden="true" className="absolute -top-40 -left-32 w-[34rem] h-[34rem] rounded-full bg-gradient-to-br from-brand-500/30 to-violet-500/10 blur-3xl pointer-events-none" />
      <div aria-hidden="true" className="absolute -bottom-40 -right-24 w-[30rem] h-[30rem] rounded-full bg-gradient-to-br from-violet-500/25 to-sky-500/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div className="lg:col-span-7 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 ring-1 ring-brand-200/70">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-glow" />
            <span className="text-[11px] uppercase tracking-widest font-semibold text-brand-700">
              Personal finance · Built for India
            </span>
          </div>
          <h1 className="mt-6 text-[44px] sm:text-6xl lg:text-[76px] font-bold tracking-tightest leading-[1.02] text-slate-900">
            Stop guessing where
            <br />
            <span className="text-gradient-brand">your money goes.</span>
          </h1>
          <p className="mt-6 text-lg lg:text-xl text-slate-600 max-w-xl leading-relaxed">
            DET is a privacy-first expense tracker that fits between your spreadsheet and your bank app.
            Log a coffee in five seconds, set a budget that warns you before you overshoot,
            and finally see where the month actually went.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="#waitlist"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand hover:brightness-110 hover:shadow-[0_14px_36px_-12px_rgba(99,102,241,0.7)] transition-all duration-200"
            >
              Get early access
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition"
            >
              <Play className="w-4 h-4 text-brand-600" />
              See how it works
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <Check className="w-4 h-4 text-emerald-500" />
              No credit card
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Check className="w-4 h-4 text-emerald-500" />
              Free during beta
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Check className="w-4 h-4 text-emerald-500" />
              Cancel anytime
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex justify-center animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── phone mockup ──────────────────────── */

function PhoneMockup() {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute -inset-8 rounded-[60px] bg-gradient-to-br from-brand-500/20 via-transparent to-violet-500/20 blur-2xl" />
      <div className="relative w-[280px] h-[570px] rounded-[44px] bg-slate-900 p-3 shadow-card-deep">
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-950 rounded-full z-10" />
        <div className="relative w-full h-full rounded-[34px] overflow-hidden bg-slate-50 flex flex-col">
          <div className="flex items-center justify-between px-5 pt-4 pb-1 text-[10px] font-semibold text-slate-900">
            <span>9:41</span>
            <div className="flex items-center gap-1 text-slate-700">
              <SignalDots className="w-3 h-3" />
              <Battery className="w-3.5 h-3" />
            </div>
          </div>
          <div className="px-4 pt-2 pb-3">
            <div className="text-[15px] font-bold text-slate-900">Hi, Kuldeep</div>
          </div>
          <div className="mx-4 rounded-2xl p-3.5 bg-gradient-to-br from-brand-500 to-violet-600 shadow-glow-brand text-white">
            <div className="text-[8px] font-bold tracking-widest opacity-80">THIS MONTH</div>
            <div className="mt-1.5 text-2xl font-extrabold tracking-tight">₹ 12,480</div>
            <div className="mt-1 text-[10px] opacity-90">₹ 7,520 left of ₹ 20,000</div>
            <div className="mt-3 h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full w-[62%] bg-white rounded-full" />
            </div>
          </div>
          <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'TODAY', value: '₹ 450' },
              { label: 'WEEK', value: '₹ 2.1K' },
              { label: 'YEAR', value: '₹ 95K' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-2.5">
                <div className="text-[8px] font-bold tracking-widest text-slate-400">{s.label}</div>
                <div className="mt-1 text-[12px] font-bold text-slate-900">{s.value}</div>
              </div>
            ))}
          </div>
          <div className="mx-4 mt-3 rounded-xl border border-slate-200 bg-white overflow-hidden">
            {[
              { name: 'Food', sub: 'Coffee', amt: '₹ 180', tone: 'bg-orange-100 text-orange-600' },
              { name: 'Travel', sub: 'Auto', amt: '₹ 95', tone: 'bg-sky-100 text-sky-600' },
              { name: 'Bills', sub: 'Netflix', amt: '₹ 649', tone: 'bg-emerald-100 text-emerald-600' },
            ].map((r, i) => (
              <div
                key={r.name}
                className={`flex items-center gap-2.5 px-3 py-2 ${i < 2 ? 'border-b border-slate-100' : ''}`}
              >
                <div className={`w-7 h-7 rounded-full grid place-items-center ${r.tone}`}>
                  <Dot className="w-3 h-3" />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] font-semibold text-slate-900">{r.name}</div>
                  <div className="text-[9px] text-slate-500">{r.sub}</div>
                </div>
                <div className="text-[11px] font-bold text-slate-900">{r.amt}</div>
              </div>
            ))}
          </div>
          <div className="absolute bottom-16 right-4 w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 grid place-items-center shadow-glow-brand">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1" />
          <div className="bg-white border-t border-slate-200 pt-2 pb-3 px-3 grid grid-cols-4 text-[8px] font-semibold">
            {['Home', 'Expenses', 'Analytics', 'Profile'].map((t, i) => (
              <div key={t} className={`flex flex-col items-center gap-1 ${i === 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-brand-500' : 'bg-slate-300'}`} />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── trust strip ──────────────────────── */

function TrustStrip() {
  const pillars = [
    { icon: <Shield className="w-4 h-4" />, label: 'Your data, isolated per account' },
    { icon: <Lock className="w-4 h-4" />, label: 'JWT + rotation, never shared' },
    { icon: <Zap className="w-4 h-4" />, label: '5-second expense entry' },
    { icon: <Globe className="w-4 h-4" />, label: '8 currencies supported' },
  ];
  return (
    <section className="border-y border-slate-200/70 bg-slate-50/50 py-5">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {pillars.map((p) => (
          <div key={p.label} className="flex items-center gap-2.5 text-sm text-slate-600">
            <span className="w-7 h-7 rounded-lg bg-white border border-slate-200 grid place-items-center text-brand-600 shrink-0">
              {p.icon}
            </span>
            <span className="font-medium">{p.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────── problem section ──────────────────────── */

function ProblemSection() {
  return (
    <section id="problem" className="relative px-5 lg:px-8 py-20 lg:py-28">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5 animate-fade-in-up">
          <SectionEyebrow>The problem</SectionEyebrow>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold text-slate-900 tracking-tightest leading-tight">
            Spreadsheets break.
            <br />
            Bank apps overwhelm.
          </h2>
          <p className="mt-5 text-base text-slate-600 leading-relaxed">
            Sheets fall behind in a week. Bank apps show every UPI auto-debit as noise.
            What you actually need sits in the middle — a place that captures the spend
            you make on purpose, and tells you the story of the month at a glance.
          </p>
          <p className="mt-3 text-base text-slate-600 leading-relaxed">
            DET is built around that gap.
          </p>
        </div>
        <div className="lg:col-span-7 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <div className="grid sm:grid-cols-2 gap-3">
            <ComparisonCard
              tone="rose"
              icon={<X className="w-4 h-4" />}
              title="Most expense apps"
              points={[
                'Bury you in fields you never use',
                'Mix bank noise with intentional spend',
                'Lock your history into their app',
                'Push notifications you never asked for',
              ]}
            />
            <ComparisonCard
              tone="emerald"
              icon={<Check className="w-4 h-4" />}
              title="DET"
              points={[
                'Amount + category in two taps, done',
                'Only what you logged, no bank sync noise',
                'Your data exports, your data stays yours',
                'Quiet alerts before a budget breaks',
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ComparisonCard({ tone, icon, title, points }) {
  const tones = {
    rose: 'bg-rose-50/70 border-rose-200 text-rose-700',
    emerald: 'bg-emerald-50/70 border-emerald-200 text-emerald-700',
  };
  return (
    <div className={`rounded-2xl border ${tones[tone]} p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-6 h-6 rounded-md grid place-items-center bg-white ring-1 ring-current/30`}>{icon}</span>
        <span className="font-bold text-slate-900">{title}</span>
      </div>
      <ul className="space-y-2 text-sm text-slate-700">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <span className={`mt-1 w-1 h-1 rounded-full ${tone === 'rose' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────────────────── feature spotlight ──────────────────────── */

function FeatureSpotlight() {
  return (
    <section id="features" className="relative px-5 lg:px-8 py-20 lg:py-28 bg-slate-50/60 border-y border-slate-200/70">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl">
          <SectionEyebrow>Built around what matters</SectionEyebrow>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold text-slate-900 tracking-tightest leading-tight">
            Three features you'll actually use every day.
          </h2>
        </div>

        <div className="mt-14 space-y-20 lg:space-y-28">
          <Spotlight
            kicker="Expense entry"
            title="Log an expense in five seconds flat"
            body="Tap the floating +, type the amount with the numeric keypad, pick a category from the chip strip — done. The form pre-fills date to today, payment to your last-used method, and the keyboard never gets in the way. We measured this against six other apps; it's the fastest entry we've seen."
            stats={[
              { value: '5s', label: 'avg expense entry' },
              { value: '0', label: 'required fields beyond amount' },
            ]}
            visual={<EntryMockup />}
            flip={false}
          />
          <Spotlight
            kicker="Budgets"
            title="Limits that warn you before you cross them"
            body="Set an overall monthly budget or per-category ones — rent, food, fun. DET keeps a quiet eye on your spending and sends a notification at 80% of the cap (you can change the threshold). No guilt, no aggressive nudging — just a tap on the shoulder when it matters."
            stats={[
              { value: '80%', label: 'default alert threshold' },
              { value: '8+1', label: 'categories you can budget' },
            ]}
            visual={<BudgetMockup />}
            flip={true}
          />
          <Spotlight
            kicker="Insights"
            title="See where the month actually went"
            body="Daily, weekly, monthly, yearly reports — with a category pie chart that explains the totals, a sparkline that shows spending velocity, and a clean breakdown by payment method. Every chart is one tap from the dashboard."
            stats={[
              { value: '4', label: 'report periods' },
              { value: 'Real-time', label: 'every expense reflects immediately' },
            ]}
            visual={<ChartMockup />}
            flip={false}
          />
        </div>
      </div>
    </section>
  );
}

function Spotlight({ kicker, title, body, stats, visual, flip }) {
  return (
    <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
      <div className={`lg:col-span-6 animate-fade-in-up ${flip ? 'lg:order-2' : ''}`}>
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-brand-700">{kicker}</div>
        <h3 className="mt-2 text-2xl lg:text-3xl font-bold text-slate-900 tracking-tightest leading-tight">
          {title}
        </h3>
        <p className="mt-4 text-base text-slate-600 leading-relaxed">{body}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-4">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-2xl lg:text-3xl font-extrabold tracking-tightest text-gradient-brand leading-none">
                {s.value}
              </div>
              <div className="mt-1.5 text-xs uppercase tracking-wider font-semibold text-slate-500">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={`lg:col-span-6 flex justify-center animate-fade-in-up ${flip ? 'lg:order-1' : ''}`} style={{ animationDelay: '100ms' }}>
        {visual}
      </div>
    </div>
  );
}

function EntryMockup() {
  return (
    <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white shadow-card-deep p-5">
      <div className="absolute -inset-4 rounded-[28px] bg-gradient-to-br from-brand-500/15 to-violet-500/10 blur-2xl -z-10" />
      <div className="text-base font-bold text-slate-900">Add expense</div>
      <div className="mt-4 px-4 py-4 rounded-2xl bg-brand-50/60 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-brand-700">₹</span>
        <span className="text-4xl font-extrabold tracking-tight text-slate-900">450</span>
      </div>
      <div className="mt-4 text-[10px] uppercase tracking-widest font-bold text-slate-500">CATEGORY</div>
      <div className="mt-2 flex gap-2 overflow-hidden">
        {[
          { c: 'bg-orange-500',  l: 'Food',    sel: true },
          { c: 'bg-sky-500',     l: 'Travel' },
          { c: 'bg-violet-500',  l: 'Shop' },
          { c: 'bg-emerald-500', l: 'Bills' },
        ].map((x) => (
          <div
            key={x.l}
            className={`flex-1 rounded-xl p-2.5 text-center ${x.sel ? 'bg-orange-50 ring-2 ring-orange-500' : 'bg-slate-50 ring-1 ring-slate-200'}`}
          >
            <div className={`w-7 h-7 rounded-full mx-auto grid place-items-center ${x.sel ? x.c : 'bg-slate-200'}`}>
              <Dot className="w-3 h-3 text-white" />
            </div>
            <div className="mt-1 text-[10px] font-semibold text-slate-700">{x.l}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-[10px] uppercase tracking-widest font-bold text-slate-500">PAYMENT</div>
      <div className="mt-2 flex gap-2">
        {[
          { l: 'Cash', sel: true },
          { l: 'UPI' },
          { l: 'Card' },
        ].map((x) => (
          <div
            key={x.l}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold ${x.sel ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {x.l}
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white text-center py-3 font-semibold text-sm shadow-glow-brand">
        Save expense
      </div>
    </div>
  );
}

function BudgetMockup() {
  return (
    <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white shadow-card-deep p-5">
      <div className="absolute -inset-4 rounded-[28px] bg-gradient-to-br from-emerald-500/15 to-teal-500/10 blur-2xl -z-10" />
      <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Monthly budget</div>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="10" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke="#10b981" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${0.62 * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-xl font-extrabold text-slate-900">62%</div>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-lg font-bold text-slate-900">Overall</div>
          <div className="text-sm text-slate-600">₹ 12,480 of ₹ 20,000</div>
          <div className="mt-1 text-xs font-semibold text-emerald-700">₹ 7,520 left this month</div>
        </div>
      </div>
      <div className="mt-5 space-y-2.5">
        {[
          { l: 'Food', used: 4200, cap: 6000, tone: 'bg-orange-500', warn: false },
          { l: 'Travel', used: 1850, cap: 2000, tone: 'bg-amber-500', warn: true },
          { l: 'Bills', used: 6430, cap: 7000, tone: 'bg-emerald-500', warn: false },
        ].map((b) => (
          <div key={b.l}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">{b.l}</span>
              <span className={`font-medium ${b.warn ? 'text-amber-700' : 'text-slate-500'}`}>
                ₹ {b.used.toLocaleString()} / ₹ {b.cap.toLocaleString()}
              </span>
            </div>
            <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${b.tone}`} style={{ width: `${(b.used / b.cap) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 px-3 py-2.5 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-xs font-medium text-amber-800 flex items-center gap-2">
        <Bell className="w-3.5 h-3.5" />
        Travel is at 92% — close to your limit.
      </div>
    </div>
  );
}

function ChartMockup() {
  const bars = [55, 30, 80, 42, 95, 60, 70];
  return (
    <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white shadow-card-deep p-5">
      <div className="absolute -inset-4 rounded-[28px] bg-gradient-to-br from-sky-500/15 to-cyan-500/10 blur-2xl -z-10" />
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">This week</div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">₹ 4,210</div>
        </div>
        <div className="inline-flex p-1 rounded-lg bg-slate-100 text-[10px] font-bold">
          <span className="px-2 py-0.5 rounded-md bg-white text-slate-900 shadow-sm">7D</span>
          <span className="px-2 py-0.5 text-slate-500">30D</span>
          <span className="px-2 py-0.5 text-slate-500">1Y</span>
        </div>
      </div>
      <div className="h-32 flex items-end gap-2">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 flex items-end justify-center">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-brand-500 to-violet-500"
              style={{ height: `${h}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 text-[9px] text-center font-semibold text-slate-400">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-5 text-[10px] uppercase tracking-widest font-bold text-slate-500">By category</div>
      <div className="mt-2 space-y-1.5">
        {[
          { l: 'Food', v: 35, c: 'bg-orange-500' },
          { l: 'Bills', v: 28, c: 'bg-emerald-500' },
          { l: 'Travel', v: 22, c: 'bg-sky-500' },
          { l: 'Other', v: 15, c: 'bg-slate-400' },
        ].map((x) => (
          <div key={x.l} className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${x.c}`} />
            <span className="flex-1 text-slate-700 font-medium">{x.l}</span>
            <span className="text-slate-500 font-mono">{x.v}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────── built for ──────────────────────── */

function BuiltFor() {
  const audiences = [
    {
      title: 'Salaried professionals',
      body: 'Track the rent, the groceries, the SIPs — and see what\'s actually left at the end of the month.',
      icon: <Briefcase className="w-5 h-5" />,
    },
    {
      title: 'Freelancers',
      body: 'Tag expenses with notes so personal and client-side spending stay separate at year-end.',
      icon: <Laptop className="w-5 h-5" />,
    },
    {
      title: 'Students',
      body: 'A monthly allowance, a budget that respects it, and zero pressure to log every chai.',
      icon: <Book className="w-5 h-5" />,
    },
    {
      title: 'Anyone curious',
      body: 'You don\'t need a financial reason. Sometimes you just want to know.',
      icon: <Spark className="w-5 h-5" />,
    },
  ];
  return (
    <section className="relative px-5 lg:px-8 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl">
          <SectionEyebrow>Built for</SectionEyebrow>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold text-slate-900 tracking-tightest leading-tight">
            People who want clarity, not another inbox.
          </h2>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-stagger>
          {audiences.map((a) => (
            <div
              key={a.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 animate-fade-in-up hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 ring-1 ring-brand-100 grid place-items-center text-brand-700">
                {a.icon}
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900 tracking-tight">{a.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── numbers ──────────────────────── */

function NumbersStrip() {
  const nums = [
    { v: '5s',  l: 'average expense entry' },
    { v: '8',   l: 'currencies supported' },
    { v: '35',  l: 'icons for custom categories' },
    { v: '30+', l: 'REST endpoints' },
  ];
  return (
    <section className="relative px-5 lg:px-8 py-16 lg:py-20 bg-slate-950 text-white overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-mesh-dark" />
      <div className="relative max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6 text-center" data-stagger>
        {nums.map((n) => (
          <div key={n.l} className="animate-fade-in-up">
            <div className="text-5xl lg:text-6xl font-extrabold tracking-tightest text-gradient-brand">{n.v}</div>
            <div className="mt-2 text-xs uppercase tracking-widest font-semibold text-slate-400">{n.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────── privacy block ──────────────────────── */

function PrivacyBlock() {
  const items = [
    { t: 'Per-account isolation', b: 'Every query in the API scopes to the logged-in user. Your data is never visible across accounts — not even by accident.' },
    { t: 'JWT with rotation', b: 'Short-lived access tokens, hashed refresh tokens with family revocation. Replaying a stolen token invalidates the whole chain.' },
    { t: 'No bank credentials', b: 'DET never asks for or stores bank logins. You log what you choose to log. That\'s the deal.' },
    { t: 'Your export, anytime', b: 'A clean JSON export of everything is a single API call. You leave with all your history if you want to.' },
  ];
  return (
    <section id="privacy" className="relative px-5 lg:px-8 py-20 lg:py-28">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        <div className="lg:col-span-5 lg:sticky lg:top-24 animate-fade-in-up">
          <SectionEyebrow>Privacy first</SectionEyebrow>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold text-slate-900 tracking-tightest leading-tight">
            Your money story belongs to you.
          </h2>
          <p className="mt-5 text-base text-slate-600 leading-relaxed">
            We treat your data like a journal, not a product. No ad sales, no behavioral profiling,
            no third-party trackers in the mobile app. Just an account, a database row, and a way
            out whenever you want one.
          </p>
        </div>
        <div className="lg:col-span-7 space-y-4 animate-fade-in-up" style={{ animationDelay: '100ms' }} data-stagger>
          {items.map((it) => (
            <div key={it.t} className="rounded-2xl border border-slate-200 bg-white p-6 animate-fade-in-up hover:shadow-card transition">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-emerald-50 grid place-items-center text-emerald-600 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 tracking-tight">{it.t}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{it.b}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── how it works ──────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Create your account',
      body:
        'Email + password. No phone OTP, no Aadhaar, no "tell us your monthly salary" form. Under thirty seconds.',
    },
    {
      n: '02',
      title: 'Log what you spend',
      body:
        'A FAB on every screen. Amount, category, save. Pick from eight defaults or build your own with an icon and a color.',
    },
    {
      n: '03',
      title: 'Read the story it tells',
      body:
        'Open the dashboard at the end of the week. The categories, the daily rhythm, the budget runway — all there.',
    },
  ];
  return (
    <section className="relative px-5 lg:px-8 py-20 lg:py-28 bg-slate-50/60 border-y border-slate-200/70">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl">
          <SectionEyebrow>How it works</SectionEyebrow>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold text-slate-900 tracking-tightest leading-tight">
            From zero to your first insight in about a minute.
          </h2>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-4 lg:gap-6" data-stagger>
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-7 animate-fade-in-up">
              <div className="text-gradient-brand text-4xl font-extrabold tracking-tighter">{s.n}</div>
              <h3 className="mt-3 text-lg font-bold tracking-tight text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── faq ──────────────────────── */

function FaqSection() {
  const items = [
    {
      q: 'Is DET really free?',
      a: 'Yes, fully free during the public beta. Once the app is out of beta, a Free plan will keep working for personal use — only advanced reports, multi-currency portfolios, and team features will move behind a paid tier.',
    },
    {
      q: 'Will it sync with my bank?',
      a: 'Not by default, and by design. Bank syncs mix intentional spending with auto-debits and noise. DET is built around the things you choose to log. If you want bank import later, a manual CSV import is planned.',
    },
    {
      q: 'Can I use it on iOS?',
      a: 'The mobile app is built with Flutter, so iOS support is one build step away. We\'re shipping Android first while we close out the beta, with iOS following shortly after.',
    },
    {
      q: 'What happens to my data if I leave?',
      a: 'You can export everything as JSON via the API today. Delete the account and your rows are removed in cascade — expenses, budgets, categories, recurring, notifications, subscription, refresh tokens. No "soft" data left behind.',
    },
    {
      q: 'Do you read my expense notes?',
      a: 'No. The team doesn\'t look at your data. The only humans with raw DB access are infrastructure admins, and that access is audited. Notes are not analyzed, indexed for search beyond your own account, or used for ads.',
    },
    {
      q: 'Who built this?',
      a: 'DET is built by an independent developer as a portfolio-grade demonstration of a complete fintech stack — Next.js, MongoDB, Flutter, JWT auth, the whole picture. The codebase is intentionally production-shaped so it can keep growing into a real product.',
    },
  ];
  return (
    <section id="faq" className="relative px-5 lg:px-8 py-20 lg:py-28">
      <div className="max-w-4xl mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <SectionEyebrow>Questions answered</SectionEyebrow>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold text-slate-900 tracking-tightest leading-tight">
            Everything you'd want to know before signing up.
          </h2>
        </div>
        <div className="mt-12 space-y-3" data-stagger>
          {items.map((it) => (
            <details
              key={it.q}
              className="group rounded-2xl border border-slate-200 bg-white p-5 animate-fade-in-up open:shadow-card transition"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-semibold text-slate-900 pr-6">{it.q}</span>
                <span className="w-7 h-7 rounded-lg bg-slate-100 grid place-items-center text-slate-500 group-open:rotate-45 group-open:bg-brand-50 group-open:text-brand-600 transition-all duration-200">
                  <Plus className="w-3.5 h-3.5" />
                </span>
              </summary>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── waitlist cta ──────────────────────── */

function WaitlistCta() {
  return (
    <section id="waitlist" className="relative px-5 lg:px-8 py-24">
      <div className="relative max-w-5xl mx-auto rounded-3xl overflow-hidden border border-slate-200 bg-slate-950 text-white p-10 lg:p-14">
        <div aria-hidden="true" className="absolute inset-0 bg-mesh-dark" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur ring-1 ring-white/15 text-[11px] uppercase tracking-widest font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
            Beta is open · No card required
          </div>
          <h2 className="mt-5 text-3xl lg:text-5xl font-bold tracking-tightest leading-[1.05]">
            Take control of your spending — starting tonight.
          </h2>
          <p className="mt-4 text-slate-300 text-base lg:text-lg max-w-xl leading-relaxed">
            Join the early-access list and we'll send you an invite the moment the Android build is ready.
            One email. No marketing, no follow-ups.
          </p>
          <form className="mt-7 flex flex-col sm:flex-row gap-3 max-w-md">
            <input
              type="email"
              required
              placeholder="you@example.com"
              className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/20 transition"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand hover:brightness-110 transition whitespace-nowrap"
            >
              Notify me
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-5 flex items-center gap-5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Email never shared
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              One invite, that's it
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── footer ──────────────────────── */

function Footer() {
  const year = new Date().getFullYear();
  const cols = [
    {
      title: 'Product',
      links: [
        ['Features', '#features'],
        ['How it works', '#how-it-works'],
        ['Privacy', '#privacy'],
        ['FAQ', '#faq'],
      ],
    },
    {
      title: 'For builders',
      links: [
        ['Admin panel', '/admin/login'],
        ['API v1', '/api/v1'],
        ['Health', '/api/health'],
      ],
    },
    {
      title: 'Company',
      links: [
        ['About', '#'],
        ['Status', '#'],
        ['Contact', 'mailto:hello@det.app'],
      ],
    },
    {
      title: 'Legal',
      links: [
        ['Terms', '#'],
        ['Privacy policy', '#'],
        ['Cookie policy', '#'],
      ],
    },
  ];
  return (
    <footer className="border-t border-slate-200/70">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-14 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-10 gap-x-8">
        <div className="col-span-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 grid place-items-center font-bold text-white">
              D
            </div>
            <div className="leading-tight">
              <div className="font-bold tracking-tight text-slate-900">DET</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Daily Expense Tracker</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600 max-w-xs leading-relaxed">
            A privacy-first expense tracker built by an indie developer who got tired of
            spreadsheets and bank-app noise.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <a aria-label="GitHub" href="#" className="w-9 h-9 rounded-lg border border-slate-200 grid place-items-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition">
              <Github className="w-4 h-4" />
            </a>
            <a aria-label="Twitter" href="#" className="w-9 h-9 rounded-lg border border-slate-200 grid place-items-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition">
              <Twitter className="w-4 h-4" />
            </a>
            <a aria-label="Email" href="mailto:hello@det.app" className="w-9 h-9 rounded-lg border border-slate-200 grid place-items-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition">
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <h4 className="text-[11px] uppercase tracking-widest font-bold text-slate-500">{col.title}</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-slate-700 hover:text-slate-900 transition">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200/70">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>© {year} DET. Built with care, hosted privately.</div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            All systems normal
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────── shared ──────────────────────── */

function SectionEyebrow({ children }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-brand-700">{children}</div>
  );
}

/* ──────────────────────── icons ──────────────────────── */

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

function ArrowRight(p)   { return <svg viewBox="0 0 24 24" {...s} {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>; }
function Check(p)        { return <svg viewBox="0 0 24 24" {...s} {...p}><polyline points="20 6 9 17 4 12" /></svg>; }
function X(p)            { return <svg viewBox="0 0 24 24" {...s} {...p}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>; }
function Play(p)         { return <svg viewBox="0 0 24 24" {...s} {...p}><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" /></svg>; }
function Plus(p)         { return <svg viewBox="0 0 24 24" {...s} strokeWidth="2.5" {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>; }
function Dot(p)          { return <svg viewBox="0 0 24 24" {...s} {...p}><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>; }
function Shield(p)       { return <svg viewBox="0 0 24 24" {...s} {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>; }
function ShieldCheck(p)  { return <svg viewBox="0 0 24 24" {...s} {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>; }
function Lock(p)         { return <svg viewBox="0 0 24 24" {...s} {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>; }
function Zap(p)          { return <svg viewBox="0 0 24 24" {...s} {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>; }
function Globe(p)        { return <svg viewBox="0 0 24 24" {...s} {...p}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20z" /></svg>; }
function Bell(p)         { return <svg viewBox="0 0 24 24" {...s} {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>; }
function Briefcase(p)    { return <svg viewBox="0 0 24 24" {...s} {...p}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>; }
function Laptop(p)       { return <svg viewBox="0 0 24 24" {...s} {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><line x1="2" y1="20" x2="22" y2="20" /></svg>; }
function Book(p)         { return <svg viewBox="0 0 24 24" {...s} {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>; }
function Spark(p)        { return <svg viewBox="0 0 24 24" {...s} {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>; }
function Mail(p)         { return <svg viewBox="0 0 24 24" {...s} {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>; }
function Github(p)       { return <svg viewBox="0 0 24 24" {...s} {...p}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>; }
function Twitter(p)      { return <svg viewBox="0 0 24 24" {...s} {...p}><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" /></svg>; }
function SignalDots(p)   { return <svg viewBox="0 0 24 24" {...s} {...p}><circle cx="6" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="18" cy="12" r="1.5" fill="currentColor" /></svg>; }
function Battery(p)      { return <svg viewBox="0 0 24 24" {...s} {...p}><rect x="2" y="7" width="18" height="10" rx="2" /><rect x="4" y="9" width="13" height="6" fill="currentColor" stroke="none" /><line x1="22" y1="11" x2="22" y2="13" /></svg>; }
