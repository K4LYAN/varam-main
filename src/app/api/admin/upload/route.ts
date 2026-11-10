import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, MIME_BY_EXT, sniffImage, UPLOAD_DIR } from "@/lib/uploads";

/**
 * Admin image upload.
 * - Production (Vercel): stored in Vercel Blob when BLOB_READ_WRITE_TOKEN is set.
 * - Local / self-hosted: stored on disk in ./.data/uploads and served from /uploads/<file>.
 */
export async function POST(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Images must be 5 MB or smaller" }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffImage(bytes);
  if (!ext) return NextResponse.json({ error: "Only JPG, PNG, WebP or AVIF images are allowed" }, { status: 415 });

  const name = `${crypto.randomUUID()}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`varam/${name}`, Buffer.from(bytes), {
      access: "public",
      contentType: MIME_BY_EXT[ext],
      addRandomSuffix: false,
    });
    return NextResponse.json({ url: blob.url });
  }

  if (process.env.VERCEL) {
    return NextResponse.json(
      { error: "Image storage is not configured. Connect Vercel Blob (BLOB_READ_WRITE_TOKEN) or paste an image URL instead." },
      { status: 500 },
    );
  }

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, name), bytes);
  return NextResponse.json({ url: `/uploads/${name}` });
}
