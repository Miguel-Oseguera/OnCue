import { requestJSON } from "@/lib/api";
import { createApiService } from "./api-service";

export const liveDashboardService = createApiService(requestJSON);
