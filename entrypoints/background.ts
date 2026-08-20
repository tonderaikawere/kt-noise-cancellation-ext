import { defineBackground } from 'wxt/sandbox';

let isCreatingOffscreen = false;

export default defineBackground(() => {
  console.log('KT Noise Cancellation background worker initialized.');

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_STATE') {
      handleStateUpdate(message.payload);
    }
    return true; 
  });
});

async function handleStateUpdate(payload: { enabled: boolean; noiseGate: number; voiceBoost: number; volume: number }) {
  const { enabled } = payload;
  const hasOffscreen = await hasOffscreenDocument();

  if (enabled) {
    // Check if browser supports offscreen (not supported on Firefox / Safari)
    // @ts-ignore
    const isSupported = typeof chrome !== 'undefined' && chrome.offscreen && chrome.tabCapture;
    if (!isSupported) {
      console.warn('Offscreen document or tab capture is not supported on this browser context.');
      // Handle fallback directly or message popup
      return;
    }

    if (!hasOffscreen && !isCreatingOffscreen) {
      isCreatingOffscreen = true;
      try {
        await setupOffscreenDocument();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await captureAndForwardStream();
      } catch (err) {
        console.error('Failed to setup offscreen audio capture:', err);
      } finally {
        isCreatingOffscreen = false;
      }
    }
    
    await browser.runtime.sendMessage({
      type: 'OFFSCREEN_STATE_CHANGE',
      payload
    }).catch((err) => {
      console.warn('Sync delayed, waiting for offscreen document initialization.', err);
    });
  } else {
    if (hasOffscreen) {
      await closeOffscreenDocument();
    }
  }
}

async function captureAndForwardStream() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    console.error('No active tab found to capture audio.');
    return;
  }

  // @ts-ignore
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tab.id,
    consumerTabId: tab.id 
  });

  console.log('Obtained tab audio stream ID:', streamId);

  await browser.runtime.sendMessage({
    type: 'START_CAPTURE',
    streamId
  }).catch(err => console.error('Failed to send stream ID to offscreen:', err));
}

async function hasOffscreenDocument(): Promise<boolean> {
  // @ts-ignore
  if (typeof chrome !== 'undefined' && chrome.runtime && 'getContexts' in chrome.runtime) {
    // @ts-ignore
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
    });
    return contexts.length > 0;
  }
  return false;
}

async function setupOffscreenDocument() {
  // @ts-ignore
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    // @ts-ignore
    await chrome.offscreen.createDocument({
      url: 'entrypoints/offscreen/index.html',
      // @ts-ignore
      reasons: ['USER_MEDIA'],
      justification: 'KT Noise Cancellation processes live audio streams locally inside a sandboxed offscreen document.',
    });
    console.log('Offscreen document created.');
  }
}

async function closeOffscreenDocument() {
  // @ts-ignore
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    // @ts-ignore
    await chrome.offscreen.closeDocument();
    console.log('Offscreen document closed.');
  }
}
