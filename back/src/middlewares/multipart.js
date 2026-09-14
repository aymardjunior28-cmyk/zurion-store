'use strict';

/**
 * Parseur multipart déclaré avant le middleware CSRF.
 *
 * Les formulaires d'upload (multipart/form-data) transportent leur jeton _csrf
 * dans le corps. Or le middleware global csrfProtection s'exécute avant le
 * stockage disque de la route, donc le corps multipart doit être parsé ici
 * (en mémoire) pour que req.body._csrf soit disponible à la vérification CSRF.
 * Le fichier est conservé dans req.files et écrit sur disque par la route.
 */
const multer = require('multer');

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 6 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype || '');
    return cb(null, ok); // refuse silencieusement les fichiers non-image
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
 *  MIDDLEWARE MULTIPART — parseur uploads (images), déclaré AVANT le CSRF
 *  Filtre : images ≤ 2 Mo, max 6 fichiers. Fichier conservé en mémoire puis écrit par la route.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Parse le corps multipart en mémoire. */
/* ═══════════════════════════════════════════════════════════════════════════
 *  MIDDLEWARE MULTIPART — parseur uploads (images), déclaré AVANT le CSRF
 *  Filtre : images ≤ 2 Mo, max 6 fichiers. Fichier conservé en mémoire puis écrit par la route.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Parse le corps multipart en mémoire. */
function parseMultipart(req, res, next) {
  if (!/multipart\/form-data/i.test(String(req.headers['content-type'] || ''))) return next();
  memoryUpload.any()(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).send('Fichier trop volumineux (maximum 2 Mo).');
    }
    return next(err);
  });
}

module.exports = { parseMultipart, memoryUpload };