/**
 * seed.js вЂ” Demo uchun to'liq fake ma'lumotlar yaratish
 * 
 * Ishga tushirish: node seed.js
 * 
 * Bu script:
 * 1. Eski barcha ma'lumotlarni o'chiradi
 * 2. 8 ta filial, 28 ta xizmat yaratadi
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

console.log('рџ—‘пёЏ  Eski ma\'lumotlar o\'chirilmoqda...');

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

console.log('вњ… Tozalandi.\n');

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

console.log(`рџЏў 8 ta filial yaratildi.`);

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
const s_kr2 = ins.run(b2, 'Kredit bo\'limi', 'KR').lastInsertRowid;
const s_t2 = ins.run(b2, 'Pul o\'tkazmalari', 'T').lastInsertRowid;
const s_p2 = ins.run(b2, 'Karta xizmati', 'P').lastInsertRowid;

// KapitalBank Yunusobod
const s_k3 = ins.run(b3, 'Kassa xizmati', 'K').lastInsertRowid;
const s_kr3 = ins.run(b3, 'Kredit bo\'limi', 'KR').lastInsertRowid;
const s_p3 = ins.run(b3, 'Karta xizmati', 'P').lastInsertRowid;
const s_v3 = ins.run(b3, 'Valyuta almashtirish', 'V').lastInsertRowid;

// KapitalBank Sergeli
const s_k4 = ins.run(b4, 'Kassa xizmati', 'K').lastInsertRowid;
const s_kr4 = ins.run(b4, 'Kredit bo\'limi', 'KR').lastInsertRowid;
const s_p4 = ins.run(b4, 'Karta xizmati', 'P').lastInsertRowid;
const s_t4 = ins.run(b4, 'Pul o\'tkazmalari', 'T').lastInsertRowid;

// XalqBank Shayxontohur
const s_k5 = ins.run(b5, 'Kassa xizmati', 'K').lastInsertRowid;
const s_kr5 = ins.run(b5, 'Kredit bo\'limi', 'KR').lastInsertRowid;
const s_p5 = ins.run(b5, 'Karta xizmati', 'P').lastInsertRowid;

// XalqBank Mirzo Ulugbek
const s_k6 = ins.run(b6, 'Kassa xizmati', 'K').lastInsertRowid;
const s_kr6 = ins.run(b6, 'Kredit bo\'limi', 'KR').lastInsertRowid;
const s_p6 = ins.run(b6, 'Karta xizmati', 'P').lastInsertRowid;

// Shifoxona
const s_h5 = ins.run(b7, 'Qabul bo\'limi', 'H').lastInsertRowid;
const s_l5 = ins.run(b7, 'Laboratoriya', 'L').lastInsertRowid;
const s_a5 = ins.run(b7, 'Analiz natijalari', 'A').lastInsertRowid;

// Soliq
const s_s6 = ins.run(b8, 'Soliq maslahati', 'S').lastInsertRowid;
const s_d6 = ins.run(b8, 'Deklaratsiya qabuli', 'D').lastInsertRowid;
const s_n6 = ins.run(b8, 'STIR bo\'yicha xizmat', 'N').lastInsertRowid;

console.log(`📋 28 ta xizmat yaratildi.`);

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
console.log(`рџ‘Ґ ${fakeUsers.length} ta fake foydalanuvchi yaratildi.`);

// ================================================================
//  CHIPTALAR вЂ” turli holatlarda
// ================================================================

const insTkt = db.prepare(
    `INSERT INTO tickets (user_id, service_id, ticket_number, status, created_at, called_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const ago = (min) => new Date(Date.now() - min * 60 * 1000).toISOString();

// Har bir xizmat uchun "o'rtacha" navbat:
// waiting: 2-3 ta, called: ayrim xizmatlarda 1 ta, completed: 1 ta
const allServices = db.prepare(`
    SELECT s.id, s.prefix
    FROM services s
    ORDER BY s.id
`).all();

const insertUserAuto = db.prepare(
    'INSERT OR IGNORE INTO users (telegram_id, username, first_name, role) VALUES (?, ?, ?, ?)'
);

const autoNames = [
    'Alisher', 'Malika', 'Jasur', 'Nilufar', 'Bobur', 'Zulfiya', 'Sardor', 'Gulnora',
    'Firdavs', 'Shahnoza', 'Ulugbek', 'Dilorom', 'Sherzod', 'Feruza', 'Kamol', 'Ozoda'
];

let nextUid = 200031;
let totalTickets = 0;

function nextFakeUserId() {
    nextUid += 1;
    const name = autoNames[nextUid % autoNames.length];
    insertUserAuto.run(nextUid, `user_${nextUid}`, name, 'client');
    return nextUid;
}

allServices.forEach((svc, index) => {
    let seq = 1;
    const completedCount = 1;
    const calledCount = (svc.id % 4 === 0) ? 1 : 0;
    const waitingCount = 2 + (svc.id % 3 === 0 ? 1 : 0);

    // completed
    for (let i = 0; i < completedCount; i++) {
        const userId = nextFakeUserId();
        const createdMin = 220 + (index * 5) + (i * 10);
        const calledMin = createdMin - 8;
        const doneMin = calledMin - 7;
        insTkt.run(
            userId,
            svc.id,
            `${svc.prefix}-${seq++}`,
            'completed',
            ago(createdMin),
            ago(calledMin),
            ago(doneMin)
        );
        totalTickets += 1;
    }

    // called
    for (let i = 0; i < calledCount; i++) {
        const userId = nextFakeUserId();
        const createdMin = 65 + (index % 7) + (i * 4);
        const calledMin = 9 + (i * 2);
        insTkt.run(
            userId,
            svc.id,
            `${svc.prefix}-${seq++}`,
            'called',
            ago(createdMin),
            ago(calledMin),
            null
        );
        totalTickets += 1;
    }

    // waiting
    for (let i = 0; i < waitingCount; i++) {
        const userId = nextFakeUserId();
        const createdMin = 35 - (i * 7) + (index % 6);
        insTkt.run(
            userId,
            svc.id,
            `${svc.prefix}-${seq++}`,
            'waiting',
            ago(createdMin),
            null,
            null
        );
        totalTickets += 1;
    }
});

console.log(`🎫 ${totalTickets} ta chipta yaratildi (waiting, called, completed).\n`);

// ================================================================
//  STATISTIKA
// ================================================================

const stats = db.prepare(`
    SELECT 
        (SELECT COUNT(*) FROM tickets WHERE status='waiting')   as waiting,
        (SELECT COUNT(*) FROM tickets WHERE status='called')    as called,
        (SELECT COUNT(*) FROM tickets WHERE status='completed') as completed
`).get();

console.log('рџ“Љ Statistika:');
console.log(`   вЏі Kutilmoqda:   ${stats.waiting} ta`);
console.log(`   рџ”” Chaqirilgan:  ${stats.called} ta`);
console.log(`   вњ… Yakunlangan:  ${stats.completed} ta`);
console.log('\nрџљЂ Demo ma\'lumotlar tayyor! Endi: npm start\n');

db.close();
