import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'KT Noise Cancellation',
    description: 'Real-time background noise cancellation and voice clarity using local on-device processing.',
    version: '1.0.0',
    permissions: [
      'tabCapture',
      'offscreen',
      'storage'
    ],
    action: {
      default_title: 'KT Noise Cancellation'
    }
  }
});
