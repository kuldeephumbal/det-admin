import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const metadata = {
  title: 'Privacy Policy — DET',
  description:
    'How DET collects, uses, and shares your information. No selling, no ads, only what we need to run the app.',
};

// Read the markdown at request time (force-dynamic) so edits to the
// doc don't need a rebuild. The legal pages get very low traffic so
// the per-request fs read is fine.
export const dynamic = 'force-dynamic';

function loadDoc() {
  const path = join(process.cwd(), 'docs', 'legal', 'privacy-policy.md');
  const raw = readFileSync(path, 'utf8');
  return stripFrontmatter(raw);
}

function stripFrontmatter(md) {
  if (md.startsWith('---')) {
    const end = md.indexOf('\n---', 3);
    if (end !== -1) return md.slice(end + 4).trimStart();
  }
  return md;
}

export default function PrivacyPolicyPage() {
  const md = loadDoc();
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {md}
    </ReactMarkdown>
  );
}
