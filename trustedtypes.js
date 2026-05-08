/**
 * AirScrollTikTok - trustedtypes.js
 * Debe inyectarse ANTES de los scripts de MediaPipe.
 *
 * YouTube aplica la directiva CSP: require-trusted-types-for 'script'
 * Esto hace que MediaPipe falle internamente cuando intenta hacer
 * setAttribute('src', url) en un elemento <script> o <iframe>.
 *
 * Solución: registrar una política 'default' de TrustedTypes permisiva,
 * que actúa como fallback para cualquier código que no usa una política nombrada.
 */
(function() {
  if (!window.trustedTypes || !window.trustedTypes.createPolicy) {
    return; // El navegador no soporta TrustedTypes, no es necesario
  }
  try {
    window.trustedTypes.createPolicy('default', {
      createHTML:      (s) => s,
      createScriptURL: (s) => s,
      createScript:    (s) => s,
    });
  } catch (e) {
    // La página host (YouTube) ya registró una política 'default'.
    // No podemos sobrescribirla, pero al menos intentamos.
    console.warn('[AirScrollTikTok] TrustedTypes: no se pudo registrar la política default –', e.message);
  }
})();
