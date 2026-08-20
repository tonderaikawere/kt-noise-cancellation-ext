/**
 * Reference implementation of the KT Noise Gate AudioWorkletProcessor.
 * This class is compiled and loaded dynamically inside the offscreen audio pipeline.
 */
export class NoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'threshold',
        defaultValue: 0.005,
        minValue: 0.0,
        maxValue: 1.0,
      },
    ];
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>) {
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
        // Attenuate low amplitude ambient noise
        outputChannel[i] = Math.abs(sample) < threshold ? sample * 0.05 : sample;
      }
    }
    return true;
  }
}

// @ts-ignore
registerProcessor('noise-gate-processor', NoiseGateProcessor);
