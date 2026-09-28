// La photo de coaching : deux ecrans, l'eleve et le coach. Cadrage a 45% de hauteur pour garder
// les deux visages ET l'ecran de jeu — c'est ce qui raconte la Training Room.
import fs from "node:fs";
import sharp from "sharp";
const src = "public/photos/1e6c5f0e-ec5d-445a-8927-8a64a92ea5bf.webp";
const { width: W, height: H } = await sharp(src).metadata();
const h = Math.min(H, Math.round(W / (1600 / 560)));
const top = Math.max(0, Math.min(H - h, Math.round(0.45 * H - h / 2)));
await sharp(src).resize(1800, null, { withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true })
  .toFile("public/photos/coaching.jpg");
await sharp(src).extract({ left: 0, top, width: W, height: h })
  .resize(1600, 560, { fit: "cover" }).jpeg({ quality: 82, mozjpeg: true })
  .toFile("public/photos/coaching-bandeau.jpg");
fs.rmSync(src);
console.log(`coaching.jpg + bandeau ecrits depuis ${W}x${H}`);
