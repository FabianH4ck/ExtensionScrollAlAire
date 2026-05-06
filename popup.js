let isActive = false;

// Wire up event listeners once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Button click
  document.getElementById('toggleBtn').addEventListener('click', toggleExtension);

  // Sensitivity slider
  document.getElementById('sensitivitySlider').addEventListener('input', (e) => {
    document.getElementById('sensitivityVal').textContent = e.target.value;
    chrome.storage.local.set({ sensitivity: parseInt(e.target.value) });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'UPDATE_SENSITIVITY',
          value: parseInt(e.target.value)
        }).catch(() => {});
      }
    });
  });

  // Zone slider
  document.getElementById('zoneSlider').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('zoneVal').textContent = val + '%';
    chrome.storage.local.set({ zoneSize: val });
    updateZonePreview(val);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'UPDATE_ZONE',
          value: val
        }).catch(() => {});
      }
    });
  });

  // Load saved state
  chrome.storage.local.get(['eyeScrollActive', 'sensitivity', 'zoneSize'], (data) => {
    if (data.eyeScrollActive) {
      isActive = true;
      updateUI(true);
    }
    if (data.sensitivity) {
      document.getElementById('sensitivitySlider').value = data.sensitivity;
      document.getElementById('sensitivityVal').textContent = data.sensitivity;
    }
    if (data.zoneSize) {
      document.getElementById('zoneSlider').value = data.zoneSize;
      document.getElementById('zoneVal').textContent = data.zoneSize + '%';
      updateZonePreview(data.zoneSize);
    }
  });
});

function toggleExtension() {
  isActive = !isActive;
  chrome.storage.local.set({ eyeScrollActive: isActive });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'TOGGLE_EYESCROLL',
        active: isActive
      }).catch(() => {});
    }
  });

  updateUI(isActive);
}

function updateUI(active) {
  const badge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const btn = document.getElementById('toggleBtn');
  const btnLabel = document.getElementById('btnLabel');
  const camIndicator = document.getElementById('camIndicator');
  const camText = document.getElementById('camText');

  if (active) {
    badge.classList.add('active');
    statusText.textContent = 'Activo — rastreando tu mirada';
    btn.classList.add('on');
    btnLabel.textContent = '⏹ Desactivar EyeScroll';
    camIndicator.classList.add('active');
    camText.textContent = 'Cámara encendida';
  } else {
    badge.classList.remove('active');
    statusText.textContent = 'Inactivo — haz clic para activar';
    btn.classList.remove('on');
    btnLabel.textContent = '👁 Activar EyeScroll';
    camIndicator.classList.remove('active');
    camText.textContent = 'Cámara apagada';
  }
}

function updateZonePreview(percent) {
  const top = document.getElementById('zoneTop');
  const bot = document.getElementById('zoneBot');
  if (top) top.style.height = percent + '%';
  if (bot) bot.style.height = percent + '%';
}
