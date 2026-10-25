import { ActivityIndicator, Text, View } from "react-native";
import { dashboardColors as c } from "./dashboard-theme";
import { useReports } from "./use-reports";
import { ReportAccordion } from "./task-ai-reports";
import { Button, Heading, Notice, Page, backToTasks, t } from "./task-ui";

export default function UnlinkedReportsScreen() {
  const { reports, loading, error, refresh, unlinkedAvailable } = useReports();
  const unlinked = reports?.filter((report) => !report.taskId) ?? [];
  return (
    <Page>
      <Heading
        section="TASKS / AI REPORTS"
        title="Unlinked AI reports"
        subtitle="Linked reports appear inside their task. Reports without a task appear here when supplied by the backend."
        back
        backLabel="All tasks"
        onBack={backToTasks}
      />
      {loading && !reports && (
        <ActivityIndicator
          color={c.accent}
          accessibilityLabel="Loading AI reports"
        />
      )}
      {error && (
        <View style={{ gap: 12 }}>
          <Notice text={error} />
          <Button
            label="Try again"
            secondary
            busy={loading}
            onPress={() => void refresh()}
          />
        </View>
      )}
      {reports && (
        <>
          {!unlinkedAvailable ? (
            <View style={t.card}>
              <Text style={t.label}>
                Unlinked reports aren’t available yet.
              </Text>
              <Text style={t.small}>
                The dashboard currently returns reports linked to tasks. Open a
                task to review those reports.
              </Text>
            </View>
          ) : (
            <>
              <Text accessibilityLiveRegion="polite" style={t.small}>
                {unlinked.length} {unlinked.length === 1 ? "report" : "reports"}
              </Text>
              {unlinked.map((report) => (
                <ReportAccordion key={report.reportId} report={report} />
              ))}
              {!unlinked.length && (
                <View style={t.card}>
                  <Text style={t.label}>No unlinked reports.</Text>
                  <Text style={t.small}>
                    Open a task to review its linked AI reports.
                  </Text>
                </View>
              )}
            </>
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
        Reports are read-only.
      </Text>
    </Page>
  );
}
