import { useCallback, useEffect, useRef, useState } from "react";
import {
  mockReportService,
  type AIReport,
  type ReportService,
} from "./report-service";

export function useReports(service: ReportService = mockReportService) {
  const [reports, setReports] = useState<AIReport[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const result = await service.listReports();
      if (current === request.current) setReports(result);
    } catch {
      if (current === request.current)
        setError("Unable to load AI reports. Please try again.");
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [service]);
  useEffect(() => {
    let cancelled = false;
    const current = ++request.current;
    service
      .listReports()
      .then((result) => {
        if (!cancelled && current === request.current) {
          setReports(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled && current === request.current)
          setError("Unable to load AI reports. Please try again.");
      })
      .finally(() => {
        if (!cancelled && current === request.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [service]);
  return { reports, loading, error, refresh };
}
