import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { dashboardColors as c } from "./dashboard-theme";
import { useOperations } from "./operations-provider";
import type { Dashboard, Task, Team } from "./service";
import {
  Button,
  Chip,
  Field,
  Heading,
  Notice,
  Page,
  priorityColors,
  statusLabels,
  t,
} from "./task-ui";

function teamData(data: Dashboard, id: string) {
  const tasks = data.tasks.filter((task) => task.teamId === id);
  return {
    roster: data.members.filter((member) => member.teamId === id),
    tasks,
    active: tasks.filter((task) => task.status !== "completed"),
    completed: tasks.filter((task) => task.status === "completed"),
    urgent: tasks.filter(
      (task) => task.priority === "urgent" && task.status !== "completed",
    ),
  };
}
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
function Avatar({ name }: { name: string }) {
  return (
    <View style={s.avatar}>
      <Text style={s.initials}>{initials(name)}</Text>
    </View>
  );
}
function Workload({
  active,
  completed,
  urgent,
}: {
  active: number;
  completed: number;
  urgent: number;
}) {
  return (
    <View style={s.workload}>
      {(
        [
          ["Active", active, c.accent],
          ["Urgent", urgent, c.red],
          ["Completed", completed, c.green],
        ] as const
      ).map(([label, count, color]) => (
        <View key={label} style={s.metric}>
          <Text style={[s.value, { color }]}>
            {count.toString().padStart(2, "0")}
          </Text>
          <Text style={t.small}>{label}</Text>
        </View>
      ))}
    </View>
  );
}
function TeamCard({ team, data }: { team: Team; data: Dashboard }) {
  const { roster, active, completed, urgent } = teamData(data, team.id);
  const leads = roster.filter((member) => team.leadIds.includes(member.id));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${team.name}, ${roster.length} members, ${active.length} active tasks. View team`}
      onPress={() =>
        router.push({ pathname: "/teams/[id]", params: { id: team.id } })
      }
      style={({ pressed }) => [t.card, pressed && { opacity: 0.7 }]}
    >
      <View style={t.row}>
        <Avatar name={team.name} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[t.label, { fontSize: 18 }]}>{team.name}</Text>
          <Text style={t.small}>
            {roster.length} {roster.length === 1 ? "member" : "members"}
          </Text>
        </View>
        <Text style={t.link}>›</Text>
      </View>
      <Text style={t.small}>
        {leads.length
          ? `Led by ${leads.map((member) => member.name).join(", ")}`
          : "No team lead assigned"}
      </Text>
      <Workload
        active={active.length}
        completed={completed.length}
        urgent={urgent.length}
      />
    </Pressable>
  );
}
function LoadingState() {
  const { loading, error, refresh } = useOperations();
  return loading ? (
    <ActivityIndicator accessibilityLabel="Loading teams" color={c.accent} />
  ) : (
    <View style={t.card}>
      <Notice text={error ?? "Unable to load the team roster."} />
      <Button label="Try again" secondary onPress={() => void refresh()} />
    </View>
  );
}
function backToTeams() {
  if (router.canGoBack()) router.back();
  else router.replace("/teams");
}

export function TeamsScreen() {
  const { data, loading, error, refresh } = useOperations();
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const visible =
    data?.teams.filter(
      (team) =>
        team.name.toLowerCase().includes(search) ||
        data.members.some(
          (member) =>
            member.teamId === team.id &&
            member.name.toLowerCase().includes(search),
        ),
    ) ?? [];
  const unassigned =
    data?.members.filter((member) => member.teamId === null) ?? [];
  return (
    <Page>
      <Heading
        section="TEAMS"
        title="Good people. Great flow."
        subtitle="See who’s behind the work, and where your teams need a hand."
      />
      {!data ? (
        <LoadingState />
      ) : (
        <>
          <View style={[t.card, { backgroundColor: c.raised }]}>
            <Text style={t.eyebrow}>YOUR CREW AT A GLANCE</Text>
            <View style={s.overview}>
              <View style={{ flex: 1 }}>
                <Text style={s.total}>{data.teams.length}</Text>
                <Text style={t.small}>Teams</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.total}>{data.members.length}</Text>
                <Text style={t.small}>Members</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.total, { color: c.green }]}>
                  {
                    data.tasks.filter((task) => task.status !== "completed")
                      .length
                  }
                </Text>
                <Text style={t.small}>Active tasks</Text>
              </View>
            </View>
            <Text style={t.small}>
              Active work includes tasks without a team.
            </Text>
          </View>
          <Field
            label="Find a team or person"
            placeholder="Search teams and members…"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          <View style={t.row}>
            <Text style={[t.label, { flex: 1 }]}>Team directory</Text>
            <Text accessibilityLiveRegion="polite" style={t.small}>
              {visible.length} of {data.teams.length}
            </Text>
          </View>
          <View style={{ gap: 14 }}>
            {visible.map((team) => (
              <TeamCard key={team.id} team={team} data={data} />
            ))}
            {!visible.length && (
              <View style={t.card}>
                <Text style={t.label}>
                  {search ? "No teams found." : "Your crew starts here."}
                </Text>
                <Text style={t.small}>
                  {search
                    ? "Try a different team or member name."
                    : "Teams will appear here when they’re available."}
                </Text>
                {Boolean(search) && (
                  <Button
                    label="Clear search"
                    secondary
                    onPress={() => setQuery("")}
                  />
                )}
              </View>
            )}
          </View>
          {unassigned.length > 0 && (
            <View style={t.card}>
              <Text style={t.label}>Not on a team yet</Text>
              <Text style={t.small}>
                These members can still be assigned to tasks.
              </Text>
              {unassigned
                .filter(
                  (member) =>
                    !search || member.name.toLowerCase().includes(search),
                )
                .map((member) => (
                  <View key={member.id} style={t.row}>
                    <Avatar name={member.name} />
                    <Text style={t.label}>{member.name}</Text>
                  </View>
                ))}
            </View>
          )}
          {error && <Notice text={error} />}
          <Button
            label="Refresh teams"
            secondary
            busy={loading}
            onPress={() => void refresh()}
          />
          <Text style={[t.small, { textAlign: "center" }]}>
            Mock roster · Team membership is read-only in this preview.
          </Text>
        </>
      )}
    </Page>
  );
}

function TeamTask({ task }: { task: Task }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${statusLabels[task.status]}. Open task`}
      onPress={() =>
        router.push({ pathname: "/tasks/[id]", params: { id: task.id } })
      }
      style={({ pressed }) => [t.card, pressed && { opacity: 0.7 }]}
    >
      <View style={t.row}>
        <Text style={[t.eyebrow, { color: priorityColors[task.priority] }]}>
          {task.priority.toUpperCase()}
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={t.small}>{statusLabels[task.status]}</Text>
      </View>
      <Text style={t.label}>{task.title}</Text>
      <View style={t.row}>
        <Text style={[t.small, { flex: 1 }]}>
          {task.location ?? "No location"} · {task.assigneeIds.length}/
          {task.slots} assigned
        </Text>
        <Text style={t.link}>›</Text>
      </View>
    </Pressable>
  );
}

export function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useOperations();
  const [showCompleted, setShowCompleted] = useState(false);
  const team = data?.teams.find((team) => team.id === id);
  if (!data)
    return (
      <Page>
        <Heading
          section="TEAMS"
          title="Team overview"
          subtitle="People and work, together."
          back
          backLabel="All teams"
          onBack={backToTeams}
        />
        <LoadingState />
      </Page>
    );
  if (!team)
    return (
      <Page>
        <Heading
          section="TEAMS"
          title="Team not found"
          subtitle="This team isn’t available in the current demo session."
          back
          backLabel="All teams"
          onBack={backToTeams}
        />
        <Button label="Browse teams" secondary onPress={backToTeams} />
      </Page>
    );
  const { roster, active, completed, urgent } = teamData(data, team.id);
  const leads = roster.filter((member) => team.leadIds.includes(member.id));
  const visibleTasks = showCompleted ? completed : active;
  return (
    <Page>
      <Heading
        section="TEAMS"
        title={team.name}
        subtitle={
          leads.length
            ? `Led by ${leads.map((member) => member.name).join(", ")}`
            : "No team lead assigned"
        }
        back
        backLabel="All teams"
        onBack={backToTeams}
      />
      <View style={t.card}>
        <Text style={t.eyebrow}>TEAM WORKLOAD</Text>
        <Workload
          active={active.length}
          completed={completed.length}
          urgent={urgent.length}
        />
        <Text style={t.small}>
          Tasks directed to this team. Urgent tasks are included in active work.
        </Text>
      </View>
      <View style={{ gap: 14 }}>
        <View style={t.row}>
          <Text style={[t.label, { flex: 1 }]}>The people behind it</Text>
          <Text style={t.small}>{roster.length} members</Text>
        </View>
        <Text style={t.small}>
          Member counts below show active assignments across all teams.
        </Text>
        <View style={t.card}>
          {roster.length ? (
            roster.map((member, index) => {
              const assignments = data.tasks.filter(
                (task) =>
                  task.status !== "completed" &&
                  task.assigneeIds.includes(member.id),
              ).length;
              return (
                <View
                  key={member.id}
                  style={[s.member, index > 0 && s.memberBorder]}
                >
                  <Avatar name={member.name} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={t.label}>{member.name}</Text>
                    <Text style={t.small}>
                      {assignments} active{" "}
                      {assignments === 1 ? "assignment" : "assignments"}
                    </Text>
                  </View>
                  {team.leadIds.includes(member.id) && (
                    <Text style={s.lead}>LEAD</Text>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={t.small}>No members have joined this team yet.</Text>
          )}
        </View>
      </View>
      <View style={{ gap: 14 }}>
        <Text style={t.label}>On the team’s radar</Text>
        <View style={t.wrap}>
          <Chip
            label={`Active (${active.length})`}
            selected={!showCompleted}
            onPress={() => setShowCompleted(false)}
          />
          <Chip
            label={`Completed (${completed.length})`}
            selected={showCompleted}
            onPress={() => setShowCompleted(true)}
          />
        </View>
        {visibleTasks.length ? (
          visibleTasks.map((task) => <TeamTask key={task.id} task={task} />)
        ) : (
          <View style={t.card}>
            <Text style={t.label}>
              {showCompleted ? "No completed tasks yet." : "A clear runway."}
            </Text>
            <Text style={t.small}>
              {showCompleted
                ? "Finished work for this team will appear here."
                : "This team has no active tasks right now."}
            </Text>
          </View>
        )}
      </View>
      <Text style={[t.small, { textAlign: "center" }]}>
        Mock roster · Task changes appear here automatically.
      </Text>
    </Page>
  );
}
const s = StyleSheet.create({
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: c.raised,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.border,
  },
  initials: { color: c.accent, fontSize: 14, fontWeight: "700" },
  workload: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    borderTopWidth: 1,
    borderColor: c.border,
    paddingTop: 16,
  },
  metric: { flex: 1, minWidth: 65, gap: 4 },
  value: { fontSize: 26, fontWeight: "600", letterSpacing: -0.5 },
  overview: { flexDirection: "row", gap: 16 },
  total: {
    color: c.text,
    fontSize: 31,
    fontWeight: "600",
    letterSpacing: -1,
    marginBottom: 5,
  },
  member: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  memberBorder: { borderTopWidth: 1, borderColor: c.border, paddingTop: 17 },
  lead: {
    color: c.green,
    backgroundColor: "#163C36",
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: "700",
    borderRadius: 6,
  },
});
