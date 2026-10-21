// Bootstrap: load all content JSON, validate, start the UI.
import { buildContent, validateContent, CONTENT_FILES } from './core/content.js';
import { createApp } from './ui/app.js';

async function loadContent() {
  const entries = await Promise.all(
    CONTENT_FILES.map(async (name) => {
      const res = await fetch(`data/${name}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`data/${name}.json: HTTP ${res.status}`);
      return [name, await res.json()];
    }),
  );
  return buildContent(Object.fromEntries(entries));
}

function fatal(err) {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) {
    boot.innerHTML = `<div style="max-width:420px;padding:24px;text-align:center;font-family:Georgia,serif;color:#f3ead2">
      <div class="stamp" style="margin:0 auto 16px">静</div>
      <p>Der Teich ließ sich nicht laden.</p>
      <p style="color:#8d93ad;font-size:13px">${String(err && err.message ? err.message : err).replace(/[<>&]/g, '')}</p>
      <p style="color:#8d93ad;font-size:13px">Tipp: Das Spiel muss über einen Webserver laufen (nicht per file://).</p></div>`;
  }
}

(async () => {
  try {
    const content = await loadContent();
    const errors = validateContent(content);
    if (errors.length) console.warn('Content-Fehler:', errors);
    window.__stille = createApp(content);
  } catch (err) {
    fatal(err);
  }
})();
