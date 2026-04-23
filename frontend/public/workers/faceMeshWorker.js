const WINDOW_SIZE = 30;
const STABLE_MS = 1500;
const RESULT_TIMEOUT_MS = 260;
const FACE_MIN_CONFIDENCE = 0.2;
const FACE_STABLE_THRESHOLD = 15;
const FACE_PERSISTENCE_MS = 2000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(points) {
  if (!points.length) return { x: 0, y: 0, z: 0, confidence: 0 };

  const total = points.reduce(
    (acc, point) => {
      acc.x += point.x ?? 0;
      acc.y += point.y ?? 0;
      acc.z += point.z ?? 0;
      acc.confidence += point.visibility ?? point.presence ?? 0.85;
      return acc;
    },
    { x: 0, y: 0, z: 0, confidence: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
    z: total.z / points.length,
    confidence: total.confidence / points.length,
  };
}

function pick(landmarks, indices) {
  return indices.map((index) => landmarks[index]).filter(Boolean);
}

function angleDegrees(x1, y1, x2, y2) {
  return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
}

function normalize3(vec) {
  const mag = Math.hypot(vec.x, vec.y, vec.z) || 1;
  return { x: vec.x / mag, y: vec.y / mag, z: vec.z / mag };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function subtract(a, b) {
  return {
    x: (a.x ?? 0) - (b.x ?? 0),
    y: (a.y ?? 0) - (b.y ?? 0),
    z: (a.z ?? 0) - (b.z ?? 0),
  };
}

function eulerFromAxes(xAxis, yAxis, zAxis) {
  const r11 = xAxis.x;
  const r21 = xAxis.y;
  const r31 = xAxis.z;
  const r32 = yAxis.z;
  const r33 = zAxis.z;

  const yaw = Math.atan2(-r31, Math.sqrt(r11 * r11 + r21 * r21));
  const pitch = Math.atan2(r32, r33);
  const roll = Math.atan2(r21, r11);

  return {
    yaw: (yaw * 180) / Math.PI,
    pitch: (pitch * 180) / Math.PI,
    roll: (roll * 180) / Math.PI,
  };
}

async function resolveMediaPipeConstructors() {
  let faceMeshCtor = null;
  let faceDetectionCtor = null;

  try {
    const faceMeshModule = await import("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js");
    const faceDetectionModule = await import("https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js");

    faceMeshCtor =
      faceMeshModule?.FaceMesh ||
      faceMeshModule?.default?.FaceMesh ||
      faceMeshModule?.default ||
      self?.FaceMesh ||
      null;

    faceDetectionCtor =
      faceDetectionModule?.FaceDetection ||
      faceDetectionModule?.default?.FaceDetection ||
      faceDetectionModule?.default ||
      self?.FaceDetection ||
      null;
  } catch {
    // Fallback to UMD loading path.
  }

  if (!faceMeshCtor || !faceDetectionCtor) {
    try {
      importScripts(
        "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js",
        "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js",
      );
      faceMeshCtor = faceMeshCtor || self?.FaceMesh || null;
      faceDetectionCtor = faceDetectionCtor || self?.FaceDetection || null;
    } catch {
      // The caller throws a clear initialization error if constructors are still missing.
    }
  }

  return { faceMeshCtor, faceDetectionCtor };
}

class FaceMeshWorker {
  constructor() {
    this.faceMesh = null;
    this.faceDetection = null;
    this.initialized = false;
    this.processing = false;
    this.rawWindow = [];
    this.pendingResult = null;
    this.pendingFaceDetectionResult = null;
    this.faceMeshResultResolver = null;
    this.faceDetectionResultResolver = null;
    this.stateTracker = {
      gaze: { value: "ON_SCREEN", startedAt: 0, confidence: 1 },
      pose: { value: "STABLE", startedAt: 0, confidence: 1 },
    };
    this.stableState = {
      gaze: "ON_SCREEN",
      pose: "STABLE",
    };
    this.lastBox = null;
    this.faceBuffer = [];
    this.lastFaceSeenAt = 0;
  }

  updateFaceBuffer(detected, confidence, now) {
    this.faceBuffer.push(Boolean(detected));
    if (this.faceBuffer.length > WINDOW_SIZE) {
      this.faceBuffer.shift();
    }

    if (detected && confidence >= FACE_MIN_CONFIDENCE) {
      this.lastFaceSeenAt = now;
    }
  }

  async initialize() {
    try {
      const { faceMeshCtor, faceDetectionCtor } = await resolveMediaPipeConstructors();
      if (!faceMeshCtor || !faceDetectionCtor) {
        throw new Error("MediaPipe constructors unavailable");
      }

      this.faceMesh = new faceMeshCtor({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        selfieMode: true,
      });
      this.faceDetection = new faceDetectionCtor({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
        selfieMode: true,
      });

      this.faceMesh.setOptions({
        maxNumFaces: 2,
        refineLandmarks: true,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });
      this.faceDetection.setOptions({
        modelSelection: 0,
        minDetectionConfidence: 0.7,
      });

      this.faceMesh.onResults((results) => {
        this.pendingResult = results;
        if (this.faceMeshResultResolver) {
          this.faceMeshResultResolver(results);
          this.faceMeshResultResolver = null;
        }
      });
      this.faceDetection.onResults((results) => {
        this.pendingFaceDetectionResult = results;
        if (this.faceDetectionResultResolver) {
          this.faceDetectionResultResolver(results);
          this.faceDetectionResultResolver = null;
        }
      });

      this.initialized = true;
      self.postMessage({ type: "INIT_SUCCESS" });
    } catch (error) {
      self.postMessage({
        type: "INIT_ERROR",
        error: error instanceof Error ? error.message : "Failed to initialize MediaPipe Face Mesh models",
      });
    }
  }

  analyzeLandmarks(landmarks) {
    const leftEyePoints = pick(landmarks, [33, 133, 159, 145, 153, 154, 155]);
    const rightEyePoints = pick(landmarks, [263, 362, 386, 374, 380, 381, 382]);
    const nose = landmarks[1] || landmarks[4] || landmarks[5];
    const chin = landmarks[152] || landmarks[175];
    const forehead = landmarks[10] || landmarks[9];
    const mouthLeft = landmarks[61] || landmarks[78];
    const mouthRight = landmarks[291] || landmarks[308];

    const leftEye = average(leftEyePoints);
    const rightEye = average(rightEyePoints);
    const eyeMid = {
      x: (leftEye.x + rightEye.x) / 2,
      y: (leftEye.y + rightEye.y) / 2,
    };
    const eyeDistance = Math.max(0.0001, Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y));
    const faceHeight = Math.max(0.0001, Math.abs((chin?.y ?? eyeMid.y + 0.2) - (forehead?.y ?? eyeMid.y - 0.2)));

    const leftIris = landmarks.length >= 473 ? average(pick(landmarks, [468, 469, 470, 471, 472])) : leftEye;
    const rightIris = landmarks.length >= 478 ? average(pick(landmarks, [473, 474, 475, 476, 477])) : rightEye;

    // PnP-style pose approximation using canonical head axes from 6 key landmarks.
    const xAxis = normalize3(subtract(rightEye, leftEye));
    const yAxisSeed = normalize3(subtract(chin || eyeMid, nose || eyeMid));
    const zAxis = normalize3(cross(xAxis, yAxisSeed));
    const yAxis = normalize3(cross(zAxis, xAxis));
    const pose = eulerFromAxes(xAxis, yAxis, zAxis);
    const yaw = pose.yaw;
    const pitch = pose.pitch;
    const roll = pose.roll || angleDegrees(leftEye.x, leftEye.y, rightEye.x, rightEye.y);

    let gaze = "ON_SCREEN";
    const leftOffsetX = (leftIris.x - leftEye.x) / eyeDistance;
    const rightOffsetX = (rightIris.x - rightEye.x) / eyeDistance;
    const combinedOffsetX = (leftOffsetX + rightOffsetX) / 2;
    const combinedOffsetY = ((leftIris.y - leftEye.y) + (rightIris.y - rightEye.y)) / (2 * faceHeight);

    if (combinedOffsetY > 0.1 || pitch > 12) {
      gaze = "AWAY_DOWN";
    } else if (combinedOffsetY < -0.08 || pitch < -8) {
      gaze = "AWAY_UP";
    } else if (combinedOffsetX > 0.11 || yaw < -14) {
      gaze = "AWAY_RIGHT";
    } else if (combinedOffsetX < -0.11 || yaw > 14) {
      gaze = "AWAY_LEFT";
    }

    let headPose = "STABLE";
    if (pitch > 15) headPose = "LOOKING_DOWN";
    else if (pitch < -10) headPose = "LOOKING_UP";
    else if (yaw > 20) headPose = "TURNED_LEFT";
    else if (yaw < -20) headPose = "TURNED_RIGHT";
    else if (Math.abs(roll) > 15) headPose = "TILTED";

    const landmarkConfidence = average([
      leftEye,
      rightEye,
      nose || eyeMid,
      chin || eyeMid,
      forehead || eyeMid,
      mouthLeft || eyeMid,
      mouthRight || eyeMid,
    ]).confidence;

    const minX = Math.min(...landmarks.map((p) => p.x));
    const maxX = Math.max(...landmarks.map((p) => p.x));
    const minY = Math.min(...landmarks.map((p) => p.y));
    const maxY = Math.max(...landmarks.map((p) => p.y));
    const bbox = { x: minX, y: minY, width: Math.max(0.001, maxX - minX), height: Math.max(0.001, maxY - minY) };
    const boxShift = this.lastBox
      ? Math.hypot((bbox.x - this.lastBox.x), (bbox.y - this.lastBox.y))
      : 0;
    const boxScaleShift = this.lastBox
      ? Math.abs((bbox.width * bbox.height) - (this.lastBox.width * this.lastBox.height))
      : 0;
    this.lastBox = bbox;

    const faceStability = clamp(1 - boxShift * 4 - boxScaleShift * 2.5, 0, 1);
    const boxConsistency = clamp(1 - boxScaleShift * 4, 0, 1);
    const posePenalty = clamp((Math.abs(yaw) / 35 + Math.abs(pitch) / 28 + Math.abs(roll) / 22) / 3, 0, 1);
    const confidenceScore = clamp(
      0.5 * landmarkConfidence + 0.25 * (1 - posePenalty) + 0.15 * faceStability + 0.1 * boxConsistency,
      0,
      1,
    );

    return {
      faceDetected: true,
      faceCount: 1,
      multipleFaces: false,
      eyeGaze: gaze,
      headPose,
      yaw,
      pitch,
      roll,
      confidenceScore,
      landmarkCount: landmarks.length,
    };
  }

  stabilizeState(key, rawValue, confidence, now) {
    const tracker = this.stateTracker[key];
    if (tracker.value !== rawValue) {
      tracker.value = rawValue;
      tracker.startedAt = now;
      tracker.confidence = confidence;
      return this.stableState[key];
    }

    tracker.confidence = confidence;

    if (now - tracker.startedAt >= STABLE_MS && confidence >= 0.7) {
      this.stableState[key] = rawValue;
    }

    return this.stableState[key];
  }

  async processFrame(imageBitmap, timestamp) {
    if (!this.initialized || this.processing || !this.faceMesh) {
      return;
    }

    this.processing = true;

    try {
      this.pendingResult = null;
      const faceMeshResultsPromise = new Promise((resolve) => {
        this.faceMeshResultResolver = resolve;
        setTimeout(() => {
          if (this.faceMeshResultResolver) {
            this.faceMeshResultResolver(this.pendingResult || {});
            this.faceMeshResultResolver = null;
          }
        }, RESULT_TIMEOUT_MS);
      });

      await this.faceMesh.send({ image: imageBitmap });
      const maybeResult = (await faceMeshResultsPromise) || this.pendingResult || {};
      let faces = maybeResult.multiFaceLandmarks || maybeResult.faceLandmarks || [];

      if (!faces.length && this.faceDetection) {
        this.pendingFaceDetectionResult = null;
        const faceDetectionResultsPromise = new Promise((resolve) => {
          this.faceDetectionResultResolver = resolve;
          setTimeout(() => {
            if (this.faceDetectionResultResolver) {
              this.faceDetectionResultResolver(this.pendingFaceDetectionResult || {});
              this.faceDetectionResultResolver = null;
            }
          }, RESULT_TIMEOUT_MS);
        });
        await this.faceDetection.send({ image: imageBitmap });
        await faceDetectionResultsPromise;
      }

      const detections = this.pendingFaceDetectionResult?.detections || [];
      const now = typeof timestamp === "number" ? timestamp : performance.now();

      let payload;

      if (!faces.length && !detections.length) {
        payload = {
          faceDetected: false,
          faceCount: 0,
          multipleFaces: false,
          eyeGaze: "ON_SCREEN",
          headPose: "STABLE",
          yaw: 0,
          pitch: 0,
          roll: 0,
          confidenceScore: 0,
          landmarkCount: 0,
        };
      } else if (!faces.length && detections.length) {
        payload = {
          faceDetected: true,
          faceCount: detections.length,
          multipleFaces: detections.length > 1,
          eyeGaze: "ON_SCREEN",
          headPose: "STABLE",
          yaw: 0,
          pitch: 0,
          roll: 0,
          confidenceScore: 0.55,
          landmarkCount: 0,
        };
      } else {
        const primary = this.analyzeLandmarks(faces[0]);
        const multipleFaces = faces.length > 1;
        const faceDetected = true;

        const gaze = multipleFaces
          ? "AWAY_DOWN"
          : this.stabilizeState("gaze", primary.eyeGaze, primary.confidenceScore, now);

        const pose = multipleFaces
          ? "TURNED_LEFT"
          : this.stabilizeState("pose", primary.headPose, primary.confidenceScore, now);

        const temporalConfidence = clamp(
          0.6 * primary.confidenceScore + 0.4 * (multipleFaces ? 0.95 : 1),
          0,
          1,
        );

        payload = {
          faceDetected,
          faceCount: faces.length,
          multipleFaces,
          eyeGaze: gaze,
          headPose: pose,
          yaw: primary.yaw,
          pitch: primary.pitch,
          roll: primary.roll,
          confidenceScore: temporalConfidence,
          landmarkCount: primary.landmarkCount,
        };
      }

      const faceConfidence = payload.faceDetected ? payload.confidenceScore : 0;
      this.updateFaceBuffer(payload.faceDetected, faceConfidence, now);

      const detectedFrames = this.faceBuffer.filter((value) => value).length;
      const bufferedFaceDetected = this.faceBuffer.length >= WINDOW_SIZE
        ? detectedFrames >= FACE_STABLE_THRESHOLD
        : payload.faceDetected;
      const recentlySeenFace = now - this.lastFaceSeenAt <= FACE_PERSISTENCE_MS;
      const stableFaceDetected = bufferedFaceDetected || recentlySeenFace;

      const stablePayload = {
        ...payload,
        faceDetected: stableFaceDetected,
        faceCount: stableFaceDetected ? Math.max(1, payload.faceCount || 1) : 0,
        multipleFaces: stableFaceDetected ? payload.multipleFaces : false,
      };

      this.rawWindow.push({ ...stablePayload, timestamp: now });
      if (this.rawWindow.length > WINDOW_SIZE) {
        this.rawWindow.shift();
      }

      const recent = this.rawWindow.slice(-WINDOW_SIZE);
      const recentConfidence = recent.reduce((sum, item) => sum + (item.confidenceScore || 0), 0) / Math.max(1, recent.length);

      self.postMessage({
        type: "FACE_RESULT",
        metrics: {
          ...stablePayload,
          confidenceScore: clamp((stablePayload.confidenceScore + recentConfidence) / 2, 0, 1),
        },
        timestamp: now,
      });
    } catch (error) {
      self.postMessage({
        type: "ERROR",
        error: error instanceof Error ? error.message : "Face tracking failed",
        timestamp,
      });
    } finally {
      this.processing = false;
      if (imageBitmap && typeof imageBitmap.close === "function") {
        imageBitmap.close();
      }
    }
  }
}

const worker = new FaceMeshWorker();

self.onmessage = async (event) => {
  const { type, imageBitmap, timestamp } = event.data || {};

  switch (type) {
    case "INIT":
      await worker.initialize();
      break;
    case "PROCESS_FRAME":
      if (imageBitmap) {
        await worker.processFrame(imageBitmap, timestamp);
      }
      break;
    default:
      break;
  }
};
