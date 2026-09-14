#!/bin/bash
set +e
cd '/home/junior_dev/Documents/Zurion Store'
OUT=/tmp/zurion-verify.txt
: > "$OUT"

echo "== IMG FILES ==" >> "$OUT"
ls -1 front/assets/images/demos/demo-3/products/ 2>&1 | grep -E 'product-[0-9]+\.jpg' | head -8 >> "$OUT"
echo "COUNT: $(ls -1 front/assets/images/demos/demo-3/products/ 2>/dev/null | grep -cE 'product-[0-9]+\.jpg')" >> "$OUT"

echo "== CLEAN DB + SEED ==" >> "$OUT"
rm -f back/data/zurion.sqlite back/data/zurion.sqlite-* 2>/dev/null
timeout 90 node scripts/seed.js >> "$OUT" 2>&1
echo "SEED_EXIT=$?" >> "$OUT"

node -e '
const D=require("sqlite3");const db=new D.Database("back/data/zurion.sqlite");
db.all("SELECT url FROM product_images LIMIT 3",(e,r)=>{console.log("DB_IMG_URLS:",e?e.message:(r?r.map(x=>x.url).join(" | "):"none"));db.close();});
' >> "$OUT" 2>&1

echo "== START SERVER ==" >> "$OUT"
pkill -9 -f 'node back/server.js' 2>/dev/null
sleep 1
setsid nohup node back/server.js > /tmp/server.log 2>&1 &
echo "SERVER_PID=$!" >> "$OUT"
sleep 4
echo "== SERVER LOG ==" >> "$OUT"
tail -8 /tmp/server.log >> "$OUT" 2>&1

echo "== CURL HOME ==" >> "$OUT"
curl -sS -o /dev/null -w "home_http=%{http_code}\n" http://127.0.0.1:4173/ >> "$OUT" 2>&1
curl -sS http://127.0.0.1:4173/ 2>/dev/null | grep -oE 'zurion-(trustbar|product-grid|hero)' | sort -u | head >> "$OUT"
curl -sS http://127.0.0.1:4173/ 2>/dev/null | grep -oE 'assets/images/demos/demo-3/products/product-[0-9]+\.jpg' | head -1 >> "$OUT"

echo "== CURL CATALOG ==" >> "$OUT"
curl -sS -o /dev/null -w "catalog_http=%{http_code}\n" "http://127.0.0.1:4173/catalogue" >> "$OUT" 2>&1

echo "DONE" >> "$OUT"
echo DONE
