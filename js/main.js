import { openDB, ensureRootCategories, ensureGuild } from './db.js';
import { initPlayer } from './player.js';
import { initActions } from './actions.js';
import { render } from './router.js';
import { app } from './ui.js';
import { initTheme } from './theme.js';

(async function boot() {
  initTheme();

  try {
    await openDB();
    await ensureRootCategories();
    await ensureGuild();
  } catch (err) {
    console.error(err);
    app().innerHTML = `<div class="empty card"><span class="disp">Stockage inaccessible</span>
      Le navigateur refuse l'accès à IndexedDB. Ouvre le dossier via un serveur local
      (<span class="mono">python -m http.server 8080</span>) et vérifie que la navigation privée est désactivée.</div>`;
    return;
  }

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  initActions();
  initPlayer();
  await render();
})();
