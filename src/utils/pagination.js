'use strict';

/**
 * Pagination déterministe à partir des query params.
 * Retourne { page, limit, offset, total, pages }.
 */
function paginate(query, defaultLimit = 12, maxLimit = 48) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function paginationMeta(page, limit, total) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, pages };
}

module.exports = { paginate, paginationMeta };