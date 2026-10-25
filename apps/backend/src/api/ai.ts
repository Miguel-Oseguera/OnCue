import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { requireSession } from "../auth.js";
import { runLogisticsAgent } from "../agent/index.js";
import { maxPhotoBytes, readPhoto } from "../photos.js";
import { aiSchema, validate } from "./validation.js";

const ai = new Hono().post(
  "/",
  requireSession,
  bodyLimit({
    maxSize: maxPhotoBytes + 64 * 1024,
    onError: (c) =>
      c.json({ error: "Upload exceeds the 10 MiB image limit" }, 413),
  }),
  validate("form", aiSchema),
  async (c) => {
    const { text, source, images } = c.req.valid("form");
    if (images.reduce((size, image) => size + image.size, 0) > maxPhotoBytes) {
      return c.json({ error: "Images exceed 10 MiB in total" }, 413);
    }
    const photos = await Promise.all(images.map(readPhoto));
    const report =
      text || "Analyze the attached images for event logistics issues.";

    const { analysis, tasks } = await runLogisticsAgent({
      message: report,
      source,
      images: photos,
    });

    return c.json(
      {
        processed: true,
        analysis,
        tasks,
      },
      200,
    );
  },
);

export default ai;
