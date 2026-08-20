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
let analyserNode: AnalyserNode | null = null;

const visualChannel = new BroadcastChannel('kt-audio-visuals');
let visualLoopActive = false;

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
          outputChannel[i] = Math.abs(sample) < threshold ? sample * 0.05 : sample;
        }
      }
      return true;
    }
  }
  registerProcessor('noise-gate-processor', NoiseGateProcessor);
`;

function initAudioContext() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('Web Audio Context initialized. Sample rate:', audioContext.sampleRate);
      
      audioContext.onstatechange = () => {
        console.log('AudioContext state changed:', audioContext?.state);
        if (audioContext?.state === 'suspended') {
          audioContext.resume().catch(err => console.error('Failed to resume AudioContext:', err));
        }
      };
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return audioContext;
  } catch (err) {
    console.error('Failed to initialize AudioContext:', err);
    browser.runtime.sendMessage({ type: 'AUDIO_INIT_ERROR', error: (err as any).message }).catch(() => {});
    throw err;
  }
}

function createDSPNodes(ctx: AudioContext) {
  try {
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

    analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 64; 
  } catch (err) {
    console.error('Failed to create DSP nodes:', err);
    browser.runtime.sendMessage({ type: 'DSP_INIT_ERROR', error: (err as any).message }).catch(() => {});
    throw err;
  }
}

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
    
    try {
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
    } catch (fallbackErr) {
      console.error('ScriptProcessor fallback failed:', fallbackErr);
      browser.runtime.sendMessage({ type: 'GATE_INIT_ERROR', error: (fallbackErr as any).message }).catch(() => {});
    }
  }
}

function connectPipeline() {
  try {
    if (!sourceNode || !highPassFilter || !noiseGateNode || !presenceFilter || !compressorNode || !volumeGainNode || !analyserNode || !audioContext) {
      throw new Error('Some audio nodes are not ready for connection.');
    }

    sourceNode.connect(highPassFilter);
    highPassFilter.connect(noiseGateNode);
    noiseGateNode.connect(presenceFilter);
    presenceFilter.connect(compressorNode);
    compressorNode.connect(volumeGainNode);
    volumeGainNode.connect(analyserNode);
    analyserNode.connect(audioContext.destination);

    console.log('Audio pipeline routing successfully established.');
    startVisualLoop();
  } catch (err) {
    console.error('Routing connection failed:', err);
    browser.runtime.sendMessage({ type: 'PIPELINE_ROUTING_ERROR', error: (err as any).message }).catch(() => {});
  }
}

function startVisualLoop() {
  if (visualLoopActive) return;
  visualLoopActive = true;

  const dataArray = new Uint8Array(analyserNode?.frequencyBinCount || 32);
  
  function draw() {
    if (!visualLoopActive || !analyserNode) return;
    try {
      analyserNode.getByteFrequencyData(dataArray);
      const frequencies = Array.from(dataArray);
      visualChannel.postMessage({ frequencies });
      requestAnimationFrame(draw);
    } catch (err) {
      console.error('Visualizer rendering loop exception:', err);
      visualLoopActive = false;
    }
  }
  
  requestAnimationFrame(draw);
}

async function handleStartCapture(streamId: string) {
  try {
    const ctx = initAudioContext();

    if (mediaStream) {
      visualLoopActive = false;
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

    const res = await browser.storage.local.get(['noiseGate', 'voiceBoost', 'volume']);
    handleStateChange({
      enabled: true,
      noiseGate: res.noiseGate ?? 50,
      voiceBoost: res.voiceBoost ?? 30,
      volume: res.volume ?? 100
    });
  } catch (err) {
    console.error('Failed to getUserMedia for tab capture stream ID:', err);
    browser.runtime.sendMessage({ type: 'CAPTURE_API_ERROR', error: (err as any).message }).catch(() => {});
  }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CAPTURE') {
    handleStartCapture(message.streamId).catch(() => {});
  } else if (message.type === 'OFFSCREEN_STATE_CHANGE') {
    handleStateChange(message.payload);
  }
  return true;
});

function handleStateChange(payload: { enabled: boolean; noiseGate: number; voiceBoost: number; volume: number }) {
  if (!audioContext) return;
  const ctx = audioContext;

  try {
    if (volumeGainNode) {
      const gainVal = payload.volume / 100;
      volumeGainNode.gain.setValueAtTime(gainVal, ctx.currentTime);
    }

    if (presenceFilter) {
      const presenceGain = (payload.voiceBoost / 100) * 10;
      presenceFilter.gain.setValueAtTime(presenceGain, ctx.currentTime);
    }

    if (noiseGateNode) {
      const thresholdVal = (payload.noiseGate / 100) * 0.04;
      // @ts-ignore
      if (noiseGateNode.threshold) {
        // @ts-ignore
        noiseGateNode.threshold.setValueAtTime(thresholdVal, ctx.currentTime);
      } else if ((noiseGateNode as any).setThreshold) {
        (noiseGateNode as any).setThreshold(thresholdVal);
      }
    }
  } catch (err) {
    console.error('Error applying state changes to audio params:', err);
  }
}
