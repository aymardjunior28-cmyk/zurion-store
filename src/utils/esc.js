'use strict';

/** Échappe les caractères HTML pour prévenir les XSS côté rendu. */
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, (c) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
  });
}

/** Chaîne tronquée proprement. */
function truncate(text, length = 120) {
  const clean = String(text || '');
  return clean.length > length ? clean.slice(0, length).trim() + '…' : clean;
}

module.exports = { esc, truncate };