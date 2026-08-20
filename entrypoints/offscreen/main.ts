console.log('KT Offscreen Audio Sandbox loaded.');

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;

// DSP Nodes declaration
let highPassFilter: BiquadFilterNode | null = null;
let presenceFilter: BiquadFilterNode | null = null;
let compressorNode: DynamicsCompressorNode | null = null;
let volumeGainNode: GainNode | null = null;

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    console.log('Web Audio Context initialized. Sample rate:', audioContext.sampleRate);
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

// Create DSP Nodes for the enhancement pipeline
function createDSPNodes(ctx: AudioContext) {
  // 1. High Pass Filter to cut rumble / ambient AC hum (< 80Hz)
  highPassFilter = ctx.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.setValueAtTime(80, ctx.currentTime);
  highPassFilter.Q.setValueAtTime(0.707, ctx.currentTime);

  // 2. Presence filter (peaking filter around 3kHz to boost voice clarity)
  presenceFilter = ctx.createBiquadFilter();
  presenceFilter.type = 'peaking';
  presenceFilter.frequency.setValueAtTime(3000, ctx.currentTime);
  presenceFilter.Q.setValueAtTime(1.0, ctx.currentTime);
  presenceFilter.gain.setValueAtTime(3, ctx.currentTime); // default boost

  // 3. Dynamics Compressor (AGC / soft limiter) to make speech consistent
  compressorNode = ctx.createDynamicsCompressor();
  compressorNode.threshold.setValueAtTime(-24, ctx.currentTime);
  compressorNode.knee.setValueAtTime(30, ctx.currentTime);
  compressorNode.ratio.setValueAtTime(12, ctx.currentTime);
  compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
  compressorNode.release.setValueAtTime(0.25, ctx.currentTime);

  // 4. Volume Gain Node (booster)
  volumeGainNode = ctx.createGain();
  volumeGainNode.gain.setValueAtTime(1.0, ctx.currentTime);
}

async function handleStartCapture(streamId: string) {
  try {
    const ctx = initAudioContext();

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    } as any);

    sourceNode = ctx.createMediaStreamSource(mediaStream);
    createDSPNodes(ctx);
    console.log('Successfully captured tab stream & initialized DSP nodes.');
  } catch (err) {
    console.error('Failed to getUserMedia for tab capture stream ID:', err);
  }
}

// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CAPTURE') {
    handleStartCapture(message.streamId);
  } else if (message.type === 'OFFSCREEN_STATE_CHANGE') {
    handleStateChange(message.payload);
  }
  return true;
});

function handleStateChange(payload: { enabled: boolean; noiseGate: number; voiceBoost: number; volume: number }) {
  console.log('Settings changed:', payload);
}
