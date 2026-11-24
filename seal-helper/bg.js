// Seal Helper : mises a jour.
// Deux verifications, aucune donnee envoyee :
// 1. le dossier de l extension sur ce poste porte-t-il deja une version plus recente que celle qui tourne ?
//    (on vient de remplacer les fichiers, ou le dossier est synchronise) -> l extension se relance seule ;
// 2. une version plus recente est-elle publiee ? On lit un petit fichier public sur GitHub (numero, nom du zip,
//    une ligne de nouveautes), au plus toutes les six heures. Rien n est execute depuis ce fichier.
const LATEST = 'https://raw.githubusercontent.com/mchauvinatlascope-ui/seal-converter/main/seal-helper/latest.json';
const DOWNLOAD = 'https://github.com/mchauvinatlascope-ui/seal-converter/raw/main/seal-helper/';
const KEY = 'sealHelperUpdate';
const SETTLE = 90 * 1000;       // un dossier en cours de copie ou de synchronisation : on attend qu il soit complet
const EVERY = 6 * 3600 * 1000;

const parts = v => String(v || '').split('.').map(n => parseInt(n, 10) || 0);
function newer(a, b) {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
async function diskVersion() {
  try {
    const r = await fetch(chrome.runtime.getURL('manifest.json') + '?t=' + Date.now(), { cache: 'no-store' });
    const v = (await r.json()).version;
    return /^\d+\.\d+\.\d+$/.test(v) ? v : '';
  } catch (e) { return ''; }
}
async function check({ remote = true, force = false } = {}) {
  const running = chrome.runtime.getManifest().version;
  const st = ((await chrome.storage.local.get(KEY))[KEY]) || {};
  const onDisk = await diskVersion();
  if (onDisk && newer(onDisk, running)) { if (st.diskV !== onDisk) { st.diskV = onDisk; st.diskSeen = Date.now(); } }
  else { st.diskV = ''; st.diskSeen = 0; }
  if (remote && (force || !st.at || Date.now() - st.at > EVERY)) {
    try {
      const r = await fetch(LATEST + '?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (/^\d+\.\d+\.\d+$/.test(j.version || '')) {
          st.latest = j.version;
          st.zip = /^seal-helper-[\d.]+\.zip$/.test(j.zip || '') ? j.zip : 'seal-helper-' + j.version + '.zip';
          st.notes = String(j.notes || '').slice(0, 240);
        }
      }
      st.at = Date.now();
    } catch (e) { st.at = Date.now() - EVERY + 30 * 60 * 1000; } // hors ligne : on reessaie dans une demi-heure
  }
  await chrome.storage.local.set({ [KEY]: st });
  const have = st.diskV || running;
  return {
    running, onDisk: st.diskV || '',
    ready: !!(st.diskV && Date.now() - st.diskSeen > SETTLE),
    settling: !!(st.diskV && Date.now() - st.diskSeen <= SETTLE),
    latest: st.latest || '', notes: st.notes || '',
    available: !!(st.latest && newer(st.latest, have)),
    url: st.latest ? DOWNLOAD + (st.zip || 'seal-helper-' + st.latest + '.zip') : '',
  };
}
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((m, sender, reply) => {
    if (!m || m.sh !== 'update') return;
    if (m.apply) { reply({ ok: true }); setTimeout(() => chrome.runtime.reload(), 250); return; }
    check({ remote: m.remote !== false, force: !!m.force }).then(reply, () => reply(null));
    return true; // reponse asynchrone
  });
}
if (typeof module !== 'undefined') module.exports = { newer, check };
