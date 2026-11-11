import { useId } from "react";

function shortLabel(name: string) {
  return name
    .replace(/^varam\s+/i, "")
    .replace(/cold[- ]pressed\s+/i, "")
    .replace(/\s+oil$/i, "")
    .trim();
}

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * (1 + amount));
  const g = clamp(((n >> 8) & 255) * (1 + amount));
  const b = clamp((n & 255) * (1 + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * A rendered VARAM bottle used when no product photograph has been uploaded.
 * Oil colour, product name and bottle size are driven by catalogue data.
 */
export function BottleArt({
  name,
  tone = "#D7A436",
  size,
  className,
}: {
  name: string;
  tone?: string;
  size?: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const label = shortLabel(name).toUpperCase();
  const safeTone = /^#[0-9a-f]{6}$/i.test(tone) ? tone : "#D7A436";
  const deep = shade(safeTone, -0.38);
  const light = shade(safeTone, 0.22);
  // Ghee is shown in a wide jar, oils in a tall bottle
  const jar = /ghee|honey/i.test(name);
  const bottle = jar
    ? "M58 150 Q44 150 44 168 L44 428 Q44 450 66 450 L174 450 Q196 450 196 428 L196 168 Q196 150 182 150 Z"
    : "M103 74 L103 112 C103 134 52 146 52 180 L52 430 Q52 450 72 450 L168 450 Q188 450 188 430 L188 180 C188 146 137 134 137 112 L137 74 Z";
  const fillTop = jar ? 178 : 196;
  const labelFont = label.length > 11 ? 10.5 : 12.5;

  return (
    <svg viewBox="0 0 240 480" className={className} role="img" aria-label={`${name} bottle`}>
      <defs>
        <clipPath id={`clip-${id}`}>
          <path d={bottle} />
        </clipPath>
        <linearGradient id={`oil-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={deep} />
          <stop offset="0.28" stopColor={safeTone} />
          <stop offset="0.55" stopColor={light} />
          <stop offset="0.82" stopColor={safeTone} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <linearGradient id={`glass-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={`cap-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#2b160a" />
          <stop offset="0.45" stopColor="#7b4826" />
          <stop offset="1" stopColor="#2b160a" />
        </linearGradient>
        <radialGradient id={`shadow-${id}`}>
          <stop offset="0" stopColor="#3b2a17" stopOpacity="0.35" />
          <stop offset="1" stopColor="#3b2a17" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="120" cy="456" rx="96" ry="14" fill={`url(#shadow-${id})`} />

      {/* glass + oil */}
      <g clipPath={`url(#clip-${id})`}>
        <rect x="0" y="0" width="240" height="480" fill="#f6efe0" opacity="0.55" />
        <rect x="0" y={fillTop} width="240" height="300" fill={`url(#oil-${id})`} />
        <rect x="0" y={fillTop - 4} width="240" height="6" fill={light} opacity="0.75" />
        <rect x="0" y="0" width="240" height="480" fill={`url(#glass-${id})`} />
        <rect x="64" y="150" width="9" height="290" rx="4.5" fill="#fff" opacity="0.32" />
        <rect x="170" y="180" width="4" height="250" rx="2" fill="#fff" opacity="0.18" />
      </g>
      <path d={bottle} fill="none" stroke="#2c2416" strokeOpacity="0.28" strokeWidth="1.2" />

      {/* cap / lid */}
      {jar ? (
        <>
          <rect x="50" y="110" width="140" height="46" rx="8" fill={`url(#cap-${id})`} />
          <rect x="50" y="144" width="140" height="7" fill="#d0921e" />
          <rect x="50" y="110" width="140" height="6" rx="3" fill="#000" opacity="0.18" />
        </>
      ) : (
        <>
          <rect x="99" y="30" width="42" height="50" rx="5" fill={`url(#cap-${id})`} />
          <rect x="99" y="66" width="42" height="7" fill="#d0921e" />
          <rect x="99" y="30" width="42" height="5" rx="2.5" fill="#000" opacity="0.18" />
        </>
      )}

      {/* label */}
      <rect x="62" y="248" width="116" height="156" rx="2" fill="#faf6ee" />
      <rect x="67" y="253" width="106" height="146" rx="1" fill="none" stroke="#d0921e" strokeWidth="0.8" />
      <path d="M120 266c3.2 4.2 5 7.4 5 10.2a5 5 0 0 1-10 0c0-2.8 1.8-6 5-10.2Z" fill="#d0921e" />
      <text
        x="120"
        y="306"
        textAnchor="middle"
        fontSize="21"
        letterSpacing="5"
        fill="#5a3218"
        style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 600 }}
      >
        VARAM
      </text>
      <line x1="96" x2="144" y1="316" y2="316" stroke="#d0921e" strokeWidth="0.8" />
      <text
        x="120"
        y="338"
        textAnchor="middle"
        fontSize={labelFont}
        letterSpacing="1.6"
        fill="#1f2117"
        style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 600 }}
      >
        {label}
      </text>
      <text
        x="120"
        y="354"
        textAnchor="middle"
        fontSize="6.4"
        letterSpacing="2.2"
        fill="#6c675a"
        style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontWeight: 600 }}
      >
        {/honey/i.test(name) ? "NATURAL HONEY" : jar ? "TRADITIONAL GHEE" : "COLD-PRESSED OIL"}
      </text>
      {size && (
        <text
          x="120"
          y="386"
          textAnchor="middle"
          fontSize="7.5"
          letterSpacing="1.6"
          fill="#6b4a2e"
          style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontWeight: 600 }}
        >
          {size.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
