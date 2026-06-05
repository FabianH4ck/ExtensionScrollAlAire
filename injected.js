/**
 * AirScrollTikTok - injected.js
 * Runs in PAGE context (not isolated), so window.Hands is accessible.
 * Communicates with content.js via postMessage.
 */

(function() {
  let isActive = false;
  let sensitivity = 5;
  let zoneSize = 25;
  let gazeSmooth = [];
  const SMOOTH_FRAMES = 8;

  let hands = null;
  let camera = null;

  function smoothGaze(y) {
    gazeSmooth.push(y);
    if (gazeSmooth.length > SMOOTH_FRAMES) gazeSmooth.shift();
    return gazeSmooth.reduce((a, b) => a + b, 0) / gazeSmooth.length;
  }

  // ── FIX 1: Corregida URL de Instagram Reels (era /reel, es /reels) ──────────
  function checkIsSnapPlatform() {
    const url = window.location.href;
    return (url.includes('youtube.com/shorts')) ||
           (url.includes('tiktok.com')) ||
           (url.includes('instagram.com/reels') || url.includes('instagram.com/reel/'));
  }

  let lastSnapTime = 0;

  function getScrollableParent(node) {
    if (node == null || node === document.body || node === document.documentElement) {
      return document.scrollingElement || window;
    }
    const style = window.getComputedStyle(node);
    if (node.scrollHeight > node.clientHeight &&
       (style.overflowY === 'scroll' || style.overflowY === 'auto' || style.overflowY === 'overlay')) {
      return node;
    }
    return getScrollableParent(node.parentNode);
  }

  // ── FIX 2: navigateSnap con 3 estrategias para YouTube Shorts ───────────────
  function navigateSnap(direction) {
    const isDown = direction === 'down';
    const amount = isDown ? window.innerHeight : -window.innerHeight;

    // ── YouTube Shorts ────────────────────────────────────────────────────────
    if (window.location.hostname.includes('youtube.com') && window.location.pathname.includes('/shorts')) {

      // Estrategia 1: múltiples selectores CSS (cubre distintas versiones de YT)
      const candidates = isDown
        ? [
            '#navigation-button-down button',
            '#navigation-button-down',
            'ytd-shorts [aria-label="Next video"]',
            'ytd-shorts [aria-label="Siguiente video"]',
            'ytd-shorts [aria-label="Vídeo siguiente"]',
            'ytd-shorts-video-header-renderer [aria-label*="next" i]',
            'ytd-shorts-video-header-renderer [aria-label*="siguiente" i]',
            '.ytd-shorts [title*="next" i]',
          ]
        : [
            '#navigation-button-up button',
            '#navigation-button-up',
            'ytd-shorts [aria-label="Previous video"]',
            'ytd-shorts [aria-label="Video anterior"]',
            'ytd-shorts [aria-label="Vídeo anterior"]',
            'ytd-shorts-video-header-renderer [aria-label*="previous" i]',
            'ytd-shorts-video-header-renderer [aria-label*="anterior" i]',
            '.ytd-shorts [title*="previous" i]',
          ];

      for (const sel of candidates) {
        try {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
            return;
          }
        } catch (_) {}
      }

      // Estrategia 2: scroll directo sobre el contenedor ytd-shorts
      const shortsPlayer = document.querySelector('ytd-shorts') ||
                           document.querySelector('ytd-reel-player-overlay-renderer') ||
                           document.querySelector('#shorts-player');
      if (shortsPlayer) {
        shortsPlayer.scrollBy({ top: amount, behavior: 'smooth' });
        return;
      }

      // Estrategia 3 (fallback garantizado): simular tecla ArrowDown / ArrowUp
      // YouTube Shorts escucha eventos de teclado a nivel del documento y del player
      const activeEl = document.activeElement;
      const targetEl = document.querySelector('ytd-shorts, #shorts-player, body') || document.body;
      targetEl.focus({ preventScroll: true });

      const keyEvent = {
        key: isDown ? 'ArrowDown' : 'ArrowUp',
        keyCode: isDown ? 40 : 38,
        which: isDown ? 40 : 38,
        code: isDown ? 'ArrowDown' : 'ArrowUp',
        bubbles: true,
        cancelable: true,
        composed: true
      };

      targetEl.dispatchEvent(new KeyboardEvent('keydown', keyEvent));
      document.dispatchEvent(new KeyboardEvent('keydown', keyEvent));

      // Restaurar el foco original para no interferir con el usuario
      if (activeEl && activeEl !== targetEl) {
        activeEl.focus({ preventScroll: true });
      }
      return;
    }

    // ── TikTok / Instagram Reels (scroll container DOM) ───────────────────────
    const centerEl = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) || document.body;
    const scrollContainer = getScrollableParent(centerEl);

    if (scrollContainer.scrollBy) {
      scrollContainer.scrollBy({ top: amount, behavior: 'smooth' });
    } else {
      scrollContainer.scrollTop += amount;
    }
  }

  function handleGaze(gazeData) {
    if (!gazeData || !isActive) {
      window.postMessage({ source: 'eyescroll-injected', zone: 'neutral', yPercent: -1, handDetected: false }, '*');
      return;
    }

    const smoothY = smoothGaze(gazeData.y);
    const h = window.innerHeight;
    const yPercent = (smoothY / h) * 100;
    const topZone = h * (zoneSize / 100);
    const botZone = h * (1 - zoneSize / 100);
    const speed = 1 + (sensitivity / 10) * 5;

    if (smoothY < topZone) {
      if (checkIsSnapPlatform()) {
        const now = Date.now();
        if (now - lastSnapTime > 1500) {
          navigateSnap('up');
          lastSnapTime = now;
        }
      } else {
        const amount = -speed * ((topZone - smoothY) / topZone);
        window.scrollBy({ top: amount * 8, behavior: 'auto' });
      }
      window.postMessage({ source: 'eyescroll-injected', zone: 'up', yPercent, handDetected: true }, '*');
    } else if (smoothY > botZone) {
      if (checkIsSnapPlatform()) {
        const now = Date.now();
        if (now - lastSnapTime > 1500) {
          navigateSnap('down');
          lastSnapTime = now;
        }
      } else {
        const amount = speed * ((smoothY - botZone) / (h - botZone));
        window.scrollBy({ top: amount * 8, behavior: 'auto' });
      }
      window.postMessage({ source: 'eyescroll-injected', zone: 'down', yPercent, handDetected: true }, '*');
    } else {
      window.postMessage({ source: 'eyescroll-injected', zone: 'neutral', yPercent, handDetected: true }, '*');
    }
  }

  function updateCamGauge(yPercent, zone, handDetected) {
    const gaugeH = 140;
    const marker = document.getElementById('es-cam-marker');
    const zoneTop = document.getElementById('es-cam-zone-top');
    const zoneBot = document.getElementById('es-cam-zone-bot');
    const pctLabel = document.getElementById('es-cam-pct');
    const vc = document.getElementById('webgazerVideoContainer');

    if (zoneTop) zoneTop.style.height = zoneSize + '%';
    if (zoneBot) zoneBot.style.height = zoneSize + '%';

    if (vc) {
      vc.classList.remove('zone-up', 'zone-down');
      if (zone === 'up') vc.classList.add('zone-up');
      if (zone === 'down') vc.classList.add('zone-down');
    }

    if (marker) {
      if (handDetected && yPercent >= 0) {
        const pos = (yPercent / 100) * gaugeH;
        marker.style.top = pos + 'px';
        marker.className = 'visible';
        if (zone === 'up') marker.classList.add('in-top');
        else if (zone === 'down') marker.classList.add('in-bot');
      } else {
        marker.className = '';
      }
    }

    if (pctLabel) {
      if (handDetected && yPercent >= 0) {
        pctLabel.textContent = Math.round(yPercent) + '%';
        pctLabel.classList.add('visible');
      } else {
        pctLabel.classList.remove('visible');
      }
    }
  }

  function onResults(results) {
    if (!isActive) return;

    const statusText = document.getElementById('eyescroll-status');

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        if (statusText) {
          statusText.textContent = 'Mano detectada';
          statusText.style.background = 'rgba(94, 234, 212, 0.7)';
        }

      // Index finger tip (landmark 8)
      const indexFingerTip = results.multiHandLandmarks[0][8];

      // indexFingerTip.x and y are normalized [0.0, 1.0]
      const yPixels = indexFingerTip.y * window.innerHeight;
      const yPercent = (yPixels / window.innerHeight) * 100;

      // Determine zone for gauge feedback
      const topZone = window.innerHeight * (zoneSize / 100);
      const botZone = window.innerHeight * (1 - zoneSize / 100);
      let zone = 'neutral';
      if (yPixels < topZone) zone = 'up';
      else if (yPixels > botZone) zone = 'down';
      updateCamGauge(yPercent, zone, true);

      const dot = document.getElementById('webgazerGazeDot');
      if (dot) {
        dot.style.display = 'block';
        dot.style.left = (indexFingerTip.x * window.innerWidth) + 'px';
        dot.style.top = yPixels + 'px';
      }

      handleGaze({ y: yPixels });
    } else {
      if (statusText) {
          statusText.textContent = 'Buscando mano...';
          statusText.style.background = 'rgba(244, 114, 182, 0.5)';
        }
      updateCamGauge(-1, 'neutral', false);
      const dot = document.getElementById('webgazerGazeDot');
      if (dot) dot.style.display = 'none';
      handleGaze(null);
    }
  }

  function startWebGazer() {
    if (!window.Hands) {
      window.postMessage({ source: 'eyescroll-injected', error: 'Hands not found on window' }, '*');
      return;
    }

    try {
      if (!hands) {
        if (!document.getElementById('eyescroll-camera-style')) {
          const style = document.createElement('style');
          style.id = 'eyescroll-camera-style';
          style.textContent = `
              #webgazerVideoContainer {
                position: fixed !important;
                bottom: 16px !important; left: 16px !important; top: auto !important; right: auto !important;
                width: 240px !important; height: 180px !important;
                opacity: 1.0 !important; border-radius: 12px !important;
                overflow: hidden !important; z-index: 2147483645 !important;
                border: 2px solid rgba(94,234,212,0.6) !important;
                box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 30px rgba(94,234,212,0.08) !important;
                background: #05050C !important;
                transition: border-color 0.2s, box-shadow 0.2s;
              }
              #webgazerVideoContainer.zone-up {
                border-color: rgba(94,234,212,1) !important;
                box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 40px rgba(94,234,212,0.5) !important;
              }
              #webgazerVideoContainer.zone-down {
                border-color: rgba(244,114,182,1) !important;
                box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 40px rgba(244,114,182,0.5) !important;
              }
            #webgazerVideoFeed {
              transform: scaleX(-1) !important;
              pointer-events: none !important;
              width: 100% !important; height: 100% !important; object-fit: cover !important;
            }
            #eyescroll-status {
                position: absolute !important;
                top: 8px !important; left: 8px !important;
                padding: 3px 8px !important;
                border-radius: 999px !important;
                font-family: 'Sora', system-ui, sans-serif !important; font-size: 10px !important;
                color: white !important; font-weight: 600 !important;
                background: rgba(244, 114, 182, 0.7) !important;
                backdrop-filter: blur(4px) !important;
                z-index: 2147483646 !important;
                letter-spacing: 0.02em !important;
                transition: background 0.2s;
              }

              /* ── In-camera gauge ──────────────────────── */
              #es-cam-gauge {
                position: absolute !important;
                right: 6px !important; top: 50% !important;
                transform: translateY(-50%) !important;
                width: 4px; height: 140px;
                border-radius: 999px;
                background: rgba(255,255,255,0.08);
                overflow: visible;
                z-index: 10;
              }
              .es-cam-zone {
                position: absolute; left: 0; right: 0;
                border-radius: 999px;
                transition: height 0.25s;
              }
              .es-cam-zone-top {
                top: 0;
                background: rgba(94,234,212,0.35);
                border: 1px solid rgba(94,234,212,0.3);
              }
              .es-cam-zone-bot {
                bottom: 0;
                background: rgba(244,114,182,0.35);
                border: 1px solid rgba(244,114,182,0.3);
              }
              #es-cam-marker {
                position: absolute !important;
                left: 50% !important;
                width: 12px; height: 12px;
                margin-left: -6px !important; margin-top: -6px !important;
                border-radius: 50%;
                background: #5EEAD4;
                border: 2px solid #05050C;
                box-shadow: 0 0 10px rgba(94,234,212,0.9);
                transition: top 0.1s ease, opacity 0.3s, background 0.15s, box-shadow 0.15s;
                opacity: 0;
                z-index: 11;
              }
              #es-cam-marker.visible { opacity: 1; }
              #es-cam-marker.in-top { background: #5EEAD4; box-shadow: 0 0 16px rgba(94,234,212,1); }
              #es-cam-marker.in-bot { background: #F472B6; box-shadow: 0 0 16px rgba(244,114,182,1); }

              #es-cam-pct {
                position: absolute !important;
                bottom: 6px !important; right: 6px !important;
                font-family: 'Sora', system-ui, sans-serif !important;
                font-size: 9px !important;
                font-weight: 700 !important;
                color: #EEEFFC !important;
                background: rgba(5,5,12,0.75) !important;
                padding: 2px 6px !important;
                border-radius: 6px !important;
                backdrop-filter: blur(4px) !important;
                z-index: 11;
                opacity: 0;
                transition: opacity 0.2s;
                letter-spacing: 0.04em;
              }
              #es-cam-pct.visible { opacity: 1; }
          `;
          document.head.appendChild(style);
        }

        let vc = document.getElementById('webgazerVideoContainer');
        let videoEl;
        if (!vc) {
          vc = document.createElement('div');
          vc.id = 'webgazerVideoContainer';

          videoEl = document.createElement('video');
          videoEl.id = 'webgazerVideoFeed';
          videoEl.autoplay = true;
          videoEl.playsInline = true;

          const statusText = document.createElement('div');
          statusText.id = 'eyescroll-status';
          statusText.textContent = 'Iniciando camara...';

          // In-camera gauge
          const gauge = document.createElement('div');
          gauge.id = 'es-cam-gauge';
          const zoneTop = document.createElement('div');
          zoneTop.className = 'es-cam-zone es-cam-zone-top';
          zoneTop.id = 'es-cam-zone-top';
          const zoneBot = document.createElement('div');
          zoneBot.className = 'es-cam-zone es-cam-zone-bot';
          zoneBot.id = 'es-cam-zone-bot';
          const marker = document.createElement('div');
          marker.id = 'es-cam-marker';
          gauge.appendChild(zoneTop);
          gauge.appendChild(zoneBot);
          gauge.appendChild(marker);

          // Position percentage label
          const pctLabel = document.createElement('div');
          pctLabel.id = 'es-cam-pct';
          pctLabel.textContent = '0%';

          vc.appendChild(videoEl);
          vc.appendChild(statusText);
          vc.appendChild(gauge);
          vc.appendChild(pctLabel);

          const dot = document.createElement('div');
          dot.id = 'webgazerGazeDot';
          dot.style.display = 'none';
          document.body.appendChild(dot);
          document.body.appendChild(vc);
        } else {
          videoEl = document.getElementById('webgazerVideoFeed');
        }

        hands = new window.Hands({locateFile: (file) => {
          return window.__eyescroll_mediapipe + file;
        }});
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        hands.onResults(onResults);

        camera = new window.Camera(videoEl, {
          onFrame: async () => {
            if (isActive && hands && videoEl.videoWidth > 0) {
              try {
                await hands.send({image: videoEl});
              } catch (e) {
                const st = document.getElementById('eyescroll-status');
                if (st) {
                  st.textContent = (e.message || 'Error').substring(0, 35);
                  st.style.background = 'rgba(244, 114, 182, 0.7)';
                }
                console.error('Hands AI Error:', e);
              }
            }
          },
          width: 640,
          height: 480
        });
      }

      camera.start();
      window.postMessage({ source: 'eyescroll-injected', status: 'started' }, '*');

    } catch(e) {
      window.postMessage({ source: 'eyescroll-injected', error: e.message }, '*');
    }
  }

  function stopWebGazer() {
    isActive = false;
    try {
      if (camera) camera.stop();
      if (hands) hands.close();
    } catch(e) {}
    gazeSmooth = [];
    document.getElementById('webgazerGazeDot')?.remove();
    document.getElementById('webgazerVideoContainer')?.remove();
    hands = null;
    camera = null;
  }

  // Listen for commands from content.js
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.source !== 'eyescroll-content') return;
    const msg = e.data;
    if (msg.type === 'START') {
      isActive = true;
      sensitivity = msg.sensitivity || 5;
      zoneSize = msg.zoneSize || 25;
      if (msg.mediapipePath) {
        window.__eyescroll_mediapipe = msg.mediapipePath;
      }
      startWebGazer();
    }
    if (msg.type === 'STOP') {
      stopWebGazer();
    }
    if (msg.type === 'UPDATE_SENSITIVITY') sensitivity = msg.value;
    if (msg.type === 'UPDATE_ZONE') zoneSize = msg.value;
    if (msg.type === 'SET_ACTIVE') isActive = msg.value;
  });

  window.postMessage({ source: 'eyescroll-injected', status: 'ready' }, '*');
})();
