export type EyeGazeState =
  | "ON_SCREEN"
  | "AWAY_LEFT"
  | "AWAY_RIGHT"
  | "AWAY_UP"
  | "AWAY_DOWN";

export type HeadPoseState =
  | "STABLE"
  | "TURNED_LEFT"
  | "TURNED_RIGHT"
  | "LOOKING_UP"
  | "LOOKING_DOWN"
  | "TILTED";
export type SpeechPattern = "NONE" | "SHORT" | "CONTINUOUS";

export interface FaceMetrics {
  faceDetected: boolean;
  faceCount: number;
  eyeGaze: EyeGazeState;
  headPose: HeadPoseState;
  multipleFaces: boolean;
  yaw: number;
  pitch: number;
  roll: number;
  confidenceScore: number;
  landmarkCount: number;
}

export interface AudioMetrics {
  vadState: "CLEAN" | "NOISE" | "TALKING";
  noiseLevel: number;
  noiseBaseline: number;
  noiseThreshold: number;
  isCalibrated: boolean;
  voiceDetected: boolean;
  speechPattern: SpeechPattern;
  noiseSpike: boolean;
  speechProbability: number;
  webrtcSpeechProbability: number;
  sileroSpeechProbability: number;
  confidenceScore: number;
  speechDurationMs: number;
  noiseDurationMs: number;
}

export interface BehaviorMetrics {
  tabActive: boolean;
  windowFocused: boolean;
  idleTime: number;
}

export type ViolationType =
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "LOOKING_AWAY"
  | "HEAD_DOWN"
  | "TALKING"
  | "NOISE"
  | "TAB_SWITCH"
  | "INACTIVITY";

export interface EngagementSnapshot {
  hp: number;
  focusScore: number;
  cognitiveLoad: number;
  confidenceScore: number;
  state: "FOCUSED" | "WARNING" | "CRITICAL" | "FOCUSED_BUT_STRUGGLING";
  violations: ViolationType[];
}

export interface SessionOutput {
  avgHP: number;
  focusScore: number;
  quizScore: number;
  anomalies: ViolationType[];
  insights: string[];
}
