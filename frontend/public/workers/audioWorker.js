let consecutiveSpeechFrames = 0;
let highNoiseFrames = 0;
let silenceFrames = 0;
let previousNoiseLevel = 0;
let rmsEma = 0;
let noiseEma = 0;

function ema(current, previous, alpha) {
  return alpha * current + (1 - alpha) * previous;
}

self.onmessage = (event) => {
  const { frequencyData, rms } = event.data || {};

  if (!Array.isArray(frequencyData) || typeof rms !== "number") {
    return;
  }

  const normalizedBins = frequencyData.map((value) => Math.max(0, Math.min(1, value / 255)));
  const noiseLevel = normalizedBins.reduce((sum, value) => sum + value, 0) / Math.max(1, normalizedBins.length);
  const noiseJump = noiseLevel - previousNoiseLevel;
  previousNoiseLevel = noiseLevel;

  rmsEma = ema(rms, rmsEma, 0.2);
  noiseEma = ema(noiseLevel, noiseEma, 0.18);

  const voiceDetected = rmsEma > 0.045 || noiseEma > 0.2;

  if (voiceDetected) {
    consecutiveSpeechFrames += 1;
    silenceFrames = 0;
  } else {
    silenceFrames += 1;
    if (silenceFrames > 10) {
      consecutiveSpeechFrames = Math.max(0, consecutiveSpeechFrames - 3);
    }
  }

  const rawNoiseSpike = noiseEma >= 0.62 || rmsEma >= 0.22 || noiseJump >= 0.15;

  if (rawNoiseSpike) {
    highNoiseFrames += 1;
  } else {
    highNoiseFrames = Math.max(0, highNoiseFrames - 1);
  }

  const noiseSpike = highNoiseFrames >= 3;

  let speechPattern = "NONE";
  if (consecutiveSpeechFrames >= 120 || highNoiseFrames >= 6) {
    speechPattern = "CONTINUOUS";
  } else if (consecutiveSpeechFrames >= 40) {
    speechPattern = "SHORT";
  }

  self.postMessage({
    noiseLevel,
    voiceDetected,
    speechPattern,
    noiseSpike,
    bars: normalizedBins.slice(0, 30),
  });
};
