import { ActivityIndicator, Text, View } from "react-native";
import { dashboardColors as c } from "./dashboard-theme";
import { useOperations } from "./operations-provider";
import { useReports } from "./use-reports";
import { ReportAccordion } from "./task-ai-reports";
import { Button, Heading, Notice, Page, backToTasks, t } from "./task-ui";

/** Reports with no task, including links to tasks missing from this session,
 * remain accessible without a dedicated reports tab.
 */
export default function UnlinkedReportsScreen() {
  const { reports, loading, error, refresh } = useReports();
  const {
    data,
    loading: tasksLoading,
    error: tasksError,
    refresh: refreshTasks,
  } = useOperations();
  const unlinked =
    reports?.filter(
      (report) =>
        !report.taskId ||
        (data !== null &&
          !data.tasks.some((task) => task.id === report.taskId)),
    ) ?? [];
  return (
    <Page>
      <Heading
        section="TASKS / AI REPORTS"
        title="Unlinked AI reports"
        subtitle="Reports without an available task stay here. Linked reports appear inside their task."
        back
        backLabel="All tasks"
        onBack={backToTasks}
      />
      {loading && !reports && (
        <ActivityIndicator
          color={c.accent}
          accessibilityLabel="Loading unlinked AI reports"
        />
      )}
      {error && (
        <View style={{ gap: 12 }}>
          <Notice text={error} />
          <Button label="Try again" secondary onPress={() => void refresh()} />
        </View>
      )}
      {tasksError && (
        <View style={{ gap: 12 }}>
          <Notice text="Task links could not be checked. Only reports with no task are shown." />
          <Button
            label="Reload tasks"
            secondary
            busy={tasksLoading}
            onPress={() => void refreshTasks()}
          />
        </View>
      )}
      {reports && (
        <>
          <Text accessibilityLiveRegion="polite" style={t.small}>
            {unlinked.length} {unlinked.length === 1 ? "report" : "reports"}
            {!data ? " · Checking task links…" : ""}
          </Text>
          {unlinked.map((report) => (
            <View key={report.reportId} style={{ gap: 8 }}>
              <Text style={t.small}>
                {report.taskId
                  ? "Linked task is unavailable in this session"
                  : "No linked task"}
              </Text>
              <ReportAccordion report={report} />
            </View>
          ))}
          {!unlinked.length && data && (
            <View style={t.card}>
              <Text style={t.label}>All reports have a home.</Text>
              <Text style={t.small}>
                No unlinked AI reports to review. Open a task to see its
                reports.
              </Text>
            </View>
          )}
          <Button
            label="Refresh reports"
            secondary
            busy={loading}
            onPress={() => void refresh()}
          />
        </>
      )}
      <Text style={[t.small, { textAlign: "center" }]}>
        Mock records · Reports are read-only.
      </Text>
    </Page>
  );
}
