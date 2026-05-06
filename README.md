# 👁 AirScrollTikTok — Chrome Extension

Scroll TikTok, YouTube Shorts, and Instagram using only your eyes.

---

## 🚀 How to install (Developer mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top right)
3. Click **"Load unpacked"**
4. Select the `eye-scroll-extension` folder
5. The AirScrollTikTok icon will appear in your toolbar

---

## 🎯 How it works

The extension uses **WebGazer.js** (Brown University) — a JavaScript eye-tracking library that works with any standard webcam.

- **Look at the top 25%** of the screen → scroll up
- **Look at the bottom 25%** of the screen → scroll down
- **Look in the middle** → no scroll (neutral zone)

The sensitivity and zone size are adjustable from the popup.

---

## 📋 Supported sites

| Site | URL |
|------|-----|
| YouTube | youtube.com |
| TikTok | tiktok.com |
| Instagram | instagram.com |

---

## ⚙️ Settings

| Setting | Description |
|---------|-------------|
| Scroll sensitivity | How fast scrolling accelerates (1–10) |
| Trigger zone | % of screen height that activates scrolling (10–40%) |

---

## 🔧 Tech stack

- **Manifest V3** Chrome Extension
- **WebGazer.js** — webcam eye tracking (loaded from CDN)
- **MediaPipe** (via WebGazer) — facial landmark detection
- No backend, no data sent anywhere — 100% local

---

## ⚠️ Notes

- First activation will ask for **camera permission** — this is required
- WebGazer takes ~2–3 seconds to initialize
- For best results: good lighting, face the camera directly
- The small camera preview in the bottom-left is WebGazer's feed (intentional)

---

## 🗺 Roadmap ideas

- [ ] Dwell-to-click (look at something for 1s to click it)
- [ ] Blink detection to pause/resume
- [ ] Custom calibration screen
- [ ] Support for more sites (Twitter/X, Reddit)
- [ ] Mobile PWA version using phone front camera
