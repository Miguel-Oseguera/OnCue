import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireSession } from "../auth.js";
import { db } from "../db.js";
import { maxPhotoBytes, readPhoto } from "../photos.js";
import { media, task } from "../schema.js";
import { mediaParams, validate } from "./validation.js";

const uploadSchema = z.strictObject({
  file: z.file(),
  taskId: z.guid().optional(),
});

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
      const { data, contentType } = await readPhoto(file);
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
