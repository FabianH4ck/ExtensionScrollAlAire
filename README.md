# ScrollSense — Extensión de Chrome

Navega por TikTok, YouTube Shorts e Instagram Reels moviendo el **dedo índice** frente a la cámara.

---

## Instalación (Modo desarrollador)

1. Abre Chrome y ve a `chrome://extensions`
2. Activa el **Modo desarrollador** (toggle arriba a la derecha)
3. Haz clic en **"Cargar extensión sin empaquetar"**
4. Selecciona la carpeta del proyecto
5. El ícono de ScrollSense aparecerá en la barra de herramientas

---

## Cómo funciona

La extensión utiliza **MediaPipe Hands** para detectar la punta del dedo índice a través de la cámara web.

- **Dedo arriba** (25% superior de la pantalla) → desplazar hacia arriba / video anterior
- **Dedo abajo** (25% inferior de la pantalla) → desplazar hacia abajo / siguiente video
- **Dedo al centro** → zona neutral (sin scroll)

Tanto la sensibilidad como el tamaño de la zona de activación son ajustables desde el popup.

---

## Sitios soportados

| Sitio | URL |
|-------|-----|
| YouTube Shorts | `youtube.com/shorts` |
| TikTok | `tiktok.com` |
| Instagram Reels | `instagram.com/reels` o `instagram.com/reel/` |

---

## Configuración

| Parámetro | Descripción |
|-----------|-------------|
| Sensibilidad | Velocidad del scroll (1–10). Más alto = más rápido |
| Zona de activación | % de la pantalla desde los bordes que activa el scroll (10–40%) |

---

## Tecnologías

- **Manifest V3** — Arquitectura de extensión de Chrome
- **MediaPipe Hands** — Detección de landmarks de la mano en tiempo real
- **MediaPipe Camera Utils** — Captura de video desde la cámara web
- **TrustedTypes** — Polyfill para compatibilidad con CSP de YouTube
- 100% local — sin backend, sin envío de datos externos

---

## Notas

- La primera activación pedirá **permiso de cámara** — es necesario
- Aparecerá un preview de la cámara (240×180) en la esquina inferior izquierda
- Un punto azul sigue la posición de la punta del dedo índice
- En YouTube Shorts se usan múltiples estrategias de scroll para mayor compatibilidad
- Para mejores resultados: buena iluminación, fondo sin distracciones
- En plataformas de video el scroll cambia al siguiente/anterior (cooldown de 1.5s entre cambios)
- En páginas normales el scroll es proporcional a la posición del dedo en la zona de activación

---

## Idea para el futuro

- [ ] Versión PWA para móvil
