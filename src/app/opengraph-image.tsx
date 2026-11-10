import { ImageResponse } from "next/og";

export const alt = "VARAM — Nature's Purity. Pressed with Tradition.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse at 50% 40%, #5a3218 0%, #2b160a 70%)",
          color: "#faf6ee",
          fontFamily: "Georgia, serif",
        }}
      >
        <svg width="96" height="96" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18.5" fill="none" stroke="#faf6ee" strokeWidth="1" opacity="0.5" />
          <path d="M20 8.5c4.6 6.1 7.2 10.6 7.2 14.6a7.2 7.2 0 0 1-14.4 0c0-4 2.6-8.5 7.2-14.6Z" fill="#e0a12b" />
        </svg>
        <div style={{ fontSize: 120, letterSpacing: 36, marginTop: 28, paddingLeft: 36 }}>VARAM</div>
        <div style={{ width: 160, height: 1, background: "#e0a12b", marginTop: 18 }} />
        <div style={{ fontSize: 40, fontStyle: "italic", color: "#f4cd7a", marginTop: 28 }}>
          Nature&apos;s Purity. Pressed with Tradition.
        </div>
        <div style={{ fontSize: 20, letterSpacing: 8, marginTop: 36, color: "rgba(250,246,238,0.7)" }}>
          TRADITIONAL COLD-PRESSED OILS
        </div>
      </div>
    ),
    size,
  );
}
