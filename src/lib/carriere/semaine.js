// Calculs de semaine, sans React et sans base : une semaine va du lundi au dimanche, les dates
// circulent en `YYYY-MM-DD` et jamais en objets Date — un fuseau mal placé décale un planning
// d'un jour entier, et c'est le genre de bug qu'on ne voit qu'en octobre.

export const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export function isoDate(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function aujourdhui() {
  return isoDate(new Date());
}

// Lundi de la semaine qui contient cette date.
export function lundiDe(date = new Date()) {
  const d = new Date(date);
  const jour = (d.getDay() + 6) % 7;      // 0 = lundi
  d.setDate(d.getDate() - jour);
  return isoDate(d);
}

export function decalerJours(iso, n) {
  const [a, m, j] = iso.split("-").map(Number);
  const d = new Date(a, m - 1, j + n);
  return isoDate(d);
}

// Les sept jours d'une semaine, à partir de son lundi.
export function joursDeSemaine(lundi) {
  return Array.from({ length: 7 }, (_, i) => decalerJours(lundi, i));
}

export function libelleJour(iso) {
  const [a, m, j] = iso.split("-").map(Number);
  const d = new Date(a, m - 1, j);
  return JOURS[(d.getDay() + 6) % 7];
}

// Numéro de jour tel que le stockent les récurrences : 1 = lundi … 7 = dimanche.
export function numeroJour(iso) {
  const [a, m, j] = iso.split("-").map(Number);
  return ((new Date(a, m - 1, j).getDay() + 6) % 7) + 1;
}

export function libelleCourt(iso) {
  const [, m, j] = iso.split("-");
  return `${j}/${m}`;
}

export function libelleSemaine(lundi) {
  const dimanche = decalerJours(lundi, 6);
  return `${libelleCourt(lundi)} → ${libelleCourt(dimanche)}`;
}

// Une tâche est en retard si son jour est passé et qu'elle n'est pas faite. Rien ne la déplace :
// c'est le joueur qui décide, on se contente de le signaler.
export function enRetard(tache, jour = aujourdhui()) {
  return !!tache.jour && !tache.fait && tache.jour < jour;
}

export function tauxAccomplissement(taches) {
  const posees = taches.filter((t) => t.jour);
  if (!posees.length) return null;
  const faites = posees.filter((t) => t.fait).length;
  return { faites, total: posees.length, pct: Math.round((faites / posees.length) * 100) };
}
