import { GlassesConnectionCard } from "../glasses/connection-card";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { authClient } from "@/lib/auth-client";
import { dashboardColors as c } from "./dashboard-theme";
import { Dashboard, Task, TaskStatus } from "./service";
import { useDashboard } from "./use-dashboard";

const statusLabels: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
};
const priorityColors = {
  urgent: c.red,
  high: c.amber,
  medium: c.accent,
  low: c.muted,
};
type Filter = "active" | "urgent" | "completed";

function TaskCard({ task, data }: { task: Task; data: Dashboard }) {
  const [expanded, setExpanded] = useState(false);
  const team = data.teams.find((item) => item.id === task.teamId);
  const assignees = task.assigneeIds.map(
    (id) =>
      data.members.find((member) => member.id === id)?.name ?? "Unknown member",
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${task.priority} priority, ${statusLabels[task.status]}. ${expanded ? "Hide" : "Show"} details`}
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)}
      style={({ pressed }) => [s.task, pressed && s.pressed]}
    >
      <View style={s.row}>
        <View
          style={[s.dot, { backgroundColor: priorityColors[task.priority] }]}
        />
        <Text style={[s.eyebrow, { color: priorityColors[task.priority] }]}>
          {task.priority.toUpperCase()}
        </Text>
        <View style={s.spacer} />
        <Text
          style={[s.small, task.status === "completed" && { color: c.green }]}
        >
          {statusLabels[task.status]}
        </Text>
      </View>
      <Text style={s.taskTitle}>{task.title}</Text>
      <Text style={s.small}>
        {task.location ?? "No location"} · {team?.name ?? "No team"}
      </Text>
      <View style={[s.row, { marginTop: 5 }]}>
        <View style={s.avatarSmall}>
          <Text style={s.initials}>
            {assignees[0]
              ?.split(" ")
              .map((part) => part[0])
              .join("") ?? "—"}
          </Text>
        </View>
        <Text style={[s.small, { flex: 1 }]}>
          {assignees.length ? assignees.join(", ") : "Unassigned"}
        </Text>
        <Text style={s.expand}>{expanded ? "−" : "+"}</Text>
      </View>
      {expanded && (
        <View style={s.details}>
          <Text style={s.body}>{task.description}</Text>
          <Text style={s.small}>
            {task.assigneeIds.length} of {task.slots} assignment slots filled
          </Text>
          <Text style={s.small}>
            Created {new Date(task.createdAt).toLocaleString()}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { data: session } = authClient.useSession();
  const { data, loading, error, refresh } = useDashboard();
  const [filter, setFilter] = useState<Filter>("active");
  const firstName = session?.user.name?.trim().split(/\s+/)[0] || "there";
  const active =
    data?.tasks.filter((task) => task.status !== "completed") ?? [];
  const visible =
    data?.tasks.filter((task) =>
      filter === "urgent"
        ? task.priority === "urgent" && task.status !== "completed"
        : filter === "completed"
          ? task.status === "completed"
          : task.status !== "completed",
    ) ?? [];
  const completedPercent = data?.tasks.length
    ? Math.round((data.stats.completed / data.tasks.length) * 100)
    : 0;
  return (
    <SafeAreaView style={s.screen} edges={["top", "left", "right"]}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={loading && Boolean(data)}
            onRefresh={() => void refresh()}
            tintColor={c.accent}
          />
        }
      >
        <View style={s.header}>
          <View style={s.row}>
            <View style={s.logo}>
              <Text style={s.logoText}>O</Text>
              <View style={s.logoDot} />
            </View>
            <Text style={s.brand}>OnCue</Text>
          </View>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {firstName === "there" ? "O" : firstName[0].toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={s.row}>
          <View style={[s.dot, { backgroundColor: c.accent }]} />
          <Text style={s.eyebrow}>OPERATIONS OVERVIEW</Text>
          <View style={s.spacer} />
          <View style={s.demo}>
            <Text style={s.demoText}>WORKSPACE</Text>
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={s.greeting}>
            You’re on cue,{"\n"}
            {firstName}.
          </Text>
          <Text style={s.subtitle}>
            One place to keep every moving part moving.
          </Text>
        </View>
        <GlassesConnectionCard />
        {loading && !data && (
          <ActivityIndicator
            accessibilityLabel="Loading dashboard"
            color={c.accent}
            style={{ margin: 36 }}
          />
        )}
        {error && (
          <View style={s.card}>
            <Text accessibilityRole="alert" style={s.body}>
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refresh()}
              style={s.retry}
            >
              <Text style={s.link}>Try again</Text>
            </Pressable>
          </View>
        )}
        {data && (
          <>
            <View style={s.event}>
              <View style={s.row}>
                <Text style={s.eventIcon}>◈</Text>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={s.eyebrow}>YOUR WORKSPACE</Text>
                  <Text style={s.eventName}>Event operations</Text>
                  <Text style={s.small}>Tasks and team activity</Text>
                </View>
              </View>
              <View style={s.eventFooter}>
                <Text style={s.small}>
                  {data.teams.length} teams coordinating
                </Text>
                <Text style={[s.small, { color: c.green }]}>
                  {data.members.length} members
                </Text>
              </View>
            </View>
            <View style={s.stats}>
              {(
                [
                  ["Open", data.stats.open, c.accent, "active"],
                  ["In progress", data.stats.inProgress, c.amber, "active"],
                  ["Completed", data.stats.completed, c.green, "completed"],
                  ["Urgent", data.stats.urgent, c.red, "urgent"],
                ] as const
              ).map(([label, value, color, target]) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={`${value} ${label.toLowerCase()} tasks. Show ${target} tasks`}
                  onPress={() => setFilter(target)}
                  style={({ pressed }) => [s.stat, pressed && s.pressed]}
                >
                  <View style={s.row}>
                    <View style={[s.dot, { backgroundColor: color }]} />
                    <Text style={s.small}>{label}</Text>
                  </View>
                  <Text style={[s.statValue, { color }]}>
                    {value.toString().padStart(2, "0")}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={s.sectionHead}>
              <View>
                <Text style={s.sectionTitle}>Task pulse</Text>
                <Text style={[s.small, { marginTop: 5 }]}>
                  {active.length} tasks need your team’s attention
                </Text>
              </View>
              <View style={s.count}>
                <Text style={s.countText}>{data.tasks.length}</Text>
              </View>
            </View>
            <View style={s.filters}>
              {(["active", "urgent", "completed"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === value }}
                  onPress={() => setFilter(value)}
                  style={({ pressed }) => [
                    s.filter,
                    filter === value && s.filterSelected,
                    pressed && s.pressed,
                  ]}
                >
                  <Text
                    style={[
                      s.filterText,
                      filter === value && { color: c.text },
                    ]}
                  >
                    {value === "active"
                      ? "Active"
                      : value === "urgent"
                        ? "Urgent"
                        : "Completed"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ gap: 12 }}>
              {visible.map((task) => (
                <TaskCard key={task.id} task={task} data={data} />
              ))}
              {!visible.length && (
                <View style={s.card}>
                  <Text style={s.taskTitle}>All clear here.</Text>
                  <Text style={s.small}>No {filter} tasks to show.</Text>
                </View>
              )}
            </View>
            <View style={s.progressCard}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>Making progress</Text>
                <Text style={[s.taskTitle, { color: c.green }]}>
                  {completedPercent}%
                </Text>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Tasks completed"
                accessibilityValue={{ min: 0, max: 100, now: completedPercent }}
                style={s.track}
              >
                <View style={[s.progress, { width: `${completedPercent}%` }]} />
              </View>
              <Text style={s.small}>
                {data.stats.completed} of {data.tasks.length} tasks completed.
                Every detail counts.
              </Text>
            </View>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Your teams</Text>
              <Text style={s.small}>{data.members.length} members</Text>
            </View>
            <View style={s.card}>
              {data.teams.map((team, index) => {
                const count = active.filter(
                  (task) => task.teamId === team.id,
                ).length;
                const roster = data.members.filter(
                  (member) => member.teamId === team.id,
                );
                const leads = roster
                  .filter((member) => team.leadIds.includes(member.id))
                  .map((member) => member.name.split(" ")[0])
                  .join(", ");
                return (
                  <View
                    key={team.id}
                    style={[s.teamRow, index > 0 && s.teamBorder]}
                  >
                    <View style={s.teamIcon}>
                      <Text style={s.avatarText}>
                        {team.name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={s.teamName}>{team.name}</Text>
                      <Text style={s.small}>
                        {roster.length} members ·{" "}
                        {leads ? `${leads} leading` : "No lead assigned"}
                      </Text>
                    </View>
                    <View style={s.count}>
                      <Text style={s.countText}>{count}</Text>
                    </View>
                  </View>
                );
              })}
              <Text style={[s.small, { paddingTop: 8 }]}>
                Task counts show active work per team.
              </Text>
            </View>
            <Text style={s.footnote}>
              Pull to refresh · Tap a task for details
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 22,
    paddingBottom: 120,
    gap: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  spacer: { flex: 1 },
  logo: {
    height: 32,
    width: 32,
    backgroundColor: c.blue,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: c.text, fontSize: 25, fontWeight: "800" },
  logoDot: {
    position: "absolute",
    height: 7,
    width: 7,
    backgroundColor: c.green,
    borderRadius: 4,
    bottom: 2,
    right: 1,
  },
  brand: { fontSize: 25, fontWeight: "700", letterSpacing: -1, color: c.text },
  avatar: {
    height: 42,
    width: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: c.accent, fontSize: 14, fontWeight: "700" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: c.muted,
  },
  demo: { backgroundColor: c.raised, borderRadius: 5, padding: 6 },
  demoText: {
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: "700",
    color: c.accent,
  },
  greeting: {
    color: c.text,
    fontSize: 36,
    lineHeight: 43,
    letterSpacing: -1.1,
    fontWeight: "700",
  },
  subtitle: { color: c.muted, fontSize: 15, lineHeight: 23 },
  event: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    padding: 18,
    gap: 18,
  },
  eventIcon: { color: c.accent, fontSize: 36, marginRight: 8 },
  eventName: { color: c.text, fontSize: 17, fontWeight: "600" },
  eventFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: 1,
    borderColor: c.border,
    paddingTop: 14,
  },
  small: { fontSize: 12, lineHeight: 18, color: c.muted },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stat: {
    flexBasis: "46%",
    flexGrow: 1,
    padding: 17,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 17,
    gap: 12,
  },
  statValue: { fontSize: 33, fontWeight: "600", letterSpacing: -1 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: c.text,
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  count: {
    minWidth: 30,
    minHeight: 30,
    borderRadius: 10,
    backgroundColor: c.raised,
    alignItems: "center",
    justifyContent: "center",
    padding: 5,
  },
  countText: { color: c.accent, fontSize: 12, fontWeight: "700" },
  filters: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: c.surface,
    borderRadius: 13,
    gap: 4,
    marginTop: -8,
  },
  filter: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 5,
  },
  filterSelected: {
    backgroundColor: c.raised,
    borderWidth: 1,
    borderColor: c.border,
  },
  filterText: { color: c.muted, fontSize: 12, fontWeight: "600" },
  task: {
    padding: 18,
    borderRadius: 17,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    gap: 11,
  },
  taskTitle: { fontSize: 16, lineHeight: 23, color: c.text, fontWeight: "600" },
  avatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: c.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: c.accent, fontSize: 10, fontWeight: "700" },
  expand: { color: c.accent, fontSize: 22 },
  details: {
    paddingTop: 13,
    gap: 12,
    borderTopWidth: 1,
    borderColor: c.border,
  },
  body: { fontSize: 14, lineHeight: 22, color: c.text },
  card: {
    backgroundColor: c.surface,
    padding: 18,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: c.border,
    gap: 12,
  },
  progressCard: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    borderRadius: 17,
    padding: 18,
    gap: 16,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.border,
    overflow: "hidden",
  },
  progress: { height: "100%", backgroundColor: c.green, borderRadius: 3 },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  teamBorder: { paddingTop: 16, borderTopWidth: 1, borderColor: c.border },
  teamIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: c.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  teamName: { color: c.text, fontSize: 14, fontWeight: "600" },
  footnote: {
    color: c.muted,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 18,
  },
  pressed: { opacity: 0.7 },
  retry: { minHeight: 44, justifyContent: "center" },
  link: { color: c.accent, fontWeight: "600" },
});
