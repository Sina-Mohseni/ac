import { byIdx, assetURL, getOwner } from './db.js';
import { fmtT2, toast } from './utils.js';
import { S } from './state.js';

export const audio = new Audio();
audio.preload = 'metadata';

export const PL = { ownerId: null, tracks: [], offsets: [], total: 0, idx: -1 };

export async function loadQueue(ownerId, autoplay) {
  const ts = (await byIdx('tracks', 'projectId', ownerId)).sort((a, b) => a.order - b.order);
  PL.ownerId = ownerId;
  PL.tracks = ts;
  PL.offsets = [];
  let acc = 0;
  ts.forEach(t => { PL.offsets.push(acc); acc += (t.duration || 0); });
  PL.total = acc;
  PL.idx = -1;
  document.getElementById('player').classList.toggle('on', ts.length > 0);
  document.body.classList.toggle('playing', ts.length > 0);
  await renderBand(ownerId);
  if (ts.length) await playIndex(0, !!autoplay);
  updatePlayerUI();
}

export async function renderBand(id) {
  const o = await getOwner(id);
  const host = document.getElementById('pBand');
  host.innerHTML = '';
  if (!o || !o.bgAssetId) return;
  const u = await assetURL(o.bgAssetId);
  if (!u) return;
  if ((o.bgKind || '').startsWith('video')) {
    const v = document.createElement('video');
    v.src = u; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
    host.appendChild(v);
    v.play().catch(() => {});
  } else {
    const i = document.createElement('img');
    i.src = u;
    host.appendChild(i);
  }
}

export async function playIndex(i, autoplay) {
  if (i < 0 || i >= PL.tracks.length) return;
  PL.idx = i;
  audio.src = await assetURL(PL.tracks[i].assetId);
  if (autoplay) audio.play().catch(() => toast('Touche ▶ pour lancer le son'));
  updatePlayerUI();
}

export const globalTime = () => PL.idx < 0 ? 0 : (PL.offsets[PL.idx] || 0) + (audio.currentTime || 0);

export async function seekGlobal(t) {
  t = Math.max(0, Math.min(t, PL.total || 0));
  let i = 0;
  for (let k = 0; k < PL.tracks.length; k++) if (t >= PL.offsets[k]) i = k;
  const was = !audio.paused;
  if (i !== PL.idx) await playIndex(i, was);
  audio.currentTime = Math.max(0, t - (PL.offsets[i] || 0));
  updatePlayerUI();
}

export function stopAll() {
  audio.pause();
  audio.src = '';
  PL.tracks = [];
  PL.ownerId = null;
  PL.idx = -1;
  document.getElementById('player').classList.remove('on');
  document.body.classList.remove('playing');
}

function setPlayIcon(p) {
  document.getElementById('pIcon').innerHTML = p
    ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>'
    : '<path d="M7 4l13 8-13 8z"/>';
}

export function updatePlayerUI() {
  const t = PL.tracks[PL.idx];
  document.getElementById('pTitle').textContent = t ? t.name : '—';
  const g = globalTime();
  document.getElementById('pTime').textContent = fmtT2(g) + ' / ' + fmtT2(PL.total);
  const sk = document.getElementById('seek');
  const pct = PL.total ? g / PL.total * 1000 : 0;
  sk.value = pct;
  sk.style.setProperty('--p', (pct / 10) + '%');
}

export function initPlayer() {
  audio.addEventListener('ended', () => {
    if (PL.idx < PL.tracks.length - 1) playIndex(PL.idx + 1, true); else updatePlayerUI();
  });
  audio.addEventListener('play', () => setPlayIcon(true));
  audio.addEventListener('pause', () => setPlayIcon(false));
  document.getElementById('seek').addEventListener('input', e => {
    if (PL.total) seekGlobal(e.target.value / 1000 * PL.total);
  });

  const raf = () => {
    updatePlayerUI();
    const vh = document.getElementById('vhead');
    if (vh) {
      const y = globalTime() * S.vzoom;
      vh.style.top = y + 'px';
      if (S.follow && !audio.paused) {
        const sc = document.getElementById('vtl');
        if (sc) {
          const target = y - sc.clientHeight * 0.4;
          if (Math.abs(sc.scrollTop - target) > 40) sc.scrollTop = target;
        }
      }
    }
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}
