# Chrome Web Store Metadata — KT Noise Cancellation

## Store Details

### Product Title
KT Noise Cancellation

### Brief Description
Real-time AI-powered noise cancellation and voice clarity using local on-device processing.

### Detailed Description
KT Noise Cancellation, developed by Kawerify Tech, brings real-time, privacy-first background noise suppression and voice enhancement directly to your browser. Filter out unwanted background noises—such as fan hums, keystrokes, traffic, and room echoes—from any audio playing in your browser.

Key Features:
- Zero Data Upload: All audio processing occurs locally on your machine.
- Privacy-First: No microphones are recorded to external servers.
- Dynamic Filters: Customizable high-pass filter, noise gate threshold, and volume booster.
- Low Latency: Built using high-performance Web Audio API.

## Permissions Justification

- **`tabCapture`**: Required to capture and process the audio stream from the currently active browser tab to remove background noise.
- **`offscreen`**: Required to instantiate the Web Audio API context in a sandboxed background page to process the captured audio stream without locking the main thread.
- **`storage`**: Required to store user preferences and persistent toggles (e.g. noise filter enabled/disabled, sliders config).
