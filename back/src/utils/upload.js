'use strict';

/**
 * Sauvegarde sécurisée d'une image envoyée par l'admin.
 * Le nom de fichier est aléatoire (non devinable) et l'extension est
 * déduite des octets réels (magic bytes) plutôt que du mimetype déclaré.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.resolve(__dirname, '../../public/uploads');

function detectExt(buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return '.png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return '.gif';
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return '.webp';
  return null;
}

/** Persiste le fichier et retourne son URL publique (ou null si invalide). */
function saveUploadedImage(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) return null;
  const ext = detectExt(file.buffer);
  if (!ext) return null;
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file.buffer);
  return `/uploads/${name}`;
}

/** Supprime une image hébergée localement (ignore les URLs externes). */
function removeUploadedImage(url) {
  if (!url || !/^\/uploads\//.test(url)) return;
  const file = path.join(UPLOAD_DIR, path.basename(url));
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

module.exports = { saveUploadedImage, removeUploadedImage, UPLOAD_DIR };