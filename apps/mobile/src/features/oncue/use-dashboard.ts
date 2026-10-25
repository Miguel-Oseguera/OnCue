import { useCallback, useEffect, useRef, useState } from "react";
import { Dashboard, DashboardService, mockDashboardService } from "./service";

/** One data boundary for the dashboard; components never import fixture data. */
export function useDashboard(service: DashboardService = mockDashboardService) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const result = await service.getDashboard();
      if (request.current === current) setData(result);
    } catch {
      if (request.current === current)
        setError("We couldn’t load your dashboard. Please try again.");
    } finally {
      if (request.current === current) setLoading(false);
    }
  }, [service]);
  useEffect(() => {
    let cancelled = false;
    const current = ++request.current;
    service
      .getDashboard()
      .then((result) => {
        if (!cancelled && current === request.current) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled && current === request.current)
          setError("We couldn’t load your dashboard. Please try again.");
      })
      .finally(() => {
        if (!cancelled && current === request.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [service]);
  return { data, loading, error, refresh };
}
