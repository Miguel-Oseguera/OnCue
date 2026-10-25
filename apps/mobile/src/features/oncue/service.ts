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
export interface DashboardService {
  getDashboard(): Promise<Dashboard>;
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
/** Replace this implementation with an authenticated adapter when APIs are approved.
 * Keep fixtures private and return fresh data so consumers cannot mutate the seed.
 */
export const mockDashboardService: DashboardService = {
  async getDashboard() {
    return JSON.parse(
      JSON.stringify({ tasks, teams, members, stats: calculateStats(tasks) }),
    ) as Dashboard;
  },
};
