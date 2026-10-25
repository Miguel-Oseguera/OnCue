import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireSession } from "../auth.js";
import { db } from "../db.js";
import { media, task } from "../schema.js";
import { mediaParams, validate } from "./validation.js";

export const maxPhotoBytes = 10 * 1024 * 1024;
const uploadSchema = z.strictObject({
  file: z.file(),
  taskId: z.guid().optional(),
});

function photoContentType(data: Buffer) {
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    return "image/jpeg";
  if (
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    data.subarray(0, 4).toString() === "RIFF" &&
    data.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  return null;
}

const photos = new Hono()
  .post(
    "/",
    requireSession,
    bodyLimit({
      maxSize: maxPhotoBytes + 64 * 1024,
      onError: (c) =>
        c.json({ error: "Upload exceeds the 10 MiB photo limit" }, 413),
    }),
    validate("form", uploadSchema),
    async (c) => {
      const { file, taskId } = c.req.valid("form");
      if (file.size === 0) return c.json({ error: "Photo is empty" }, 400);
      if (file.size > maxPhotoBytes)
        return c.json({ error: "Photo exceeds 10 MiB" }, 413);
      const data = Buffer.from(await file.arrayBuffer());
      const contentType = photoContentType(data);
      if (!contentType || contentType !== file.type) {
        return c.json(
          {
            error:
              "Upload a JPEG, PNG, or WebP photo with its matching MIME type",
          },
          415,
        );
      }
      const id = randomUUID();
      const url = `/api/media/${id}`;
      await db.transaction(async (tx) => {
        if (taskId) {
          const [target] = await tx
            .select({ id: task.id })
            .from(task)
            .where(eq(task.id, taskId))
            .for("key share");
          if (!target)
            throw new HTTPException(404, { message: "Task not found" });
        }
        await tx.insert(media).values({
          mediaId: id,
          taskId,
          photo: url,
          photoData: data,
          contentType,
        });
      });
      return c.json(
        { id, url, contentType, size: file.size, taskId: taskId ?? null },
        201,
      );
    },
  )
  .get(
    "/:mediaId",
    requireSession,
    validate("param", mediaParams),
    async (c) => {
      const [photo] = await db
        .select({ data: media.photoData, contentType: media.contentType })
        .from(media)
        .where(eq(media.mediaId, c.req.valid("param").mediaId));
      if (!photo?.data || !photo.contentType)
        return c.json({ error: "Photo not found" }, 404);
      c.header("Content-Type", photo.contentType);
      c.header("Content-Length", String(photo.data.length));
      c.header("Cache-Control", "private, no-store");
      c.header("X-Content-Type-Options", "nosniff");
      return c.body(new Uint8Array(photo.data), 200);
    },
  );

export default photos;
