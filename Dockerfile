# ZURION Store — image de production (serveur web uniquement).
# Electron, scripts de dev, tests et docs sont exclus via .dockerignore.
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PORT=4173

WORKDIR /app

# 1) Dépendances de production — couche cachée pour les builds suivants.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2) Code applicatif : back/ (serveur) + front/ (vues et statiques servis par Express).
COPY back ./back
COPY front ./front

# 3) Dossier d'uploads (contenus clients) — montable en volume.
RUN mkdir -p /app/front/public/uploads
VOLUME /app/front/public/uploads

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]