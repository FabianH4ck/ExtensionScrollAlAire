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
        background: rgba(5,5,12,0.92);
        border: 1px solid rgba(94,234,212,0.25);
        border-radius: 999px; padding: 6px 14px;
        font-family: 'Sora', system-ui, sans-serif; font-size: 11px; color: #eeeefc;
        backdrop-filter: blur(12px); display: flex; align-items: center; gap: 7px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      }
      .es-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: #8888aa; flex-shrink: 0;
        transition: all 0.3s;
      }
      .es-dot.active {
        background: #5EEAD4;
        box-shadow: 0 0 10px rgba(94,234,212,0.8);
        animation: es-pulse 2s ease-in-out infinite;
      }
      @keyframes es-pulse { 0%,100%{opacity:1;box-shadow:0 0 8px rgba(94,234,212,0.6)} 50%{opacity:0.5;box-shadow:0 0 20px rgba(94,234,212,0.9)} }
      .es-zone-indicator { font-size: 10px; color: #8888aa; font-weight: 600; letter-spacing:0.02em; }
      .es-zone-up   { color: #5EEAD4 !important; }
      .es-zone-down { color: #F472B6 !important; }

      /* ── Zone bars ─────────────────────────────────────── */
      .es-bar {
        position: fixed; left: 0; right: 0; z-index: 2147483646;
        pointer-events: none; transition: all 0.15s ease;
      }
      #es-bar-top {
        top: 0; height: 3px;
        background: linear-gradient(90deg,transparent,rgba(94,234,212,0.4),transparent);
        box-shadow: 0 0 0 transparent;
      }
      #es-bar-top.active {
        height: 5px;
        background: linear-gradient(90deg,transparent,rgba(94,234,212,0.8),transparent);
        box-shadow: 0 2px 20px rgba(94,234,212,0.15);
      }
      #es-bar-bottom {
        bottom: 0; height: 3px;
        background: linear-gradient(90deg,transparent,rgba(244,114,182,0.4),transparent);
        box-shadow: 0 0 0 transparent;
      }
      #es-bar-bottom.active {
        height: 5px;
        background: linear-gradient(90deg,transparent,rgba(244,114,182,0.8),transparent);
        box-shadow: 0 -2px 20px rgba(244,114,182,0.15);
      }
    </style>
    <div class="es-pill">
      <div class="es-dot" id="es-dot"></div>
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
  if (msg.zone === 'up') {
    setZoneLabel('↑ arriba', 'up');
  }
  if (msg.zone === 'down') {
    setZoneLabel('↓ abajo', 'down');
  }
  if (msg.zone === 'neutral') {
    if (msg.handDetected) {
      setZoneLabel('● neutro', null);
    } else {
      setZoneLabel('— sin mano', null);
    }
  }
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
