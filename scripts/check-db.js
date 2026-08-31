const path = require('path');
const root = path.resolve(process.argv[2] || '.');
process.chdir(root);

const D = require('sqlite3');
const db = new D.Database(path.join(root, 'data/zurion.sqlite'), D.OPEN_READWRITE);


db.all('SELECT COUNT(*) AS c FROM sqlite_master', (e, rows) => {
  if (e) { console.log('DB_LOCK_OR_ERR:', e.message); } else {
    console.log('MASTER_COUNT:', rows && rows[0] ? rows[0].c : 'none');
  }
  db.all('SELECT COUNT(*) AS c FROM Products', (e2, r2) => {
    console.log('PRODUCTS_COUNT:', e2 ? e2.message : (r2 && r2[0] ? r2[0].c : 'none'));
            db.all('SELECT url FROM product_images LIMIT 3', (e3, r3) => {
      console.log('IMG_URLS:', e3 ? e3.message : (r3 ? r3.map(x=>x.url).join(' | ') : 'none'));
      db.close();
    });
  });
});
