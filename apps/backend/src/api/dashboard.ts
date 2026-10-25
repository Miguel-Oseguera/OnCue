import { Hono } from "hono";
import { db } from "../db.js";
import { requireSession } from "../auth.js";
import { listTasks } from "../tasks.js";

const dashboard = new Hono().get("/", requireSession, async (c) => {
  const [tasks, teams, members] = await Promise.all([
    listTasks(),
    db.query.team.findMany({
      with: { members: true },
      orderBy: (team, { asc }) => [asc(team.teamName), asc(team.id)],
    }),
    db.query.user.findMany({
      columns: { id: true, name: true },
      orderBy: (user, { asc }) => [asc(user.name), asc(user.id)],
    }),
  ]);
  const memberships = new Map(
    teams.flatMap((team) =>
      team.members.map((member) => [member.userId, team.id] as const),
    ),
  );
  return c.json(
    {
      tasks,
      teams: teams.map((team) => ({
        id: team.id,
        name: team.teamName,
        leadIds: team.members
          .filter((member) => member.role === "lead")
          .map((member) => member.userId)
          .sort(),
      })),
      members: members.map((member) => ({
        ...member,
        teamId: memberships.get(member.id) ?? null,
      })),
      stats: {
        open: tasks.filter((task) => task.status === "open").length,
        inProgress: tasks.filter((task) => task.status === "in_progress")
          .length,
        completed: tasks.filter((task) => task.status === "completed").length,
        urgent: tasks.filter(
          (task) => task.priority === "urgent" && task.status !== "completed",
        ).length,
      },
    },
    200,
  );
});

export default dashboard;
