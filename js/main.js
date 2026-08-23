import { openDB, ensureRootCategories, ensureHouses, ensurePersonaGroups, migratePersonas } from './db.js';
import { initPlayer } from './player.js';
import { initActions } from './actions.js';
import { render } from './router.js';
import { app } from './ui.js';
import { initTheme } from './theme.js';

(async function boot() {
  try {
    await openDB();
    await ensureRootCategories();
    await ensureHouses();
    await migratePersonas();
    await ensurePersonaGroups();
  } catch (err) {
    console.error(err);
    app().innerHTML = `<div class="empty card"><span class="disp">Stockage inaccessible</span>
      Le navigateur refuse l'accès à IndexedDB. Ouvre le dossier via un serveur local
      (<span class="mono">python -m http.server 8080</span>) et vérifie que la navigation privée est désactivée.</div>`;
    return;
  }

  /* Le thème est déjà appliqué par le script de tête ; on branche ici le
     suivi du système et le fond d'écran, une fois la base ouverte. */
  initTheme();

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  initActions();
  initPlayer();
  await render();
})();
