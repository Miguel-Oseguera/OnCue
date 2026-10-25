import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { dashboardColors as c } from "./dashboard-theme";
import { useOperations } from "./operations-provider";
import type { Task, TaskStatus } from "./service";
import {
  Button,
  Chip,
  Field,
  Heading,
  Notice,
  priorityColors,
  statusLabels,
  statuses,
  t,
} from "./task-ui";

type Filter = "all" | TaskStatus;
export default function TasksScreen() {
  const { data, loading, error, refresh } = useOperations();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Filter>("all");
  const [teamId, setTeamId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (data?.tasks ?? []).filter((task) => {
      const team =
        data?.teams.find((team) => team.id === task.teamId)?.name ?? "";
      return (
        (status === "all" || task.status === status) &&
        (!teamId || task.teamId === teamId) &&
        (!search ||
          [task.title, task.description, task.location, team].some((value) =>
            value?.toLowerCase().includes(search),
          ))
      );
    });
  }, [data, query, status, teamId]);
  function renderTask({ item: task }: { item: Task }) {
    const team = data?.teams.find((team) => team.id === task.teamId);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${task.title}, ${task.priority} priority, ${statusLabels[task.status]}. Open task details`}
        onPress={() =>
          router.push({ pathname: "/tasks/[id]", params: { id: task.id } })
        }
        style={({ pressed }) => [
          t.card,
          { marginBottom: 12 },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={t.row}>
          <Text style={[t.eyebrow, { color: priorityColors[task.priority] }]}>
            {task.priority.toUpperCase()}
          </Text>
          <View style={{ flex: 1 }} />
          <Text
            style={[t.small, task.status === "completed" && { color: c.green }]}
          >
            {statusLabels[task.status]}
          </Text>
        </View>
        <Text style={[t.label, { fontSize: 17 }]}>{task.title}</Text>
        <Text style={t.small}>
          {task.location ?? "No location"} · {team?.name ?? "No team"}
        </Text>
        <View style={t.row}>
          <Text style={[t.small, { flex: 1 }]}>
            {task.assigneeIds.length
              ? task.assigneeIds
                  .map(
                    (id) =>
                      data?.members.find((member) => member.id === id)?.name ??
                      "Unknown member",
                  )
                  .join(", ")
              : "Unassigned"}
          </Text>
          <Text style={t.link}>›</Text>
        </View>
      </Pressable>
    );
  }
  return (
    <SafeAreaView style={t.screen} edges={["top", "left", "right"]}>
      <StatusBar style="light" />
      <FlatList
        data={filtered}
        keyExtractor={(task) => task.id}
        renderItem={renderTask}
        contentContainerStyle={[t.content, { gap: 0 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading && Boolean(data)}
            onRefresh={() => void refresh()}
            tintColor={c.accent}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 20, paddingBottom: 20 }}>
            <Heading
              title="Every detail, covered."
              subtitle="Find the work. Get it moving. Keep everyone in sync."
            />
            <Button
              label="+ Create task"
              onPress={() => router.push("/tasks/new")}
              disabled={!data}
            />
            <Field
              label="Search tasks"
              placeholder="Title, location, or team…"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <Chip
                label={`All (${data?.tasks.length ?? 0})`}
                selected={status === "all"}
                onPress={() => setStatus("all")}
              />
              {statuses.map((value) => (
                <Chip
                  key={value}
                  label={statusLabels[value]}
                  selected={status === value}
                  onPress={() => setStatus(value)}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <Chip
                label="All teams"
                selected={!teamId}
                onPress={() => setTeamId(null)}
              />
              {data?.teams.map((team) => (
                <Chip
                  key={team.id}
                  label={team.name}
                  selected={teamId === team.id}
                  onPress={() => setTeamId(team.id)}
                />
              ))}
            </ScrollView>
            {error && (
              <View style={{ gap: 12 }}>
                <Notice text={error} />
                <Button
                  label="Try again"
                  secondary
                  onPress={() => void refresh()}
                />
              </View>
            )}
            {data && (
              <Text accessibilityLiveRegion="polite" style={t.small}>
                {filtered.length} {filtered.length === 1 ? "task" : "tasks"} ·
                Newest first
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          loading && !data ? (
            <ActivityIndicator
              accessibilityLabel="Loading tasks"
              color={c.accent}
            />
          ) : !error ? (
            <View style={t.card}>
              <Text style={t.label}>A little breathing room.</Text>
              <Text style={t.small}>
                {query || status !== "all" || teamId
                  ? "No tasks match these filters."
                  : "No tasks yet. Create one to get started."}
              </Text>
              {(query || status !== "all" || teamId) && (
                <Button
                  label="Clear filters"
                  secondary
                  onPress={() => {
                    setQuery("");
                    setStatus("all");
                    setTeamId(null);
                  }}
                />
              )}
            </View>
          ) : undefined
        }
        ListFooterComponent={
          <Text style={[t.small, { textAlign: "center", marginTop: 12 }]}>
            Demo changes stay in this app session. Reload to reset.
          </Text>
        }
      />
    </SafeAreaView>
  );
}
