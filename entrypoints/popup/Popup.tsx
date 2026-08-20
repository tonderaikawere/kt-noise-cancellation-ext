import React, { useState, useEffect } from 'react';

export default function Popup() {
  const [enabled, setEnabled] = useState(false);
  const [noiseGate, setNoiseGate] = useState(50); 
  const [voiceBoost, setVoiceBoost] = useState(30); 
  const [volume, setVolume] = useState(100); 

  // Load saved state from local storage on mount
  useEffect(() => {
    browser.storage.local.get(['enabled', 'noiseGate', 'voiceBoost', 'volume']).then((res) => {
      if (res.enabled !== undefined) setEnabled(res.enabled);
      if (res.noiseGate !== undefined) setNoiseGate(res.noiseGate);
      if (res.voiceBoost !== undefined) setVoiceBoost(res.voiceBoost);
      if (res.volume !== undefined) setVolume(res.volume);
    }).catch(err => console.error('Error loading storage:', err));
  }, []);

  // Save changes to local storage and notify background when state changes
  useEffect(() => {
    browser.storage.local.set({ enabled, noiseGate, voiceBoost, volume })
      .then(() => {
        // Send message to background service worker
        browser.runtime.sendMessage({
          type: 'UPDATE_STATE',
          payload: { enabled, noiseGate, voiceBoost, volume }
        }).catch(err => console.warn('Background script not loaded yet:', err));
      })
      .catch(err => console.error('Error saving storage:', err));
  }, [enabled, noiseGate, voiceBoost, volume]);

  return (
    <div className="container">
      <div className="header">
        <svg className="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
          <rect width="128" height="128" rx="24" fill="#0F172A"/>
          <rect x="28" y="44" width="8" height="40" rx="4" fill="#3B82F6"/>
          <rect x="44" y="24" width="8" height="80" rx="4" fill="#3B82F6"/>
          <rect x="60" y="34" width="8" height="60" rx="4" fill="#60A5FA"/>
          <rect x="76" y="54" width="8" height="20" rx="4" fill="#EF4444"/>
          <rect x="92" y="40" width="8" height="48" rx="4" fill="#10B981"/>
          <line x1="20" y1="108" x2="108" y2="20" stroke="#EF4444" stroke-width="8" stroke-linecap="round" opacity="0.9"/>
        </svg>
        <div>
          <h1 className="title">KT Noise Control</h1>
          <p className="subtitle">by Kawerify Tech</p>
        </div>
      </div>

      <div className="control-panel">
        <div className="toggle-container">
          <span className="label">Active Noise Filter</span>
          <label className="switch">
            <input 
              type="checkbox" 
              checked={enabled} 
              onChange={(e) => setEnabled(e.target.checked)} 
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className={`status-badge ${enabled ? 'status-active' : 'status-inactive'}`}>
          <span className="dot"></span>
          <span>{enabled ? 'Filtering Active' : 'Filter Bypass'}</span>
        </div>
      </div>

      <div className="control-panel">
        <div className="range-container">
          <div className="range-header">
            <span>Noise Gate Threshold</span>
            <span>{noiseGate}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={noiseGate} 
            onChange={(e) => setNoiseGate(Number(e.target.value))} 
            disabled={!enabled}
          />
        </div>

        <div className="range-container">
          <div className="range-header">
            <span>Voice Presence Boost</span>
            <span>{voiceBoost}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={voiceBoost} 
            onChange={(e) => setVoiceBoost(Number(e.target.value))} 
            disabled={!enabled}
          />
        </div>

        <div className="range-container">
          <div className="range-header">
            <span>Output Level Booster</span>
            <span>{volume}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="200" 
            value={volume} 
            onChange={(e) => setVolume(Number(e.target.value))} 
            disabled={!enabled}
          />
        </div>
      </div>

      <canvas className="visualizer-canvas" id="visualizer"></canvas>
    </div>
  );
}
