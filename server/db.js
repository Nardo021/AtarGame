const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'atar.db');
let sqliteDb = null;
let wrapper = null;

function persist() {
  if (!sqliteDb) return;
  try {
    const data = sqliteDb.export();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('DB persist error:', e.message);
  }
}

function wrap(db) {
  return {
    exec(sql) {
      try {
        db.run(sql);
      } catch (e) {
        const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
        for (const stmt of statements) {
          if (!stmt) continue;
          try {
            db.run(stmt);
          } catch (err) {
            throw err;
          }
        }
      }
    },
    prepare(sql) {
      const st = db.prepare(sql);
      return {
        run(...args) {
          try {
            if (args.length) st.bind(args);
            st.step();
            let lastInsertRowid = undefined;
            try {
              const r = db.exec('SELECT last_insert_rowid() AS id');
              if (r.length && r[0].values && r[0].values[0]) lastInsertRowid = r[0].values[0][0];
            } catch (_) {}
            st.free();
            persist();
            return { lastInsertRowid };
          } catch (e) {
            st.free();
            throw e;
          }
        },
        get(...args) {
          try {
            if (args.length) st.bind(args);
            let row = null;
            if (st.step()) row = st.getAsObject();
            st.free();
            return row;
          } catch (e) {
            st.free();
            throw e;
          }
        },
        all(...args) {
          try {
            if (args.length) st.bind(args);
            const rows = [];
            while (st.step()) rows.push(st.getAsObject());
            st.free();
            return rows;
          } catch (e) {
            st.free();
            throw e;
          }
        }
      };
    }
  };
}

function getDb() {
  if (!wrapper) throw new Error('数据库未初始化，请先调用 init()');
  return wrapper;
}

function init() {
  return new Promise((resolve, reject) => {
    const initSqlJs = require('sql.js');
    const schemaPath = path.join(__dirname, 'schema.sql');
    initSqlJs()
      .then((SQL) => {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        let buffer = null;
        if (fs.existsSync(DB_PATH)) {
          try {
            buffer = fs.readFileSync(DB_PATH);
          } catch (e) {}
        }
        sqliteDb = new SQL.Database(buffer);
        wrapper = wrap(sqliteDb);
        const sql = fs.readFileSync(schemaPath, 'utf8');
        const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
        for (const stmt of statements) {
          if (!stmt) continue;
          try {
            sqliteDb.run(stmt);
          } catch (err) {
            if (!err.message || !err.message.includes('already exists')) reject(err);
          }
        }
        persist();
        resolve(wrapper);
      })
      .catch(reject);
  });
}

module.exports = { getDb, init, DB_PATH };
