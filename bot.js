require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const dbActions = require('./db');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'DUMMY_TOKEN_PLEASE_REPLACE');
const STAFF_IDS = (process.env.STAFF_IDS || '')
    .split(',')
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id));

// ================================================================
//  REPLY KEYBOARD MENULARI
// ================================================================

const CLIENT_MENU = Markup.keyboard([
    ['🎫 Navbat olish', '📋 Mening chiptam'],
    ['🌍 Xalqaro o\'tkazma'],
    ['ℹ️ Ma\'lumot', '📞 Aloqa']
]).resize();

const STAFF_MENU = Markup.keyboard([
    ['📊 Boshqaruv paneli', '📋 Navbat ro\'yxati'],
    ['✅ Keyingisini chaqirish', '🔄 Yangilash']
]).resize();

const TRANSFER_SUPPORT = {
    swift8: {
        title: 'SWIFT/BIC',
        formatText: '8 yoki 11 belgi',
        sendBanks: ['AloqaBank', 'KapitalBank', 'XalqBank'],
        receiveBanks: ['AloqaBank', 'KapitalBank', 'XalqBank']
    },
    routing9: {
        title: 'Routing/ABA',
        formatText: '9 ta raqam',
        sendBanks: ['AloqaBank', 'KapitalBank'],
        receiveBanks: ['AloqaBank', 'KapitalBank']
    }
};

// ================================================================
//  MIDDLEWARE
// ================================================================

bot.use(async (ctx, next) => {
    if (ctx.from) {
        const isStaff = STAFF_IDS.includes(ctx.from.id);
        dbActions.upsertUser(
            ctx.from.id,
            ctx.from.username,
            ctx.from.first_name,
            isStaff ? 'staff' : 'client'
        );
        ctx.state.isStaff = isStaff;
    }
    return next();
});

// ================================================================
//  /start
// ================================================================

bot.start(async (ctx) => {
    const name = ctx.from.first_name || 'Foydalanuvchi';

    if (ctx.state.isStaff) {
        await ctx.reply(
            `👋 Xush kelibsiz, <b>${name}</b>!\n\n` +
            `🏛 <b>Tashkilotlar Navbat Tizimi</b> — Xodim paneli\n\n` +
            `Quyidagi tugmalardan birini tanlang:`,
            { parse_mode: 'HTML', ...STAFF_MENU }
        );
    } else {
        await ctx.reply(
            `👋 Assalomu alaykum, <b>${name}</b>!\n\n` +
            `🏛 <b>Tashkilotlar Navbat Tizimi</b>ga xush kelibsiz!\n\n` +
            `Bu bot orqali siz:\n` +
            `• 🎫 Onlayn navbat olishingiz\n` +
            `• 🌍 Xalqaro o'tkazma bo'yicha yo'nalish ko'rishingiz\n` +
            `• 📋 Chiptangiz holatini kuzatishingiz\n` +
            `• 🔔 Navbatingiz kelganda bildirishnoma olishingiz mumkin!\n\n` +
            `Boshlash uchun quyidagi tugmani bosing 👇`,
            { parse_mode: 'HTML', ...CLIENT_MENU }
        );
    }
});

// ================================================================
//  MIJOZ — NAVBAT OLISH (Reply button)
// ================================================================

async function sendOrganizationsMenu(ctx, isEdit = false) {
    const organizations = dbActions.getOrganizations();
    if (organizations.length === 0) {
        const text = '⚠️ Hozircha faol tashkilotlar mavjud emas.\nKeyinroq qayta urinib ko\'ring.';
        if (isEdit) {
            return ctx.editMessageText(text).catch(() => ctx.reply(text, CLIENT_MENU));
        }
        return ctx.reply(text, CLIENT_MENU);
    }

    const rows = organizations.map(org => [
        Markup.button.callback(`🏛 ${org.name}`, `org_${org.id}`)
    ]);
    rows.push([Markup.button.callback('❌ Bekor qilish', 'act_cancel')]);

    const text =
        '🏛 <b>Tashkilotni tanlang</b>\n\n' +
        'Qaysi tashkilotga navbat olmoqchisiz?';
    const opts = { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) };

    if (isEdit) {
        return ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
    }
    return ctx.reply(text, opts);
}

function getBankBranchesByName() {
    const bankOrg = dbActions.getOrganizations().find(o => o.name === 'Bank');
    if (!bankOrg) return {};

    const institutions = dbActions.getInstitutions(bankOrg.id);
    const result = {};

    institutions.forEach(inst => {
        const branches = dbActions.getBranchesByInstitution(inst.id).map(b => b.name);
        result[inst.name] = branches;
    });

    return result;
}

function renderBankList(bankNames, branchMap) {
    const shortBranchName = (branchName, bankName) => {
        let out = branchName;
        out = out.replace(new RegExp(`^${bankName}\\s+`, 'i'), '');
        out = out.replace(/\s+filiali$/i, '');
        return out.trim();
    };

    return bankNames.map(name => {
        const branches = branchMap[name] || [];
        if (branches.length === 0) return `• ${name}`;
        const visible = branches.slice(0, 2).map(b => shortBranchName(b, name));
        const more = branches.length > 2 ? ` +${branches.length - 2}` : '';
        return `• ${name} (${visible.join(', ')}${more})`;
    }).join('\n');
}

async function sendTransferMenu(ctx, isEdit = false) {
    const text =
        `🌍 <b>Международный перевод</b>\n\n` +
        `Kod formatini tanlang:\n` +
        `• SWIFT/BIC (8 yoki 11)\n` +
        `• Routing/ABA (9)`;

    const opts = {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('SWIFT/BIC (8)', 'trf_swift8')],
            [Markup.button.callback('Routing/ABA (9)', 'trf_routing9')],
            [Markup.button.callback('❌ Bekor qilish', 'act_cancel')]
        ])
    };

    if (isEdit) {
        return ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
    }
    return ctx.reply(text, opts);
}

async function sendBankQueueMenu(ctx, isEdit = false, backCallback = 'act_orgs') {
    const bankOrg = dbActions.getOrganizations().find(o => o.name === 'Bank');
    if (!bankOrg) {
        return sendOrganizationsMenu(ctx, isEdit);
    }

    const institutions = dbActions.getInstitutions(bankOrg.id);
    if (!institutions || institutions.length === 0) {
        return sendOrganizationsMenu(ctx, isEdit);
    }

    const rows = institutions.map(inst => [
        Markup.button.callback(`🏦 ${inst.name}`, `inst_${inst.id}`)
    ]);
    rows.push([Markup.button.callback('🔙 Ortga', backCallback)]);

    const text =
        `🏛 <b>${bankOrg.name}</b>\n\n` +
        `🏦 Bankni tanlang:`;
    const opts = { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) };

    if (isEdit) {
        return ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
    }
    return ctx.reply(text, opts);
}

bot.hears('🎫 Navbat olish', async (ctx) => {
    if (ctx.state.isStaff) return;
    await sendOrganizationsMenu(ctx);
});

bot.hears('🌍 Xalqaro o\'tkazma', async (ctx) => {
    if (ctx.state.isStaff) return;
    await sendTransferMenu(ctx);
});

// Orqaga moslik uchun eski ruscha tugma matni ham ishlaydi
bot.hears('🌍 Международный перевод', async (ctx) => {
    if (ctx.state.isStaff) return;
    await sendTransferMenu(ctx);
});

bot.action('trf_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await sendTransferMenu(ctx, true);
});

bot.action('act_bank_queue', async (ctx) => {
    await ctx.answerCbQuery();
    await sendBankQueueMenu(ctx, true, 'trf_menu');
});

bot.action(/^trf_(swift8|routing9)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const key = ctx.match[1];
    const conf = TRANSFER_SUPPORT[key];
    if (!conf) {
        return sendTransferMenu(ctx, true);
    }

    const branchMap = getBankBranchesByName();
    const sendList = renderBankList(conf.sendBanks, branchMap);
    const receiveList = renderBankList(conf.receiveBanks, branchMap);

    const msg =
        `🌍 <b>Международный перевод</b>\n\n` +
        `🔎 <b>Format:</b> ${conf.title}\n` +
        `🧾 <b>Kod:</b> ${conf.formatText}\n\n` +
        `📤 <b>Jo'natish mumkin:</b>\n${sendList}\n\n` +
        `📥 <b>Qabul qilish mumkin:</b>\n${receiveList}\n\n` +
        `ℹ️ Tarif va limit bankga qarab farq qiladi.`;

    await ctx.editMessageText(msg, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Kod turini qayta tanlash', 'trf_menu')],
            [Markup.button.callback('🏦 Bankda navbat olish', 'act_bank_queue')]
        ])
    }).catch(() => {});
});

// ================================================================
//  TASHKILOT TANLASH
// ================================================================

bot.action(/^org_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const orgId = parseInt(ctx.match[1]);
    const organization = dbActions.getOrganizationById(orgId);

    if (!organization) {
        return sendOrganizationsMenu(ctx, true);
    }

    const institutions = dbActions.getInstitutions(orgId);
    if (institutions && institutions.length > 0) {
        const rows = institutions.map(inst => [
            Markup.button.callback(`🏦 ${inst.name}`, `inst_${inst.id}`)
        ]);
        rows.push([Markup.button.callback('🔙 Tashkilotlarga qaytish', 'act_orgs')]);

        return ctx.editMessageText(
            `🏛 <b>${organization.name}</b>\n\n` +
            `🏦 Avval bankni tanlang:`,
            { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) }
        );
    }

    const branches = dbActions.getBranchesByOrganization(orgId);
    if (!branches || branches.length === 0) {
        return ctx.editMessageText(
            `⚠️ <b>${organization.name}</b> uchun hozircha filiallar mavjud emas.`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🔙 Tashkilotlarga qaytish', 'act_orgs')]
                ])
            }
        );
    }

    const rows = branches.map(b => [
        Markup.button.callback(`🏢 ${b.name}`, `br_${b.id}`)
    ]);
    rows.push([Markup.button.callback('🔙 Tashkilotlarga qaytish', 'act_orgs')]);

    await ctx.editMessageText(
        `🏛 <b>${organization.name}</b>\n\n` +
        `🏢 Filialni tanlang:`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) }
    );
});

bot.action(/^inst_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const institutionId = parseInt(ctx.match[1]);
    const institution = dbActions.getInstitutionById(institutionId);
    if (!institution) {
        return sendOrganizationsMenu(ctx, true);
    }

    const organization = dbActions.getOrganizationById(institution.organization_id);
    const branches = dbActions.getBranchesByInstitution(institutionId);
    if (!branches || branches.length === 0) {
        return ctx.editMessageText(
            `⚠️ <b>${institution.name}</b> uchun hozircha filiallar mavjud emas.`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🔙 Banklarga qaytish', `org_${institution.organization_id}`)]
                ])
            }
        );
    }

    const rows = branches.map(b => [
        Markup.button.callback(`🏢 ${b.name}`, `br_${b.id}`)
    ]);
    rows.push([Markup.button.callback('🔙 Banklarga qaytish', `org_${institution.organization_id}`)]);

    await ctx.editMessageText(
        `🏛 <b>${organization ? organization.name : ''}</b>\n` +
        `🏦 <b>${institution.name}</b>\n\n` +
        `🏢 Filialni tanlang:`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) }
    );
});

// ================================================================
//  FILIAL TANLASH (inline callback)
// ================================================================

bot.action(/^br_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const branchId = parseInt(ctx.match[1]);
    const branch = dbActions.getBranchById(branchId);
    const services = dbActions.getServices(branchId);

    if (!services || services.length === 0) {
        const backCallback = branch && branch.institution_id
            ? `inst_${branch.institution_id}`
            : branch && branch.organization_id
            ? `org_${branch.organization_id}`
            : 'act_orgs';
        return ctx.editMessageText(
            `⚠️ Bu filialda hozircha xizmatlar mavjud emas.`,
            {
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🔙 Filiallarga qaytish', backCallback)]
                ])
            }
        );
    }

    const rows = services.map(s => {
        const qLen = dbActions.getQueueLength(s.id);
        const dot = qLen === 0 ? '🟢' : qLen < 5 ? '🟡' : '🔴';
        return [
            Markup.button.callback(
                `${dot} ${s.name}  —  👥 ${qLen} kishi`,
                `svc_${s.id}`
            )
        ];
    });
    const backCallback = branch && branch.institution_id
        ? `inst_${branch.institution_id}`
        : branch && branch.organization_id
        ? `org_${branch.organization_id}`
        : 'act_orgs';
    rows.push([Markup.button.callback('🔙 Boshqa filial', backCallback)]);

    const brName = branch ? branch.name : 'Filial';
    const orgName = branch && branch.organization_name ? branch.organization_name : 'Tashkilot';
    const instName = branch && branch.institution_name ? branch.institution_name : null;
    await ctx.editMessageText(
        `🏛 <b>${orgName}</b>\n` +
        (instName ? `🏦 <b>${instName}</b>\n` : '') +
        `🏢 <b>${brName}</b>\n\n` +
        `📋 Xizmat turini tanlang:\n` +
        `🟢 bo'sh  🟡 o'rtacha  🔴 gavjum`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) }
    );
});

// ================================================================
//  XIZMAT TANLASH — CHIPTA YARATISH
// ================================================================

bot.action(/^svc_(\d+)$/, async (ctx) => {
    const serviceId = parseInt(ctx.match[1]);

    try {
        const ticket = dbActions.createTicket(ctx.from.id, serviceId);
        const peopleAhead = dbActions.getVirtualPeopleAhead(ticket.id, serviceId);
        const waitTime = dbActions.getWaitEstimate(ticket.id, serviceId);

        await ctx.answerCbQuery('✅ Navbatga yozildingiz!');

        const msg =
            `✅ <b>Navbatga muvaffaqiyatli yozildingiz!</b>\n\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `🎫 <b>Chipta raqami:</b>  <code>${ticket.ticket_number}</code>\n` +
            `👥 <b>Siz oldida:</b>  ${peopleAhead} kishi\n` +
            `⏳ <b>Taxminiy kutish:</b>  ~${waitTime} daqiqa\n` +
            `━━━━━━━━━━━━━━━━\n\n` +
            `🔔 Navbatingiz kelganda <b>avtomatik xabar</b> yuboriladi.\n` +
            `Tashkilotga o'z vaqtida keling! 🏛`;

        await ctx.editMessageText(msg, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📋 Chiptamni ko\'rish', 'act_myticket')],
                [Markup.button.callback('❌ Chiptani bekor qilish', `cxl_${ticket.id}`)]
            ])
        });

    } catch (err) {
        if (err.message === 'Siz allaqachon navbatdasiz') {
            await ctx.answerCbQuery('ℹ️ Sizda allaqachon faol chipta bor!', { show_alert: true });
            await sendMyTicket(ctx, true);
        } else {
            console.error('createTicket error:', err.message);
            await ctx.answerCbQuery('❌ Xatolik yuz berdi, qayta urinib ko\'ring.', { show_alert: true });
        }
    }
});

// ================================================================
//  MENING CHIPTAM
// ================================================================

bot.hears('📋 Mening chiptam', async (ctx) => {
    if (ctx.state.isStaff) return;
    await sendMyTicket(ctx, false);
});

bot.action('act_myticket', async (ctx) => {
    await ctx.answerCbQuery('🔄 Yangilandi!');
    await simulateFakeQueue();
    await sendMyTicket(ctx, true, true);
});

async function sendMyTicket(ctx, isEdit, isRefresh = false) {
    const ticket = dbActions.getActiveTicket(ctx.from.id);

    if (!ticket) {
        const text =
            `❌ <b>Faol chiptangiz yo'q</b>\n\n` +
            `Navbat olish uchun «🎫 Navbat olish» tugmasini bosing.`;
        const opts = {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🎫 Navbat olish', 'act_orgs')]
            ])
        };
        if (isEdit) return ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
        return ctx.reply(text, opts);
    }

    if (isRefresh && ticket.status === 'waiting') {
        dbActions.decrementWaitOnRefresh(ticket.id);
    }

    const waitTime = dbActions.getWaitEstimate(ticket.id, ticket.service_id);
    const peopleAhead = dbActions.getVirtualPeopleAhead(ticket.id, ticket.service_id);

    // --- Vizualizatsiya ---

    // Holat
    let statusLine;
    if (ticket.status === 'called') {
        statusLine = `🔔 <b>SIZNI CHAQIRISHMOQDA!</b>`;
    } else if (peopleAhead === 0) {
        statusLine = `✅ <b>Navbat boshidasiz!</b>`;
    } else {
        statusLine = `⏳ Kutilmoqda`;
    }

    // Toza Unicode progress bar
    function buildProgressBar(ahead, total) {
        const MAX = 10;
        const safeTotal = Math.max(total, ahead + 1);
        const filled = Math.min(Math.round((ahead / safeTotal) * MAX), MAX);
        const bar = '█'.repeat(filled) + '░'.repeat(MAX - filled);
        return `<code>[${bar}]</code>  ${ahead}/${safeTotal}`;
    }

    let msg =
        `🎫 <b>Sizning chiptangiz</b>\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        (ticket.organization_name ? `🏛 <b>Tashkilot:</b>  ${ticket.organization_name}\n` : '') +
        (ticket.institution_name ? `🏦 <b>Bank:</b>  ${ticket.institution_name}\n` : '') +
        `🏢 <b>Filial:</b>  ${ticket.branch_name}\n` +
        `📋 <b>Xizmat:</b>  ${ticket.service_name}\n` +
        `🔢 <b>Chipta:</b>  <code>${ticket.ticket_number}</code>\n` +
        `📊 <b>Holat:</b>  ${statusLine}\n` +
        `━━━━━━━━━━━━━━━━\n`;

    if (ticket.status === 'called') {
        msg += `\n⚠️ Iltimos, xizmat oynasiga <b>darhol yaqinlashing!</b>\n`;
    } else if (peopleAhead === 0) {
        msg += `\n🎉 <b>Siz birinchisiz!</b> Tez orada chaqirilasiz.\n`;
        msg += `⏳ <b>Taxminiy kutish:</b>  ~${waitTime} daqiqa\n`;
        msg += `${buildProgressBar(0, 1)}\n`;
    } else {
        const totalInQueue = dbActions.getQueueLength(ticket.service_id);
        msg += `\n👥 <b>Siz oldida:</b>  ${peopleAhead} kishi\n`;
        msg += `⏳ <b>Taxminiy kutish:</b>  ~${waitTime} daqiqa\n`;
        msg += `\n${buildProgressBar(peopleAhead, totalInQueue)}\n`;
    }

    const opts = {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Yangilash', 'act_myticket')],
            [Markup.button.callback('❌ Chiptani bekor qilish', `cxl_${ticket.id}`)]
        ])
    };

    if (isEdit) {
        return ctx.editMessageText(msg, opts).catch(err => {
            // "message is not modified" xatosini e'tiborsiz qoldiramiz
            if (!err.description || !err.description.includes('not modified')) {
                return ctx.reply(msg, opts);
            }
        });
    }
    return ctx.reply(msg, opts);
}



// ================================================================
//  CHIPTANI BEKOR QILISH
// ================================================================

bot.action(/^cxl_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const ticketId = parseInt(ctx.match[1]);
    const success = dbActions.cancelTicket(ticketId, ctx.from.id);

    if (success) {
        await ctx.editMessageText(
            `✅ <b>Chiptangiz bekor qilindi.</b>\n\n` +
            `Qayta navbat olish uchun «🎫 Navbat olish» tugmasini bosing.`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🎫 Qayta navbat olish', 'act_orgs')]
                ])
            }
        );
    } else {
        await ctx.answerCbQuery(
            '⚠️ Chiptani bekor qilib bo\'lmadi. U allaqachon yopilgan yoki chaqirilgan.',
            { show_alert: true }
        );
    }
});

// ================================================================
//  BRANCHES BACK BUTTON
// ================================================================

bot.action('act_orgs', async (ctx) => {
    await ctx.answerCbQuery();
    await sendOrganizationsMenu(ctx, true);
});

// Old callback uchun moslik: endi bu ham tashkilot menyusini ochadi
bot.action('act_branches', async (ctx) => {
    await ctx.answerCbQuery();
    await sendOrganizationsMenu(ctx, true);
});

bot.action('act_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => { });
});

// ================================================================
//  MA'LUMOT va ALOQA
// ================================================================

bot.hears('ℹ️ Ma\'lumot', async (ctx) => {
    await ctx.reply(
        '🏛 <b>Tashkilotlar Navbat Tizimi haqida</b>\n\n' +
        '📌 Bu tizim orqali siz tashkilotga kelmasdan oldin onlayn navbat olishingiz mumkin.\n\n' +
        '<b>Qanday ishlaydi?</b>\n' +
        '1️⃣ «🎫 Navbat olish» tugmasini bosing\n' +
        '2️⃣ Tashkilotni tanlang\n' +
        '3️⃣ (Bank bo\'lsa) bankni tanlang\n' +
        '4️⃣ Filialni tanlang\n' +
        '5️⃣ Xizmat turini tanlang\n' +
        '6️⃣ Navbatingiz kelganda sizga xabar yuboriladi!\n\n' +
        '🌍 «Международный перевод» bo\'limida 8 yoki 9 kod formati bo\'yicha banklar ro\'yxatini ko\'rasiz.\n\n' +
        '⏰ <b>Ish vaqti:</b> 09:00 — 18:00 (Du-Ju)',
        { parse_mode: 'HTML' }
    );
});

bot.hears('📞 Aloqa', async (ctx) => {
    await ctx.reply(
        '📞 <b>Bog\'lanish</b>\n\n' +
        '🏦 <b>Markaziy filial:</b>\n' +
        '📍 Asosiy ko\'cha, 1\n' +
        '📱 +998 71 123 45 67\n\n' +
        '🏦 <b>Shimoliy filiali:</b>\n' +
        '📍 Shimoliy shoh ko\'chasi, 42\n' +
        '📱 +998 71 234 56 78',
        { parse_mode: 'HTML' }
    );
});

// ================================================================
//  XODIM — BOSHQARUV PANELI
// ================================================================

bot.hears('📊 Boshqaruv paneli', async (ctx) => {
    if (!ctx.state.isStaff) return;
    await sendStaffPanel(ctx, false);
});

bot.hears('🔄 Yangilash', async (ctx) => {
    if (!ctx.state.isStaff) return;
    await simulateFakeQueue();
    await ctx.reply('🔄 Yangilandi!', STAFF_MENU);
    await sendStaffPanel(ctx, false);
});

bot.hears('📋 Navbat ro\'yxati', async (ctx) => {
    if (!ctx.state.isStaff) return;
    await sendStaffQueueList(ctx);
});

bot.hears('✅ Keyingisini chaqirish', async (ctx) => {
    if (!ctx.state.isStaff) return;
    // Birinchi navbatni topamiz
    const branches = dbActions.getBranches();
    let firstTicket = null;
    let firstServiceId = null;

    for (const b of branches) {
        const services = dbActions.getServices(b.id);
        for (const s of services) {
            const t = dbActions.getNextTicket(s.id);
            if (t) { firstTicket = t; firstServiceId = s.id; break; }
        }
        if (firstTicket) break;
    }

    if (!firstTicket) {
        return ctx.reply('✅ Hozir barcha navbatlar bo\'sh!', STAFF_MENU);
    }

    // Manage panel orqali chaqirish uchun foydalanuvchiga ko'rsatamiz
    await sendStaffPanel(ctx, false);
});

bot.command('admin', async (ctx) => {
    if (!ctx.state.isStaff) return ctx.reply('⛔ Sizda ruxsat yo\'q.');
    await sendStaffPanel(ctx, false);
});

async function sendStaffPanel(ctx, isEdit) {
    const branches = dbActions.getBranches();
    const rows = [];

    branches.forEach(b => {
        const services = dbActions.getServices(b.id);
        services.forEach(s => {
            const q = dbActions.getQueueLength(s.id);
            const dot = q === 0 ? '🟢' : q < 5 ? '🟡' : '🔴';
            const orgLabel = [b.organization_name, b.institution_name].filter(Boolean).join(' › ');
            const prefix = orgLabel ? `${orgLabel} › ` : '';
            rows.push([Markup.button.callback(
                `${dot} ${prefix}${b.name} › ${s.name}  (${q} navbat)`,
                `mgr_${s.id}`
            )]);
        });
    });

    if (rows.length === 0) {
        return ctx.reply('⚠️ Mavjud xizmatlar topilmadi.', STAFF_MENU);
    }

    const totalWaiting = rows.length > 0
        ? branches.reduce((sum, b) => {
            const services = dbActions.getServices(b.id);
            return sum + services.reduce((s2, s) => s2 + dbActions.getQueueLength(s.id), 0);
        }, 0)
        : 0;

    const msg =
        `👨‍💻 <b>Xodimlar paneli</b>\n\n` +
        `📊 Umumiy navbatda: <b>${totalWaiting} kishi</b>\n\n` +
        `Boshqarish uchun navbatni tanlang:`;

    const opts = { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) };

    if (isEdit) return ctx.editMessageText(msg, opts).catch(() => ctx.reply(msg, opts));
    return ctx.reply(msg, opts);
}

async function sendStaffQueueList(ctx) {
    const branches = dbActions.getBranches();
    let msg = `📋 <b>Barcha navbatlar</b>\n\n`;
    let hasData = false;

    branches.forEach(b => {
        const services = dbActions.getServices(b.id);
        services.forEach(s => {
            const q = dbActions.getQueueLength(s.id);
            if (q > 0) {
                hasData = true;
                const orgLabel = [b.organization_name, b.institution_name].filter(Boolean).join(' › ');
                const prefix = orgLabel ? `${orgLabel} › ` : '';
                msg += `🏢 <b>${prefix}${b.name}</b> › ${s.name}: <b>${q} kishi</b>\n`;
            }
        });
    });

    if (!hasData) msg += '✅ Barcha navbatlar bo\'sh!';

    await ctx.reply(msg, { parse_mode: 'HTML', ...STAFF_MENU });
}

// ================================================================
//  XODIM — MANAGE SERVICE (inline)
// ================================================================

bot.action(/^mgr_(\d+)$/, async (ctx) => {
    if (!ctx.state.isStaff) return ctx.answerCbQuery('⛔ Ruxsat yo\'q');
    await ctx.answerCbQuery();

    const serviceId = parseInt(ctx.match[1]);
    const service = dbActions.getServiceById(serviceId);
    const branch = dbActions.getBranchByServiceId(serviceId);
    const q = dbActions.getQueueLength(serviceId);
    const nextTicket = dbActions.getNextTicket(serviceId);
    const dot = q === 0 ? '🟢' : q < 5 ? '🟡' : '🔴';

    const orgLabel = branch
        ? [branch.organization_name, branch.institution_name].filter(Boolean).join(' › ')
        : '';
    const prefix = orgLabel ? `${orgLabel} › ` : '';
    let msg =
        `🏢 <b>${prefix}${branch ? branch.name : ''}</b> › <b>${service ? service.name : ''}</b>\n\n` +
        `${dot} Navbatda: <b>${q} kishi</b>\n`;

    if (nextTicket) {
        msg += `\n👤 <b>Keyingi mijoz:</b> ${nextTicket.first_name || 'Noma\'lum'}\n`;
        msg += `🎫 <b>Chipta:</b> <code>${nextTicket.ticket_number}</code>`;
    } else {
        msg += `\n✅ Navbat bo'sh, hozir hech kim yo'q.`;
    }

    await ctx.editMessageText(msg, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback(`📢 Keyingisini chaqirish`, `nxt_${serviceId}`)],
            [Markup.button.callback('🔄 Yangilash', `mgr_${serviceId}`)],
            [Markup.button.callback('🔙 Panelga qaytish', 'act_staff')]
        ])
    }).catch(() => { });
});

bot.action('act_staff', async (ctx) => {
    if (!ctx.state.isStaff) return ctx.answerCbQuery('⛔ Ruxsat yo\'q');
    await ctx.answerCbQuery();
    await sendStaffPanel(ctx, true);
});

// ================================================================
//  KEYINGISINI CHAQIRISH (inline)
// ================================================================

bot.action(/^nxt_(\d+)$/, async (ctx) => {
    if (!ctx.state.isStaff) return ctx.answerCbQuery('⛔ Ruxsat yo\'q');
    await ctx.answerCbQuery();

    const serviceId = parseInt(ctx.match[1]);
    const ticket = dbActions.getNextTicket(serviceId);

    if (!ticket) {
        return ctx.answerCbQuery('✅ Hozir bu navbatda hech kim yo\'q.', { show_alert: true });
    }

    dbActions.callTicket(ticket.id);

    try {
        await bot.telegram.sendMessage(
            ticket.telegram_id,
            `🔔 <b>NAVBATINGIZ KELDI!</b>\n\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `🎫 Chiptangiz: <code>${ticket.ticket_number}</code>\n` +
            `━━━━━━━━━━━━━━━━\n\n` +
            `⚠️ Iltimos, <b>darhol</b> xizmat oynasiga yaqinlashing!\n` +
            `Kechikib qolsangiz, navbatingiz bekor qilinishi mumkin.`,
            { parse_mode: 'HTML' }
        );
    } catch (err) {
        console.error('Mijozga xabar yuborib bo\'lmadi:', err.message);
    }

    const service = dbActions.getServiceById(serviceId);

    await ctx.editMessageText(
        `📢 <b>Mijoz chaqirildi!</b>\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Ism:</b>  ${ticket.first_name || 'Noma\'lum'}\n` +
        `🎫 <b>Chipta:</b>  <code>${ticket.ticket_number}</code>\n` +
        `📋 <b>Xizmat:</b>  ${service ? service.name : ''}\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `Xizmat tugagach «✅ Yakunlash» tugmasini bosing.`,
        {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ Xizmatni yakunlash', `done_${ticket.id}_${serviceId}`)],
                [Markup.button.callback('⏭️ Keyingisini chaqirish', `nxt_${serviceId}`)],
                [Markup.button.callback('🔙 Navbatga qaytish', `mgr_${serviceId}`)]
            ])
        }
    );
});

// ================================================================
//  XIZMATNI YAKUNLASH
// ================================================================

bot.action(/^done_(\d+)_(\d+)$/, async (ctx) => {
    if (!ctx.state.isStaff) return ctx.answerCbQuery('⛔ Ruxsat yo\'q');
    await ctx.answerCbQuery('✅ Xizmat yakunlandi!');

    const ticketId = parseInt(ctx.match[1]);
    const serviceId = parseInt(ctx.match[2]);

    dbActions.completeTicket(ticketId);

    const service = dbActions.getServiceById(serviceId);
    const q = dbActions.getQueueLength(serviceId);

    await ctx.editMessageText(
        `✅ <b>Xizmat muvaffaqiyatli yakunlandi!</b>\n\n` +
        `📋 Xizmat: <b>${service ? service.name : ''}</b>\n` +
        `👥 Navbatda qoldi: <b>${q} kishi</b>`,
        {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📢 Keyingisini chaqirish', `nxt_${serviceId}`)],
                [Markup.button.callback('🔄 Navbatni yangilash', `mgr_${serviceId}`)],
                [Markup.button.callback('🔙 Panel', 'act_staff')]
            ])
        }
    );
});

// ================================================================
//  XATOLAR
// ================================================================

bot.catch((err, ctx) => {
    console.error(`[Xatolik] ${ctx.updateType}:`, err.message);
});


// ================================================================
//  FAKE NAVBAT SIMULYATSIYASI (Demo uchun)
//  Endi real vaqtga bog'liq emas.
//  Har safar "Yangilash" bosilganda fake navbat 1 qadam oldinga yuradi.
//  Shu orqali haqiqiy foydalanuvchilar ham progress ko'radi.
// ================================================================

// Fake user ID oralig'i (seed.js da yaratilgan)
const FAKE_USER_MIN = 200001;
const FAKE_USER_MAX = 200031;

function isFakeUser(userId) {
    return userId >= FAKE_USER_MIN && userId <= FAKE_USER_MAX;
}


// Yangilash bosilganda fake navbatni bitta qadam oldinga siljitamiz.
// Real vaqtga bog'liq emas.
async function simulateFakeQueue() {
    try {
        const db = dbActions.db;

        const fakeTicket = db.prepare(`
            SELECT t.*
            FROM tickets t
            WHERE t.status = 'waiting'
              AND t.user_id >= ${FAKE_USER_MIN}
              AND t.user_id <= ${FAKE_USER_MAX}
            ORDER BY t.created_at ASC, t.id ASC
            LIMIT 1
        `).get();

        if (!fakeTicket) {
            refillFakeQueue(db);
            return;
        }

        dbActions.callTicket(fakeTicket.id);
        dbActions.completeTicket(fakeTicket.id);
        console.log(`[Sim] Qadam bajarildi: ${fakeTicket.ticket_number} (xizmat #${fakeTicket.service_id})`);

        await notifyRealUsersPositionChange(fakeTicket.service_id);
    } catch (err) {
        console.error('[Sim] Xatolik:', err.message);
    }
}

// Haqiqiy foydalanuvchilarga pozitsiya o'zgargani haqida xabar
async function notifyRealUsersPositionChange(serviceId) {
    try {
        const db = dbActions.db;
        // Ushbu xizmatdagi haqiqiy foydalanuvchilar
        const realTickets = db.prepare(`
            SELECT t.*, u.telegram_id
            FROM tickets t
            JOIN users u ON t.user_id = u.telegram_id
            WHERE t.service_id = ? AND t.status = 'waiting'
              AND t.user_id < ${FAKE_USER_MIN}
            ORDER BY t.created_at ASC
        `).all(serviceId);

        for (const rt of realTickets) {
            const ahead = dbActions.getPeopleAhead(rt.id, serviceId);
            // Faqat 0, 1, 2, 3 qolgan bo'lsa xabar yuboramiz
            if (ahead <= 3) {
                const msg = ahead === 0
                    ? `🔔 <b>Siz navbat boshidasiz!</b>\n🎫 Chipta: <code>${rt.ticket_number}</code>\n\nTez orada chaqirilasiz, tayyor bo'ling!`
                    : `⚡️ <b>Navbatingiz yaqinlashdi!</b>\n🎫 Chipta: <code>${rt.ticket_number}</code>\n👥 Siz oldida: <b>${ahead} kishi</b>`;

                await bot.telegram.sendMessage(rt.telegram_id, msg, { parse_mode: 'HTML' })
                    .catch(() => { });
            }
        }
    } catch (err) { /* ignore */ }
}

// Fake ticketlar tugaganda yangi navbat yaratish
function refillFakeQueue(db) {
    try {
        const services = db.prepare('SELECT * FROM services').all();
        if (services.length === 0) return;

        const prefixes = {
            'Kassa xizmati': 'K', 'Kredit bo\'limi': 'KR', 'Karta xizmati': 'P',
            'Depozit bo\'limi': 'D', 'Pul o\'tkazmalari': 'T', 'Valyuta almashtirish': 'V'
        };

        const insTicket = db.prepare(
            "INSERT INTO tickets (user_id, service_id, ticket_number, status) VALUES (?, ?, ?, 'waiting')"
        );
        const insUser = db.prepare(
            'INSERT OR IGNORE INTO users (telegram_id, username, first_name, role) VALUES (?, ?, ?, ?)'
        );

        const names = ['Anvar', 'Barno', 'Diyora', 'Eldor', 'Farzona', 'Gulsanam', 'Hamza', 'Iroda'];
        let uid = FAKE_USER_MIN + Math.floor(Math.random() * 1000) + 100;

        // Har bir xizmatga 2-4 ta yangi fake ticket
        for (const svc of services.slice(0, 6)) {
            const count = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                uid++;
                const name = names[Math.floor(Math.random() * names.length)];
                insUser.run(uid, `user_${uid}`, name, 'client');
                const prefix = svc.prefix || 'T';
                const total = db.prepare('SELECT COUNT(*) as c FROM tickets WHERE service_id=?').get(svc.id).c;
                insTicket.run(uid, svc.id, `${prefix}-${total + 1}`);
            }
        }
        console.log('🔄 [Sim] Yangi fake ticketlar yaratildi.');
    } catch (err) { console.error('[Sim] Refill xatolik:', err.message); }
}

// ================================================================
//  ISHGA TUSHIRISH
// ================================================================

bot.launch().then(() => {
    console.log('✅ Bot ishga tushdi!');
    console.log(`👥 Xodimlar: ${STAFF_IDS.length > 0 ? STAFF_IDS.join(', ') : 'Belgilanmagan'}`);

    console.log('[INFO] Fake navbat simulyatsiyasi yangilash tugmasi orqali ishlaydi');

}).catch(err => {
    console.error('❌ Bot ishga tushmadi:', err.message);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));



