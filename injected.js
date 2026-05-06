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

  function checkIsSnapPlatform() {
    const url = window.location.href;
    return (url.includes('youtube.com/shorts')) ||
           (url.includes('tiktok.com')) ||
           (url.includes('instagram.com/reel'));
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

  function navigateSnap(direction) {
    const isDown = direction === 'down';
    const amount = isDown ? window.innerHeight : -window.innerHeight;

    // Specific button fallback for YouTube Shorts (very reliable)
    if (window.location.hostname.includes('youtube.com') && window.location.pathname.includes('/shorts')) {
      const btnId = isDown ? 'navigation-button-down' : 'navigation-button-up';
      const btn = document.getElementById(btnId)?.querySelector('button') || document.getElementById(btnId);
      if (btn) {
        btn.click();
        return;
      }
    }

    // Universal DOM Scroll for TikTok, Reels, etc.
    const centerEl = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) || document.body;
    const scrollContainer = getScrollableParent(centerEl);
    
    // Perform smooth scroll, browser CSS scroll-snap will handle the rest
    if (scrollContainer.scrollBy) {
      scrollContainer.scrollBy({ top: amount, behavior: 'smooth' });
    } else {
      scrollContainer.scrollTop += amount;
    }
  }

  function handleGaze(gazeData) {
    if (!gazeData || !isActive) {
      window.postMessage({ source: 'eyescroll-injected', zone: 'neutral' }, '*');
      return;
    }
    
    const smoothY = smoothGaze(gazeData.y);
    const h = window.innerHeight;
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
      window.postMessage({ source: 'eyescroll-injected', zone: 'up' }, '*');
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
      window.postMessage({ source: 'eyescroll-injected', zone: 'down' }, '*');
    } else {
      window.postMessage({ source: 'eyescroll-injected', zone: 'neutral' }, '*');
    }
  }

  function onResults(results) {
    if (!isActive) return;
    
    const statusText = document.getElementById('eyescroll-status');
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      if (statusText) {
        statusText.textContent = '🟢 Mano detectada';
        statusText.style.background = 'rgba(52, 211, 153, 0.8)';
      }
      
      // Index finger tip (landmark 8)
      const indexFingerTip = results.multiHandLandmarks[0][8];
      
      // indexFingerTip.x and y are normalized [0.0, 1.0]
      const yPixels = indexFingerTip.y * window.innerHeight;
      
      const dot = document.getElementById('webgazerGazeDot');
      if (dot) {
        dot.style.display = 'block';
        dot.style.left = (indexFingerTip.x * window.innerWidth) + 'px';
        dot.style.top = yPixels + 'px';
      }

      handleGaze({ y: yPixels });
    } else {
      if (statusText) {
        statusText.textContent = '🔴 Buscando mano...';
        statusText.style.background = 'rgba(248, 113, 113, 0.8)';
      }
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
              width: 240px !important; height: 180px !important; /* Enlarged */
              opacity: 1.0 !important; border-radius: 12px !important;
              overflow: hidden !important; z-index: 2147483645 !important;
              border: 2px solid rgba(91,94,244,0.8) !important;
              box-shadow: 0 4px 15px rgba(0,0,0,0.5) !important;
              background: #000 !important;
            }
            #webgazerVideoFeed {
              transform: scaleX(-1) !important; /* Mirror video */
              pointer-events: none !important;
              width: 100% !important; height: 100% !important; object-fit: cover !important;
            }
            #eyescroll-status {
              position: absolute !important;
              top: 8px !important; left: 8px !important;
              padding: 4px 8px !important;
              border-radius: 6px !important;
              font-family: sans-serif !important; font-size: 11px !important;
              color: white !important; font-weight: bold !important;
              background: rgba(248, 113, 113, 0.8) !important;
              z-index: 2147483646 !important;
            }
            #webgazerGazeDot { 
              position: fixed !important;
              background: #5b5ef4 !important; 
              border: 2px solid white !important; 
              box-shadow: 0 0 10px rgba(91,94,244,0.8) !important; 
              width: 14px !important; height: 14px !important; 
              margin-left: -7px !important; margin-top: -7px !important;
              opacity: 0.8 !important;
              border-radius: 50% !important;
              pointer-events: none !important;
              z-index: 2147483647 !important;
              transition: left 0.1s, top 0.1s !important;
            }
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
          statusText.textContent = 'Iniciando cámara...';
          
          vc.appendChild(videoEl);
          vc.appendChild(statusText);

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
                  // Limit message length so it fits
                  st.textContent = '❌ ' + (e.message || 'Error').substring(0, 35);
                  st.style.background = 'rgba(248, 113, 113, 0.8)';
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
