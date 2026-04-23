const violationCounters = {
  NO_FACE: 0,
  MULTIPLE_FACES: 0,
  LOOKING_AWAY: 0,
  HEAD_DOWN: 0,
  TALKING: 0,
  NOISE: 0,
  TAB_SWITCH: 0,
  INACTIVITY: 0,
};

const recentViolationHits = {
  NO_FACE: [],
  MULTIPLE_FACES: [],
  LOOKING_AWAY: [],
  HEAD_DOWN: [],
  TALKING: [],
  NOISE: [],
  TAB_SWITCH: [],
  INACTIVITY: [],
};

let previousFocusScore = 1;
const TEMPORAL_WINDOW_FRAMES = 30;
const TEMPORAL_TRIGGER_FRAMES = 15;
const FACE_BUFFER_SIZE = 30;
const TAB_BUFFER_SIZE = 10;
const MIN_FACE_DETECTED_FRAMES = 21;
const MIN_TAB_HIDDEN_FRAMES = 8;
const SEGBOT_SEQUENCE_LENGTH = 50;
const SEGBOT_FEATURE_DIM = 128;
const SEGBOT_MODEL_PATHS = ["/models/segbot.onnx", "/segbot.onnx"];

const temporalBuffers = {
  NO_FACE: [],
  MULTIPLE_FACES: [],
  TAB_SWITCH: [],
  LOOKING_AWAY: [],
  HEAD_DOWN: [],
  TALKING: [],
  NOISE: [],
};
const faceBuffer = [];
const tabSwitchBuffer = [];

const segbotSequence = [];
let ort = null;
let segbotSession = null;
let segbotInitializing = false;
let segbotDisabled = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function withinWindow(key, now) {
  recentViolationHits[key] = recentViolationHits[key].filter((ts) => now - ts <= 30000);
  return recentViolationHits[key].length;
}

function recordViolation(key, now) {
  recentViolationHits[key].push(now);
  return withinWindow(key, now);
}

function stabilizeViolation(key, condition, minFrames, confidence, now) {
  if (!condition || confidence < 0.7) {
    violationCounters[key] = Math.max(0, violationCounters[key] - 2);
    return false;
  }

  violationCounters[key] = Math.min(240, violationCounters[key] + 1);

  if (violationCounters[key] >= minFrames) {
    recordViolation(key, now);
    return true;
  }

  return false;
}

function temporalStable(key, isBad, confidence) {
  if (!temporalBuffers[key]) return false;

  const frame = isBad && confidence >= 0.65 ? 1 : 0;
  temporalBuffers[key].push(frame);
  if (temporalBuffers[key].length > TEMPORAL_WINDOW_FRAMES) {
    temporalBuffers[key].shift();
  }

  const badFrames = temporalBuffers[key].reduce((sum, value) => sum + value, 0);
  return badFrames >= TEMPORAL_TRIGGER_FRAMES;
}

function pushBoolean(buffer, value, maxSize) {
  buffer.push(Boolean(value));
  if (buffer.length > maxSize) {
    buffer.shift();
  }
}

function countTrue(buffer) {
  return buffer.reduce((sum, value) => sum + (value ? 1 : 0), 0);
}

function hardFocusOverride(faceMetrics, audioMetrics, behaviorMetrics) {
  if (!faceMetrics.faceDetected || faceMetrics.multipleFaces) {
    return 0;
  }

  let focus = 1;
  const gazeOff = faceMetrics.eyeGaze !== "ON_SCREEN";
  const headDown = faceMetrics.headPose === "LOOKING_DOWN";
  const headTurned =
    faceMetrics.headPose === "TURNED_LEFT" ||
    faceMetrics.headPose === "TURNED_RIGHT" ||
    faceMetrics.headPose === "TILTED";
  const speaking = audioMetrics.vadState === "TALKING" && audioMetrics.confidenceScore > 0.7;
  const noisy = audioMetrics.vadState === "NOISE" && audioMetrics.noiseDurationMs >= 2000;
  const tabAway = !behaviorMetrics.tabActive || !behaviorMetrics.windowFocused;
  const idleTooLong = behaviorMetrics.idleTime > 5000;

  focus -= gazeOff ? 0.28 : 0;
  focus -= headDown ? 0.35 : 0;
  focus -= headTurned ? 0.18 : 0;
  focus -= speaking ? 0.25 : 0;
  focus -= noisy ? 0.12 : 0;
  focus -= tabAway ? 0.35 : 0;
  focus -= idleTooLong ? 0.15 : 0;

  if (gazeOff || headDown || speaking || tabAway) {
    focus = Math.min(focus, 0.2);
  }

  return clamp(focus * faceMetrics.confidenceScore * audioMetrics.confidenceScore, 0, 1);
}

function weightFocusScore(faceMetrics, audioMetrics, behaviorMetrics) {
  const faceScore = faceMetrics.faceDetected ? 1 : 0;
  const gazeScore = faceMetrics.eyeGaze === "ON_SCREEN" ? 1 : 0;
  const speechScore = audioMetrics.vadState === "TALKING" ? 0 : 1;
  const noiseCleanliness = audioMetrics.vadState === "NOISE" ? 0 : 1;
  const tabScore = behaviorMetrics.tabActive && behaviorMetrics.windowFocused ? 1 : 0;
  const activityPenalty = behaviorMetrics.idleTime > 5000 ? 0.5 : 1;

  const raw =
    faceScore * 0.35 +
    gazeScore * 0.2 +
    noiseCleanliness * 0.15 +
    speechScore * 0.1 +
    tabScore * 0.2;

  return clamp(raw * activityPenalty, 0, 1);
}

async function loadSegbotSession() {
  if (segbotSession || segbotInitializing || segbotDisabled) {
    return segbotSession;
  }

  segbotInitializing = true;

  try {
    const ortModule = await import("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js");
    ort = ortModule?.default || ortModule || null;
    if (!ort?.InferenceSession || !ort?.Tensor) {
      throw new Error("ONNX Runtime Web unavailable");
    }

    ort.env.wasm = ort.env.wasm || {};
    ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";

    for (const path of SEGBOT_MODEL_PATHS) {
      try {
        segbotSession = await ort.InferenceSession.create(path, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
        break;
      } catch {
        // Try next known model location.
      }
    }

    if (!segbotSession) {
      throw new Error("SEGBOT model file not found");
    }

    self.postMessage({ type: "MODEL_READY", model: "SEGBOT" });
    return segbotSession;
  } catch (error) {
    segbotDisabled = true;
    self.postMessage({
      type: "MODEL_WARNING",
      model: "SEGBOT",
      error: error instanceof Error ? error.message : "SEGBOT ONNX unavailable",
    });
    return null;
  } finally {
    segbotInitializing = false;
  }
}

function buildSegbotFeatureVector(faceMetrics, audioMetrics, behaviorMetrics) {
  const core = [
    faceMetrics.faceDetected ? 1 : 0,
    faceMetrics.multipleFaces ? 1 : 0,
    faceMetrics.faceCount > 1 ? 1 : 0,
    faceMetrics.eyeGaze === "ON_SCREEN" ? 1 : 0,
    faceMetrics.headPose === "STABLE" ? 1 : 0,
    clamp(Math.abs(faceMetrics.yaw) / 45, 0, 1),
    clamp(Math.abs(faceMetrics.pitch) / 35, 0, 1),
    clamp(Math.abs(faceMetrics.roll) / 35, 0, 1),
    clamp(faceMetrics.confidenceScore || 0, 0, 1),
    clamp((faceMetrics.landmarkCount || 0) / 478, 0, 1),
    audioMetrics.vadState === "TALKING" ? 1 : 0,
    audioMetrics.vadState === "NOISE" ? 1 : 0,
    clamp(audioMetrics.noiseLevel || 0, 0, 1),
    clamp(audioMetrics.speechProbability || 0, 0, 1),
    clamp(audioMetrics.confidenceScore || 0, 0, 1),
    behaviorMetrics.tabActive ? 1 : 0,
    behaviorMetrics.windowFocused ? 1 : 0,
    clamp((behaviorMetrics.idleTime || 0) / 5000, 0, 1),
  ];

  const vector = new Float32Array(SEGBOT_FEATURE_DIM);
  for (let i = 0; i < SEGBOT_FEATURE_DIM; i += 1) {
    vector[i] = clamp(core[i % core.length] || 0, 0, 1);
  }

  return vector;
}

function appendSegbotFrame(faceMetrics, audioMetrics, behaviorMetrics) {
  segbotSequence.push(buildSegbotFeatureVector(faceMetrics, audioMetrics, behaviorMetrics));
  if (segbotSequence.length > SEGBOT_SEQUENCE_LENGTH) {
    segbotSequence.shift();
  }
}

function buildSegbotTensor() {
  if (!ort?.Tensor) {
    return null;
  }

  const sequence = segbotSequence.slice(-SEGBOT_SEQUENCE_LENGTH);
  while (sequence.length < SEGBOT_SEQUENCE_LENGTH) {
    sequence.unshift(new Float32Array(SEGBOT_FEATURE_DIM));
  }

  const flat = new Float32Array(SEGBOT_SEQUENCE_LENGTH * SEGBOT_FEATURE_DIM);
  for (let t = 0; t < SEGBOT_SEQUENCE_LENGTH; t += 1) {
    flat.set(sequence[t], t * SEGBOT_FEATURE_DIM);
  }

  return new ort.Tensor("float32", flat, [1, SEGBOT_SEQUENCE_LENGTH, SEGBOT_FEATURE_DIM]);
}

function parseSegbotConfidence(output) {
  const values = output?.data || output;
  if (!values || typeof values.length !== "number" || values.length === 0) {
    return null;
  }

  let maxScore = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = Number(values[i]) || 0;
    if (value > maxScore) {
      maxScore = value;
    }
  }

  return clamp(maxScore, 0, 1);
}

async function inferSegbotConfidence(faceMetrics, audioMetrics, behaviorMetrics) {
  appendSegbotFrame(faceMetrics, audioMetrics, behaviorMetrics);
  const session = await loadSegbotSession();
  if (!session) {
    return null;
  }

  try {
    const inputTensor = buildSegbotTensor();
    if (!inputTensor) {
      return null;
    }

    const feeds = {
      input_x: inputTensor,
      start_units: new ort.Tensor("int64", BigInt64Array.from([BigInt(0)]), []),
    };

    const outputMap = await session.run(feeds);
    const primaryOutput = outputMap?.attention_weights || Object.values(outputMap || {})[0];
    return parseSegbotConfidence(primaryOutput);
  } catch {
    return null;
  }
}

async function processEvent(event) {
  const { faceMetrics, audioMetrics, behaviorMetrics } = event.data || {};
  if (!faceMetrics || !audioMetrics || !behaviorMetrics) {
    return;
  }

  const now = Date.now();
  const violations = [];

  const faceConfidence = faceMetrics.faceDetected ? faceMetrics.confidenceScore : 1;
  pushBoolean(faceBuffer, faceMetrics.faceDetected && faceConfidence >= 0.35, FACE_BUFFER_SIZE);

  const stableFaceDetected = faceBuffer.length === FACE_BUFFER_SIZE
    ? countTrue(faceBuffer) >= MIN_FACE_DETECTED_FRAMES
    : faceMetrics.faceDetected;

  const tabHidden = !behaviorMetrics.tabActive || !behaviorMetrics.windowFocused;
  pushBoolean(tabSwitchBuffer, tabHidden, TAB_BUFFER_SIZE);
  const tabActuallySwitched = tabSwitchBuffer.length === TAB_BUFFER_SIZE
    ? countTrue(tabSwitchBuffer) >= MIN_TAB_HIDDEN_FRAMES
    : tabHidden;

  const noFaceState = !stableFaceDetected && faceConfidence < 0.35;
  if (
    temporalStable("NO_FACE", noFaceState, Math.max(faceConfidence, 0.7)) &&
    stabilizeViolation("NO_FACE", noFaceState, 2, Math.max(faceConfidence, 0.7), now)
  ) {
    violations.push("NO_FACE");
  }

  if (
    temporalStable("MULTIPLE_FACES", faceMetrics.multipleFaces, faceMetrics.confidenceScore) &&
    stabilizeViolation("MULTIPLE_FACES", faceMetrics.multipleFaces, 2, faceMetrics.confidenceScore, now)
  ) {
    violations.push("MULTIPLE_FACES");
  }

  const lookingAwayState =
    faceMetrics.eyeGaze !== "ON_SCREEN" ||
    faceMetrics.headPose === "TURNED_LEFT" ||
    faceMetrics.headPose === "TURNED_RIGHT" ||
    faceMetrics.headPose === "LOOKING_UP" ||
    faceMetrics.headPose === "TILTED";

  const headDownState = faceMetrics.headPose === "LOOKING_DOWN" || faceMetrics.pitch > 15;

  if (
    temporalStable("LOOKING_AWAY", lookingAwayState, faceMetrics.confidenceScore) &&
    stabilizeViolation("LOOKING_AWAY", lookingAwayState, 2, faceMetrics.confidenceScore, now)
  ) {
    violations.push("LOOKING_AWAY");
  }

  if (
    temporalStable("HEAD_DOWN", headDownState, faceMetrics.confidenceScore) &&
    stabilizeViolation("HEAD_DOWN", headDownState, 2, faceMetrics.confidenceScore, now)
  ) {
    violations.push("HEAD_DOWN");
  }

  const speechDetected = audioMetrics.vadState === "TALKING" && audioMetrics.speechDurationMs >= 2000;
  if (
    temporalStable("TALKING", speechDetected, audioMetrics.confidenceScore) &&
    stabilizeViolation("TALKING", speechDetected, 1, audioMetrics.confidenceScore, now)
  ) {
    violations.push("TALKING");
  }

  const backgroundNoiseDetected =
    audioMetrics.vadState === "NOISE" && audioMetrics.noiseDurationMs >= 2000;
  if (
    temporalStable("NOISE", backgroundNoiseDetected, audioMetrics.confidenceScore) &&
    stabilizeViolation("NOISE", backgroundNoiseDetected, 1, audioMetrics.confidenceScore, now)
  ) {
    violations.push("NOISE");
  }

  if (tabActuallySwitched && temporalStable("TAB_SWITCH", tabActuallySwitched, 1) && stabilizeViolation("TAB_SWITCH", tabActuallySwitched, 1, 1, now)) {
    violations.push("TAB_SWITCH");
  }

  if (behaviorMetrics.idleTime > 5000 && stabilizeViolation("INACTIVITY", true, 5, 0.7, now)) {
    violations.push("INACTIVITY");
  }

  const hardFocus = hardFocusOverride(faceMetrics, audioMetrics, behaviorMetrics);
  const weightedFocus = weightFocusScore(faceMetrics, audioMetrics, behaviorMetrics);
  const instantFocus = violations.includes("NO_FACE") || violations.includes("MULTIPLE_FACES")
    ? 0
    : clamp(hardFocus * 0.65 + weightedFocus * 0.35, 0, 1);
  const focusScore = clamp(instantFocus * 0.7 + previousFocusScore * 0.3, 0, 1);
  previousFocusScore = focusScore;

  const confidenceScore = clamp(
    (faceMetrics.confidenceScore * 0.45) +
      (audioMetrics.confidenceScore * 0.35) +
      ((behaviorMetrics.tabActive && behaviorMetrics.windowFocused && behaviorMetrics.idleTime <= 5000) ? 1 : 0.55) * 0.2,
    0,
    1,
  );

  const segbotConfidence = await inferSegbotConfidence(faceMetrics, audioMetrics, behaviorMetrics);
  const fusedConfidence = segbotConfidence === null
    ? confidenceScore
    : clamp(confidenceScore * 0.7 + segbotConfidence * 0.3, 0, 1);

  self.postMessage({
    focusScore,
    violations,
    confidenceScore: fusedConfidence,
  });
}

self.onmessage = (event) => {
  void processEvent(event);
};
