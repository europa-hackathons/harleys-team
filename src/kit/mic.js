// Microphone loudness, e.g. "roar to breathe fire". No words are recorded or understood, only how loud it is.
//   const mic = await startMic();             // asks for the microphone (needs https or localhost)
//   each frame: if (mic.level() > 0.3) breatheFire();   // level() is 0..1
// On failure it throws an Error with .reason: 'insecure' | 'unsupported' | 'denied' | 'no-mic' | 'busy' | 'other'.
export async function startMic() {
  if (!window.isSecureContext) throw micError('insecure', 'The microphone only works on https:// or localhost pages.');
  if (!navigator.mediaDevices?.getUserMedia) throw micError('unsupported', 'This browser has no microphone support.');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
  } catch (e) {
    const reason = { NotAllowedError: 'denied', SecurityError: 'denied', NotFoundError: 'no-mic', NotReadableError: 'busy', AbortError: 'busy' }[e.name] || 'other';
    throw micError(reason, `${e.name}: ${e.message}`);
  }

  const audio = new AudioContext();
  if (audio.state === 'suspended') await audio.resume().catch(() => {});
  const analyser = audio.createAnalyser();
  analyser.fftSize = 512;
  audio.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);

  return {
    stream,
    level() {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      return Math.min(1, Math.sqrt(sum / buf.length) * 4); // RMS, scaled so a shout reaches about 1
    },
    stop() { stream.getTracks().forEach((t) => t.stop()); audio.close(); },
  };
}

function micError(reason, message) {
  const e = new Error(message);
  e.reason = reason;
  return e;
}
