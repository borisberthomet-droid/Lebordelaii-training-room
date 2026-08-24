// Un lien replayer Winamax (ex: winamax.fr/replayer/replayer.html?2025-<hash 64 hex>=&lang=en_US)
// contient un ID au format AAAA-<64 caractères hex>. Cet ID est ensuite transformé par le JS du
// replayer en chemin de stockage `AAAA/XX/YY/XXYYreste`, servi publiquement (sans auth) sur
// poker-assets.winamax.fr — voir le plan pour le détail de la rétro-ingénierie.
const ID_FIND_RE = /20\d{2}-[0-9a-f]{64}/;
const ID_VALIDATE_RE = /^20\d{2}-[0-9a-f]{64}$/;
const ID_SPLIT_RE = /^([0-9]+)-([a-zA-Z0-9][a-zA-Z0-9])([a-zA-Z0-9][a-zA-Z0-9])(.*)$/;

export function extractHandSessionId(input) {
  const m = String(input || '').match(ID_FIND_RE);
  return m ? m[0] : null;
}

export function handIdToAssetPath(id) {
  if (!ID_VALIDATE_RE.test(id)) return null;
  const m = ID_SPLIT_RE.exec(id);
  if (!m) return null;
  const [, year, p2, p3, rest] = m;
  return `${year}/${p2}/${p3}/${p2}${p3}${rest}`;
}
