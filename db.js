const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'bank_queue.db');
const db = new Database(dbPath);
const DEFAULT_ORGANIZATIONS = ['Bank', 'Shifoxona', 'Soliq'];

// ================================================================
//  SCHEMA
// ================================================================

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS institutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id),
      UNIQUE(organization_id, name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER,
      institution_id INTEGER,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      FOREIGN KEY(organization_id) REFERENCES organizations(id),
      FOREIGN KEY(institution_id) REFERENCES institutions(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      prefix TEXT NOT NULL,
      FOREIGN KEY(branch_id) REFERENCES branches(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      role TEXT DEFAULT 'client'
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      ticket_number TEXT NOT NULL,
      status TEXT DEFAULT 'waiting',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      called_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(telegram_id),
      FOREIGN KEY(service_id) REFERENCES services(id)
    )
  `);

  ensureBranchColumns();
  ensureTicketColumns();
  ensureOrganizationData();
  seedData();
  ensureBankInstitutionCoverage();
}

function ensureBranchColumns() {
  const columns = db.prepare('PRAGMA table_info(branches)').all().map(c => c.name);
  if (!columns.includes('organization_id')) {
    db.exec('ALTER TABLE branches ADD COLUMN organization_id INTEGER');
  }
  if (!columns.includes('institution_id')) {
    db.exec('ALTER TABLE branches ADD COLUMN institution_id INTEGER');
  }
}

function ensureTicketColumns() {
  const columns = db.prepare('PRAGMA table_info(tickets)').all().map(c => c.name);
  if (!columns.includes('refresh_wait_minutes')) {
    db.exec('ALTER TABLE tickets ADD COLUMN refresh_wait_minutes INTEGER');
  }
}

function ensureOrganizationData() {
  const insertOrg = db.prepare('INSERT OR IGNORE INTO organizations (name) VALUES (?)');
  DEFAULT_ORGANIZATIONS.forEach(name => insertOrg.run(name));

  const bankOrg = db.prepare('SELECT id FROM organizations WHERE name = ?').get('Bank');
  if (bankOrg) {
    db.prepare('UPDATE branches SET organization_id = ? WHERE organization_id IS NULL')
      .run(bankOrg.id);
  }
}

// ================================================================
//  SEED DATA — Ko'proq ma'lumot
// ================================================================

function getOrganizationId(name) {
  const row = db.prepare('SELECT id FROM organizations WHERE name = ?').get(name);
  return row ? row.id : null;
}

function ensureBranchWithServices(organizationId, branchName, address, services) {
  if (!organizationId) return;

  const branchCount = db.prepare(
    'SELECT COUNT(*) as count FROM branches WHERE organization_id = ?'
  ).get(organizationId).count;

  if (branchCount > 0) return;

  const branchId = db.prepare(
    'INSERT INTO branches (organization_id, name, address) VALUES (?, ?, ?)'
  ).run(organizationId, branchName, address).lastInsertRowid;

  const insertService = db.prepare(
    'INSERT INTO services (branch_id, name, prefix) VALUES (?, ?, ?)'
  );
  services.forEach(s => insertService.run(branchId, s.name, s.prefix));
}

function ensureOrganizationCoverage() {
  const hospitalOrgId = getOrganizationId('Shifoxona');
  const taxOrgId = getOrganizationId('Soliq');

  ensureBranchWithServices(
    hospitalOrgId,
    'Markaziy shifoxona',
    'Sog\'liq ko\'chasi, 12',
    [
      { name: 'Qabul bo\'limi', prefix: 'H' },
      { name: 'Laboratoriya', prefix: 'L' },
      { name: 'Analiz natijalari', prefix: 'A' }
    ]
  );

  ensureBranchWithServices(
    taxOrgId,
    'Soliq markazi',
    'Istiqlol ko\'chasi, 21',
    [
      { name: 'Soliq maslahati', prefix: 'S' },
      { name: 'Deklaratsiya qabuli', prefix: 'D' },
      { name: 'STIR bo\'yicha xizmat', prefix: 'N' }
    ]
  );
}

function getOrCreateInstitution(organizationId, name) {
  const existing = db.prepare(
    'SELECT id FROM institutions WHERE organization_id = ? AND name = ?'
  ).get(organizationId, name);

  if (existing) return existing.id;

  const info = db.prepare(
    'INSERT INTO institutions (organization_id, name) VALUES (?, ?)'
  ).run(organizationId, name);

  return Number(info.lastInsertRowid);
}

function ensureBranchInInstitution(organizationId, institutionId, branchName, address, services) {
  let branch = db.prepare(
    'SELECT id FROM branches WHERE organization_id = ? AND institution_id = ? AND name = ?'
  ).get(organizationId, institutionId, branchName);

  if (!branch) {
    const info = db.prepare(
      'INSERT INTO branches (organization_id, institution_id, name, address) VALUES (?, ?, ?, ?)'
    ).run(organizationId, institutionId, branchName, address);
    branch = { id: Number(info.lastInsertRowid) };
  }

  const insertService = db.prepare(
    'INSERT INTO services (branch_id, name, prefix) VALUES (?, ?, ?)'
  );
  const hasService = db.prepare(
    'SELECT 1 FROM services WHERE branch_id = ? AND name = ? LIMIT 1'
  );

  services.forEach(s => {
    if (!hasService.get(branch.id, s.name)) {
      insertService.run(branch.id, s.name, s.prefix);
    }
  });
}

function ensureBankInstitutionCoverage() {
  const bankOrgId = getOrganizationId('Bank');
  if (!bankOrgId) return;

  const commonServices = [
    { name: 'Kassa xizmati', prefix: 'K' },
    { name: 'Kredit bo\'limi', prefix: 'KR' },
    { name: 'Karta xizmati', prefix: 'P' }
  ];

  const bankConfigs = [
    {
      name: 'AloqaBank',
      branches: [
        { name: 'AloqaBank Markaziy filiali', address: 'Amir Temur ko\'chasi, 10' },
        { name: 'AloqaBank Chilonzor filiali', address: 'Chilonzor, 15-kvartal' }
      ]
    },
    {
      name: 'KapitalBank',
      branches: [
        { name: 'KapitalBank Yunusobod filiali', address: 'Yunusobod, 12-mavze' },
        { name: 'KapitalBank Sergeli filiali', address: 'Sergeli tumani, 5-uy' }
      ]
    },
    {
      name: 'XalqBank',
      branches: [
        { name: 'XalqBank Shayxontohur filiali', address: 'Shayxontohur, 23-uy' },
        { name: 'XalqBank Mirzo Ulugbek filiali', address: 'Buyuk Ipak Yo\'li, 18' }
      ]
    }
  ];

  const aloqaId = getOrCreateInstitution(bankOrgId, 'AloqaBank');
  db.prepare(
    'UPDATE branches SET institution_id = ? WHERE organization_id = ? AND institution_id IS NULL'
  ).run(aloqaId, bankOrgId);

  bankConfigs.forEach(cfg => {
    const institutionId = getOrCreateInstitution(bankOrgId, cfg.name);
    cfg.branches.forEach(br => {
      ensureBranchInInstitution(bankOrgId, institutionId, br.name, br.address, commonServices);
    });
  });
}

function seedData() {
  const branchesCount = db.prepare('SELECT COUNT(*) as count FROM branches').get().count;
  if (branchesCount > 0) {
    ensureOrganizationCoverage();
    return; // Allaqachon ma'lumot bor
  }

  const bankOrgId = getOrganizationId('Bank');
  const hospitalOrgId = getOrganizationId('Shifoxona');
  const taxOrgId = getOrganizationId('Soliq');

  // --- Filiallar ---
  const insertBranch = db.prepare(
    'INSERT INTO branches (organization_id, name, address) VALUES (?, ?, ?)'
  );
  const b1 = insertBranch.run(bankOrgId, 'Markaziy filial', 'Mustaqillik ko\'chasi, 1').lastInsertRowid;
  const b2 = insertBranch.run(bankOrgId, 'Shimoliy filiali', 'Amir Temur shoh ko\'chasi, 42').lastInsertRowid;
  const b3 = insertBranch.run(bankOrgId, 'Yunusobod filiali', 'Yunusobod, 19-mavze, 5-uy').lastInsertRowid;
  const b4 = insertBranch.run(bankOrgId, 'Chilonzor filiali', 'Chilonzor ko\'chasi, 78').lastInsertRowid;
  const b5 = insertBranch.run(hospitalOrgId, 'Markaziy shifoxona', 'Sog\'liq ko\'chasi, 12').lastInsertRowid;
  const b6 = insertBranch.run(taxOrgId, 'Soliq markazi', 'Istiqlol ko\'chasi, 21').lastInsertRowid;

  // --- Xizmatlar ---
  const insertService = db.prepare('INSERT INTO services (branch_id, name, prefix) VALUES (?, ?, ?)');

  // Markaziy filial
  const s1 = insertService.run(b1, 'Kassa xizmati', 'K').lastInsertRowid;
  const s2 = insertService.run(b1, 'Kredit bo\'limi', 'KR').lastInsertRowid;
  const s3 = insertService.run(b1, 'Karta xizmati', 'P').lastInsertRowid;
  const s4 = insertService.run(b1, 'Depozit bo\'limi', 'D').lastInsertRowid;

  // Shimoliy filiali
  const s5 = insertService.run(b2, 'Kassa xizmati', 'K').lastInsertRowid;
  const s6 = insertService.run(b2, 'O\'tkazmalar', 'T').lastInsertRowid;
  const s7 = insertService.run(b2, 'Karta xizmati', 'P').lastInsertRowid;

  // Yunusobod filiali
  const s8 = insertService.run(b3, 'Kassa xizmati', 'K').lastInsertRowid;
  const s9 = insertService.run(b3, 'Kredit bo\'limi', 'KR').lastInsertRowid;
  const s10 = insertService.run(b3, 'Valyuta almashtirish', 'V').lastInsertRowid;

  // Chilonzor filiali
  const s11 = insertService.run(b4, 'Kassa xizmati', 'K').lastInsertRowid;
  const s12 = insertService.run(b4, 'O\'tkazmalar', 'T').lastInsertRowid;

  // Shifoxona
  const s13 = insertService.run(b5, 'Qabul bo\'limi', 'H').lastInsertRowid;
  insertService.run(b5, 'Laboratoriya', 'L');
  insertService.run(b5, 'Analiz natijalari', 'A');

  // Soliq markazi
  const s16 = insertService.run(b6, 'Soliq maslahati', 'S').lastInsertRowid;
  insertService.run(b6, 'Deklaratsiya qabuli', 'D');
  insertService.run(b6, 'STIR bo\'yicha xizmat', 'N');

  // --- Fake Users ---
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (telegram_id, username, first_name, role) VALUES (?, ?, ?, ?)');
  const fakeUsers = [
    [100001, 'alisher_u', 'Alisher', 'client'],
    [100002, 'malika_t', 'Malika', 'client'],
    [100003, 'jasur_k', 'Jasur', 'client'],
    [100004, 'nilufar_r', 'Nilufar', 'client'],
    [100005, 'bobur_m', 'Bobur', 'client'],
    [100006, 'zulfiya_h', 'Zulfiya', 'client'],
    [100007, 'sardor_n', 'Sardor', 'client'],
    [100008, 'gulnora_s', 'Gulnora', 'client'],
    [100009, 'firdavs_j', 'Firdavs', 'client'],
    [100010, 'shahnoza_a', 'Shahnoza', 'client'],
    [100011, 'doston_p', 'Doston', 'client'],
    [100012, 'rayhona_l', 'Rayhona', 'client'],
  ];
  fakeUsers.forEach(u => insertUser.run(...u));

  // --- Fake Tickets (waiting) ---
  const insertTicket = db.prepare(
    'INSERT INTO tickets (user_id, service_id, ticket_number, status) VALUES (?, ?, ?, ?)'
  );

  // Markaziy filial — Kassa: 4 kishi navbatda
  insertTicket.run(100001, s1, 'K-1', 'waiting');
  insertTicket.run(100002, s1, 'K-2', 'waiting');
  insertTicket.run(100003, s1, 'K-3', 'waiting');
  insertTicket.run(100004, s1, 'K-4', 'waiting');

  // Markaziy filial — Kredit: 2 kishi
  insertTicket.run(100005, s2, 'KR-1', 'waiting');
  insertTicket.run(100006, s2, 'KR-2', 'waiting');

  // Shimoliy — Kassa: 3 kishi
  insertTicket.run(100007, s5, 'K-1', 'waiting');
  insertTicket.run(100008, s5, 'K-2', 'waiting');
  insertTicket.run(100009, s5, 'K-3', 'waiting');

  // Yunusobod — Valyuta: 1 kishi
  insertTicket.run(100010, s10, 'V-1', 'waiting');
  insertTicket.run(100011, s13, 'H-1', 'waiting');
  insertTicket.run(100012, s16, 'S-1', 'waiting');

  console.log('✅ Seed data yaratildi!');
}

initDb();

// ================================================================
//  EXPORTS
// ================================================================

module.exports = {
  db,

  upsertUser(telegramId, username, firstName, role = 'client') {
    const stmt = db.prepare(`
      INSERT INTO users (telegram_id, username, first_name, role)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET
        username=excluded.username,
        first_name=excluded.first_name
    `);
    stmt.run(telegramId, username, firstName, role);
  },

  getUser(telegramId) {
    return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
  },

  getOrganizations() {
    return db.prepare('SELECT * FROM organizations ORDER BY id ASC').all();
  },

  getOrganizationById(organizationId) {
    return db.prepare('SELECT * FROM organizations WHERE id = ?').get(organizationId);
  },

  getInstitutions(organizationId) {
    return db.prepare(
      'SELECT * FROM institutions WHERE organization_id = ? ORDER BY id ASC'
    ).all(organizationId);
  },

  getInstitutionById(institutionId) {
    return db.prepare('SELECT * FROM institutions WHERE id = ?').get(institutionId);
  },

  getBranches() {
    return db.prepare(`
      SELECT b.*, o.name as organization_name, i.name as institution_name
      FROM branches b
      LEFT JOIN organizations o ON o.id = b.organization_id
      LEFT JOIN institutions i ON i.id = b.institution_id
      ORDER BY b.id ASC
    `).all();
  },

  getBranchesByOrganization(organizationId) {
    return db.prepare(`
      SELECT b.*, o.name as organization_name, i.name as institution_name
      FROM branches b
      LEFT JOIN organizations o ON o.id = b.organization_id
      LEFT JOIN institutions i ON i.id = b.institution_id
      WHERE b.organization_id = ?
      ORDER BY b.id ASC
    `).all(organizationId);
  },

  getBranchesByInstitution(institutionId) {
    return db.prepare(`
      SELECT b.*, o.name as organization_name, i.name as institution_name
      FROM branches b
      LEFT JOIN organizations o ON o.id = b.organization_id
      LEFT JOIN institutions i ON i.id = b.institution_id
      WHERE b.institution_id = ?
      ORDER BY b.id ASC
    `).all(institutionId);
  },

  getBranchById(branchId) {
    return db.prepare(`
      SELECT b.*, o.name as organization_name, i.name as institution_name
      FROM branches b
      LEFT JOIN organizations o ON o.id = b.organization_id
      LEFT JOIN institutions i ON i.id = b.institution_id
      WHERE b.id = ?
    `).get(branchId);
  },

  getBranchByServiceId(serviceId) {
    return db.prepare(
      `
      SELECT b.*, o.name as organization_name, i.name as institution_name
      FROM branches b
      JOIN services s ON s.branch_id = b.id
      LEFT JOIN organizations o ON o.id = b.organization_id
      LEFT JOIN institutions i ON i.id = b.institution_id
      WHERE s.id = ?
      `
    ).get(serviceId);
  },

  getServices(branchId) {
    return db.prepare('SELECT * FROM services WHERE branch_id = ?').all(branchId);
  },

  getServiceById(serviceId) {
    return db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  },

  createTicket(userId, serviceId) {
    const activeTicket = this.getActiveTicket(userId);
    if (activeTicket) {
      throw new Error('Siz allaqachon navbatdasiz');
    }

    const service = this.getServiceById(serviceId);
    if (!service) throw new Error('Xizmat topilmadi');

    // Bugungi chipta raqamini hisoblash (date filter o'rniga COUNT ishlatamiz)
    const totalCount = db.prepare(
      'SELECT COUNT(*) as count FROM tickets WHERE service_id = ?'
    ).get(serviceId).count + 1;

    const ticketNumber = `${service.prefix}-${totalCount}`;

    const info = db.prepare(
      'INSERT INTO tickets (user_id, service_id, ticket_number) VALUES (?, ?, ?)'
    ).run(userId, serviceId, ticketNumber);

    const ticketId = Number(info.lastInsertRowid);
    const peopleAhead = this.getPeopleAhead(ticketId, serviceId);
    const initialWait = Math.max(1, peopleAhead + 1);

    db.prepare('UPDATE tickets SET refresh_wait_minutes = ? WHERE id = ?')
      .run(initialWait, ticketId);

    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  },

  getActiveTicket(userId) {
    return db.prepare(`
      SELECT
        t.*,
        s.name as service_name,
        b.name as branch_name,
        o.name as organization_name,
        i.name as institution_name
      FROM tickets t
      JOIN services s ON t.service_id = s.id
      JOIN branches b ON s.branch_id = b.id
      LEFT JOIN organizations o ON o.id = b.organization_id
      LEFT JOIN institutions i ON i.id = b.institution_id
      WHERE t.user_id = ? AND t.status IN ('waiting', 'called')
    `).get(userId);
  },

  cancelTicket(ticketId, userId) {
    return db.prepare(
      "UPDATE tickets SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'waiting'"
    ).run(ticketId, userId).changes > 0;
  },

  getWaitEstimate(ticketId, serviceId) {
    const ticket = db.prepare(
      'SELECT status, service_id, refresh_wait_minutes FROM tickets WHERE id = ?'
    ).get(ticketId);

    if (!ticket || ticket.status !== 'waiting') return 0;
    if (ticket.refresh_wait_minutes !== null && ticket.refresh_wait_minutes !== undefined) {
      return Math.max(0, ticket.refresh_wait_minutes);
    }

    const resolvedServiceId = serviceId || ticket.service_id;
    const peopleAhead = this.getPeopleAhead(ticketId, resolvedServiceId);
    const initialWait = Math.max(1, peopleAhead + 1);

    db.prepare('UPDATE tickets SET refresh_wait_minutes = ? WHERE id = ?')
      .run(initialWait, ticketId);

    return initialWait;
  },

  decrementWaitOnRefresh(ticketId) {
    const ticket = db.prepare('SELECT id, service_id, status FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket || ticket.status !== 'waiting') return 0;

    const current = this.getWaitEstimate(ticket.id, ticket.service_id);
    const next = Math.max(0, current - 1);

    db.prepare('UPDATE tickets SET refresh_wait_minutes = ? WHERE id = ?')
      .run(next, ticket.id);

    return next;
  },

  getVirtualPeopleAhead(ticketId, serviceId) {
    const wait = this.getWaitEstimate(ticketId, serviceId);
    return wait > 0 ? wait - 1 : 0;
  },

  getPeopleAhead(ticketId, serviceId) {
    return db.prepare(
      "SELECT COUNT(*) as count FROM tickets WHERE service_id = ? AND status = 'waiting' AND id < ?"
    ).get(serviceId, ticketId).count;
  },

  getQueueLength(serviceId) {
    return db.prepare(
      "SELECT COUNT(*) as count FROM tickets WHERE service_id = ? AND status = 'waiting'"
    ).get(serviceId).count;
  },

  getNextTicket(serviceId) {
    return db.prepare(`
      SELECT t.*, u.first_name, u.telegram_id 
      FROM tickets t
      JOIN users u ON t.user_id = u.telegram_id
      WHERE t.service_id = ? AND t.status = 'waiting'
      ORDER BY t.created_at ASC
      LIMIT 1
    `).get(serviceId);
  },

  callTicket(ticketId) {
    return db.prepare(
      "UPDATE tickets SET status = 'called', called_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'waiting'"
    ).run(ticketId).changes > 0;
  },

  completeTicket(ticketId) {
    return db.prepare(
      "UPDATE tickets SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'called'"
    ).run(ticketId).changes > 0;
  }
};
