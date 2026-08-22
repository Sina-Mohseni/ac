/* ============================================================
   THÈME — jour, nuit, ou suivi du système.
   Le choix est appliqué sur <html> :
     data-theme-pref = auto | light | dark  (préférence de l'utilisateur)
     data-theme      = light | dark          (thème réellement appliqué,
                                              absent en mode automatique)
   Un script court dans index.html applique déjà ce choix avant le
   premier rendu ; ce module ne sert qu'aux changements à chaud.
   ============================================================ */

const KEY = 'ac-theme';

export const THEMES = [
  ['auto', 'Automatique', 'Suit le réglage du système'],
  ['light', 'Jour', 'Fond clair, contraste doux'],
  ['dark', 'Nuit', 'Fond sombre, repos des yeux']
];

export const themeLabel = p => (THEMES.find(t => t[0] === p) || THEMES[0])[1];

export function getTheme() {
  let v = null;
  try { v = localStorage.getItem(KEY); } catch (e) { /* stockage refusé */ }
  return v === 'light' || v === 'dark' ? v : 'auto';
}

/* Thème effectivement affiché, une fois le mode automatique résolu. */
export function resolvedTheme() {
  const p = getTheme();
  if (p !== 'auto') return p;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(pref) {
  const p = pref === 'light' || pref === 'dark' ? pref : 'auto';
  const el = document.documentElement;
  el.setAttribute('data-theme-pref', p);
  if (p === 'auto') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', p);
  try { localStorage.setItem(KEY, p); } catch (e) { /* stockage refusé */ }
  const btn = document.getElementById('btnTheme');
  if (btn) {
    btn.title = `Thème : ${themeLabel(p).toLowerCase()}`;
    btn.setAttribute('aria-label', btn.title);
  }
  return p;
}

/* Bascule dans l'ordre : automatique → jour → nuit → automatique. */
export function cycleTheme() {
  const order = THEMES.map(t => t[0]);
  const next = order[(order.indexOf(getTheme()) + 1) % order.length];
  return applyTheme(next);
}

/* Au démarrage : titre du bouton, et suivi du système en mode auto. */
export function initTheme() {
  applyTheme(getTheme());
  if (!window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => { if (getTheme() === 'auto') applyTheme('auto'); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
}
