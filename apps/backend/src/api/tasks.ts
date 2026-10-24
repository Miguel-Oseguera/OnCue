import { Hono } from "hono";

const dummy_tasks = [
  {
    id: "task-1",
    title: "Plan the week",
    description: "Review priorities and schedule the most important work.",
    completed: false,
  },
  {
    id: "task-2",
    title: "Reply to emails",
    description: "Clear the outstanding messages in the inbox.",
    completed: false,
  },
  {
    id: "task-3",
    title: "Take a break",
    description: "Step away from the desk for a short walk.",
    completed: true,
  },
];

const tasks = new Hono().basePath("/tasks");

tasks.get("/all", (c) => c.json(dummy_tasks));

tasks.post("/new", (c) => c.text("new task created!"));

export default tasks;
