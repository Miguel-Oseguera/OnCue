import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { dashboardColors as c } from "./dashboard-theme";
import { useOperations } from "./operations-provider";
import type { Priority } from "./service";
import {
  Button,
  Chip,
  Field,
  Heading,
  Notice,
  Page,
  backToTasks,
  priorities,
  t,
} from "./task-ui";

export default function TaskCreateScreen() {
  const {
    data,
    loading,
    error: loadError,
    refresh,
    createTask,
    saving,
  } = useOperations();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [slotsText, setSlotsText] = useState("1");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const slots = Number(slotsText);
  const validSlots =
    /^\d+$/.test(slotsText) &&
    Number.isInteger(slots) &&
    slots >= 1 &&
    slots <= 100;
  async function submit() {
    if (submitting.current || saving || !data) return;
    setError(null);
    if (!title.trim()) {
      setError("Give the task a title before creating it.");
      return;
    }
    if (!validSlots) {
      setError("Enter a whole number between 1 and 100 for assignment slots.");
      return;
    }
    if (assigneeIds.length > slots) {
      setError("Remove an assignee or increase the number of slots.");
      return;
    }
    submitting.current = true;
    try {
      const task = await createTask({
        title,
        description,
        location: location || null,
        priority,
        teamId,
        slots,
        assigneeIds,
      });
      router.replace({ pathname: "/tasks/[id]", params: { id: task.id } });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create the task. Please try again.",
      );
    } finally {
      submitting.current = false;
    }
  }
  if (!data)
    return (
      <Page>
        <Heading
          title="Create a task"
          subtitle="A clear next step for the right people."
          back
        />
        {loading ? (
          <ActivityIndicator
            color={c.accent}
            accessibilityLabel="Loading roster"
          />
        ) : (
          <>
            <Notice
              text={loadError ?? "Load the roster before creating a task."}
            />
            <Button label="Try again" onPress={() => void refresh()} />
          </>
        )}
      </Page>
    );
  return (
    <Page>
      <Heading
        title="Make it happen."
        subtitle="Give your team a clear next step. New tasks start as open."
        back
      />
      <Field
        label="Task title · required"
        value={title}
        onChangeText={setTitle}
        placeholder="What needs to happen?"
        maxLength={200}
        editable={!saving}
        autoCapitalize="sentences"
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Add the context your team needs…"
        maxLength={10000}
        multiline
        editable={!saving}
      />
      <Field
        label="Location"
        value={location}
        onChangeText={setLocation}
        placeholder="Room, stage, or meeting point"
        maxLength={500}
        editable={!saving}
      />
      <View style={{ gap: 10 }}>
        <Text style={t.label}>Priority</Text>
        <View style={t.wrap}>
          {priorities.map((value) => (
            <Chip
              key={value}
              label={value[0].toUpperCase() + value.slice(1)}
              selected={priority === value}
              onPress={() => setPriority(value)}
              disabled={saving}
            />
          ))}
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Text style={t.label}>Team</Text>
        <View style={t.wrap}>
          <Chip
            label="No team"
            selected={teamId === null}
            onPress={() => setTeamId(null)}
            disabled={saving}
          />
          {data.teams.map((team) => (
            <Chip
              key={team.id}
              label={team.name}
              selected={teamId === team.id}
              onPress={() => setTeamId(team.id)}
              disabled={saving}
            />
          ))}
        </View>
        <Text style={t.small}>
          Team is optional. You can assign members from any team.
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Field
          label="Assignment slots"
          value={slotsText}
          onChangeText={setSlotsText}
          keyboardType="number-pad"
          maxLength={3}
          editable={!saving}
        />
        <Text style={t.small}>
          Total capacity, from 1 to 100. Leave members unassigned if you’re
          still coordinating.
        </Text>
      </View>
      <View style={{ gap: 10 }}>
        <Text style={t.label}>Assign members · optional</Text>
        <Text style={t.small}>
          {assigneeIds.length} selected
          {validSlots ? ` · ${slots - assigneeIds.length} slots remaining` : ""}
        </Text>
        <View style={t.card}>
          {data.members.map((member) => {
            const selected = assigneeIds.includes(member.id);
            const disabled =
              saving ||
              (!selected && (!validSlots || assigneeIds.length >= slots));
            return (
              <Pressable
                key={member.id}
                accessibilityRole="checkbox"
                accessibilityLabel={member.name}
                accessibilityState={{ checked: selected, disabled }}
                disabled={disabled}
                onPress={() =>
                  setAssigneeIds((ids) =>
                    selected
                      ? ids.filter((id) => id !== member.id)
                      : [...ids, member.id],
                  )
                }
                style={({ pressed }) => [
                  t.row,
                  {
                    minHeight: 48,
                    opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={t.label}>{member.name}</Text>
                  <Text style={t.small}>
                    {data.teams.find((team) => team.id === member.teamId)
                      ?.name ?? "No team"}
                  </Text>
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
      </View>
      {error && <Notice text={error} />}
      <Button label="Create task" onPress={() => void submit()} busy={saving} />
      <Button
        label="Cancel"
        secondary
        onPress={backToTasks}
        disabled={saving}
      />
      <Text style={[t.small, { textAlign: "center" }]}>
        This task will be saved to your event workspace.
      </Text>
    </Page>
  );
}
