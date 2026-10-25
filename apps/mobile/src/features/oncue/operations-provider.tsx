import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  mergeSavedTask,
  type CreateTaskInput,
  type Dashboard,
  type DashboardService,
  type Task,
  type UpdateTaskInput,
} from "./service";

import { liveDashboardService } from "./live-service";

type Operations = {
  data: Dashboard | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  refresh: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, input: UpdateTaskInput) => Promise<Task>;
};
const Context = createContext<Operations | null>(null);

/** One authenticated dashboard snapshot shared across all signed-in screens. */
export function OperationsProvider({
  children,
  service: injectedService,
}: PropsWithChildren<{ service?: DashboardService }>) {
  const service = injectedService ?? liveDashboardService;
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const writing = useRef(false);
  const version = useRef(0);

  const refresh = useCallback(async () => {
    if (writing.current) return;
    const current = ++version.current;
    setLoading(true);
    setError(null);
    try {
      const result = await service.getDashboard();
      if (version.current === current) setData(result);
    } catch (cause) {
      if (version.current === current)
        setError(
          cause instanceof Error
            ? cause.message
            : "We couldn’t load your tasks. Please try again.",
        );
    } finally {
      if (version.current === current) setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    let cancelled = false;
    const current = ++version.current;
    service
      .getDashboard()
      .then((result) => {
        if (!cancelled && current === version.current) {
          setData(result);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled && current === version.current)
          setError(
            cause instanceof Error
              ? cause.message
              : "We couldn’t load your tasks. Please try again.",
          );
      })
      .finally(() => {
        if (!cancelled && current === version.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [service]);

  const save = useCallback(async (action: () => Promise<Task>) => {
    if (writing.current)
      throw new Error("Another change is being saved. Please try again.");
    writing.current = true;
    version.current++;
    setSaving(true);
    setLoading(false);
    try {
      const task = await action();
      setData((previous) =>
        previous ? mergeSavedTask(previous, task) : previous,
      );
      setError(null);
      return task;
    } finally {
      writing.current = false;
      setSaving(false);
    }
  }, []);
  const createTask = useCallback(
    (input: CreateTaskInput) => save(() => service.createTask(input)),
    [save, service],
  );
  const updateTask = useCallback(
    (id: string, input: UpdateTaskInput) =>
      save(() => service.updateTask(id, input)),
    [save, service],
  );

  return (
    <Context.Provider
      value={{ data, loading, error, saving, refresh, createTask, updateTask }}
    >
      {children}
    </Context.Provider>
  );
}
export function useOperations() {
  const context = useContext(Context);
  if (!context)
    throw new Error("OnCue screens must be inside OperationsProvider.");
  return context;
}
