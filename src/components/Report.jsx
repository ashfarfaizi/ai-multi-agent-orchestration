import { useState } from 'react';
import Markdown from './Markdown.jsx';

export default function Report({ text, streaming, task }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };
  const download = () => {
    const blob = new Blob([text], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const slug = (task || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50).replace(/^-|-$/g, '');
    a.download = `${slug || 'report'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="panel report" id="report">
      <div className="panel-head">
        <h2>
          Final document
          {streaming && <span className="state st-running"><span className="dot d-running" />Writing</span>}
        </h2>
        {!streaming && (
          <div className="row gap">
            <button type="button" className="btn ghost sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            <button type="button" className="btn ghost sm" onClick={download}>Download .md</button>
          </div>
        )}
      </div>
      <Markdown text={text} streaming={streaming} className="report-md" />
    </section>
  );
}
