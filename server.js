const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

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
let receipts = {};
const userSessions = {};
const adminSessions = {};

// ========== نظام حفظ البيانات المحسن ==========
const DATA_DIR = './bot_data';
const RECEIPTS_DIR = './bot_data/receipts';

// إنشاء مجلدات البيانات إذا لم تكن موجودة
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(RECEIPTS_DIR)) {
    fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

// دالة لتنزيل الصور
async function downloadPhoto(fileId, botToken, orderId) {
    try {
        const file = await axios.get(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
        const filePath = file.data.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
        
        const localPath = path.join(RECEIPTS_DIR, `${orderId}.jpg`);
        const writer = fs.createWriteStream(localPath);
        
        return new Promise((resolve, reject) => {
            https.get(downloadUrl, (response) => {
                response.pipe(writer);
                writer.on('finish', () => {
                    writer.close();
                    resolve(localPath);
                });
                writer.on('error', reject);
            }).on('error', reject);
        });
    } catch (error) {
        console.error('❌ خطأ في تنزيل الصورة:', error);
        throw error;
    }
}

function saveData() {
    try {
        fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
        fs.writeFileSync(path.join(DATA_DIR, 'services.json'), JSON.stringify(services, null, 2));
        fs.writeFileSync(path.join(DATA_DIR, 'orders.json'), JSON.stringify(orders, null, 2));
        fs.writeFileSync(path.join(DATA_DIR, 'receipts.json'), JSON.stringify(receipts, null, 2));
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
        }
        
        // تحميل الطلبات
        if (fs.existsSync(path.join(DATA_DIR, 'orders.json'))) {
            orders = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'orders.json'), 'utf8'));
        }
        
        // تحميل الإيصالات
        if (fs.existsSync(path.join(DATA_DIR, 'receipts.json'))) {
            receipts = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'receipts.json'), 'utf8'));
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
        }
    ];
    
    defaultServices.forEach(service => {
        services[service.id] = service;
    });
    
    saveData();
    console.log('✅ تم تهيئة الخدمات الافتراضية');
}

// ========== دوال إدارة الخدمات المحسنة ==========
function generateServiceId() {
    return 'service_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function addService(name, description, price, stock, category = 'عام') {
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

async function createOrder(userId, type, data) {
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
        adminReview: {
            reviewedBy: null,
            reviewedAt: null,
            status: 'pending',
            comments: ''
        }
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

function updateOrderStatus(orderId, status, adminId = null, comments = '') {
    if (!orders[orderId]) return null;
    
    const order = orders[orderId];
    order.status = status;
    order.updatedAt = new Date().toISOString();
    
    if (adminId) {
        order.processedBy = adminId;
        order.processedAt = new Date().toISOString();
        
        // تحديث قسم المراجعة
        order.adminReview = {
            reviewedBy: adminId,
            reviewedAt: new Date().toISOString(),
            status: status === 'completed' ? 'approved' : 'rejected',
            comments: comments || ''
        };
    }
    
    orders[orderId] = order;
    saveData();
    return order;
}

// ========== إدارة الإيصالات ==========
async function saveReceipt(orderId, fileId, botToken) {
    try {
        const localPath = await downloadPhoto(fileId, botToken, orderId);
        
        receipts[orderId] = {
            orderId: orderId,
            fileId: fileId,
            localPath: localPath,
            savedAt: new Date().toISOString(),
            status: 'active'
        };
        
        saveData();
        console.log(`✅ تم حفظ إيصال للطلب: ${orderId}`);
        return localPath;
    } catch (error) {
        console.error(`❌ خطأ في حفظ إيصال: ${orderId}`, error);
        throw error;
    }
}

// ========== بوت المستخدمين (@Diamouffbot) ==========

chargingBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || 'بدون';
    const firstName = msg.from.first_name || '';
    
    console.log(`🟢 مستخدم جديد: ${chatId} (@${username})`);
    
    const user = getUser(chatId);
    updateUser(chatId, { username, firstName });
    
    userSessions[chatId] = null; // مسح أي جلسة سابقة
    
    showMainMenu(chatId, user);
});

chargingBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    console.log(`📩 رسالة من ${chatId}: ${text}`);
    
    const user = getUser(chatId);
    updateUser(chatId, {}); // تحديث النشاط
    
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
            
        default:
            // إذا كان النص يبدأ باختيار خدمة
            if (text.startsWith('🎮 ')) {
                const serviceName = text.replace('🎮 ', '').split(' - ')[0];
                selectService(chatId, user, serviceName);
            }
    }
});

function showMainMenu(chatId, user) {
    const activeServices = Object.values(services).filter(s => s.isActive).length;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '🎮 الخدمات'],
                ['📋 طلباتي', '💰 رصيدي'],
                ['🆘 المساعدة', '🚫 إلغاء']
            ],
            resize_keyboard: true
        }
    };
    
    const message = `🎮 *مرحباً بك في بوت شحن Free Fire*\n\n` +
                   `👤 ${user.firstName || 'عزيزي المستخدم'}\n` +
                   `💰 رصيدك: *${user.balance}$*\n` +
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
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    if (activeServices.length === 0) {
        chargingBot.sendMessage(chatId,
            '⚠️ *لا توجد خدمات متاحة حالياً*\n' +
            'يرجى المحاولة لاحقاً.',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    let message = `🎮 *الخدمات المتاحة*\n\n` +
                 `💰 رصيدك الحالي: *${user.balance}$*\n\n`;
    
    const keyboardRows = [];
    
    activeServices.forEach(service => {
        const finalPrice = service.price * (1 - (user.discount / 100));
        const priceText = finalPrice.toFixed(2);
        
        message += `🎮 *${service.name}*\n`;
        message += `   💰 ${priceText}$ (${service.stock} متبقي)\n`;
        message += `   📝 ${service.description}\n\n`;
        
        keyboardRows.push([`🎮 ${service.name} - ${priceText}$`]);
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
            `💰 رصيدك: ${user.balance}$\n` +
            `💵 السعر: ${finalPrice.toFixed(2)}$\n\n` +
            `يرجى شحن رصيد أولاً.`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    chargingBot.sendMessage(chatId,
        `🎮 *${service.name}*\n\n` +
        `💰 السعر: ${finalPrice.toFixed(2)}$\n` +
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
        } else if (session.type === 'awaiting_deposit_receipt') {
            if (msg.photo) {
                await handleDepositReceipt(chatId, msg, session, user);
            } else {
                chargingBot.sendMessage(chatId, '❌ يرجى إرسال صورة الإيصال');
            }
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
    const order = await createOrder(chatId, 'service', {
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
        `💰 المبلغ: ${session.price}$\n` +
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
        `💵 المبلغ: *${amount}$*\n\n` +
        `📋 *تعليمات الدفع:*\n` +
        `1. قم بتحويل *${amount}$* إلى:\n` +
        `   🆔 *${PAYMENT_ID}*\n` +
        `2. بعد التحويل، أرسل *صورة إيصال الدفع* هنا\n\n` +
        `📸 *أرسل صورة الإيصال الآن:*`,
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

async function handleDepositReceipt(chatId, msg, session, user) {
    try {
        const photoId = msg.photo[msg.photo.length - 1].file_id;
        
        // إنشاء طلب الشحن
        const order = await createOrder(chatId, 'deposit', {
            username: session.username,
            amount: session.amount,
            paymentProof: photoId
        });
        
        // حفظ الإيصال
        await saveReceipt(order.orderId, photoId, CHARGING_BOT_TOKEN);
        
        // إرسال إشعار للإدارة
        await sendDepositNotification(order, photoId);
        
        userSessions[chatId] = null;
        
        chargingBot.sendMessage(chatId,
            `✅ *تم استلام إيصال الدفع*\n\n` +
            `💰 المبلغ: ${session.amount}$\n` +
            `🆔 رقم الطلب: ${order.orderId}\n\n` +
            `⏳ جاري مراجعة الإيصال...\n` +
            `سيتم إعلامك عند التأكيد.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [['🏠 الرئيسية', '📋 طلباتي']],
                    resize_keyboard: true
                }
            }
        );
        
    } catch (error) {
        console.error('❌ خطأ في معالجة الإيصال:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ في معالجة الصورة، يرجى إعادة المحاولة');
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
        
        message += `${icon} ${order.serviceName || 'شحن رصيد'}\n`;
        message += `💰 ${order.amount}$ | ${status}\n`;
        message += `🆔 ${order.orderId}\n\n`;
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
        `💵 الرصيد: *${user.balance}$*\n` +
        `🎯 الخصم: *${user.discount}%*\n` +
        `📊 إجمالي المشتريات: *${user.totalSpent}$*\n` +
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
                    `4. انتظر التأكيد (1-5 دقائق)\n\n` +
                    `🎮 *شراء الخدمات:*\n` +
                    `1. اضغط "🎮 الخدمات"\n` +
                    `2. اختر الخدمة\n` +
                    `3. أدخل ID اللعبة\n` +
                    `4. انتظر التنفيذ (1-10 دقائق)\n\n` +
                    `📞 *للتواصل مع الدعم:*\n` +
                    `@otzhabot (بوت الدعم)\n\n` +
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

function getStatusText(status) {
    const statusMap = {
        'pending': '⏳ قيد الانتظار',
        'pending_payment': '💳 بانتظار الدفع',
        'completed': '✅ مكتمل',
        'cancelled': '❌ ملغى',
        'under_review': '🔍 قيد المراجعة'
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
                   `💰 ${order.amount}$\n` +
                   `🎮 ID: \`${order.gameId}\`\n` +
                   `🆔 ${order.orderId}`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ إكمال', callback_data: `complete_${order.orderId}` },
                { text: '❌ إلغاء', callback_data: `cancel_${order.orderId}` },
                { text: '✏️ تعليق', callback_data: `comment_${order.orderId}` }
            ],
            [
                { text: '📊 تفاصيل الطلب', callback_data: `details_${order.orderId}` }
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

async function sendDepositNotification(order, photoId) {
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    
    const message = `💳 *طلب شحن جديد*\n\n` +
                   `👤 ${order.firstName || '@' + order.username}\n` +
                   `🆔 \`${order.userId}\`\n` +
                   `💰 ${order.amount}$\n` +
                   `🆔 ${order.orderId}\n\n` +
                   `📊 *خيارات:*`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ تأكيد', callback_data: `confirm_deposit_${order.orderId}` },
                { text: '❌ رفض', callback_data: `reject_deposit_${order.orderId}` },
                { text: '✏️ تعليق', callback_data: `comment_deposit_${order.orderId}` }
            ],
            [
                { text: '🔍 عرض الإيصال', callback_data: `view_receipt_${order.orderId}` },
                { text: '📊 تفاصيل الطلب', callback_data: `deposit_details_${order.orderId}` }
            ]
        ]
    };
    
    for (const adminId of admins) {
        try {
            await adminBot.sendPhoto(adminId, photoId, {
                caption: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } catch (error) {
            console.error(`❌ فشل إرسال إشعار للإدمن ${adminId}:`, error.message);
            
            // محاولة إرسال الرسالة بدون صورة
            try {
                await adminBot.sendMessage(adminId, 
                    `💳 *طلب شحن جديد*\n\n` +
                    `👤 ${order.firstName || '@' + order.username}\n` +
                    `🆔 \`${order.userId}\`\n` +
                    `💰 ${order.amount}$\n` +
                    `🆔 ${order.orderId}\n\n` +
                    `📸 *ملاحظة:* لم يتم تحميل صورة الإيصال\n` +
                    `استخدم زر "🔍 عرض الإيصال" لمشاهدته`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
            } catch (error2) {
                console.error(`❌ فشل إرسال الرسالة النصية للإدمن ${adminId}:`, error2.message);
            }
        }
    }
}

// ========== بوت الإدارة (@otzhabot) ==========

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
    
    // زر الإلغاء يعمل في أي وقت
    if (text === '🚫 إلغاء' || text === '🏠 الرئيسية') {
        adminSessions[chatId] = null;
        showAdminMainMenu(chatId);
        return;
    }
    
    const session = adminSessions[chatId];
    
    if (session) {
        await handleAdminSession(chatId, text, session);
        return;
    }
    
    // معالجة الأوامر الرئيسية
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
            
        case '💳 الشحنات':
            showDepositOrders(chatId);
            break;
            
        case '👥 المستخدمين':
            showUsersList(chatId);
            break;
            
        case '🔄 تحديث':
            showAdminMainMenu(chatId);
            break;
            
        case '🔍 بحث':
            adminSessions[chatId] = { type: 'searching' };
            adminBot.sendMessage(chatId, '🔍 *ابحث عن طلب أو مستخدم:*\n\n' +
                'أدخل:\n' +
                '- رقم الطلب (مثل DEP_123)\n' +
                '- ID المستخدم\n' +
                '- اسم المستخدم (بدون @)',
                { parse_mode: 'Markdown' }
            );
            break;
            
        default:
            // التحقق من أزرار الخدمات
            if (text.startsWith('✏️ تعديل ')) {
                const serviceId = text.replace('✏️ تعديل ', '');
                startEditServiceProcess(chatId, serviceId);
            } else if (text.startsWith('🗑️ حذف ')) {
                const serviceId = text.replace('🗑️ حذف ', '');
                confirmDeleteService(chatId, serviceId);
            } else if (text.startsWith('🔁 ')) {
                const serviceId = text.replace('🔁 ', '');
                toggleServiceStatusAndNotify(chatId, serviceId);
            } else if (text.startsWith('📊 ')) {
                const orderId = text.replace('📊 ', '');
                showOrderDetails(chatId, orderId);
            }
    }
});

// ========== دالة البحث ==========
async function handleAdminSession(chatId, text, session) {
    try {
        if (session.type === 'searching') {
            await handleSearch(chatId, text);
        } else if (session.type === 'adding_service') {
            await handleAddServiceStep(chatId, text, session);
        } else if (session.type === 'editing_service') {
            await handleEditServiceStep(chatId, text, session);
        } else if (session.type === 'deleting_service') {
            await handleDeleteService(chatId, text, session);
        } else if (session.type === 'awaiting_comment') {
            await handleAdminComment(chatId, text, session);
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة جلسة الأدمن:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة مرة أخرى');
        adminSessions[chatId] = null;
        showAdminMainMenu(chatId);
    }
}

async function handleSearch(chatId, text) {
    const searchTerm = text.trim();
    
    // البحث عن طريق رقم الطلب
    if (orders[searchTerm]) {
        showOrderDetails(chatId, searchTerm);
        return;
    }
    
    // البحث عن طريق ID المستخدم
    if (users[searchTerm]) {
        const user = users[searchTerm];
        const userOrders = Object.values(orders).filter(o => o.userId == searchTerm);
        
        adminBot.sendMessage(chatId,
            `👤 *المستخدم*\n\n` +
            `🆔: ${user.userId}\n` +
            `👤: ${user.firstName || 'بدون'}\n` +
            `📱: @${user.username || 'بدون'}\n` +
            `💰 الرصيد: ${user.balance}$\n` +
            `📊 الطلبات: ${user.ordersCount}\n` +
            `💵 إجمالي المشتريات: ${user.totalSpent}$\n` +
            `🕒 آخر نشاط: ${new Date(user.lastActive).toLocaleString('ar-SA')}`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // البحث عن طريق اسم المستخدم
    const userByUsername = Object.values(users).find(u => u.username === searchTerm);
    if (userByUsername) {
        const user = userByUsername;
        adminBot.sendMessage(chatId,
            `👤 *المستخدم*\n\n` +
            `🆔: ${user.userId}\n` +
            `👤: ${user.firstName || 'بدون'}\n` +
            `📱: @${user.username || 'بدون'}\n` +
            `💰 الرصيد: ${user.balance}$\n` +
            `📊 الطلبات: ${user.ordersCount}\n` +
            `💵 إجمالي المشتريات: ${user.totalSpent}$`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    adminBot.sendMessage(chatId, '❌ *لم يتم العثور على نتائج*\n\nحاول البحث بـ:\n- رقم الطلب\n- ID المستخدم\n- اسم المستخدم', 
        { parse_mode: 'Markdown' });
}

function showAdminMainMenu(chatId) {
    const pendingOrders = Object.values(orders)
        .filter(o => o.status === 'pending' || o.status === 'pending_payment').length;
    
    const activeServices = Object.values(services).filter(s => s.isActive).length;
    const pendingDeposits = Object.values(orders).filter(o => o.type === 'deposit' && o.status === 'pending_payment').length;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['📦 إدارة الخدمات', '📋 الطلبات'],
                ['💳 الشحنات', '👥 المستخدمين'],
                ['📊 الإحصائيات', '🆕 إضافة خدمة'],
                ['🔍 بحث', '🔄 تحديث'],
                ['🚫 إلغاء']
            ],
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId,
        `👑 *لوحة التحكم*\n\n` +
        `📊 *الإحصائيات:*\n` +
        `📦 الخدمات: ${Object.keys(services).length} (${activeServices} مفعلة)\n` +
        `📋 طلبات الخدمات: ${pendingOrders}\n` +
        `💳 طلبات الشحن: ${pendingDeposits}\n` +
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
    
    let message = `📦 *إدارة الخدمات*\n\n`;
    
    allServices.slice(0, 10).forEach((service, index) => {
        const status = service.isActive ? '🟢' : '🔴';
        message += `${index + 1}. ${status} *${service.name}*\n`;
        message += `   💰 ${service.price}$ | 📦 ${service.stock}\n`;
        message += `   🆔 \`${service.id}\`\n\n`;
    });
    
    // أزرار التحكم
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
    
    keyboardRows.push(['🆕 إضافة خدمة', '📋 جميع الخدمات']);
    keyboardRows.push(['🏠 الرئيسية', '🔍 بحث']);
    keyboardRows.push(['🚫 إلغاء']);
    
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
        `🆕 *إضافة خدمة جديدة*\n\n` +
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
                `*الخطوة 3/4:* أدخل سعر الخدمة ($)\n` +
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
                `💰 ${service.price}$\n` +
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
        `✏️ *تعديل الخدمة*\n\n` +
        `🎮 ${service.name}\n` +
        `💰 ${service.price}$ | 📦 ${service.stock}\n` +
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
            `السعر الحالي: ${service.price}$\n\n` +
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
        // معالجة القيمة الجديدة
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
        `💰 ${service.price}$\n` +
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

// ========== معالجة Callback Queries المحسنة ==========

adminBot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;
    
    if (![ADMIN_ID, SECOND_ADMIN_ID].includes(parseInt(chatId))) {
        adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ غير مصرح' });
        return;
    }
    
    try {
        if (data.startsWith('complete_')) {
            const orderId = data.replace('complete_', '');
            const order = updateOrderStatus(orderId, 'completed', chatId);
            
            if (order) {
                // إشعار المستخدم
                chargingBot.sendMessage(order.userId,
                    `✅ *تم إكمال طلبك*\n\n` +
                    `🎮 ${order.serviceName}\n` +
                    `💰 ${order.amount}$\n` +
                    `🆔 ${order.orderId}\n\n` +
                    `🎉 تم التنفيذ بنجاح!`,
                    { parse_mode: 'Markdown' }
                );
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: '✅ تم الإكمال' });
                adminBot.sendMessage(chatId, `✅ تم إكمال الطلب ${orderId}`);
            }
            
        } else if (data.startsWith('cancel_')) {
            const orderId = data.replace('cancel_', '');
            const order = updateOrderStatus(orderId, 'cancelled', chatId);
            
            if (order) {
                // إرجاع المبلغ للمستخدم
                const user = getUser(order.userId);
                user.balance += order.amount;
                updateUser(order.userId, user);
                
                // إشعار المستخدم
                chargingBot.sendMessage(order.userId,
                    `❌ *تم إلغاء طلبك*\n\n` +
                    `🎮 ${order.serviceName}\n` +
                    `💰 ${order.amount}$\n` +
                    `🆔 ${order.orderId}\n\n` +
                    `💳 تم إرجاع ${order.amount}$ إلى رصيدك`,
                    { parse_mode: 'Markdown' }
                );
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ تم الإلغاء' });
                adminBot.sendMessage(chatId, `❌ تم إلغاء الطلب ${orderId}`);
            }
            
        } else if (data.startsWith('confirm_deposit_')) {
            const orderId = data.replace('confirm_deposit_', '');
            const order = updateOrderStatus(orderId, 'completed', chatId);
            
            if (order) {
                // إضافة الرصيد للمستخدم
                const user = getUser(order.userId);
                user.balance += order.amount;
                user.totalSpent += order.amount;
                updateUser(order.userId, user);
                
                // إشعار المستخدم
                chargingBot.sendMessage(order.userId,
                    `✅ *تم تأكيد شحن رصيدك*\n\n` +
                    `💰 ${order.amount}$\n` +
                    `💳 الرصيد الجديد: ${user.balance}$\n` +
                    `🆔 ${order.orderId}\n\n` +
                    `🎉 تمت العملية بنجاح!`,
                    { parse_mode: 'Markdown' }
                );
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: '✅ تم التأكيد' });
                adminBot.sendMessage(chatId, `✅ تم تأكيد شحن ${order.amount}$ للطلب ${orderId}`);
            }
            
        } else if (data.startsWith('reject_deposit_')) {
            const orderId = data.replace('reject_deposit_', '');
            const order = updateOrderStatus(orderId, 'cancelled', chatId);
            
            if (order) {
                // إشعار المستخدم
                chargingBot.sendMessage(order.userId,
                    `❌ *فشل تأكيد الدفع*\n\n` +
                    `💰 ${order.amount}$\n` +
                    `🆔 ${order.orderId}\n\n` +
                    `⚠️ يرجى التحقق من الإيصال والمحاولة مرة أخرى`,
                    { parse_mode: 'Markdown' }
                );
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ تم الرفض' });
                adminBot.sendMessage(chatId, `❌ تم رفض طلب الشحن ${orderId}`);
            }
            
        } else if (data.startsWith('comment_') || data.startsWith('comment_deposit_')) {
            const orderId = data.startsWith('comment_deposit_') ? 
                data.replace('comment_deposit_', '') : 
                data.replace('comment_', '');
            
            adminSessions[chatId] = {
                type: 'awaiting_comment',
                orderId: orderId
            };
            
            adminBot.answerCallbackQuery(callbackQuery.id, { text: '📝 أرسل التعليق' });
            
            adminBot.sendMessage(chatId,
                `📝 *إضافة تعليق للطلب*\n\n` +
                `🆔 ${orderId}\n\n` +
                `أدخل تعليقك:`,
                { parse_mode: 'Markdown' }
            );
            
        } else if (data.startsWith('view_receipt_')) {
            const orderId = data.replace('view_receipt_', '');
            await showReceiptImage(chatId, orderId);
            adminBot.answerCallbackQuery(callbackQuery.id, { text: '📸 جاري تحميل الإيصال' });
            
        } else if (data.startsWith('details_') || data.startsWith('deposit_details_')) {
            const orderId = data.startsWith('deposit_details_') ? 
                data.replace('deposit_details_', '') : 
                data.replace('details_', '');
            
            showOrderDetails(chatId, orderId);
            adminBot.answerCallbackQuery(callbackQuery.id, { text: '📊 جاري تحميل التفاصيل' });
        }
        
    } catch (error) {
        console.error('❌ خطأ في Callback:', error);
        adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ حدث خطأ' });
    }
});

// ========== دوال مساعدة للوحة التحكم ==========

async function showReceiptImage(chatId, orderId) {
    const order = orders[orderId];
    if (!order) {
        adminBot.sendMessage(chatId, '❌ الطلب غير موجود');
        return;
    }
    
    if (order.type !== 'deposit') {
        adminBot.sendMessage(chatId, '❌ هذا الطلب ليس شحن رصيد');
        return;
    }
    
    // محاولة إرسال الصورة المحفوظة
    const receipt = receipts[orderId];
    if (receipt && receipt.localPath && fs.existsSync(receipt.localPath)) {
        try {
            await adminBot.sendPhoto(chatId, receipt.localPath, {
                caption: `📸 *إيصال الدفع*\n\n` +
                        `🆔 ${orderId}\n` +
                        `👤 ${order.firstName || '@' + order.username}\n` +
                        `💰 ${order.amount}$\n` +
                        `🕒 ${new Date(order.createdAt).toLocaleString('ar-SA')}`,
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error('❌ خطأ في إرسال الصورة المحفوظة:', error);
            // محاولة استخدام fileId
            await sendReceiptFromFileId(chatId, order);
        }
    } else {
        // محاولة استخدام fileId
        await sendReceiptFromFileId(chatId, order);
    }
}

async function sendReceiptFromFileId(chatId, order) {
    if (order.paymentProof) {
        try {
            await adminBot.sendPhoto(chatId, order.paymentProof, {
                caption: `📸 *إيصال الدفع*\n\n` +
                        `🆔 ${order.orderId}\n` +
                        `👤 ${order.firstName || '@' + order.username}\n` +
                        `💰 ${order.amount}$\n` +
                        `🕒 ${new Date(order.createdAt).toLocaleString('ar-SA')}`,
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error('❌ خطأ في إرسال الصورة من fileId:', error);
            adminBot.sendMessage(chatId,
                `📸 *إيصال الدفع*\n\n` +
                `🆔 ${order.orderId}\n` +
                `👤 ${order.firstName || '@' + order.username}\n` +
                `💰 ${order.amount}$\n` +
                `🕒 ${new Date(order.createdAt).toLocaleString('ar-SA')}\n\n` +
                `⚠️ *لم يتمكن النظام من تحميل الصورة*\n` +
                `قد تكون الصورة محذوفة أو غير متاحة`,
                { parse_mode: 'Markdown' }
            );
        }
    } else {
        adminBot.sendMessage(chatId,
            `📸 *إيصال الدفع*\n\n` +
            `🆔 ${order.orderId}\n` +
            `👤 ${order.firstName || '@' + order.username}\n` +
            `💰 ${order.amount}$\n\n` +
            `⚠️ *لا يوجد إيصال متاح*`,
            { parse_mode: 'Markdown' }
        );
    }
}

function showOrderDetails(chatId, orderId) {
    const order = orders[orderId];
    if (!order) {
        adminBot.sendMessage(chatId, '❌ الطلب غير موجود');
        return;
    }
    
    const user = getUser(order.userId);
    const statusText = getStatusText(order.status);
    const typeText = order.type === 'deposit' ? '💳 شحن رصيد' : '🎮 خدمة';
    
    let message = `📊 *تفاصيل الطلب*\n\n`;
    message += `🆔: ${order.orderId}\n`;
    message += `📋: ${typeText}\n`;
    message += `📊: ${statusText}\n`;
    message += `💰: ${order.amount}$\n`;
    message += `👤: ${order.firstName || 'بدون'} (@${order.username || 'بدون'})\n`;
    message += `🆔 المستخدم: \`${order.userId}\`\n`;
    
    if (order.type === 'service') {
        message += `🎮: ${order.serviceName}\n`;
        message += `🎮 ID: \`${order.gameId}\`\n`;
    } else if (order.type === 'deposit') {
        message += `📸: ${order.paymentProof ? '✅' : '❌'}\n`;
    }
    
    message += `🕒 الإنشاء: ${new Date(order.createdAt).toLocaleString('ar-SA')}\n`;
    
    if (order.processedAt) {
        message += `🕒 المعالجة: ${new Date(order.processedAt).toLocaleString('ar-SA')}\n`;
        message += `👨‍💼 المعالج: ${order.processedBy}\n`;
    }
    
    // إضافة تفاصيل المراجعة
    if (order.adminReview && order.adminReview.reviewedBy) {
        message += `\n📝 *المراجعة:*\n`;
        message += `✅: ${order.adminReview.reviewedBy}\n`;
        message += `🕒: ${new Date(order.adminReview.reviewedAt).toLocaleString('ar-SA')}\n`;
        message += `📌: ${order.adminReview.comments || 'لا يوجد تعليقات'}\n`;
    }
    
    const keyboard = {
        inline_keyboard: []
    };
    
    if (order.type === 'deposit') {
        if (order.status === 'pending_payment') {
            keyboard.inline_keyboard.push([
                { text: '✅ تأكيد', callback_data: `confirm_deposit_${orderId}` },
                { text: '❌ رفض', callback_data: `reject_deposit_${orderId}` },
                { text: '✏️ تعليق', callback_data: `comment_deposit_${orderId}` }
            ]);
        }
        keyboard.inline_keyboard.push([
            { text: '🔍 عرض الإيصال', callback_data: `view_receipt_${orderId}` }
        ]);
    } else {
        if (order.status === 'pending') {
            keyboard.inline_keyboard.push([
                { text: '✅ إكمال', callback_data: `complete_${orderId}` },
                { text: '❌ إلغاء', callback_data: `cancel_${orderId}` },
                { text: '✏️ تعليق', callback_data: `comment_${orderId}` }
            ]);
        }
    }
    
    keyboard.inline_keyboard.push([
        { text: '👤 عرض المستخدم', url: `tg://user?id=${order.userId}` }
    ]);
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

async function handleAdminComment(chatId, text, session) {
    const orderId = session.orderId;
    const order = orders[orderId];
    
    if (!order) {
        adminBot.sendMessage(chatId, '❌ الطلب غير موجود');
        adminSessions[chatId] = null;
        return;
    }
    
    // تحديث التعليق
    if (!order.adminReview) {
        order.adminReview = {};
    }
    order.adminReview.comments = text;
    order.adminReview.reviewedBy = chatId;
    order.adminReview.reviewedAt = new Date().toISOString();
    
    orders[orderId] = order;
    saveData();
    
    // إرسال إشعار للمستخدم
    chargingBot.sendMessage(order.userId,
        `📝 *تحديث على طلبك*\n\n` +
        `🆔 ${order.orderId}\n` +
        `📌 تعليق الأدمن: ${text}\n\n` +
        `⏳ جاري معالجة طلبك...`,
        { parse_mode: 'Markdown' }
    );
    
    adminSessions[chatId] = null;
    
    adminBot.sendMessage(chatId,
        `✅ *تم إضافة التعليق*\n\n` +
        `🆔 ${orderId}\n` +
        `📝 ${text}`,
        { parse_mode: 'Markdown' }
    );
}

function showAdminStats(chatId) {
    const totalUsers = Object.keys(users).length;
    const totalOrders = Object.keys(orders).length;
    const completedOrders = Object.values(orders).filter(o => o.status === 'completed').length;
    const pendingOrders = Object.values(orders).filter(o => o.status === 'pending').length;
    const pendingDeposits = Object.values(orders).filter(o => o.type === 'deposit' && o.status === 'pending_payment').length;
    const totalRevenue = Object.values(orders)
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + o.amount, 0);
    
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = Object.values(orders)
        .filter(o => o.createdAt.split('T')[0] === today);
    const todayRevenue = todayOrders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + o.amount, 0);
    
    adminBot.sendMessage(chatId,
        `📊 *إحصائيات مفصلة*\n\n` +
        `👥 المستخدمين: ${totalUsers}\n` +
        `📦 الطلبات الكلية: ${totalOrders}\n` +
        `✅ المكتملة: ${completedOrders}\n` +
        `⏳ المنتظرة: ${pendingOrders}\n` +
        `💳 الشحنات المنتظرة: ${pendingDeposits}\n\n` +
        `💰 الإيرادات الكلية: ${totalRevenue.toFixed(2)}$\n` +
        `📅 إيرادات اليوم: ${todayRevenue.toFixed(2)}$\n` +
        `📦 طلبات اليوم: ${todayOrders.length}`,
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
    
    // تصنيف الطلبات
    const pendingOrders = allOrders.filter(o => o.status === 'pending' || o.status === 'pending_payment');
    const completedOrders = allOrders.filter(o => o.status === 'completed');
    const cancelledOrders = allOrders.filter(o => o.status === 'cancelled');
    
    let message = '📋 *لوحة الطلبات*\n\n';
    message += `⏳ قيد الانتظار: ${pendingOrders.length}\n`;
    message += `✅ مكتملة: ${completedOrders.length}\n`;
    message += `❌ ملغية: ${cancelledOrders.length}\n\n`;
    
    message += '📦 *أحدث الطلبات:*\n\n';
    
    allOrders.slice(0, 5).forEach(order => {
        const icon = order.type === 'deposit' ? '💳' : '🎮';
        const status = getStatusText(order.status);
        
        message += `${icon} ${order.serviceName || 'شحن رصيد'}\n`;
        message += `👤 @${order.username} | 💰 ${order.amount}$\n`;
        message += `🆔 ${order.orderId} | ${status}\n`;
        message += `📊 ${order.adminReview?.comments ? '📝' : ''}\n\n`;
    });
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['📋 الطلبات النشطة', '📋 الطلبات المكتملة'],
                ['📊 تفاصيل الطلبات', '🔍 بحث عن طلب'],
                ['🏠 الرئيسية']
            ],
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function showDepositOrders(chatId) {
    const depositOrders = Object.values(orders)
        .filter(o => o.type === 'deposit' && o.status === 'pending_payment');
    
    if (depositOrders.length === 0) {
        adminBot.sendMessage(chatId, '💳 *لا توجد طلبات شحن*', { parse_mode: 'Markdown' });
        return;
    }
    
    let message = `💳 *طلبات الشحن*\n\n`;
    message += `📊 بانتظار التأكيد: ${depositOrders.length}\n\n`;
    
    depositOrders.slice(0, 5).forEach(order => {
        message += `💰 ${order.amount}$\n`;
        message += `👤 ${order.firstName || '@' + order.username}\n`;
        message += `🆔 ${order.orderId}\n\n`;
    });
    
    const keyboard = {
        inline_keyboard: []
    };
    
    depositOrders.slice(0, 3).forEach(order => {
        keyboard.inline_keyboard.push([
            { text: `✅ ${order.orderId}`, callback_data: `confirm_deposit_${order.orderId}` },
            { text: `❌ ${order.orderId}`, callback_data: `reject_deposit_${order.orderId}` }
        ]);
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
    
    // تصنيف المستخدمين
    const activeUsers = allUsers.filter(u => {
        const lastActive = new Date(u.lastActive);
        const now = new Date();
        const diffDays = (now - lastActive) / (1000 * 60 * 60 * 24);
        return diffDays < 7;
    });
    
    const topSpenders = [...allUsers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
    
    let message = '👥 *إدارة المستخدمين*\n\n';
    message += `📊 المستخدمين الكلي: ${allUsers.length}\n`;
    message += `🟢 النشطون (أسبوع): ${activeUsers.length}\n\n`;
    
    message += '🏆 *أكثر المستخدمين إنفاقاً:*\n\n';
    
    topSpenders.forEach((user, index) => {
        message += `${index + 1}. ${user.firstName || '@' + user.username}\n`;
        message += `   💰 ${user.totalSpent}$ | 📦 ${user.ordersCount}\n`;
        message += `   🆔 \`${user.userId}\`\n\n`;
    });
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['👥 المستخدمين النشطين', '👥 المستخدمين الجدد'],
                ['💰 تعديل رصيد مستخدم', '🎯 تعديل خصم مستخدم'],
                ['🏠 الرئيسية']
            ],
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

// ========== تشغيل النظام ==========

console.log('🚀 بدء تشغيل نظام البوتات...');

// تحميل البيانات
loadData();

// تثبيت حزم npm المطلوبة
console.log('📦 التأكد من حزم Node.js...');
try {
    // التأكد من وجود axios
    require('axios');
    console.log('✅ حزمة axios مثبتة');
} catch (error) {
    console.log('❌ يرجى تثبيت axios: npm install axios');
    process.exit(1);
}

console.log('✅ النظام جاهز للعمل!');
console.log(`🤖 بوت المستخدمين (@Diamouffbot): جاهز`);
console.log(`👑 بوت الإدارة (@otzhabot): جاهز`);
console.log(`📊 الخدمات: ${Object.keys(services).length}`);
console.log(`👥 المستخدمين: ${Object.keys(users).length}`);
console.log(`📦 الطلبات: ${Object.keys(orders).length}`);

// تشغيل سيرفر ويب بسيط
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    
    const stats = `
        <html dir="rtl">
        <head>
            <title>نظام بوتات Free Fire</title>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
                .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
                .stat-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border-right: 4px solid #007bff; }
                .stat-title { color: #333; font-weight: bold; margin-bottom: 5px; }
                .stat-value { color: #007bff; font-size: 24px; }
                .status { padding: 10px; border-radius: 5px; margin: 5px 0; }
                .online { background: #d4edda; color: #155724; }
                .offline { background: #f8d7da; color: #721c24; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 نظام بوتات Free Fire</h1>
                <p>نظام إدارة خدمات شحن Free Fire</p>
                
                <div class="stats">
                    <div class="stat-box">
                        <div class="stat-title">👥 المستخدمين</div>
                        <div class="stat-value">${Object.keys(users).length}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-title">📦 الخدمات</div>
                        <div class="stat-value">${Object.keys(services).length}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-title">📊 الطلبات</div>
                        <div class="stat-value">${Object.keys(orders).length}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-title">💵 الإيرادات</div>
                        <div class="stat-value">${Object.values(orders)
                            .filter(o => o.status === 'completed')
                            .reduce((sum, o) => sum + o.amount, 0).toFixed(2)}$</div>
                    </div>
                </div>
                
                <div class="status online">
                    ✅ النظام يعمل بشكل طبيعي
                </div>
                
                <h3>البوتات:</h3>
                <div class="status online">🤖 بوت المستخدمين (@Diamouffbot) - نشط</div>
                <div class="status online">👑 بوت الإدارة (@otzhabot) - نشط</div>
                
                <p style="margin-top: 30px; color: #666; text-align: center;">
                    آخر تحديث: ${new Date().toLocaleString('ar-SA')}
                </p>
            </div>
        </body>
        </html>
    `;
    
    res.end(stats);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 السيرفر يعمل على المنفذ: ${PORT}`);
    console.log(`🌐 رابط الإحصائيات: http://localhost:${PORT}`);
});

console.log('🎉 تم تشغيل النظام بنجاح!');

// فحص دوري للنظام
setInterval(() => {
    console.log('🔍 فحص النظام...');
    console.log(`📊 المستخدمين النشطين: ${Object.values(users).length}`);
    console.log(`📦 الطلبات المنتظرة: ${Object.values(orders).filter(o => o.status === 'pending' || o.status === 'pending_payment').length}`);
    
    // تنظيف الجلسات القديمة
    const now = Date.now();
    for (const [userId, session] of Object.entries(userSessions)) {
        if (session && session.createdAt && (now - session.createdAt > 3600000)) { // ساعة واحدة
            delete userSessions[userId];
        }
    }
    
    for (const [adminId, session] of Object.entries(adminSessions)) {
        if (session && session.createdAt && (now - session.createdAt > 1800000)) { // نصف ساعة
            delete adminSessions[adminId];
        }
    }
}, 300000); // كل 5 دقائق
