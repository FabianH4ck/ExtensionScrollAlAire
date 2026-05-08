/**
 * ScrollSense - Content Script (isolated world)
 * Injects mediapipe + injected.js into the PAGE context,
 * then communicates with injected.js via postMessage.
 */

let isActive = false;
let sensitivity = 5;
let zoneSize = 25;
let injectedReady = false;

// ─── Overlay UI ────────────────────────────────────────────────────────────
let overlay = null;

function createOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.id = 'eyescroll-overlay';
  overlay.innerHTML = `
    <style>
      #eyescroll-overlay {
        position: fixed; top: 16px; right: 16px;
        z-index: 2147483647; pointer-events: none;
      }
      .es-pill {
        background: rgba(8,8,15,0.88);
        border: 1px solid rgba(91,94,244,0.4);
        border-radius: 20px; padding: 6px 14px;
        font-family: system-ui, sans-serif; font-size: 12px; color: #e8e8f0;
        backdrop-filter: blur(8px); display: flex; align-items: center; gap: 7px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      }
      .es-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: #5b5ef4; box-shadow: 0 0 6px rgba(91,94,244,0.8);
        animation: es-pulse 2s ease infinite; flex-shrink: 0;
      }
      @keyframes es-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      .es-zone-indicator { font-size: 11px; color: #a78bfa; font-weight: 600; }
      .es-zone-up   { color: #5b5ef4 !important; }
      .es-zone-down { color: #f87171 !important; }
      .es-bar {
        position: fixed; left: 0; right: 0; height: 3px;
        z-index: 2147483646; pointer-events: none;
      }
      #es-bar-top { top: 0; background: linear-gradient(90deg,transparent,rgba(91,94,244,0.6),transparent); }
      #es-bar-bottom { bottom: 0; background: linear-gradient(90deg,transparent,rgba(248,113,113,0.6),transparent); }
    </style>
    <div class="es-pill">
      <div class="es-dot"></div>
      <span>ScrollSense</span>
      <span class="es-zone-indicator" id="es-zone-label">— cargando...</span>
    </div>
  `;
  const barTop = document.createElement('div');
  barTop.className = 'es-bar'; barTop.id = 'es-bar-top';
  const barBot = document.createElement('div');
  barBot.className = 'es-bar'; barBot.id = 'es-bar-bottom';
  document.body.appendChild(overlay);
  document.body.appendChild(barTop);
  document.body.appendChild(barBot);
}

function removeOverlay() {
  overlay?.remove(); overlay = null;
  document.getElementById('es-bar-top')?.remove();
  document.getElementById('es-bar-bottom')?.remove();
}

function setZoneLabel(label, type) {
  const el = document.getElementById('es-zone-label');
  if (!el) return;
  el.textContent = label;
  el.className = 'es-zone-indicator';
  if (type === 'up') el.classList.add('es-zone-up');
  if (type === 'down') el.classList.add('es-zone-down');
}

// ─── Script injection into PAGE context ────────────────────────────────────
function injectScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => { s.remove(); resolve(); };
    s.onerror = () => { s.remove(); reject(new Error('Failed to load: ' + url)); };
    (document.head || document.documentElement).appendChild(s);
  });
}

// ─── Listen to messages from injected.js ───────────────────────────────────
window.addEventListener('message', (e) => {
  if (!e.data || e.data.source !== 'eyescroll-injected') return;
  const msg = e.data;

  if (msg.status === 'ready') {
    injectedReady = true;
    // If we were waiting to start, send start now
    if (isActive) sendToInjected({ type: 'START', sensitivity, zoneSize, mediapipePath: chrome.runtime.getURL('mediapipe/hands/') });
  }
  if (msg.status === 'started') {
    setZoneLabel('● observando', null);
  }
  if (msg.error) {
    setZoneLabel('⚠ ' + msg.error.substring(0, 30), null);
    console.error('[AirScrollTikTok] injected error:', msg.error);
  }
  if (msg.zone === 'up') setZoneLabel('↑ desplazando arriba', 'up');
  if (msg.zone === 'down') setZoneLabel('↓ desplazando abajo', 'down');
  if (msg.zone === 'neutral') setZoneLabel('● observando', null);
});

function sendToInjected(msg) {
  window.postMessage({ source: 'eyescroll-content', ...msg }, '*');
}

// ─── Main start / stop ─────────────────────────────────────────────────────
async function startEyeScroll() {
  createOverlay();
  setZoneLabel('— cargando...', null);

  try {
    const mediapipePath = chrome.runtime.getURL('mediapipe/hands/');

    if (!injectedReady) {
      setZoneLabel('— cargando IA...', null);

      // Paso 1: registrar política TrustedTypes ANTES de MediaPipe
      // (necesario en YouTube, que aplica require-trusted-types-for 'script')
      await injectScript(chrome.runtime.getURL('trustedtypes.js'));

      // Paso 2: cargar MediaPipe en el contexto de la página
      await injectScript(chrome.runtime.getURL('mediapipe/camera_utils/camera_utils.js'));
      await injectScript(chrome.runtime.getURL('mediapipe/hands/hands.js'));

      // Paso 3: cargar injected.js (puente de mensajes)
      // injected.js enviará postMessage 'ready' de vuelta
      await injectScript(chrome.runtime.getURL('injected.js'));
    } else {
      sendToInjected({ type: 'START', sensitivity, zoneSize, mediapipePath });
    }
  } catch (err) {
    setZoneLabel('⚠ ' + err.message.substring(0, 30), null);
    console.error('[AirScrollTikTok]', err);
  }
}

function stopEyeScroll() {
  sendToInjected({ type: 'STOP' });
  removeOverlay();
}

// ─── Message listener from popup ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOGGLE_EYESCROLL') {
    isActive = msg.active;
    if (isActive) startEyeScroll();
    else stopEyeScroll();
  }
  if (msg.type === 'UPDATE_SENSITIVITY') {
    sensitivity = msg.value;
    sendToInjected({ type: 'UPDATE_SENSITIVITY', value: msg.value });
  }
  if (msg.type === 'UPDATE_ZONE') {
    zoneSize = msg.value;
    sendToInjected({ type: 'UPDATE_ZONE', value: msg.value });
  }
});

// ── FIX 3: Restaurar estado solo en páginas de contenido relevantes ──────────
// Evita que la cámara arranque en /watch, /feed u otras páginas genéricas
// de YouTube e Instagram donde el scroll snap no tiene sentido.
chrome.storage.local.get(['eyeScrollActive', 'sensitivity', 'zoneSize'], (data) => {
  if (data.sensitivity) sensitivity = data.sensitivity;
  if (data.zoneSize) zoneSize = data.zoneSize;
  if (data.eyeScrollActive) {
    const url = window.location.href;
    const isRelevantPage =
      url.includes('youtube.com/shorts') ||
      url.includes('tiktok.com') ||
      url.includes('instagram.com/reels') ||
      url.includes('instagram.com/reel/');
    if (isRelevantPage) {
      isActive = true;
      startEyeScroll();
    }
  }
});
