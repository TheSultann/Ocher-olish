/**
 * seed.js — Demo uchun to'liq fake ma'lumotlar yaratish
 * 
 * Ishga tushirish: node seed.js
 * 
 * Bu script:
 * 1. Eski barcha ma'lumotlarni o'chiradi
 * 2. 8 ta filial, 22 ta xizmat yaratadi
 * 3. 31 ta fake foydalanuvchi qo'shadi
 * 4. Turli holatlardagi chiptalar yaratadi (waiting, called, completed)
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.resolve(__dirname, 'bank_queue.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS institutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(organization_id, name)
  );

  CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER,
    institution_id INTEGER,
    name TEXT NOT NULL,
    address TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    role TEXT DEFAULT 'client'
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    ticket_number TEXT NOT NULL,
    status TEXT DEFAULT 'waiting',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    called_at DATETIME,
    completed_at DATETIME
  );
`);

const branchColumns = db.prepare('PRAGMA table_info(branches)').all().map(c => c.name);
if (!branchColumns.includes('organization_id')) {
  db.exec('ALTER TABLE branches ADD COLUMN organization_id INTEGER');
}
if (!branchColumns.includes('institution_id')) {
  db.exec('ALTER TABLE branches ADD COLUMN institution_id INTEGER');
}

console.log('🗑️  Eski ma\'lumotlar o\'chirilmoqda...');

// Barcha jadvaldagi ma'lumotlarni tozalash
db.exec(`
  DELETE FROM tickets;
  DELETE FROM users;
  DELETE FROM services;
  DELETE FROM branches;
  DELETE FROM institutions;
  DELETE FROM organizations;
  DELETE FROM sqlite_sequence WHERE name IN ('tickets','users','services','branches','institutions','organizations');
`);

console.log('✅ Tozalandi.\n');

// ================================================================
//  FILIALLAR
// ================================================================

const insertOrg = db.prepare('INSERT INTO organizations (name) VALUES (?)');
const orgBank = insertOrg.run('Bank').lastInsertRowid;
const orgHospital = insertOrg.run('Shifoxona').lastInsertRowid;
const orgTax = insertOrg.run('Soliq').lastInsertRowid;

const insertInst = db.prepare('INSERT INTO institutions (organization_id, name) VALUES (?, ?)');
const bankAloqa = insertInst.run(orgBank, 'AloqaBank').lastInsertRowid;
const bankKapital = insertInst.run(orgBank, 'KapitalBank').lastInsertRowid;
const bankXalq = insertInst.run(orgBank, 'XalqBank').lastInsertRowid;

const insertBranch = db.prepare(
  'INSERT INTO branches (organization_id, institution_id, name, address) VALUES (?, ?, ?, ?)'
);

const b1 = insertBranch.run(orgBank, bankAloqa, 'AloqaBank Markaziy filiali', 'Amir Temur ko\'chasi, 10').lastInsertRowid;
const b2 = insertBranch.run(orgBank, bankAloqa, 'AloqaBank Chilonzor filiali', 'Chilonzor, 15-kvartal').lastInsertRowid;
const b3 = insertBranch.run(orgBank, bankKapital, 'KapitalBank Yunusobod filiali', 'Yunusobod, 12-mavze').lastInsertRowid;
const b4 = insertBranch.run(orgBank, bankKapital, 'KapitalBank Sergeli filiali', 'Sergeli tumani, 5-uy').lastInsertRowid;
const b5 = insertBranch.run(orgBank, bankXalq, 'XalqBank Shayxontohur filiali', 'Shayxontohur, 23-uy').lastInsertRowid;
const b6 = insertBranch.run(orgBank, bankXalq, 'XalqBank Mirzo Ulugbek filiali', 'Buyuk Ipak Yo\'li, 18').lastInsertRowid;
const b7 = insertBranch.run(orgHospital, null, 'Markaziy shifoxona', 'Sog\'liq ko\'chasi, 12').lastInsertRowid;
const b8 = insertBranch.run(orgTax, null, 'Soliq markazi', 'Istiqlol ko\'chasi, 21').lastInsertRowid;

console.log(`🏢 8 ta filial yaratildi.`);

// ================================================================
//  XIZMATLAR
// ================================================================

const ins = db.prepare('INSERT INTO services (branch_id, name, prefix) VALUES (?, ?, ?)');

// AloqaBank Markaziy
const s_k1 = ins.run(b1, 'Kassa xizmati', 'K').lastInsertRowid;
const s_kr1 = ins.run(b1, 'Kredit bo\'limi', 'KR').lastInsertRowid;
const s_p1 = ins.run(b1, 'Karta xizmati', 'P').lastInsertRowid;
const s_d1 = ins.run(b1, 'Depozit bo\'limi', 'D').lastInsertRowid;

// AloqaBank Chilonzor
const s_k2 = ins.run(b2, 'Kassa xizmati', 'K').lastInsertRowid;
const s_t2 = ins.run(b2, 'Pul o\'tkazmalari', 'T').lastInsertRowid;
const s_p2 = ins.run(b2, 'Karta xizmati', 'P').lastInsertRowid;

// KapitalBank Yunusobod
const s_k3 = ins.run(b3, 'Kassa xizmati', 'K').lastInsertRowid;
const s_kr3 = ins.run(b3, 'Kredit bo\'limi', 'KR').lastInsertRowid;
const s_v3 = ins.run(b3, 'Valyuta almashtirish', 'V').lastInsertRowid;

// KapitalBank Sergeli
const s_k4 = ins.run(b4, 'Kassa xizmati', 'K').lastInsertRowid;
const s_t4 = ins.run(b4, 'Pul o\'tkazmalari', 'T').lastInsertRowid;

// XalqBank Shayxontohur
const s_k5 = ins.run(b5, 'Kassa xizmati', 'K').lastInsertRowid;
const s_kr5 = ins.run(b5, 'Kredit bo\'limi', 'KR').lastInsertRowid;

// XalqBank Mirzo Ulugbek
const s_k6 = ins.run(b6, 'Kassa xizmati', 'K').lastInsertRowid;
const s_p6 = ins.run(b6, 'Karta xizmati', 'P').lastInsertRowid;

// Shifoxona
const s_h5 = ins.run(b7, 'Qabul bo\'limi', 'H').lastInsertRowid;
const s_l5 = ins.run(b7, 'Laboratoriya', 'L').lastInsertRowid;
const s_a5 = ins.run(b7, 'Analiz natijalari', 'A').lastInsertRowid;

// Soliq
const s_s6 = ins.run(b8, 'Soliq maslahati', 'S').lastInsertRowid;
const s_d6 = ins.run(b8, 'Deklaratsiya qabuli', 'D').lastInsertRowid;
const s_n6 = ins.run(b8, 'STIR bo\'yicha xizmat', 'N').lastInsertRowid;

console.log(`📋 22 ta xizmat yaratildi.`);

// ================================================================
//  FAKE FOYDALANUVCHILAR (31 ta)
// ================================================================

const insUser = db.prepare(
    'INSERT OR IGNORE INTO users (telegram_id, username, first_name, role) VALUES (?, ?, ?, ?)'
);

const fakeUsers = [
    // Mijozlar
    [200001, 'alisher_uz', 'Alisher', 'client'],
    [200002, 'malika_t', 'Malika', 'client'],
    [200003, 'jasur_k', 'Jasur', 'client'],
    [200004, 'nilufar_r', 'Nilufar', 'client'],
    [200005, 'bobur_m', 'Bobur', 'client'],
    [200006, 'zulfiya_h', 'Zulfiya', 'client'],
    [200007, 'sardor_n', 'Sardor', 'client'],
    [200008, 'gulnora_s', 'Gulnora', 'client'],
    [200009, 'firdavs_j', 'Firdavs', 'client'],
    [200010, 'shahnoza_a', 'Shahnoza', 'client'],
    [200011, 'ulugbek_y', 'Ulugbek', 'client'],
    [200012, 'dilorom_f', 'Dilorom', 'client'],
    [200013, 'sherzod_o', 'Sherzod', 'client'],
    [200014, 'feruza_b', 'Feruza', 'client'],
    [200015, 'kamol_i', 'Kamol', 'client'],
    [200016, 'ozoda_x', 'Ozoda', 'client'],
    [200017, 'mirzo_t', 'Mirzo', 'client'],
    [200018, 'maftuna_d', 'Maftuna', 'client'],
    [200019, 'bekzod_q', 'Bekzod', 'client'],
    [200020, 'nasiba_g', 'Nasiba', 'client'],
    [200021, 'jahongir_s', 'Jahongir', 'client'],
    [200022, 'mohira_r', 'Mohira', 'client'],
    [200023, 'otabek_h', 'Otabek', 'client'],
    [200024, 'barno_k', 'Barno', 'client'],
    [200025, 'sanjar_l', 'Sanjar', 'client'],
    [200026, 'lola_m', 'Lola', 'client'],
    [200027, 'doniyor_p', 'Doniyor', 'client'],
    [200028, 'yulduz_n', 'Yulduz', 'client'],
    [200029, 'husan_v', 'Husan', 'client'],
    [200030, 'manzura_c', 'Manzura', 'client'],
    [200031, 'aziza_b', 'Aziza', 'client'],
];

fakeUsers.forEach(u => insUser.run(...u));
console.log(`👥 ${fakeUsers.length} ta fake foydalanuvchi yaratildi.`);

// ================================================================
//  CHIPTALAR — turli holatlarda
// ================================================================

const insTkt = db.prepare(
    `INSERT INTO tickets (user_id, service_id, ticket_number, status, created_at, called_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const now = new Date().toISOString();
const ago = (min) => new Date(Date.now() - min * 60 * 1000).toISOString();

// --- Markaziy filial: Kassa — 6 kishi navbatda, 2 ta yakunlangan ---
insTkt.run(200001, s_k1, 'K-1', 'completed', ago(60), ago(55), ago(48));
insTkt.run(200002, s_k1, 'K-2', 'completed', ago(50), ago(44), ago(38));
insTkt.run(200003, s_k1, 'K-3', 'waiting', ago(40), null, null);
insTkt.run(200004, s_k1, 'K-4', 'waiting', ago(35), null, null);
insTkt.run(200005, s_k1, 'K-5', 'waiting', ago(30), null, null);
insTkt.run(200006, s_k1, 'K-6', 'waiting', ago(25), null, null);
insTkt.run(200007, s_k1, 'K-7', 'waiting', ago(20), null, null);
insTkt.run(200008, s_k1, 'K-8', 'waiting', ago(15), null, null);

// --- Markaziy filial: Kredit — 3 kishi ---
insTkt.run(200009, s_kr1, 'KR-1', 'completed', ago(90), ago(80), ago(70));
insTkt.run(200010, s_kr1, 'KR-2', 'called', ago(30), ago(5), null);   // ← chaqirilgan!
insTkt.run(200011, s_kr1, 'KR-3', 'waiting', ago(20), null, null);
insTkt.run(200012, s_kr1, 'KR-4', 'waiting', ago(10), null, null);

// --- Markaziy filial: Karta ---
insTkt.run(200013, s_p1, 'P-1', 'completed', ago(45), ago(40), ago(32));
insTkt.run(200014, s_p1, 'P-2', 'waiting', ago(25), null, null);
insTkt.run(200015, s_p1, 'P-3', 'waiting', ago(15), null, null);

// --- Markaziy filial: Depozit ---
insTkt.run(200016, s_d1, 'D-1', 'waiting', ago(10), null, null);

// --- Shimoliy filiali: Kassa — 4 kishi ---
insTkt.run(200017, s_k2, 'K-1', 'completed', ago(55), ago(48), ago(40));
insTkt.run(200018, s_k2, 'K-2', 'waiting', ago(35), null, null);
insTkt.run(200019, s_k2, 'K-3', 'waiting', ago(25), null, null);
insTkt.run(200020, s_k2, 'K-4', 'waiting', ago(15), null, null);
insTkt.run(200021, s_k2, 'K-5', 'waiting', ago(5), null, null);

// --- Shimoliy filiali: O'tkazmalar ---
insTkt.run(200022, s_t2, 'T-1', 'called', ago(20), ago(3), null);   // ← chaqirilgan!
insTkt.run(200023, s_t2, 'T-2', 'waiting', ago(15), null, null);

// --- Yunusobod filiali: Valyuta ---
insTkt.run(200024, s_v3, 'V-1', 'waiting', ago(12), null, null);
insTkt.run(200025, s_v3, 'V-2', 'waiting', ago(8), null, null);

// --- Chilonzor filiali: Kassa ---
insTkt.run(200026, s_k4, 'K-1', 'completed', ago(80), ago(72), ago(60));
insTkt.run(200027, s_k4, 'K-2', 'waiting', ago(18), null, null);
insTkt.run(200028, s_k4, 'K-3', 'waiting', ago(10), null, null);

// --- Chilonzor filiali: O'tkazmalar ---
insTkt.run(200029, s_t4, 'T-1', 'waiting', ago(5), null, null);

// --- Shifoxona: Qabul ---
insTkt.run(200030, s_h5, 'H-1', 'waiting', ago(2), null, null);

// --- Soliq: Maslahat ---
insTkt.run(200031, s_s6, 'S-1', 'waiting', ago(1), null, null);

console.log(`🎫 31 ta chipta yaratildi (waiting, called, completed).\n`);

// ================================================================
//  STATISTIKA
// ================================================================

const stats = db.prepare(`
    SELECT 
        (SELECT COUNT(*) FROM tickets WHERE status='waiting')   as waiting,
        (SELECT COUNT(*) FROM tickets WHERE status='called')    as called,
        (SELECT COUNT(*) FROM tickets WHERE status='completed') as completed
`).get();

console.log('📊 Statistika:');
console.log(`   ⏳ Kutilmoqda:   ${stats.waiting} ta`);
console.log(`   🔔 Chaqirilgan:  ${stats.called} ta`);
console.log(`   ✅ Yakunlangan:  ${stats.completed} ta`);
console.log('\n🚀 Demo ma\'lumotlar tayyor! Endi: npm start\n');

db.close();
