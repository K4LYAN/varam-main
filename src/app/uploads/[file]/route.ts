import { MIME_BY_EXT, SAFE_FILE, UPLOAD_DIR } from "@/lib/uploads";

/** Serves locally stored uploads (development / self-hosting without Blob storage). */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!SAFE_FILE.test(file)) return new Response("Not found", { status: 404 });
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  try {
    const data = await fs.readFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, file));
    const ext = file.split(".").pop() as string;
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
