import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { dashboardColors as c } from "./dashboard-theme";
import { parseDecision, type AIReport } from "./report-service";
import { useReports } from "./use-reports";
import { Button, Notice, t } from "./task-ui";

function DecisionText({ value }: { value: string | null }) {
  const decision = parseDecision(value);
  if (!decision)
    return (
      <Text selectable style={t.body}>
        {value ?? "No decision recorded."}
      </Text>
    );
  return (
    <View style={{ gap: 12 }}>
      {decision.issueSummary && (
        <Text selectable style={t.body}>
          {decision.issueSummary}
        </Text>
      )}
      {(decision.category || decision.urgency) && (
        <Text style={t.small}>
          {[
            decision.category && `Category: ${decision.category}`,
            decision.urgency && `Urgency: ${decision.urgency}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      )}
      {decision.requiresHumanAttention && (
        <Text style={[t.label, { color: c.amber }]}>
          Human attention requested
        </Text>
      )}
      {Boolean(decision.recommendedActions?.length) && (
        <View style={{ gap: 7 }}>
          <Text style={t.label}>Recommended actions</Text>
          {decision.recommendedActions?.map((action, index) => (
            <Text selectable key={index} style={t.body}>
              • {action}
            </Text>
          ))}
        </View>
      )}
      {Boolean(decision.missingInformation?.length) && (
        <View style={{ gap: 7 }}>
          <Text style={t.label}>Missing information</Text>
          {decision.missingInformation?.map((item, index) => (
            <Text selectable key={index} style={t.body}>
              • {item}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/** Read-only presentation shared by task reports and the unlinked-report inbox. */
export function AIReportContent({ report }: { report: AIReport }) {
  const transcripts = report.relatedEvidence.filter((item) =>
    item.transcript?.trim(),
  );
  return (
    <View style={{ gap: 16 }}>
      <View style={t.row}>
        <Text style={[t.eyebrow, { flex: 1 }]}>REPORT TEXT</Text>
        <Text style={s.unverified}>UNVERIFIED</Text>
      </View>
      <Text selectable style={t.body}>
        {report.report}
      </Text>
      <View style={{ gap: 6 }}>
        <Text style={t.eyebrow}>AI DECISION</Text>
        <DecisionText value={report.decision} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={t.eyebrow}>AI ACTION</Text>
        <Text selectable style={t.body}>
          {report.action ?? "No action recorded."}
        </Text>
      </View>
      <View style={s.evidence}>
        <Text style={t.eyebrow}>COMPARE WITH THE EVIDENCE</Text>
        {transcripts.length ? (
          <>
            <Text style={t.small}>
              Related task transcripts may not be the exact input used for this
              report.
            </Text>
            {transcripts.map((evidence, index) => (
              <View key={evidence.mediaId} style={{ gap: 7 }}>
                <Text style={t.label}>
                  Task transcript{transcripts.length > 1 ? ` ${index + 1}` : ""}
                </Text>
                <Text selectable style={t.body}>
                  {evidence.transcript}
                </Text>
              </View>
            ))}
            <Text style={t.small}>
              Original recordings are not included in this response.
            </Text>
          </>
        ) : (
          <>
            <Text style={[t.label, { color: c.amber }]}>
              No source evidence available
            </Text>
            <Text style={t.small}>
              This report cannot be checked against an original observation
              here.
            </Text>
          </>
        )}
      </View>
      <Text selectable style={t.small}>
        Report ID: {report.reportId}
      </Text>
    </View>
  );
}

export function ReportAccordion({ report }: { report: AIReport }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={t.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? "Hide" : "Read"} AI report: ${report.report}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [
          { minHeight: 44, gap: 10 },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={t.row}>
          <Text style={[t.eyebrow, { flex: 1 }]}>AI REPORT</Text>
          <Text style={s.unverified}>UNVERIFIED</Text>
          <Text style={t.link}>{expanded ? "−" : "+"}</Text>
        </View>
        {!expanded && (
          <Text numberOfLines={2} style={t.label}>
            {report.report}
          </Text>
        )}
      </Pressable>
      {expanded && <AIReportContent report={report} />}
    </View>
  );
}

export function TaskAIReports({ taskId }: { taskId: string }) {
  const { reports, loading, error, refresh } = useReports();
  const [expanded, setExpanded] = useState(false);
  const linked = reports?.filter((report) => report.taskId === taskId) ?? [];
  return (
    <View style={t.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? "Hide" : "Show"} AI reports${reports ? `, ${linked.length} linked to this task` : ""}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [
          { minHeight: 48, gap: 7 },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={t.row}>
          <Text style={[t.label, { flex: 1 }]}>
            AI reports{reports ? ` (${linked.length})` : ""}
          </Text>
          {loading && !reports ? (
            <ActivityIndicator
              color={c.accent}
              accessibilityLabel="Loading task AI reports"
            />
          ) : (
            <Text style={t.link}>{expanded ? "−" : "+"}</Text>
          )}
        </View>
        <Text style={t.small}>
          Check the AI’s claims, decisions, and actions against the available
          evidence.
        </Text>
      </Pressable>
      {expanded && (
        <View style={{ gap: 18 }}>
          {error && (
            <View style={{ gap: 12 }}>
              <Notice text={error} />
              <Button
                label="Reload reports"
                secondary
                busy={loading}
                onPress={() => void refresh()}
              />
            </View>
          )}
          {reports && (
            <>
              {!linked.length && (
                <Text style={t.small}>
                  No AI reports are linked to this task.
                </Text>
              )}
              {linked.map((report, index) => (
                <View
                  key={report.reportId}
                  style={[{ gap: 14 }, index > 0 && s.nextReport]}
                >
                  {linked.length > 1 && (
                    <Text style={t.label}>
                      Report {index + 1} of {linked.length}
                    </Text>
                  )}
                  <AIReportContent report={report} />
                </View>
              ))}
              <Text style={t.small}>
                Reading reports does not change this task.
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  unverified: {
    color: c.amber,
    backgroundColor: "#382E1F",
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
    fontSize: 9,
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  evidence: {
    gap: 12,
    backgroundColor: c.raised,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: c.accent,
  },
  nextReport: { borderTopWidth: 1, borderColor: c.border, paddingTop: 20 },
});
