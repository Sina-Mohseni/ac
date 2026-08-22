export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtSize = b => b > 1073741824 ? (b / 1073741824).toFixed(2) + ' Go'
  : b > 1048576 ? (b / 1048576).toFixed(1) + ' Mo' : (b / 1024).toFixed(0) + ' Ko';

export const fmtT = s => {
  s = Math.max(0, s || 0);
  return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
};

export const fmtT2 = s => {
  s = Math.max(0, s || 0);
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = Math.floor(s % 60);
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
};

export const today = () => new Date().toISOString().slice(0, 10);

/* Aucun attribut "accept" : tous les types de fichiers sont acceptés, sans limite ni conversion. */
export function pickFiles(multiple, cb) {
  const i = document.createElement('input');
  i.type = 'file';
  if (multiple) i.multiple = true;
  i.onchange = () => { if (i.files && i.files.length) cb([...i.files]); };
  i.click();
}

export function probeDuration(blob) {
  return new Promise(res => {
    const url = URL.createObjectURL(blob);
    const isV = (blob.type || '').startsWith('video');
    const m = document.createElement(isV ? 'video' : 'audio');
    m.preload = 'metadata';
    m.src = url;
    const done = d => { URL.revokeObjectURL(url); res(isFinite(d) && d > 0 ? d : 0); };
    m.onloadedmetadata = () => done(m.duration);
    m.onerror = () => done(0);
    setTimeout(() => done(m.duration || 0), 9000);
  });
}

export function toast(t) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = t;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}
