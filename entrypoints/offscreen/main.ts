console.log('KT Offscreen Audio Sandbox loaded.');

// Listen for direct messages from the background script or popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Offscreen sandbox received message:', message);
  if (message.type === 'OFFSCREEN_STATE_CHANGE') {
    handleStateChange(message.payload);
  }
  return true;
});

function handleStateChange(payload: { enabled: boolean; noiseGate: number; voiceBoost: number; volume: number }) {
  console.log('Syncing processing settings in offscreen:', payload);
  // We will wire up audio parameters in subsequent steps
}
