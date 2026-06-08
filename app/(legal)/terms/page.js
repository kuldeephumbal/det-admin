import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const metadata = {
  title: 'Terms of Service — DET',
  description:
    'The rules of using DET. Plain-English contract, no surprises.',
};

export const dynamic = 'force-dynamic';

function loadDoc() {
  const path = join(process.cwd(), 'docs', 'legal', 'terms-of-service.md');
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

export default function TermsOfServicePage() {
  const md = loadDoc();
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {md}
    </ReactMarkdown>
  );
}
