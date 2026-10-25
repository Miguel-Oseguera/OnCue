import { useMemo } from "react";
import { useOperations } from "./operations-provider";

/** Reports share the dashboard snapshot; opening a task makes no extra request. */
export function useReports() {
  const { data, loading, error, refresh } = useOperations();
  const reports = useMemo(
    () =>
      data
        ? [
            ...data.tasks.flatMap((task) => task.aiReports ?? []),
            ...(data.unlinkedAiReports ?? []),
          ]
        : null,
    [data],
  );
  return {
    reports,
    loading,
    error,
    refresh,
    unlinkedAvailable: data?.unlinkedReportsAvailable ?? false,
  };
}
