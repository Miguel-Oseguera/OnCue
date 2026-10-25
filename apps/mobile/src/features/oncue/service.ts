import type { AIReport } from "./report-service";
/** Mobile DTOs follow Joshua's API contract on origin/jilva-dev (API.md).
 * Mock IDs are illustrative. No API, auth, database, or device calls occur here.
 */
export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "open" | "in_progress" | "completed";
export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  teamId: string | null;
  assigneeIds: string[];
  slots: number;
  location: string | null;
  createdAt: string;
  aiReports?: AIReport[];
}
export interface Team {
  id: string;
  name: string;
  leadIds: string[];
}
export interface Member {
  id: string;
  name: string;
  teamId: string | null;
}
export interface Dashboard {
  unlinkedAiReports?: AIReport[];
  unlinkedReportsAvailable?: boolean;
  tasks: Task[];
  teams: Team[];
  members: Member[];
  stats: {
    open: number;
    inProgress: number;
    completed: number;
    urgent: number;
  };
}
export type CreateTaskInput = Omit<
  Task,
  "id" | "status" | "createdAt" | "aiReports"
>;
export type UpdateTaskInput = Partial<Pick<Task, "status" | "assigneeIds">>;
export interface DashboardService {
  getDashboard(): Promise<Dashboard>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;
}
export function calculateStats(tasks: Task[]): Dashboard["stats"] {
  return {
    open: tasks.filter((task) => task.status === "open").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    urgent: tasks.filter(
      (task) => task.priority === "urgent" && task.status !== "completed",
    ).length,
  };
}
/** Mutation responses may omit AI reports. Preserve the loaded reports in that case. */
export function mergeSavedTask(previous: Dashboard, task: Task): Dashboard {
  const tasks = previous.tasks.some((item) => item.id === task.id)
    ? previous.tasks.map((item) =>
        item.id === task.id
          ? { ...task, aiReports: task.aiReports ?? item.aiReports }
          : item,
      )
    : [task, ...previous.tasks];
  return { ...previous, tasks, stats: calculateStats(tasks) };
}

const teams: Team[] = [
  { id: "team_av", name: "AV Support", leadIds: ["member_alex"] },
  { id: "team_ops", name: "Event Operations", leadIds: ["member_sam"] },
  { id: "team_logistics", name: "Logistics", leadIds: ["member_jordan"] },
];
const members: Member[] = [
  { id: "member_alex", name: "Alex Chen", teamId: "team_av" },
  { id: "member_maya", name: "Maya Patel", teamId: "team_av" },
  { id: "member_sam", name: "Sam Rivera", teamId: "team_ops" },
  { id: "member_lee", name: "Lee Thompson", teamId: "team_ops" },
  { id: "member_jordan", name: "Jordan Brooks", teamId: "team_logistics" },
  { id: "member_casey", name: "Casey Nguyen", teamId: "team_logistics" },
];
const tasks: Task[] = [
  {
    id: "task_projector",
    title: "Projector down in Room 204",
    description:
      "The projector is powered on but there is no image. Check the HDMI connection and bring a spare adapter before the next session.",
    priority: "urgent",
    status: "open",
    teamId: "team_av",
    assigneeIds: ["member_alex"],
    slots: 2,
    location: "Room 204",
    createdAt: "2026-10-25T08:42:00Z",
  },
  {
    id: "task_water",
    title: "Restock the water station",
    description:
      "Bring two cases of water and refill the cups at the main lobby station.",
    priority: "high",
    status: "in_progress",
    teamId: "team_logistics",
    assigneeIds: ["member_jordan"],
    slots: 1,
    location: "Main lobby",
    createdAt: "2026-10-25T08:36:00Z",
  },
  {
    id: "task_checkin",
    title: "Open a second check-in lane",
    description:
      "Set up a second badge scanner and direct arrivals to the new lane.",
    priority: "high",
    status: "open",
    teamId: "team_ops",
    assigneeIds: [],
    slots: 2,
    location: "North entrance",
    createdAt: "2026-10-25T08:28:00Z",
  },
  {
    id: "task_mic",
    title: "Test the keynote microphones",
    description:
      "Run a sound check with both wireless microphones and replace the batteries.",
    priority: "medium",
    status: "in_progress",
    teamId: "team_av",
    assigneeIds: ["member_maya"],
    slots: 1,
    location: "Main stage",
    createdAt: "2026-10-25T08:10:00Z",
  },
  {
    id: "task_signs",
    title: "Put up workshop wayfinding",
    description:
      "Directional signs are in place from the lobby to the workshop rooms.",
    priority: "low",
    status: "completed",
    teamId: "team_ops",
    assigneeIds: ["member_lee"],
    slots: 1,
    location: "East wing",
    createdAt: "2026-10-25T07:55:00Z",
  },
  {
    id: "task_tables",
    title: "Set up the volunteer desk",
    description: "Volunteer check-in table, schedules, and radios are ready.",
    priority: "medium",
    status: "completed",
    teamId: "team_logistics",
    assigneeIds: ["member_casey"],
    slots: 1,
    location: "Main lobby",
    createdAt: "2026-10-25T07:30:00Z",
  },
];
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Each signed-in UI session gets its own in-memory store. Reloading resets it.
 * A future API adapter implements this interface; screens never touch fixtures.
 */
export function createMockDashboardService(): DashboardService {
  let currentTasks = copy(tasks);
  let nextId = 1;
  function validateAssignees(ids: string[], slots: number) {
    if (new Set(ids).size !== ids.length)
      throw new Error("Choose each member only once.");
    if (ids.length > slots)
      throw new Error("The task has no more assignment slots.");
    if (ids.some((id) => !members.some((member) => member.id === id)))
      throw new Error("Choose a member from the roster.");
  }
  return {
    async getDashboard() {
      return copy({
        tasks: currentTasks,
        teams,
        members,
        stats: calculateStats(currentTasks),
      });
    },
    async createTask(input) {
      const title = input.title.trim();
      const description = input.description.trim();
      const location = input.location?.trim() || null;
      if (!title || title.length > 200)
        throw new Error("Use a title between 1 and 200 characters.");
      if (description.length > 10000)
        throw new Error("Keep the description under 10,000 characters.");
      if (location && location.length > 500)
        throw new Error("Keep the location under 500 characters.");
      if (!["low", "medium", "high", "urgent"].includes(input.priority))
        throw new Error("Choose a valid priority.");
      if (
        !Number.isInteger(input.slots) ||
        input.slots < 1 ||
        input.slots > 100
      )
        throw new Error("Choose between 1 and 100 assignment slots.");
      if (
        input.teamId !== null &&
        !teams.some((team) => team.id === input.teamId)
      )
        throw new Error("Choose a team from the roster.");
      validateAssignees(input.assigneeIds, input.slots);
      const task: Task = {
        ...copy(input),
        title,
        description,
        location,
        id: `mock_task_${nextId++}`,
        status: "open",
        createdAt: new Date().toISOString(),
      };
      currentTasks = [task, ...currentTasks];
      return copy(task);
    },
    async updateTask(id, input) {
      const existing = currentTasks.find((task) => task.id === id);
      if (!existing) throw new Error("This task is no longer available.");
      if (
        Object.keys(input).length === 0 ||
        Object.keys(input).some(
          (key) => key !== "status" && key !== "assigneeIds",
        )
      )
        throw new Error("Update a task's status or assignments.");
      if (
        input.status !== undefined &&
        !["open", "in_progress", "completed"].includes(input.status)
      )
        throw new Error("Choose a valid status.");
      const assigneeIds = input.assigneeIds ?? existing.assigneeIds;
      validateAssignees(assigneeIds, existing.slots);
      const updated = {
        ...existing,
        status: input.status ?? existing.status,
        assigneeIds: [...assigneeIds],
      };
      currentTasks = currentTasks.map((task) =>
        task.id === id ? updated : task,
      );
      return copy(updated);
    },
  };
}

export const mockDashboardService = createMockDashboardService();
