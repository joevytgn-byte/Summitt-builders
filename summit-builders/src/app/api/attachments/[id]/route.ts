import { getCurrentUser } from "@/lib/auth";
import { requestScope } from "@/lib/access";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const attachment = await db.attachment.findFirst({
    where: { id, request: requestScope(user) },
    select: { name: true, mime: true, data: true, size: true },
  });
  if (!attachment) return new Response("Not found", { status: 404 });

  const buffer = Buffer.from(attachment.data, "base64");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": attachment.mime || "application/octet-stream",
      "Content-Length": String(buffer.byteLength || attachment.size),
      "Content-Disposition": `inline; filename="${attachment.name.replace(/["\r\n]/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
