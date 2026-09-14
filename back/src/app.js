'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
 *  CONFIGURATION EXPRESS (application, sans écoute — permet les tests supertest)
 *  Ordre des middlewares :
 *    view engine → trust proxy → nonce CSP → helmet → body parsers → cookies
 *    → rate limit → multipart → CSRF → statics → helpers de vues → routeurs
 *    → healthcheck → catch-all 404 → error handler
 * ═══════════════════════════════════════════════════════════════════════════ */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const apiRouter = require('./routes/api');
const pagesRouter = require('./routes/pages');
const { viewsHelpers } = require('./utils/views-helpers');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { authLimiter } = require('./middlewares/rateLimit');
const { csrfProtection } = require('./middlewares/csrf');
const { parseMultipart } = require('./middlewares/multipart');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../../front/views'));

// Derrière un reverse proxy en production : nécessaire pour que le rate limiter
// (et req.ip) voient la vraie IP du client.
if (env.isProd) app.set('trust proxy', 1);

// Nonce CSP — généré avant Helmet pour être injectable dans les directives.
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Sécurité de base : en-têtes HTTP + Content-Security-Policy.
app.use(
  helmet({
    // Le MVP utilise quelques styles inline (toasts, icônes) : on autorise
    // style-src 'unsafe-inline' mais PAS les scripts sans nonce.
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
        styleSrc: ["'self'", 'https://cdnjs.cloudflare.com', "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:', 'https://cdnjs.cloudflare.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' },
  })
);

app.use(express.json({ limit: '200kb' }));
// extended:false — évite la création d'objets imbriqués (risque prototype pollution
// via qs) ; les formulaires SSR restent plats, le JSON gère les structures imbriquées.
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(cookieParser());

// Anti-abuse global
app.use('/api/', rateLimit({ ...authLimiter, message: { error: 'Trop de requêtes. Veuillez patienter.' } }));

// Multipart (uploads) : parse le corps en mémoire AVANT le CSRF pour que
// req.body._csrf soit visible, puis enregistre le fichier dans req.files.
app.use(parseMultipart);

// CSRF : cookie + jeton dans les vues, vérifié sur toutes les mutations.
app.use(csrfProtection);

// Fichiers statiques (thème, images, uploads)
app.use(express.static(path.join(__dirname, '../../front/assets')));
app.use(express.static(path.join(__dirname, '../../front/public')));

// Helpers de vues (money, esc, productImage, stockLabel…)
viewsHelpers(app);

// API REST
app.use('/api', apiRouter);

app.get('/health', (req, res) => res.json({ ok: true, service: 'zurion', time: new Date().toISOString() }));

// Pages SSR (accueil, catalogue, produit, panier, checkout, compte…)
app.use(pagesRouter);

// Catch-all API
app.use('/api', notFound);

// Middleware d'erreurs
app.use(errorHandler);

module.exports = app;