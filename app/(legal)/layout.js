// Shared layout for the public legal pages (/privacy, /terms). Sits
// outside the (admin) route group so it doesn't pick up the admin auth
// middleware — these pages MUST be reachable to logged-out users
// (Play Store reviewers, EU GDPR access, etc.).

export const metadata = {
  robots: { index: true, follow: false },
};

export default function LegalLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#5B7CFA] to-[#4564D6] flex items-center justify-center text-white font-extrabold tracking-wider text-[13px]">
            DET
          </div>
          <span className="font-semibold text-slate-900">DET</span>
          <nav className="ml-auto flex gap-4 text-sm text-slate-600">
            <a href="/privacy" className="hover:text-slate-900">Privacy</a>
            <a href="/terms" className="hover:text-slate-900">Terms</a>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <article className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h1:mb-2 prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-p:leading-relaxed prose-a:text-[#5B7CFA] prose-a:no-underline hover:prose-a:underline prose-table:text-sm prose-th:text-left prose-th:font-semibold prose-th:bg-slate-100 prose-td:align-top">
          {children}
        </article>
        <footer className="mt-16 pt-8 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
          <span>© {new Date().getFullYear()} DET</span>
          <a href="mailto:support@det.app">support@det.app</a>
        </footer>
      </main>
    </div>
  );
}
