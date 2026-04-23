import { apiRequest } from "./http";

export type FrontendAnomalyType =
  | "VOICE_DETECTION"
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "BLUR_DETECTION"
  | "FOCUS"
  | "HAND_GESTURE_DETECTION"
  | "FACE_RECOGNITION";

export interface RecordAnomalyBody {
  type: FrontendAnomalyType;
  courseId: string;
  versionId: string;
  itemId: string;
  cohortId?: string;
}

export function recordAnomaly(body: RecordAnomalyBody) {
  return apiRequest("/anomalies/record", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
