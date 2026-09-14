#!/bin/bash
# Lance le test d'intégration des notifications avec une base seedée propre.
cd "/home/junior_dev/Documents/Zurion Store" || exit 1
export DATABASE_URL="sqlite://./data/zurion-notif.sqlite"
export NODE_ENV=development

rm -f back/data/zurion-notif.sqlite

echo "=== [1/2] Seed de la base ==="
node scripts/seed.js 2>&1 | tail -5
echo "Seed exit: $?"

echo "=== [2/2] Test d'intégration notifications ==="
node tmp/test-notifications.js 2>&1
echo "Test exit: $?"
