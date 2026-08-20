# KT Noise Cancellation Extension

Built and sponsored by **Kawerify Tech** ([kawerifytech.com](https://kawerifytech.com)).

KT Noise Cancellation is a privacy-first, on-device browser extension that delivers real-time AI-inspired noise suppression and voice enhancement for browser audio (meetings, videos, and calls) without uploading data to external servers.

---

## 🚀 Key Features

- **100% On-Device DSP Pipeline**: Audio processing runs fully in the browser sandbox.
- **Rumble Elimination**: Integrated high-pass filter cuts room hum, ventilation, and microphone pops below 80Hz.
- **Dynamic Noise Gate**: Built on custom AudioWorklets (with ScriptProcessor fallbacks) to mute keyboard typing and background chat.
- **Voice Definition Peaking**: High-pass peaking filter at 3kHz enhances voice presence.
- **Dynamic Compressor**: Soft Automatic Gain Control (AGC) preserves natural volume characteristics.
- **Volume Booster**: Allows boosting overall browser audio levels from 0% up to 200%.
- **Real-Time Visualizer**: A 30fps frequency visualizer drawn on canvas using a low-latency BroadcastChannel.

---

## 🛠️ Technical Stack

- **Framework**: [WXT](https://wxt.dev) (Vite-powered, MV3-compliant)
- **Language**: TypeScript
- **Frontend**: React
- **Audio Core**: Web Audio API (BiquadFilterNodes, DynamicsCompressorNode, GainNode, AnalyserNode, AudioWorkletProcessor)

---

## 📂 Project Structure

```text
├── .output/                    # Build output directory
├── entrypoints/
│   ├── background.ts           # Service worker managing tabCapture & offscreen lifecycles
│   ├── offscreen/
│   │   ├── index.html          # Processing sandbox host HTML
│   │   ├── main.ts             # Audio pipeline, routing, and BroadcastChannel
│   │   ├── main.test.ts        # Unit tests verifying parameter mapping math
│   │   └── gate-processor.ts   # Noise Gate AudioWorklet code reference
│   └── popup/
│       ├── index.html          # Controller popup HTML
│       ├── style.css           # Modern dark-theme styles
│       ├── main.tsx            # React root renderer
│       └── Popup.tsx           # React UI and control sliders
├── public/
│   └── logo.svg                # Graphic logo asset
├── licenses/                   # Repository of open-source license templates
├── package.json                # Project configurations & dependencies
├── tsconfig.json               # TypeScript path & compiler settings
└── wxt.config.ts               # WXT settings & Manifest MV3 specifications
```

---

## 📦 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/tonderaikawere/kt-noise-cancellation-ext.git
   cd kt-noise-cancellation-ext
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server with Hot Module Replacement (HMR):
```bash
npm run dev
```

### Building for Production

Compile the extension bundle for production:
```bash
npm run build
```
The output will be generated inside the `.output/chrome-mv3` directory.

---

## 🔒 Privacy & Security

KT Noise Cancellation respects your privacy:
1. **No External Server Calls**: All audio processing remains local on the client.
2. **Zero Telemetry**: We do not collect analytical or user tracking data.
3. **Open-Source Compliance**: Includes multiple standard open-source licenses for development and integration.
