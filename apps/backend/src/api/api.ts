import { Hono } from "hono";
import tasks from "./tasks.js";

const api = new Hono().basePath("/api");
api.route("/", tasks);
export default api;
