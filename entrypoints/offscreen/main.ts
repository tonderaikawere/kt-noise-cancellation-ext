console.log('KT Offscreen Audio Sandbox loaded.');

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;

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

async function handleStartCapture(streamId: string) {
  try {
    const ctx = initAudioContext();

    // Stop previous capture stream if any exists
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }

    // Capture the tab audio stream using the stream ID passed from background
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
    console.log('Successfully captured tab stream in offscreen.');
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
