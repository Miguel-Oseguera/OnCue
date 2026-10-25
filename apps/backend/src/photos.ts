import { HTTPException } from "hono/http-exception";

export const maxPhotoBytes = 10 * 1024 * 1024;

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

// Check the file signature before storing a photo or sending it to Gemini.
export async function readPhoto(file: File) {
  if (file.size === 0)
    throw new HTTPException(400, { message: "Photo is empty" });
  if (file.size > maxPhotoBytes)
    throw new HTTPException(413, { message: "Photo exceeds 10 MiB" });
  const data = Buffer.from(await file.arrayBuffer());
  const contentType = photoContentType(data);
  if (!contentType || contentType !== file.type) {
    throw new HTTPException(415, {
      message: "Upload a JPEG, PNG, or WebP photo with its matching MIME type",
    });
  }
  return { data, contentType };
}
