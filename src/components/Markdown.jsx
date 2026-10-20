import { memo, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: false });

// GFM treats a single "~" as strikethrough, but agents write "~9M" to mean
// "approximately". Only allow strikethrough with a double tilde.
marked.use({
  tokenizer: {
    del(src) {
      const dbl = /^~~(?=\S)([\s\S]*?\S)~~(?!~)/.exec(src);
      if (dbl) return { type: 'del', raw: dbl[0], text: dbl[1], tokens: this.lexer.inlineTokens(dbl[1]) };
      if (src[0] === '~') return { type: 'text', raw: '~', text: '~' };
      return false;
    },
  },
});

function Markdown({ text, streaming = false, className = '' }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text || '')), [text]);
  return (
    <div className={`md ${streaming ? 'streaming' : ''} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export default memo(Markdown);
