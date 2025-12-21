const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// === إعداد التوكنات ===
const CHARGING_BOT_TOKEN = '8223596744:AAGHOMQ3Sjk3-X_Z7eXXnL5drAXaHXglLFg';
const ADMIN_BOT_TOKEN = '8216188569:AAEEA1q_os_6XfSJrUDLDkkQxZXh-3OMAVU';

// === إعداد المدراء ===
const ADMIN_ID = 7656412227;
const SECOND_ADMIN_ID = 7450109529;
const PAYMENT_ID = '953936100';

// === إنشاء البوتات ===
const chargingBot = new TelegramBot(CHARGING_BOT_TOKEN, {
    polling: {
        interval: 300,
        autoStart: true,
        params: { timeout: 30 }
    },
    request: {
        timeout: 60000
    }
});

const adminBot = new TelegramBot(ADMIN_BOT_TOKEN, {
    polling: {
        interval: 300,
        autoStart: true,
        params: { timeout: 30 }
    },
    request: {
        timeout: 60000
    }
});

// ========== تخزين البيانات ==========
let users = {};
let services = {};
let orders = {};
const userSessions = {};
const adminSessions = {};

// ========== نظام حفظ البيانات ==========
const DATA_DIR = './bot_data';

// إنشاء مجلد البيانات إذا لم يكن موجوداً
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function saveData() {
    try {
        fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
        fs.writeFileSync(path.join(DATA_DIR, 'services.json'), JSON.stringify(services, null, 2));
        fs.writeFileSync(path.join(DATA_DIR, 'orders.json'), JSON.stringify(orders, null, 2));
        console.log('✅ تم حفظ البيانات');
    } catch (error) {
        console.error('❌ خطأ في حفظ البيانات:', error);
    }
}

function loadData() {
    try {
        // تحميل المستخدمين
        if (fs.existsSync(path.join(DATA_DIR, 'users.json'))) {
            users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json'), 'utf8'));
        }
        
        // تحميل الخدمات
        if (fs.existsSync(path.join(DATA_DIR, 'services.json'))) {
            services = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'services.json'), 'utf8'));
        } else {
            initializeDefaultServices();
        }
        
        // تحميل الطلبات
        if (fs.existsSync(path.join(DATA_DIR, 'orders.json'))) {
            orders = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'orders.json'), 'utf8'));
        }
        
        console.log(`✅ تم تحميل البيانات: ${Object.keys(users).length} مستخدم، ${Object.keys(services).length} خدمة`);
    } catch (error) {
        console.error('❌ خطأ في تحميل البيانات:', error);
        initializeDefaultServices();
    }
}

// حفظ البيانات كل دقيقة
setInterval(saveData, 60000);

// ========== تهيئة الخدمات الافتراضية ==========
function initializeDefaultServices() {
    const defaultServices = [
        {
            id: 'service_001',
            name: 'جواهر فري فاير 100+10',
            description: 'اشتري 100 جوهرة واحصل على 10 مجاناً',
            price: 1,
            stock: 100,
            category: 'جواهر',
            isActive: true,
            createdAt: new Date().toISOString()
        },
        {
            id: 'service_002',
            name: 'جواهر فري فاير 500+50',
            description: 'اشتري 500 جوهرة واحصل على 50 مجاناً',
            price: 5,
            stock: 50,
            category: 'جواهر',
            isActive: true,
            createdAt: new Date().toISOString()
        },
        {
            id: 'service_003',
            name: 'جواهر فري فاير 1000+100',
            description: 'اشتري 1000 جوهرة واحصل على 100 مجاناً',
            price: 10,
            stock: 30,
            category: 'جواهر',
            isActive: true,
            createdAt: new Date().toISOString()
        },
        {
            id: 'service_004',
            name: 'جواهر فري فاير 2000+200',
            description: 'اشتري 2000 جوهرة واحصل على 200 مجاناً',
            price: 20,
            stock: 20,
            category: 'جواهر',
            isActive: true,
            createdAt: new Date().toISOString()
        },
        {
            id: 'service_005',
            name: 'جواهر فري فاير 5000+500',
            description: 'اشتري 5000 جوهرة واحصل على 500 مجاناً',
            price: 50,
            stock: 10,
            category: 'جواهر',
            isActive: true,
            createdAt: new Date().toISOString()
        }
    ];
    
    defaultServices.forEach(service => {
        services[service.id] = service;
    });
    
    saveData();
    console.log('✅ تم تهيئة الخدمات الافتراضية');
}

// ========== دوال إدارة الخدمات ==========
function generateServiceId() {
    return 'service_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function addService(name, description, price, stock, category = 'جواهر') {
    const serviceId = generateServiceId();
    const service = {
        id: serviceId,
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        stock: parseInt(stock),
        category: category.trim(),
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    services[serviceId] = service;
    saveData();
    console.log(`✅ تمت إضافة خدمة: ${name}`);
    return service;
}

function updateService(serviceId, updates) {
    if (!services[serviceId]) return null;
    
    const service = services[serviceId];
    Object.assign(service, updates);
    service.updatedAt = new Date().toISOString();
    services[serviceId] = service;
    saveData();
    console.log(`✅ تم تحديث خدمة: ${service.name}`);
    return service;
}

function deleteService(serviceId) {
    if (!services[serviceId]) return false;
    
    const serviceName = services[serviceId].name;
    delete services[serviceId];
    saveData();
    console.log(`✅ تم حذف خدمة: ${serviceName}`);
    return true;
}

function toggleServiceStatus(serviceId) {
    if (!services[serviceId]) return null;
    
    services[serviceId].isActive = !services[serviceId].isActive;
    services[serviceId].updatedAt = new Date().toISOString();
    saveData();
    console.log(`✅ تم ${services[serviceId].isActive ? 'تفعيل' : 'تعطيل'} خدمة: ${services[serviceId].name}`);
    return services[serviceId];
}

// ========== دوال إدارة المستخدمين ==========
function getUser(userId) {
    if (!users[userId]) {
        users[userId] = {
            userId: userId,
            username: '',
            firstName: '',
            balance: 0,
            discount: 0,
            totalSpent: 0,
            ordersCount: 0,
            isActive: true,
            lastActive: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            language: 'ar'
        };
        saveData();
    }
    return users[userId];
}

function updateUser(userId, updates) {
    const user = getUser(userId);
    Object.assign(user, updates);
    user.lastActive = new Date().toISOString();
    users[userId] = user;
    saveData();
    return user;
}

// ========== دوال إدارة الطلبات ==========
function generateOrderId(type) {
    const prefix = type === 'deposit' ? 'DEP' : 'ORD';
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function createOrder(userId, type, data) {
    const orderId = generateOrderId(type);
    const user = getUser(userId);
    
    const order = {
        orderId: orderId,
        userId: userId,
        username: user.username || '',
        firstName: user.firstName || '',
        type: type,
        amount: data.amount,
        serviceName: data.serviceName || '',
        gameId: data.gameId || '',
        paymentProof: data.paymentProof || '',
        status: type === 'deposit' ? 'pending_payment' : 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: '',
        adminNotes: '',
        reviewedBy: null,
        reviewedAt: null
    };
    
    orders[orderId] = order;
    
    // تحديث إحصائيات المستخدم
    if (type !== 'deposit') {
        user.ordersCount = (user.ordersCount || 0) + 1;
        user.totalSpent = (user.totalSpent || 0) + data.amount;
    }
    
    saveData();
    console.log(`✅ تم إنشاء طلب: ${orderId} للمستخدم ${userId}`);
    return order;
}

function updateOrderStatus(orderId, status, adminId = null, notes = '') {
    if (!orders[orderId]) return null;
    
    const order = orders[orderId];
    order.status = status;
    order.updatedAt = new Date().toISOString();
    
    if (adminId) {
        order.processedBy = adminId;
        order.processedAt = new Date().toISOString();
        if (notes) {
            order.adminNotes = notes;
        }
    }
    
    orders[orderId] = order;
    saveData();
    return order;
}

// ========== إرسال الصور إلى لوحة التحكم ==========
async function sendReceiptToAdmin(order, photoId) {
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    
    const caption = `💳 *إيصال دفع جديد*\n\n` +
                   `👤 ${order.firstName || '@' + order.username}\n` +
                   `🆔 \`${order.userId}\`\n` +
                   `💰 *${order.amount}$*\n` +
                   `🆔 ${order.orderId}\n` +
                   `📅 ${new Date(order.createdAt).toLocaleString('ar-SA')}`;
    
    // إرسال الصورة مباشرة إلى كل أدمن
    for (const adminId of admins) {
        try {
            await adminBot.sendPhoto(adminId, photoId, {
                caption: caption,
                parse_mode: 'Markdown'
            });
            console.log(`✅ تم إرسال الصورة ${order.orderId} إلى الأدمن ${adminId}`);
        } catch (error) {
            console.error(`❌ فشل إرسال الصورة للإدمن ${adminId}:`, error.message);
        }
    }
    
    // إرسال رسالة التحكم المنفصلة
    const controlMessage = `🔧 *إدارة طلب الشحن*\n\n` +
                          `🆔 ${order.orderId}\n` +
                          `👤 ${order.firstName || '@' + order.username}\n` +
                          `💰 ${order.amount}$\n\n` +
                          `📸 *تم استلام الصورة أعلاه*`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ تأكيد الدفع', callback_data: `confirm_deposit_${order.orderId}` },
                { text: '❌ رفض الدفع', callback_data: `reject_deposit_${order.orderId}` }
            ],
            [
                { text: '🔍 تحت المراجعة', callback_data: `review_deposit_${order.orderId}` },
                { text: '📝 إرسال ملاحظة', callback_data: `note_deposit_${order.orderId}` }
            ]
        ]
    };
    
    for (const adminId of admins) {
        try {
            await adminBot.sendMessage(adminId, controlMessage, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } catch (error) {
            console.error(`❌ فشل إرسال رسالة التحكم للإدمن ${adminId}:`, error.message);
        }
    }
}

// ========== بوت المستخدمين ==========

chargingBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || 'بدون';
    const firstName = msg.from.first_name || '';
    
    console.log(`🟢 مستخدم جديد: ${chatId} (@${username})`);
    
    const user = getUser(chatId);
    updateUser(chatId, { username, firstName });
    
    userSessions[chatId] = null;
    
    showMainMenu(chatId, user);
});

chargingBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    console.log(`📩 رسالة من ${chatId}: ${text}`);
    
    const user = getUser(chatId);
    updateUser(chatId, {});
    
    // زر الإلغاء يعمل في أي وقت
    if (text === '🚫 إلغاء' || text === '🏠 الرئيسية') {
        userSessions[chatId] = null;
        showMainMenu(chatId, user);
        return;
    }
    
    // التحقق من الجلسة النشطة
    const session = userSessions[chatId];
    
    if (session) {
        await handleUserSession(chatId, text, msg, session, user);
        return;
    }
    
    // معالجة الأوامر الرئيسية
    switch(text) {
        case '💳 شحن رصيد':
            startDepositProcess(chatId);
            break;
            
        case '🎮 الخدمات':
            showServicesMenu(chatId, user);
            break;
            
        case '📋 طلباتي':
            showUserOrders(chatId);
            break;
            
        case '💰 رصيدي':
            showBalance(chatId, user);
            break;
            
        case '🆘 المساعدة':
            showHelp(chatId);
            break;
            
        case '📞 تواصل مع الإدارة':
            showContactAdmin(chatId);
            break;
            
        default:
            if (text.startsWith('🎮 ')) {
                const serviceName = text.replace('🎮 ', '').split(' - ')[0];
                selectService(chatId, user, serviceName);
            }
    }
});

// معالج الصور
chargingBot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions[chatId];
    
    if (session && session.type === 'awaiting_deposit_receipt') {
        await handleDepositReceipt(chatId, msg, session);
    } else {
        chargingBot.sendMessage(chatId, '❌ يرجى بدء عملية الشحن أولاً عبر زر "💳 شحن رصيد"');
    }
});

function showMainMenu(chatId, user) {
    const activeServices = Object.values(services).filter(s => s.isActive).length;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '🎮 الخدمات'],
                ['📋 طلباتي', '💰 رصيدي'],
                ['🆘 المساعدة', '📞 تواصل مع الإدارة']
            ],
            resize_keyboard: true
        }
    };
    
    const message = `🎮 *مرحباً بك في بوت شحن Free Fire*\n\n` +
                   `👤 ${user.firstName || 'عزيزي المستخدم'}\n` +
                   `💰 رصيدك: *${user.balance} دولار*\n` +
                   `🎯 خصمك: *${user.discount}%*\n` +
                   `📊 ${activeServices} خدمة متاحة\n\n` +
                   `📌 *اختر من القائمة:*`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function showServicesMenu(chatId, user) {
    const activeServices = Object.values(services)
        .filter(s => s.isActive && s.stock > 0)
        .sort((a, b) => a.price - b.price);
    
    if (activeServices.length === 0) {
        chargingBot.sendMessage(chatId,
            '⚠️ *لا توجد خدمات متاحة حالياً*\n' +
            'يرجى المحاولة لاحقاً.',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    let message = `🎮 *خدمات Free Fire*\n\n` +
                 `💰 رصيدك الحالي: *${user.balance} دولار*\n` +
                 `🎯 خصمك: *${user.discount}%*\n\n`;
    
    const keyboardRows = [];
    
    activeServices.forEach(service => {
        const finalPrice = service.price * (1 - (user.discount / 100));
        const priceText = finalPrice.toFixed(2);
        
        message += `🎮 *${service.name}*\n`;
        message += `💰 ${priceText} دولار (${service.stock} متبقي)\n`;
        message += `📝 ${service.description}\n\n`;
        
        keyboardRows.push([`🎮 ${service.name} - ${priceText} دولار`]);
    });
    
    keyboardRows.push(['🏠 الرئيسية', '🚫 إلغاء']);
    
    const keyboard = {
        reply_markup: {
            keyboard: keyboardRows,
            resize_keyboard: true
        }
    };
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function selectService(chatId, user, serviceName) {
    const service = Object.values(services)
        .find(s => s.name === serviceName && s.isActive && s.stock > 0);
    
    if (!service) {
        chargingBot.sendMessage(chatId,
            '❌ *الخدمة غير متاحة*\n' +
            'يرجى اختيار خدمة أخرى.',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const finalPrice = service.price * (1 - (user.discount / 100));
    
    if (user.balance < finalPrice) {
        chargingBot.sendMessage(chatId,
            `❌ *رصيدك غير كافي*\n\n` +
            `💰 رصيدك: ${user.balance} دولار\n` +
            `💵 السعر: ${finalPrice.toFixed(2)} دولار\n\n` +
            `يرجى شحن رصيد أولاً.`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    chargingBot.sendMessage(chatId,
        `🎮 *${service.name}*\n\n` +
        `💰 السعر: ${finalPrice.toFixed(2)} دولار\n` +
        `📝 ${service.description}\n\n` +
        `🆔 *أدخل ID الخاص بك في Free Fire:*`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء']],
                resize_keyboard: true
            }
        }
    );
    
    userSessions[chatId] = {
        type: 'awaiting_game_id',
        serviceId: service.id,
        serviceName: service.name,
        price: finalPrice,
        username: user.username
    };
}

async function handleUserSession(chatId, text, msg, session, user) {
    try {
        if (session.type === 'awaiting_deposit_amount') {
            await handleDepositAmount(chatId, text, user);
        } else if (session.type === 'awaiting_game_id') {
            await handleGameId(chatId, text, session, user);
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة الجلسة:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة مرة أخرى');
        userSessions[chatId] = null;
        showMainMenu(chatId, user);
    }
}

async function handleGameId(chatId, text, session, user) {
    const gameId = text.trim();
    
    if (!gameId || gameId.length < 3) {
        chargingBot.sendMessage(chatId,
            '❌ *ID غير صالح*\n' +
            'الرجاء إدخال ID صحيح للعبة',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // خصم المبلغ
    user.balance -= session.price;
    user.totalSpent += session.price;
    user.ordersCount += 1;
    updateUser(chatId, user);
    
    // تحديث المخزون
    const service = services[session.serviceId];
    if (service) {
        service.stock -= 1;
        if (service.stock <= 0) {
            service.isActive = false;
        }
        services[session.serviceId] = service;
        saveData();
    }
    
    // إنشاء الطلب
    const order = createOrder(chatId, 'service', {
        username: session.username,
        amount: session.price,
        serviceName: session.serviceName,
        gameId: gameId
    });
    
    // إرسال إشعار للإدارة
    await sendOrderNotification(order);
    
    userSessions[chatId] = null;
    
    chargingBot.sendMessage(chatId,
        `✅ *تم تقديم طلبك بنجاح!*\n\n` +
        `🎮 الخدمة: ${session.serviceName}\n` +
        `💰 المبلغ: ${session.price} دولار\n` +
        `🆔 رقم الطلب: ${order.orderId}\n` +
        `🎮 ID اللعبة: ${gameId}\n\n` +
        `⏳ جاري تنفيذ طلبك...\n` +
        `سيتم إعلامك عند اكتماله.`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🏠 الرئيسية', '📋 طلباتي']],
                resize_keyboard: true
            }
        }
    );
}

function startDepositProcess(chatId) {
    chargingBot.sendMessage(chatId,
        `💳 *شحن الرصيد*\n\n` +
        `أدخل المبلغ الذي تريد شحنه (بالدولار):\n` +
        `مثال: 5 أو 10.5`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء']],
                resize_keyboard: true
            }
        }
    );
    
    userSessions[chatId] = {
        type: 'awaiting_deposit_amount',
        step: 1
    };
}

async function handleDepositAmount(chatId, text, user) {
    const amount = parseFloat(text);
    
    if (isNaN(amount) || amount <= 0) {
        chargingBot.sendMessage(chatId, '❌ الرجاء إدخال مبلغ صحيح');
        return;
    }
    
    chargingBot.sendMessage(chatId,
        `💰 *طلب شحن رصيد*\n\n` +
        `💵 المبلغ: *${amount} دولار*\n\n` +
        `📋 *تعليمات الدفع:*\n` +
        `1. قم بتحويل *${amount} دولار* إلى:\n` +
        `   🆔 *${PAYMENT_ID}*\n` +
        `2. بعد التحويل، أرسل *صورة إيصال الدفع* هنا\n\n` +
        `📸 *أرسل صورة الإيصال الآن:*\n` +
        `(يجب أن تظهر التفاصيل بوضوح)`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء']],
                resize_keyboard: true
            }
        }
    );
    
    userSessions[chatId] = {
        type: 'awaiting_deposit_receipt',
        amount: amount,
        username: user.username
    };
}

async function handleDepositReceipt(chatId, msg, session) {
    try {
        const photoId = msg.photo[msg.photo.length - 1].file_id;
        
        console.log(`📸 تم استلام صورة إيصال من ${chatId}`);
        
        // إنشاء طلب الشحن
        const order = createOrder(chatId, 'deposit', {
            username: session.username,
            amount: session.amount,
            paymentProof: photoId
        });
        
        userSessions[chatId] = null;
        
        // إرسال إشعار للمستخدم
        chargingBot.sendMessage(chatId,
            `✅ *تم استلام إيصال الدفع بنجاح!*\n\n` +
            `💰 المبلغ: ${session.amount} دولار\n` +
            `🆔 رقم الطلب: ${order.orderId}\n\n` +
            `⏳ *جاري مراجعة الإيصال...*\n` +
            `سيتم إعلامك عند التأكيد خلال دقائق.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [['🏠 الرئيسية', '📋 طلباتي']],
                    resize_keyboard: true
                }
            }
        );
        
        // إرسال الصورة مباشرة إلى الإدارة
        await sendReceiptToAdmin(order, photoId);
        
    } catch (error) {
        console.error('❌ خطأ في معالجة الإيصال:', error);
        chargingBot.sendMessage(chatId, 
            '❌ حدث خطأ في معالجة الصورة\n' +
            'يرجى المحاولة مرة أخرى أو التواصل مع الإدارة'
        );
    }
}

function showUserOrders(chatId) {
    const userOrders = Object.values(orders)
        .filter(o => o.userId == chatId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (userOrders.length === 0) {
        chargingBot.sendMessage(chatId,
            '📭 *لا توجد طلبات سابقة*',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    let message = `📋 *طلباتي*\n\n`;
    
    userOrders.slice(0, 10).forEach(order => {
        const icon = order.type === 'deposit' ? '💳' : '🎮';
        const status = getStatusText(order.status);
        
        message += `${icon} *${order.serviceName || 'شحن رصيد'}*\n`;
        message += `💰 ${order.amount} دولار | ${status}\n`;
        message += `🆔 ${order.orderId}\n`;
        if (order.gameId) {
            message += `🎮 ID: ${order.gameId}\n`;
        }
        if (order.adminNotes) {
            message += `📝 ملاحظة: ${order.adminNotes}\n`;
        }
        message += `📅 ${new Date(order.createdAt).toLocaleString('ar-SA')}\n\n`;
    });
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

function showBalance(chatId, user) {
    chargingBot.sendMessage(chatId,
        `💰 *معلومات الرصيد*\n\n` +
        `💵 الرصيد: *${user.balance} دولار*\n` +
        `🎯 الخصم: *${user.discount}%*\n` +
        `📊 إجمالي المشتريات: *${user.totalSpent} دولار*\n` +
        `📦 عدد الطلبات: *${user.ordersCount}*`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['💳 شحن رصيد', '🏠 الرئيسية']],
                resize_keyboard: true
            }
        }
    );
}

function showHelp(chatId) {
    const helpText = `🆘 *دليل الاستخدام*\n\n` +
                    `💳 *شحن الرصيد:*\n` +
                    `1. اضغط "💳 شحن رصيد"\n` +
                    `2. أدخل المبلغ\n` +
                    `3. أرسل صورة الإيصال\n` +
                    `4. انتظر التأكيد من الإدارة\n\n` +
                    `🎮 *شراء الخدمات:*\n` +
                    `1. اضغط "🎮 الخدمات"\n` +
                    `2. اختر الخدمة\n` +
                    `3. أدخل ID اللعبة\n` +
                    `4. انتظر التنفيذ\n\n` +
                    `📞 *تواصل مع الإدارة:*\n` +
                    `للشكاوى أو الاستفسارات\n\n` +
                    `🚫 *لإلغاء أي عملية:*\n` +
                    `اضغط على زر "🚫 إلغاء"`;
    
    chargingBot.sendMessage(chatId, helpText, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

function showContactAdmin(chatId) {
    chargingBot.sendMessage(chatId,
        `📞 *تواصل مع الإدارة*\n\n` +
        `للاستفسارات والشكاوى:\n` +
        `📧 تيليجرام: @otzha_admin\n\n` +
        `⏰ ساعات العمل: 24/7`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🏠 الرئيسية']],
                resize_keyboard: true
            }
        }
    );
}

function getStatusText(status) {
    const statusMap = {
        'pending': '⏳ قيد الانتظار',
        'pending_payment': '💰 بانتظار الدفع',
        'reviewing': '🔍 قيد المراجعة',
        'completed': '✅ مكتمل',
        'cancelled': '❌ ملغى',
        'rejected': '❌ مرفوض'
    };
    return statusMap[status] || status;
}

// ========== إرسال الإشعارات للإدارة ==========

async function sendOrderNotification(order) {
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    
    const message = `📦 *طلب خدمة جديد*\n\n` +
                   `👤 ${order.firstName || '@' + order.username}\n` +
                   `🆔 \`${order.userId}\`\n` +
                   `🎮 ${order.serviceName}\n` +
                   `💰 ${order.amount} دولار\n` +
                   `🎮 ID: \`${order.gameId}\`\n` +
                   `🆔 ${order.orderId}\n` +
                   `📅 ${new Date(order.createdAt).toLocaleString('ar-SA')}`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ إكمال', callback_data: `complete_${order.orderId}` },
                { text: '❌ إلغاء', callback_data: `cancel_${order.orderId}` }
            ],
            [
                { text: '📝 ملاحظة', callback_data: `note_${order.orderId}` }
            ]
        ]
    };
    
    for (const adminId of admins) {
        try {
            await adminBot.sendMessage(adminId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } catch (error) {
            console.error(`❌ فشل إرسال إشعار للإدمن ${adminId}:`, error.message);
        }
    }
}

// ========== بوت الإدارة ==========

adminBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    if (![ADMIN_ID, SECOND_ADMIN_ID].includes(parseInt(chatId))) {
        adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول');
        return;
    }
    
    console.log(`👑 أدمن دخل: ${chatId}`);
    
    adminSessions[chatId] = null;
    showAdminMainMenu(chatId);
});

adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (![ADMIN_ID, SECOND_ADMIN_ID].includes(parseInt(chatId))) return;
    
    if (!text || text.startsWith('/')) return;
    
    console.log(`📩 أدمن: ${text}`);
    
    if (text === '🚫 إلغاء' || text === '🏠 الرئيسية') {
        adminSessions[chatId] = null;
        showAdminMainMenu(chatId);
        return;
    }
    
    const session = adminSessions[chatId];
    
    if (session) {
        await handleAdminSession(chatId, text, msg, session);
        return;
    }
    
    switch(text) {
        case '📊 الإحصائيات':
            showAdminStats(chatId);
            break;
            
        case '📦 إدارة الخدمات':
            showServicesManagement(chatId);
            break;
            
        case '🆕 إضافة خدمة':
            startAddServiceProcess(chatId);
            break;
            
        case '📋 الطلبات':
            showAllOrders(chatId);
            break;
            
        case '💳 طلبات الشحن':
            showDepositOrders(chatId);
            break;
            
        case '👥 المستخدمين':
            showUsersList(chatId);
            break;
            
        case '🔄 تحديث':
            showAdminMainMenu(chatId);
            break;
            
        default:
            if (text.startsWith('✏️ تعديل ')) {
                const serviceId = text.replace('✏️ تعديل ', '');
                startEditServiceProcess(chatId, serviceId);
            } else if (text.startsWith('🗑️ حذف ')) {
                const serviceId = text.replace('🗑️ حذف ', '');
                confirmDeleteService(chatId, serviceId);
            } else if (text.startsWith('🔁 ')) {
                const serviceId = text.replace('🔁 ', '');
                toggleServiceStatusAndNotify(chatId, serviceId);
            }
    }
});

function showAdminMainMenu(chatId) {
    const pendingOrders = Object.values(orders)
        .filter(o => o.status === 'pending').length;
    
    const pendingDeposits = Object.values(orders)
        .filter(o => o.type === 'deposit' && o.status === 'pending_payment').length;
    
    const activeServices = Object.values(services).filter(s => s.isActive).length;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['📦 إدارة الخدمات', '📋 الطلبات'],
                ['💳 طلبات الشحن', '👥 المستخدمين'],
                ['📊 الإحصائيات', '🔄 تحديث'],
                ['🆕 إضافة خدمة', '🚫 إلغاء']
            ],
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId,
        `👑 *لوحة تحكم Free Fire*\n\n` +
        `📊 *الإحصائيات الحية:*\n` +
        `📦 الخدمات: ${Object.keys(services).length} (${activeServices} مفعلة)\n` +
        `📋 طلبات خدمات: ${pendingOrders}\n` +
        `💳 طلبات شحن: ${pendingDeposits}\n` +
        `👥 المستخدمين: ${Object.keys(users).length}\n\n` +
        `🎯 *اختر من القائمة:*`,
        { parse_mode: 'Markdown', ...keyboard }
    );
}

function showServicesManagement(chatId) {
    const allServices = Object.values(services)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (allServices.length === 0) {
        adminBot.sendMessage(chatId,
            '📭 *لا توجد خدمات*\n' +
            'استخدم "🆕 إضافة خدمة" للبدء.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [['🆕 إضافة خدمة', '🏠 الرئيسية']],
                    resize_keyboard: true
                }
            }
        );
        return;
    }
    
    let message = `📦 *إدارة خدمات Free Fire*\n\n`;
    
    allServices.slice(0, 10).forEach((service, index) => {
        const status = service.isActive ? '🟢' : '🔴';
        message += `${index + 1}. ${status} *${service.name}*\n`;
        message += `   💰 ${service.price} دولار | 📦 ${service.stock}\n`;
        message += `   🆔 \`${service.id}\`\n\n`;
    });
    
    const keyboardRows = [];
    
    allServices.slice(0, 3).forEach(service => {
        keyboardRows.push([
            `✏️ تعديل ${service.id}`,
            `🗑️ حذف ${service.id}`
        ]);
        keyboardRows.push([
            `🔁 ${service.id}`
        ]);
    });
    
    keyboardRows.push(['🆕 إضافة خدمة']);
    keyboardRows.push(['🏠 الرئيسية', '🚫 إلغاء']);
    
    const keyboard = {
        reply_markup: {
            keyboard: keyboardRows,
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function startAddServiceProcess(chatId) {
    adminSessions[chatId] = {
        type: 'adding_service',
        step: 1,
        data: {}
    };
    
    adminBot.sendMessage(chatId,
        `🆕 *إضافة خدمة جديدة لـ Free Fire*\n\n` +
        `*الخطوة 1/4:* أدخل اسم الخدمة\n` +
        `مثال: "جواهر فري فاير 5000+500"`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء']],
                resize_keyboard: true
            }
        }
    );
}

async function handleAdminSession(chatId, text, msg, session) {
    try {
        if (session.type === 'adding_service') {
            await handleAddServiceStep(chatId, text, session);
        } else if (session.type === 'editing_service') {
            await handleEditServiceStep(chatId, text, session);
        } else if (session.type === 'deleting_service') {
            await handleDeleteService(chatId, text, session);
        } else if (session.type === 'adding_note') {
            await handleAddNote(chatId, text, session);
        } else if (session.type === 'rejecting_deposit') {
            await handleRejectDepositReason(chatId, text, session);
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة جلسة الأدمن:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة مرة أخرى');
        adminSessions[chatId] = null;
        showAdminMainMenu(chatId);
    }
}

async function handleAddNote(chatId, text, session) {
    const order = orders[session.orderId];
    
    if (order) {
        order.adminNotes = text;
        order.updatedAt = new Date().toISOString();
        orders[session.orderId] = order;
        saveData();
        
        // إرسال الملاحظة للمستخدم
        chargingBot.sendMessage(order.userId,
            `📝 *ملاحظة من الإدارة*\n\n` +
            `🆔 ${order.orderId}\n` +
            `📝 ${text}`,
            { parse_mode: 'Markdown' }
        );
        
        adminBot.sendMessage(chatId,
            `✅ *تم إرسال الملاحظة للمستخدم*\n\n` +
            `👤 ${order.firstName || '@' + order.username}\n` +
            `📝 ${text}`,
            { parse_mode: 'Markdown' }
        );
    }
    
    adminSessions[chatId] = null;
}

async function handleRejectDepositReason(chatId, text, session) {
    const order = updateOrderStatus(session.orderId, 'rejected', chatId, text);
    
    if (order) {
        // إشعار المستخدم
        chargingBot.sendMessage(order.userId,
            `❌ *تم رفض إيصال الدفع*\n\n` +
            `💰 ${order.amount} دولار\n` +
            `🆔 ${order.orderId}\n\n` +
            `📝 *السبب:* ${text}\n\n` +
            `💡 يرجى إرسال إيصال دفع صالح`,
            { parse_mode: 'Markdown' }
        );
        
        adminBot.sendMessage(chatId,
            `✅ *تم رفض الدفع وإرسال السبب للمستخدم*\n\n` +
            `👤 ${order.firstName || '@' + order.username}\n` +
            `📝 ${text}`,
            { parse_mode: 'Markdown' }
        );
    }
    
    adminSessions[chatId] = null;
}

async function handleAddServiceStep(chatId, text, session) {
    switch(session.step) {
        case 1:
            session.data.name = text;
            session.step = 2;
            adminBot.sendMessage(chatId,
                `✅ *تم حفظ الاسم*\n\n` +
                `*الخطوة 2/4:* أدخل وصف الخدمة\n` +
                `مثال: "اشتري 5000 جوهرة واحصل على 500 مجاناً"`,
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 2:
            session.data.description = text;
            session.step = 3;
            adminBot.sendMessage(chatId,
                `✅ *تم حفظ الوصف*\n\n` +
                `*الخطوة 3/4:* أدخل سعر الخدمة (دولار)\n` +
                `مثال: "45" أو "10.5"`,
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 3:
            const price = parseFloat(text);
            if (isNaN(price) || price <= 0) {
                adminBot.sendMessage(chatId, '❌ سعر غير صالح');
                return;
            }
            session.data.price = price;
            session.step = 4;
            adminBot.sendMessage(chatId,
                `✅ *تم حفظ السعر*\n\n` +
                `*الخطوة 4/4:* أدخل كمية المخزون\n` +
                `مثال: "100"`,
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 4:
            const stock = parseInt(text);
            if (isNaN(stock) || stock < 0) {
                adminBot.sendMessage(chatId, '❌ مخزون غير صالح');
                return;
            }
            session.data.stock = stock;
            
            // إضافة الخدمة
            const service = addService(
                session.data.name,
                session.data.description,
                session.data.price,
                session.data.stock,
                'جواهر'
            );
            
            adminSessions[chatId] = null;
            
            adminBot.sendMessage(chatId,
                `🎉 *تمت إضافة الخدمة بنجاح!*\n\n` +
                `🎮 ${service.name}\n` +
                `💰 ${service.price} دولار\n` +
                `📦 ${service.stock}\n` +
                `🆔 ${service.id}\n\n` +
                `✅ الخدمة متاحة الآن للمستخدمين`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [['📦 إدارة الخدمات', '🏠 الرئيسية']],
                        resize_keyboard: true
                    }
                }
            );
            break;
    }
    
    adminSessions[chatId] = session;
}

function startEditServiceProcess(chatId, serviceId) {
    const service = services[serviceId];
    
    if (!service) {
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        return;
    }
    
    adminSessions[chatId] = {
        type: 'editing_service',
        serviceId: serviceId,
        step: 1
    };
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                [`✏️ تعديل اسم ${serviceId}`],
                [`✏️ تعديل وصف ${serviceId}`],
                [`✏️ تعديل سعر ${serviceId}`],
                [`✏️ تعديل مخزون ${serviceId}`],
                ['🚫 إلغاء']
            ],
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId,
        `✏️ *تعديل خدمة Free Fire*\n\n` +
        `🎮 ${service.name}\n` +
        `💰 ${service.price} دولار | 📦 ${service.stock}\n` +
        `🆔 ${service.id}\n\n` +
        `اختر ما تريد تعديله:`,
        {
            parse_mode: 'Markdown',
            ...keyboard
        }
    );
}

async function handleEditServiceStep(chatId, text, session) {
    const service = services[session.serviceId];
    
    if (!service) {
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        adminSessions[chatId] = null;
        return;
    }
    
    if (text.startsWith('✏️ تعديل اسم ')) {
        session.editingField = 'name';
        adminBot.sendMessage(chatId,
            `✏️ *تعديل الاسم*\n\n` +
            `الاسم الحالي: ${service.name}\n\n` +
            `أدخل الاسم الجديد:`,
            { parse_mode: 'Markdown' }
        );
    } else if (text.startsWith('✏️ تعديل وصف ')) {
        session.editingField = 'description';
        adminBot.sendMessage(chatId,
            `✏️ *تعديل الوصف*\n\n` +
            `الوصف الحالي: ${service.description}\n\n` +
            `أدخل الوصف الجديد:`,
            { parse_mode: 'Markdown' }
        );
    } else if (text.startsWith('✏️ تعديل سعر ')) {
        session.editingField = 'price';
        adminBot.sendMessage(chatId,
            `✏️ *تعديل السعر*\n\n` +
            `السعر الحالي: ${service.price} دولار\n\n` +
            `أدخل السعر الجديد:`,
            { parse_mode: 'Markdown' }
        );
    } else if (text.startsWith('✏️ تعديل مخزون ')) {
        session.editingField = 'stock';
        adminBot.sendMessage(chatId,
            `✏️ *تعديل المخزون*\n\n` +
            `المخزون الحالي: ${service.stock}\n\n` +
            `أدخل المخزون الجديد:`,
            { parse_mode: 'Markdown' }
        );
    } else {
        let value = text;
        let isValid = true;
        
        if (session.editingField === 'price') {
            value = parseFloat(text);
            if (isNaN(value) || value <= 0) {
                adminBot.sendMessage(chatId, '❌ سعر غير صالح');
                isValid = false;
            }
        } else if (session.editingField === 'stock') {
            value = parseInt(text);
            if (isNaN(value) || value < 0) {
                adminBot.sendMessage(chatId, '❌ مخزون غير صالح');
                isValid = false;
            }
        }
        
        if (isValid) {
            const updates = {};
            updates[session.editingField] = value;
            updateService(session.serviceId, updates);
            
            adminSessions[chatId] = null;
            
            adminBot.sendMessage(chatId,
                `✅ *تم التعديل بنجاح*\n\n` +
                `🎮 ${service.name}\n` +
                `🔄 ${session.editingField}: ${value}`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [['📦 إدارة الخدمات', '🏠 الرئيسية']],
                        resize_keyboard: true
                    }
                }
            );
        }
    }
    
    adminSessions[chatId] = session;
}

function confirmDeleteService(chatId, serviceId) {
    const service = services[serviceId];
    
    if (!service) {
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        return;
    }
    
    adminSessions[chatId] = {
        type: 'deleting_service',
        serviceId: serviceId
    };
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['✅ نعم، احذف الخدمة'],
                ['🚫 لا، إلغاء الحذف']
            ],
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId,
        `⚠️ *تأكيد حذف الخدمة*\n\n` +
        `🎮 ${service.name}\n` +
        `💰 ${service.price} دولار\n` +
        `📦 ${service.stock}\n` +
        `🆔 ${service.id}\n\n` +
        `❌ *تحذير:* لا يمكن التراجع عن الحذف!\n` +
        `هل أنت متأكد؟`,
        {
            parse_mode: 'Markdown',
            ...keyboard
        }
    );
}

async function handleDeleteService(chatId, text, session) {
    if (text === '✅ نعم، احذف الخدمة') {
        const service = services[session.serviceId];
        
        if (service) {
            const deleted = deleteService(session.serviceId);
            
            if (deleted) {
                adminSessions[chatId] = null;
                
                adminBot.sendMessage(chatId,
                    `🗑️ *تم حذف الخدمة*\n\n` +
                    `🎮 ${service.name}\n` +
                    `✅ تم الحذف بنجاح`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            keyboard: [['📦 إدارة الخدمات', '🏠 الرئيسية']],
                            resize_keyboard: true
                        }
                    }
                );
            }
        }
    } else {
        adminSessions[chatId] = null;
        adminBot.sendMessage(chatId, '✅ تم إلغاء عملية الحذف');
        showAdminMainMenu(chatId);
    }
}

function toggleServiceStatusAndNotify(chatId, serviceId) {
    const service = toggleServiceStatus(serviceId);
    
    if (service) {
        adminBot.sendMessage(chatId,
            `🔄 *تم تغيير الحالة*\n\n` +
            `🎮 ${service.name}\n` +
            `📊 ${service.isActive ? '🟢 مفعل' : '🔴 معطل'}`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [['📦 إدارة الخدمات', '🏠 الرئيسية']],
                    resize_keyboard: true
                }
            }
        );
    }
}

// ========== معالجة Callback Queries ==========

adminBot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    
    if (![ADMIN_ID, SECOND_ADMIN_ID].includes(parseInt(chatId))) {
        adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ غير مصرح' });
        return;
    }
    
    try {
        if (data.startsWith('complete_')) {
            const orderId = data.replace('complete_', '');
            await handleCompleteOrder(callbackQuery, orderId, chatId);
            
        } else if (data.startsWith('cancel_')) {
            const orderId = data.replace('cancel_', '');
            await handleCancelOrder(callbackQuery, orderId, chatId);
            
        } else if (data.startsWith('confirm_deposit_')) {
            const orderId = data.replace('confirm_deposit_', '');
            await handleConfirmDeposit(callbackQuery, orderId, chatId);
            
        } else if (data.startsWith('reject_deposit_')) {
            const orderId = data.replace('reject_deposit_', '');
            await handleRejectDeposit(callbackQuery, orderId, chatId);
            
        } else if (data.startsWith('review_deposit_')) {
            const orderId = data.replace('review_deposit_', '');
            await handleReviewDeposit(callbackQuery, orderId, chatId);
            
        } else if (data.startsWith('note_') || data.startsWith('note_deposit_')) {
            const orderId = data.replace('note_', '').replace('note_deposit_', '');
            await startAddNoteProcess(chatId, orderId);
        }
        
    } catch (error) {
        console.error('❌ خطأ في Callback:', error);
        adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ حدث خطأ' });
    }
});

async function handleCompleteOrder(callbackQuery, orderId, adminId) {
    const order = updateOrderStatus(orderId, 'completed', adminId);
    
    if (order) {
        // إشعار المستخدم
        chargingBot.sendMessage(order.userId,
            `✅ *تم إكمال طلبك*\n\n` +
            `🎮 ${order.serviceName}\n` +
            `💰 ${order.amount} دولار\n` +
            `🆔 ${order.orderId}\n\n` +
            `🎉 تم التنفيذ بنجاح!`,
            { parse_mode: 'Markdown' }
        );
        
        adminBot.answerCallbackQuery(callbackQuery.id, { text: '✅ تم الإكمال' });
    }
}

async function handleCancelOrder(callbackQuery, orderId, adminId) {
    const order = updateOrderStatus(orderId, 'cancelled', adminId);
    
    if (order) {
        // إرجاع المبلغ للمستخدم
        const user = getUser(order.userId);
        user.balance += order.amount;
        updateUser(order.userId, user);
        
        // إشعار المستخدم
        chargingBot.sendMessage(order.userId,
            `❌ *تم إلغاء طلبك*\n\n` +
            `🎮 ${order.serviceName}\n` +
            `💰 ${order.amount} دولار\n` +
            `🆔 ${order.orderId}\n\n` +
            `💳 تم إرجاع ${order.amount} دولار إلى رصيدك`,
            { parse_mode: 'Markdown' }
        );
        
        adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ تم الإلغاء' });
    }
}

async function handleConfirmDeposit(callbackQuery, orderId, adminId) {
    const order = updateOrderStatus(orderId, 'completed', adminId, 'تم تأكيد الدفع');
    
    if (order) {
        // إضافة الرصيد للمستخدم
        const user = getUser(order.userId);
        user.balance += order.amount;
        user.totalSpent += order.amount;
        updateUser(order.userId, user);
        
        // إشعار المستخدم
        chargingBot.sendMessage(order.userId,
            `✅ *تم تأكيد شحن رصيدك*\n\n` +
            `💰 ${order.amount} دولار\n` +
            `💳 الرصيد الجديد: ${user.balance} دولار\n` +
            `🆔 ${order.orderId}\n\n` +
            `🎉 يمكنك الآن شراء الخدمات`,
            { parse_mode: 'Markdown' }
        );
        
        adminBot.answerCallbackQuery(callbackQuery.id, { text: '✅ تم التأكيد' });
    }
}

async function handleRejectDeposit(callbackQuery, orderId, adminId) {
    adminSessions[callbackQuery.message.chat.id] = {
        type: 'rejecting_deposit',
        orderId: orderId
    };
    
    adminBot.sendMessage(callbackQuery.message.chat.id,
        `❌ *سبب رفض الدفع*\n\n` +
        `أدخل سبب الرفض لإرساله للمستخدم:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء']],
                resize_keyboard: true
            }
        }
    );
    
    adminBot.answerCallbackQuery(callbackQuery.id, { text: '📝 أدخل سبب الرفض' });
}

async function handleReviewDeposit(callbackQuery, orderId, adminId) {
    const order = updateOrderStatus(orderId, 'reviewing', adminId, 'قيد المراجعة');
    
    if (order) {
        // إشعار المستخدم
        chargingBot.sendMessage(order.userId,
            `🔍 *طلبك قيد المراجعة*\n\n` +
            `💰 ${order.amount} دولار\n` +
            `🆔 ${order.orderId}\n\n` +
            `⏳ جاري مراجعة الإيصال...\n` +
            `سيتم إعلامك بالنتيجة قريباً`,
            { parse_mode: 'Markdown' }
        );
        
        adminBot.answerCallbackQuery(callbackQuery.id, { text: '🔍 وضع تحت المراجعة' });
    }
}

async function startAddNoteProcess(chatId, orderId) {
    const order = orders[orderId];
    
    if (!order) {
        adminBot.sendMessage(chatId, '❌ الطلب غير موجود');
        return;
    }
    
    adminSessions[chatId] = {
        type: 'adding_note',
        orderId: orderId
    };
    
    adminBot.sendMessage(chatId,
        `📝 *إرسال ملاحظة للمستخدم*\n\n` +
        `👤 ${order.firstName || '@' + order.username}\n` +
        `🆔 ${orderId}\n\n` +
        `أدخل الملاحظة لإرسالها:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء']],
                resize_keyboard: true
            }
        }
    );
}

// ========== دوال مساعدة للوحة التحكم ==========

function showAdminStats(chatId) {
    const totalUsers = Object.keys(users).length;
    const totalOrders = Object.keys(orders).length;
    const completedOrders = Object.values(orders).filter(o => o.status === 'completed').length;
    const pendingDeposits = Object.values(orders).filter(o => o.type === 'deposit' && o.status === 'pending_payment').length;
    const totalRevenue = Object.values(orders)
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + o.amount, 0);
    
    adminBot.sendMessage(chatId,
        `📊 *إحصائيات مفصلة*\n\n` +
        `👥 المستخدمين: ${totalUsers}\n` +
        `📦 إجمالي الطلبات: ${totalOrders}\n` +
        `✅ المكتملة: ${completedOrders}\n` +
        `💳 بانتظار الدفع: ${pendingDeposits}\n` +
        `💰 الإيرادات: ${totalRevenue.toFixed(2)} دولار\n\n` +
        `📅 آخر تحديث: ${new Date().toLocaleString('ar-SA')}`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🏠 الرئيسية']],
                resize_keyboard: true
            }
        }
    );
}

function showAllOrders(chatId) {
    const allOrders = Object.values(orders)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (allOrders.length === 0) {
        adminBot.sendMessage(chatId, '📭 *لا توجد طلبات*', { parse_mode: 'Markdown' });
        return;
    }
    
    let message = '📋 *جميع الطلبات*\n\n';
    
    allOrders.slice(0, 10).forEach(order => {
        const icon = order.type === 'deposit' ? '💳' : '🎮';
        const status = getStatusText(order.status);
        
        message += `${icon} *${order.serviceName || 'شحن رصيد'}*\n`;
        message += `👤 @${order.username} | 💰 ${order.amount} دولار\n`;
        message += `🆔 ${order.orderId} | ${status}\n`;
        message += `📅 ${new Date(order.createdAt).toLocaleString('ar-SA')}\n\n`;
    });
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

function showDepositOrders(chatId) {
    const depositOrders = Object.values(orders)
        .filter(o => o.type === 'deposit')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (depositOrders.length === 0) {
        adminBot.sendMessage(chatId, '💳 *لا توجد طلبات شحن*', { parse_mode: 'Markdown' });
        return;
    }
    
    let message = '💳 *طلبات الشحن*\n\n';
    
    depositOrders.slice(0, 10).forEach(order => {
        const status = getStatusText(order.status);
        message += `💰 *${order.amount} دولار*\n`;
        message += `👤 ${order.firstName || '@' + order.username}\n`;
        message += `🆔 ${order.orderId} | ${status}\n`;
        if (order.adminNotes) {
            message += `📝 ${order.adminNotes}\n`;
        }
        message += `\n`;
    });
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

function showUsersList(chatId) {
    const allUsers = Object.values(users)
        .sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
    
    if (allUsers.length === 0) {
        adminBot.sendMessage(chatId, '👥 *لا يوجد مستخدمين*', { parse_mode: 'Markdown' });
        return;
    }
    
    let message = '👥 *المستخدمين*\n\n';
    
    allUsers.slice(0, 10).forEach(user => {
        const userOrders = Object.values(orders).filter(o => o.userId == user.userId);
        const lastOrder = userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        
        message += `👤 ${user.firstName || '@' + user.username}\n`;
        message += `💰 ${user.balance} دولار | 📦 ${user.ordersCount}\n`;
        message += `💳 ${user.totalSpent} دولار | 🆔 ${user.userId}\n`;
        if (lastOrder) {
            message += `📅 آخر طلب: ${new Date(lastOrder.createdAt).toLocaleDateString('ar-SA')}\n`;
        }
        message += `\n`;
    });
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

// ========== تشغيل النظام ==========

console.log('🚀 بدء تشغيل نظام بوتات Free Fire...');

// تحميل البيانات
loadData();

console.log('✅ النظام جاهز للعمل!');
console.log(`🤖 بوت المستخدمين: جاهز`);
console.log(`👑 بوت الإدارة: جاهز`);
console.log(`📊 الخدمات: ${Object.keys(services).length}`);
console.log(`👥 المستخدمين: ${Object.keys(users).length}`);
console.log(`💳 معرف الدفع: ${PAYMENT_ID}`);

// تشغيل سيرفر ويب بسيط
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`🎮 نظام بوتات Free Fire يعمل بنجاح\n👥 المستخدمين: ${Object.keys(users).length}\n📦 الطلبات: ${Object.keys(orders).length}\n📅 ${new Date().toLocaleString('ar-SA')}`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 السيرفر يعمل على المنفذ: ${PORT}`);
});

// حفظ البيانات عند إغلاق البرنامج
process.on('SIGINT', () => {
    console.log('📀 حفظ البيانات قبل الإغلاق...');
    saveData();
    process.exit(0);
});

console.log('🎉 تم تشغيل النظام بنجاح!');
