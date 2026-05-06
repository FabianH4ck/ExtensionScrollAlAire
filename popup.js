let isActive = false;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('toggleBtn').addEventListener('click', toggleExtension);

  document.getElementById('sensitivitySlider').addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    document.getElementById('sensitivityVal').textContent = value;
    chrome.storage.local.set({ sensitivity: value });
    sendToActiveTab({ type: 'UPDATE_SENSITIVITY', value });
  });

  document.getElementById('zoneSlider').addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    document.getElementById('zoneVal').textContent = value + '%';
    chrome.storage.local.set({ zoneSize: value });
    updateZonePreview(value);
    sendToActiveTab({ type: 'UPDATE_ZONE', value });
  });

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

function sendToActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
  });
}

function toggleExtension() {
  isActive = !isActive;
  chrome.storage.local.set({ eyeScrollActive: isActive });
  sendToActiveTab({ type: 'TOGGLE_EYESCROLL', active: isActive });
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
    statusText.textContent = 'Activo - siguiendo tu dedo';
    btn.classList.add('on');
    btnLabel.textContent = 'Desactivar control por dedo';
    camIndicator.classList.add('active');
    camText.textContent = 'Camara encendida';
  } else {
    badge.classList.remove('active');
    statusText.textContent = 'Inactivo - activa el seguimiento';
    btn.classList.remove('on');
    btnLabel.textContent = 'Activar control por dedo';
    camIndicator.classList.remove('active');
    camText.textContent = 'Camara apagada';
  }
}

function updateZonePreview(percent) {
  const top = document.getElementById('zoneTop');
  const bot = document.getElementById('zoneBot');
  if (top) top.style.height = percent + '%';
  if (bot) bot.style.height = percent + '%';
}
