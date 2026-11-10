import { Fragment } from "react";

/**
 * Tiny, safe Markdown renderer for admin-edited content (policies, story).
 * Supports: ## / ### headings, paragraphs, - and 1. lists, **bold**, _italic_.
 * Output is built from React elements — no raw HTML is ever injected.
 */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={`${keyBase}-${k++}`}>{tok.slice(2, -2)}</strong>);
    else out.push(<em key={`${keyBase}-${k++}`}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (!lines.length) return null;
        const first = lines[0];
        if (first.startsWith("### ")) return <h3 key={bi}>{inline(first.slice(4), `h${bi}`)}</h3>;
        if (first.startsWith("## ")) return <h2 key={bi}>{inline(first.slice(3), `h${bi}`)}</h2>;
        if (lines.every((l) => /^\s*[-*]\s+/.test(l)))
          return (
            <ul key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        if (lines.every((l) => /^\s*\d+\.\s+/.test(l)))
          return (
            <ol key={bi}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*\d+\.\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ol>
          );
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
