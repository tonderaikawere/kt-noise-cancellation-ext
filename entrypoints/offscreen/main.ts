console.log('KT Offscreen Audio Sandbox loaded.');

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;

// DSP Nodes declaration
let highPassFilter: BiquadFilterNode | null = null;
let presenceFilter: BiquadFilterNode | null = null;
let compressorNode: DynamicsCompressorNode | null = null;
let volumeGainNode: GainNode | null = null;
let noiseGateNode: AudioNode | null = null;

// Inline Noise Gate AudioWorklet code
const noiseGateWorkletCode = `
  class NoiseGateProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [{ name: 'threshold', defaultValue: 0.005, minValue: 0.0, maxValue: 1.0 }];
    }
    process(inputs, outputs, parameters) {
      const input = inputs[0];
      const output = outputs[0];
      if (!input || !input[0]) return true;
      
      const threshold = parameters.threshold[0];
      for (let channel = 0; channel < input.length; ++channel) {
        const inputChannel = input[channel];
        const outputChannel = output[channel];
        if (!outputChannel) continue;
        for (let i = 0; i < inputChannel.length; ++i) {
          const sample = inputChannel[i];
          // Basic soft noise gate: attenuate signals below threshold
          outputChannel[i] = Math.abs(sample) < threshold ? sample * 0.05 : sample;
        }
      }
      return true;
    }
  }
  registerProcessor('noise-gate-processor', NoiseGateProcessor);
`;

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
  highPassFilter = ctx.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.setValueAtTime(80, ctx.currentTime);
  highPassFilter.Q.setValueAtTime(0.707, ctx.currentTime);

  presenceFilter = ctx.createBiquadFilter();
  presenceFilter.type = 'peaking';
  presenceFilter.frequency.setValueAtTime(3000, ctx.currentTime);
  presenceFilter.Q.setValueAtTime(1.0, ctx.currentTime);
  presenceFilter.gain.setValueAtTime(3, ctx.currentTime); 

  compressorNode = ctx.createDynamicsCompressor();
  compressorNode.threshold.setValueAtTime(-24, ctx.currentTime);
  compressorNode.knee.setValueAtTime(30, ctx.currentTime);
  compressorNode.ratio.setValueAtTime(12, ctx.currentTime);
  compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
  compressorNode.release.setValueAtTime(0.25, ctx.currentTime);

  volumeGainNode = ctx.createGain();
  volumeGainNode.gain.setValueAtTime(1.0, ctx.currentTime);
}

// Initialize Noise Gate AudioWorklet
async function initNoiseGate(ctx: AudioContext) {
  try {
    const blob = new Blob([noiseGateWorkletCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    // @ts-ignore
    noiseGateNode = new AudioWorkletNode(ctx, 'noise-gate-processor');
    console.log('AudioWorklet Noise Gate loaded.');
  } catch (err) {
    console.warn('AudioWorklet failed, using ScriptProcessor fallback:', err);
    const bufferSize = 4096;
    let threshold = 0.005;
    
    const scriptNode = ctx.createScriptProcessor(bufferSize, 1, 1);
    scriptNode.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer;
      const outputBuffer = event.outputBuffer;
      for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
        const inputData = inputBuffer.getChannelData(channel);
        const outputData = outputBuffer.getChannelData(channel);
        for (let sample = 0; sample < inputBuffer.length; sample++) {
          const val = inputData[sample];
          outputData[sample] = Math.abs(val) < threshold ? val * 0.05 : val;
        }
      }
    };
    
    (scriptNode as any).setThreshold = (val: number) => {
      threshold = val;
    };
    
    noiseGateNode = scriptNode;
  }
}

// Build and connect the pipeline
function connectPipeline() {
  if (!sourceNode || !highPassFilter || !noiseGateNode || !presenceFilter || !compressorNode || !volumeGainNode || !audioContext) {
    console.error('Cannot connect pipeline: some nodes are not initialized.');
    return;
  }

  // Route: Source -> High Pass -> Noise Gate -> Presence Boost -> Compressor -> Volume Gain -> Destination
  sourceNode.connect(highPassFilter);
  highPassFilter.connect(noiseGateNode);
  noiseGateNode.connect(presenceFilter);
  presenceFilter.connect(compressorNode);
  compressorNode.connect(volumeGainNode);
  volumeGainNode.connect(audioContext.destination);

  console.log('Audio pipeline routing successfully established.');
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
    await initNoiseGate(ctx);
    connectPipeline();
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
