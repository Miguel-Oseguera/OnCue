import { Hono } from "hono";
import ai from "./ai.js";
import dashboard from "./dashboard.js";
import media from "./media.js";
import tasks from "./tasks.js";
import notifications from "./notifications.js";

const api = new Hono()
  .basePath("/api")
  .route("/dashboard", dashboard)
  .route("/tasks", tasks)
  .route("/media", media)
  .route("/ai", ai)
  .route("/notifications", notifications);
  

export default api;
