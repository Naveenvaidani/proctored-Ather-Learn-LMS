const SPEECH_WINDOW_MS = 2000;
const NOISE_WINDOW_MS = 2000;
const SHORT_WINDOW_MS = 400;
const SILERO_WEIGHT = 0.6;
const WEBRTC_WEIGHT = 0.4;
const CALIBRATION_MS = 5000;
const NOISE_MARGIN = 0.08;

let vadPipeline = null;
let webRtcVad = null;
let webRtcVadEnum = null;
let webRtcVadClass = null;
let initialized = false;
let initializing = false;
let speechDurationMs = 0;
let noiseDurationMs = 0;
let silenceDurationMs = 0;
let calibrationStartedAt = 0;
let calibrationSamples = [];
let baselineNoise = 0.05;
let adaptiveNoiseThreshold = 0.13;
let lastSpeechTimestamp = 0;
let lastNoiseTimestamp = 0;
let speechConfidenceEma = 0;
let noiseConfidenceEma = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ema(current, previous, alpha) {
  return alpha * current + (1 - alpha) * previous;
}

function getEnergy(samples) {
  if (!samples.length) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sumSquares += samples[i] * samples[i];
  }
  return Math.sqrt(sumSquares / samples.length);
}

function zeroCrossingRate(samples) {
  if (!samples.length) return 0;

  let crossings = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const curr = samples[i];
    if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
      crossings += 1;
    }
  }

  return crossings / samples.length;
}

function to16BitPCM(buffer) {
  const pcm = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i += 1) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm;
}

function resampleTo16k(samples, sampleRate) {
  if (!samples.length || sampleRate === 16000) return samples;

  const ratio = 16000 / sampleRate;
  const targetLength = Math.max(1, Math.round(samples.length * ratio));
  const output = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i += 1) {
    const position = i / ratio;
    const left = Math.floor(position);
    const right = Math.min(samples.length - 1, left + 1);
    const mix = position - left;
    output[i] = samples[left] * (1 - mix) + samples[right] * mix;
  }

  return output;
}

function extractSpeechProbability(result) {
  if (!result) return 0;

  const candidates = Array.isArray(result) ? result : [result];
  if (!candidates.length) return 0;

  let speechScore = 0;
  let bestScore = 0;

  candidates.forEach((entry) => {
    if (typeof entry?.score === "number") {
      bestScore = Math.max(bestScore, entry.score);
    }
    const label = String(entry?.label || entry?.class || entry?.category || "").toLowerCase();
    if (label.includes("speech") || label.includes("voice") || label.includes("human")) {
      speechScore = Math.max(speechScore, entry.score ?? 0);
    }
  });

  return Math.max(speechScore, bestScore);
}

function runWebRtcVad(input16kFloat) {
  if (!webRtcVad) return { probability: 0.5, confidence: 0 };

  try {
    const pcm = webRtcVadClass?.floatTo16BitPCM
      ? webRtcVadClass.floatTo16BitPCM(input16kFloat)
      : to16BitPCM(input16kFloat);
    const vadEvent = webRtcVad.processBuffer(pcm);
    const isVoice = vadEvent === webRtcVadEnum?.VOICE || vadEvent === 1;
    const isSilence = vadEvent === webRtcVadEnum?.SILENCE || vadEvent === 0;

    return {
      probability: isVoice ? 0.95 : isSilence ? 0.05 : 0.5,
      confidence: isVoice || isSilence ? 0.9 : 0.5,
    };
  } catch {
    return { probability: 0.5, confidence: 0.2 };
  }
}

async function initializeVad() {
  if (initialized || initializing) return;
  initializing = true;

  try {
    const vadModule = await import("https://cdn.jsdelivr.net/npm/@ozymandiasthegreat/vad@2.0.7/+esm");
    const createWebRtcVad = vadModule.default;
    const VADClass = await createWebRtcVad();
    const VADMode = vadModule.VADMode;
    webRtcVadEnum = vadModule.VADEvent;
    webRtcVadClass = VADClass;
    webRtcVad = new VADClass(VADMode.AGGRESSIVE, 16000);

    try {
      const { pipeline, env } = await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm");
      env.allowRemoteModels = true;
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      vadPipeline = await pipeline("audio-classification", "onnx-community/silero-vad");
    } catch {
      vadPipeline = null;
    }

    initialized = true;
    self.postMessage({
      type: "INIT_SUCCESS",
      mode: vadPipeline ? "model-only" : "webrtc-only",
      warning: vadPipeline ? undefined : "Silero VAD unavailable; using WebRTC VAD only",
    });
  } catch (error) {
    self.postMessage({
      type: "INIT_ERROR",
      error: error instanceof Error ? error.message : "Failed to initialize WebRTC/Silero VAD models",
    });
  } finally {
    initializing = false;
  }
}

async function classifyAudio(payload) {
  const { samples, sampleRate = 48000, frequencyData, timestamp } = payload || {};
  if (!samples || !samples.length) return;

  if (!initialized) {
    await initializeVad();
    if (!initialized) return;
  }

  const input = resampleTo16k(samples, sampleRate);
  const energy = getEnergy(input);
  const rms = getEnergy(samples);
  const freqEnergy = frequencyData && frequencyData.length
    ? frequencyData.reduce((sum, value) => sum + Math.max(0, Math.min(1, value / 255)), 0) / frequencyData.length
    : energy;

  const now = typeof timestamp === "number" ? timestamp : performance.now();
  if (!calibrationStartedAt) {
    calibrationStartedAt = now;
  }

  const noiseProxy = clamp(Math.max(energy, rms, freqEnergy), 0, 1);
  if (now - calibrationStartedAt <= CALIBRATION_MS) {
    calibrationSamples.push(noiseProxy);
    if (calibrationSamples.length > 200) {
      calibrationSamples.shift();
    }
  }

  if (calibrationSamples.length && now - calibrationStartedAt >= CALIBRATION_MS) {
    const avgNoise = calibrationSamples.reduce((sum, value) => sum + value, 0) / calibrationSamples.length;
    baselineNoise = clamp(avgNoise, 0.01, 0.6);
    adaptiveNoiseThreshold = clamp(baselineNoise + NOISE_MARGIN, 0.06, 0.9);
  }

  let sileroSpeechProbability = 0;
  const webRtcResult = runWebRtcVad(input);
  const webrtcSpeechProbability = webRtcResult.probability;

  if (vadPipeline) {
    try {
      const vadResult = await vadPipeline({ array: input, sampling_rate: 16000 });
      sileroSpeechProbability = clamp(extractSpeechProbability(vadResult), 0, 1);
    } catch {
      sileroSpeechProbability = webrtcSpeechProbability;
    }
  } else {
    sileroSpeechProbability = webrtcSpeechProbability;
  }

  const speechProbability = clamp(
    sileroSpeechProbability * SILERO_WEIGHT + webrtcSpeechProbability * WEBRTC_WEIGHT,
    0,
    1,
  );

  const backgroundEnergy = clamp(
    0.45 * Math.max(freqEnergy, noiseProxy) +
      0.35 * (1 - sileroSpeechProbability) +
      0.2 * clamp(zeroCrossingRate(input) * 2.5, 0, 1),
    0,
    1,
  );

  speechConfidenceEma = ema(speechProbability, speechConfidenceEma, 0.35);
  noiseConfidenceEma = ema(backgroundEnergy, noiseConfidenceEma, 0.25);

  const speechDetected = speechConfidenceEma >= 0.7;
  const noisyEnvironment = noiseConfidenceEma >= adaptiveNoiseThreshold && speechConfidenceEma < 0.72;

  const vadState = speechDetected
    ? "TALKING"
    : noisyEnvironment
      ? "NOISE"
      : "CLEAN";

  const chunkMs = (input.length / 16000) * 1000;

  if (vadState === "TALKING") {
    speechDurationMs += chunkMs;
    lastSpeechTimestamp = now;
    silenceDurationMs = 0;
  } else {
    silenceDurationMs += chunkMs;
    if (silenceDurationMs > 250) {
      speechDurationMs = Math.max(0, speechDurationMs - chunkMs * 0.5);
    }
  }

  if (vadState === "NOISE") {
    noiseDurationMs += chunkMs;
    lastNoiseTimestamp = now;
  } else {
    noiseDurationMs = Math.max(0, noiseDurationMs - chunkMs * 0.5);
  }

  const speechPattern = speechDurationMs >= SPEECH_WINDOW_MS
    ? "CONTINUOUS"
    : speechDurationMs >= SHORT_WINDOW_MS
      ? "SHORT"
      : "NONE";

  const noiseSpike = noiseDurationMs >= NOISE_WINDOW_MS && noiseConfidenceEma >= adaptiveNoiseThreshold;
  const isCalibrated = now - calibrationStartedAt >= CALIBRATION_MS;
  const effectiveConfidence = clamp(
    0.5 * speechConfidenceEma +
      0.2 * (webrtcSpeechProbability * webRtcResult.confidence) +
      0.2 * sileroSpeechProbability +
      0.1 * (isCalibrated ? 1 : 0.6),
    0,
    1,
  );

  self.postMessage({
    type: "VAD_RESULT",
    metrics: {
      vadState,
      noiseLevel: clamp(Math.max(rms, backgroundEnergy), 0, 1),
      noiseBaseline: baselineNoise,
      noiseThreshold: adaptiveNoiseThreshold,
      isCalibrated,
      voiceDetected: vadState === "TALKING",
      speechPattern,
      noiseSpike,
      speechProbability: speechConfidenceEma,
      webrtcSpeechProbability,
      sileroSpeechProbability,
      confidenceScore: effectiveConfidence,
      speechDurationMs,
      noiseDurationMs,
      lastSpeechTimestamp,
      lastNoiseTimestamp,
    },
    timestamp,
  });
}

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case "INIT":
      await initializeVad();
      break;
    case "PROCESS_AUDIO":
      await classifyAudio(payload);
      break;
    default:
      break;
  }
};
