import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { dashboardColors as c } from "./dashboard-theme";
import { useOperations } from "./operations-provider";
import type { UpdateTaskInput } from "./service";
import {
  Button,
  Chip,
  Heading,
  Notice,
  Page,
  backToTasks,
  priorityColors,
  statusLabels,
  statuses,
  t,
} from "./task-ui";

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    data,
    loading,
    error: loadError,
    refresh,
    updateTask,
    saving,
  } = useOperations();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const task = data?.tasks.find((task) => task.id === id);
  async function update(input: UpdateTaskInput) {
    if (!task) return;
    setError(null);
    setSaved(null);
    try {
      await updateTask(task.id, input);
      setSaved("Changes saved to this demo session.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save. Please try again.",
      );
    }
  }
  if (!data && loading)
    return (
      <Page>
        <ActivityIndicator color={c.accent} accessibilityLabel="Loading task" />
      </Page>
    );
  if (!task)
    return (
      <Page>
        <Heading
          title={loadError ? "Unable to load task" : "Task not found"}
          subtitle={
            loadError ??
            "This task may have been part of an earlier demo session."
          }
          back
        />
        {loadError && (
          <Button label="Try again" onPress={() => void refresh()} />
        )}
        <Button label="Browse tasks" secondary onPress={backToTasks} />
      </Page>
    );
  const team = data?.teams.find((team) => team.id === task.teamId);
  return (
    <Page>
      <Heading
        title={task.title}
        subtitle={`${task.location ?? "No location"} · ${team?.name ?? "No team assigned"}`}
        back
      />
      <View style={t.card}>
        <View style={t.row}>
          <Text style={[t.eyebrow, { color: priorityColors[task.priority] }]}>
            {task.priority.toUpperCase()} PRIORITY
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={t.small}>{statusLabels[task.status]}</Text>
        </View>
        <Text style={t.body}>
          {task.description || "No description provided."}
        </Text>
        <Text style={t.small}>
          Created {new Date(task.createdAt).toLocaleString()}
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        <Text style={t.label}>Move the work forward</Text>
        <Text style={t.small}>Select a status. Changes save immediately.</Text>
        <View style={t.wrap}>
          {statuses.map((status) => (
            <Chip
              key={status}
              label={statusLabels[status]}
              selected={task.status === status}
              disabled={saving}
              onPress={() => void update({ status })}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: 12 }}>
        <View style={t.row}>
          <Text style={[t.label, { flex: 1 }]}>Who’s on it?</Text>
          <Text style={t.small}>
            {task.assigneeIds.length} / {task.slots} slots
          </Text>
        </View>
        <Text style={t.small}>
          Tap a member to assign or remove them. Members from any team can help.
        </Text>
        <View style={t.card}>
          {data?.members.map((member) => {
            const selected = task.assigneeIds.includes(member.id);
            const disabled =
              saving || (!selected && task.assigneeIds.length >= task.slots);
            const memberTeam = data.teams.find(
              (team) => team.id === member.teamId,
            );
            return (
              <Pressable
                key={member.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`Assign ${member.name}`}
                accessibilityState={{ checked: selected, disabled }}
                disabled={disabled}
                onPress={() =>
                  void update({
                    assigneeIds: selected
                      ? task.assigneeIds.filter((id) => id !== member.id)
                      : [...task.assigneeIds, member.id],
                  })
                }
                style={({ pressed }) => [
                  t.row,
                  {
                    minHeight: 52,
                    opacity: disabled && !saving ? 0.45 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View
                  style={{
                    height: 34,
                    width: 34,
                    borderRadius: 11,
                    backgroundColor: c.raised,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={t.link}>
                    {member.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={t.label}>{member.name}</Text>
                  <Text style={t.small}>{memberTeam?.name ?? "No team"}</Text>
                </View>
                <Text
                  style={{ color: selected ? c.green : c.muted, fontSize: 20 }}
                >
                  {selected ? "✓" : "+"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {task.assigneeIds.length >= task.slots && (
          <Text style={t.small}>
            All slots are filled. Remove an assignee to make room for another.
          </Text>
        )}
      </View>
      {saving && (
        <ActivityIndicator color={c.accent} accessibilityLabel="Saving task" />
      )}
      {error && <Notice text={error} />}
      {saved && (
        <Text
          accessibilityLiveRegion="polite"
          style={[t.small, { color: c.green }]}
        >
          {saved}
        </Text>
      )}
      <Text style={t.small}>
        This is a mock task. No updates are sent to the backend.
      </Text>
    </Page>
  );
}
