import { defineBackground } from 'wxt/sandbox';

export default defineBackground(() => {
  console.log('KT Noise Cancellation background worker initialized.');

  // Handle messages from Popup or Offscreen
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    if (message.type === 'UPDATE_STATE') {
      handleStateUpdate(message.payload);
    }
    return true; // Keep message channel open for async responses
  });
});

async function handleStateUpdate(payload: { enabled: boolean; noiseGate: number; voiceBoost: number; volume: number }) {
  const { enabled } = payload;
  const hasOffscreen = await hasOffscreenDocument();

  if (enabled) {
    if (!hasOffscreen) {
      await setupOffscreenDocument();
    }
    // Forward state payload to offscreen document
    await browser.runtime.sendMessage({
      type: 'OFFSCREEN_STATE_CHANGE',
      payload
    }).catch((err) => {
      console.log('Offscreen not fully ready, state will sync on creation.', err);
    });
  } else {
    if (hasOffscreen) {
      await closeOffscreenDocument();
    }
  }
}

// Check if offscreen document is already open
async function hasOffscreenDocument(): Promise<boolean> {
  // @ts-ignore
  if ('getContexts' in chrome.runtime) {
    // @ts-ignore
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });
    return contexts.length > 0;
  } else {
    // Fallback: WXT offscreen check or query tabs
    // @ts-ignore
    const clients = await clients.matchAll();
    return clients.some((client: any) => client.url.includes('offscreen'));
  }
}

// Create offscreen document
async function setupOffscreenDocument() {
  // Guard against concurrent creations
  // @ts-ignore
  if (chrome.offscreen) {
    // @ts-ignore
    await chrome.offscreen.createDocument({
      url: 'entrypoints/offscreen/index.html',
      // @ts-ignore
      reasons: ['USER_MEDIA'],
      justification: 'KT Noise Cancellation needs to process captured browser tab audio in the background.',
    });
    console.log('Offscreen document created successfully.');
  }
}

// Close offscreen document
async function closeOffscreenDocument() {
  // @ts-ignore
  if (chrome.offscreen) {
    // @ts-ignore
    await chrome.offscreen.closeDocument();
    console.log('Offscreen document closed.');
  }
}
