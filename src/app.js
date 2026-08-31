'use strict';

/**
 * Démarre l'application Express (sans écouter) pour permettre les tests supertest.
 */
const path = require('path');
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

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Sécurité de base
app.use(
  helmet({
    contentSecurityPolicy: false, // les pages EJS intègrent des styles inline (toasts) par simplicité MVP
  })
);

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(cookieParser());

// Anti-abuse global
app.use('/api/', rateLimit({ ...authLimiter, message: { error: 'Trop de requêtes. Veuillez patienter.' } }));

// Fichiers statiques (thème, images, uploads)
app.use(express.static(path.join(__dirname, '../assets')));
app.use(express.static(path.join(__dirname, '../public')));

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