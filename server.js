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
        params: { timeout: 10 }
    }
});

const adminBot = new TelegramBot(ADMIN_BOT_TOKEN, {
    polling: {
        interval: 300,
        autoStart: true,
        params: { timeout: 10 }
    }
});

// ========== تخزين البيانات ==========
const dataDir = path.join(__dirname, 'data');

// إنشاء مجلد البيانات إذا لم يكن موجوداً
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

let users = new Map();
let services = new Map();
let orders = new Map();
const userStates = new Map();
const adminStates = new Map();

// ========== دوال حفظ البيانات ==========
function saveData() {
    try {
        const usersData = Array.from(users.entries());
        const servicesData = Array.from(services.entries());
        const ordersData = Array.from(orders.entries());
        
        fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(usersData, null, 2));
        fs.writeFileSync(path.join(dataDir, 'services.json'), JSON.stringify(servicesData, null, 2));
        fs.writeFileSync(path.join(dataDir, 'orders.json'), JSON.stringify(ordersData, null, 2));
        
        console.log('✅ تم حفظ البيانات');
    } catch (error) {
        console.error('❌ خطأ في حفظ البيانات:', error);
    }
}

function loadData() {
    try {
        // تحميل المستخدمين
        if (fs.existsSync(path.join(dataDir, 'users.json'))) {
            const usersData = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
            users = new Map(usersData);
            console.log(`✅ تم تحميل ${users.size} مستخدم`);
        }
        
        // تحميل الخدمات
        if (fs.existsSync(path.join(dataDir, 'services.json'))) {
            const servicesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'services.json'), 'utf8'));
            services = new Map(servicesData);
            console.log(`✅ تم تحميل ${services.size} خدمة`);
        }
        
        // تحميل الطلبات
        if (fs.existsSync(path.join(dataDir, 'orders.json'))) {
            const ordersData = JSON.parse(fs.readFileSync(path.join(dataDir, 'orders.json'), 'utf8'));
            orders = new Map(ordersData);
            console.log(`✅ تم تحميل ${orders.size} طلب`);
        }
    } catch (error) {
        console.error('❌ خطأ في تحميل البيانات:', error);
        initializeDefaultData();
    }
}

function initializeDefaultData() {
    console.log('🔄 تهيئة البيانات الافتراضية...');
    
    // خدمات افتراضية
    const defaultServices = [
        { id: 'SERV001', name: 'جواهر فري فاير 100+10', description: 'اشتري 100 جوهرة واحصل على 10 مجاناً', price: 1, stock: 100, category: 'جواهر', isActive: true },
        { id: 'SERV002', name: 'جواهر فري فاير 500+50', description: 'اشتري 500 جوهرة واحصل على 50 مجاناً', price: 5, stock: 50, category: 'جواهر', isActive: true },
        { id: 'SERV003', name: 'جواهر فري فاير 1000+100', description: 'اشتري 1000 جوهرة واحصل على 100 مجاناً', price: 10, stock: 30, category: 'جواهر', isActive: true },
        { id: 'SERV004', name: 'باس موسم فري فاير', description: 'اشتراك باس الموسم الكامل', price: 8, stock: 50, category: 'باقات', isActive: true },
        { id: 'SERV005', name: 'حزمة أسلبة نادرة', description: 'حزمة أسلبة مميزة مع سكنات', price: 15, stock: 25, category: 'أسلبة', isActive: true }
    ];
    
    defaultServices.forEach(service => {
        services.set(service.id, {
            ...service,
            createdAt: new Date(),
            priority: services.size + 1
        });
    });
    
    console.log(`✅ تم تهيئة ${services.size} خدمة افتراضية`);
    saveData();
}

// ========== دوال إدارة الخدمات ==========
function addService(name, description, price, stock, category = 'عام') {
    const serviceId = `SERV${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const service = {
        id: serviceId,
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        stock: parseInt(stock),
        category: category.trim(),
        isActive: true,
        createdAt: new Date(),
        priority: services.size + 1
    };
    
    services.set(serviceId, service);
    saveData();
    console.log(`✅ تمت إضافة خدمة: ${name}`);
    return service;
}

function updateService(serviceId, updates) {
    const service = services.get(serviceId);
    if (service) {
        Object.keys(updates).forEach(key => {
            if (key in service && key !== 'id') {
                if (key === 'price') {
                    service[key] = parseFloat(updates[key]);
                } else if (key === 'stock') {
                    service[key] = parseInt(updates[key]);
                } else {
                    service[key] = updates[key];
                }
            }
        });
        service.updatedAt = new Date();
        services.set(serviceId, service);
        saveData();
        return service;
    }
    return null;
}

function deleteService(serviceId) {
    const deleted = services.delete(serviceId);
    if (deleted) {
        saveData();
        return true;
    }
    return false;
}

function toggleServiceStatus(serviceId) {
    const service = services.get(serviceId);
    if (service) {
        service.isActive = !service.isActive;
        service.updatedAt = new Date();
        services.set(serviceId, service);
        saveData();
        return service;
    }
    return null;
}

// ========== دوال إدارة المستخدمين ==========
function getUser(userId) {
    if (!users.has(userId)) {
        users.set(userId, {
            userId: userId,
            username: '',
            firstName: '',
            balance: 0,
            discount: 0,
            totalSpent: 0,
            ordersCount: 0,
            isActive: true,
            lastActive: new Date(),
            createdAt: new Date(),
            language: 'ar'
        });
        saveData();
    }
    return users.get(userId);
}

function updateUser(userId, updates) {
    const user = getUser(userId);
    Object.assign(user, updates);
    user.lastActive = new Date();
    users.set(userId, user);
    saveData();
    return user;
}

// ========== دوال إدارة الطلبات ==========
let orderCounter = 1;

function createOrder(userId, type, data) {
    const orderId = type === 'deposit' ? `DEP${orderCounter++}` : `ORD${orderCounter++}`;
    const order = {
        orderId: orderId,
        userId: userId,
        username: data.username || '',
        firstName: data.firstName || '',
        type: type,
        amount: data.amount,
        serviceName: data.serviceName || '',
        gameId: data.gameId || '',
        paymentProof: data.paymentProof || '',
        status: type === 'deposit' ? 'pending_payment' : 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: ''
    };
    
    orders.set(orderId, order);
    
    // زيادة عدد طلبات المستخدم
    const user = getUser(userId);
    user.ordersCount += 1;
    updateUser(userId, user);
    
    saveData();
    return order;
}

function updateOrderStatus(orderId, status, adminId = null) {
    const order = orders.get(orderId);
    if (order) {
        order.status = status;
        order.updatedAt = new Date();
        if (adminId) {
            order.processedBy = adminId;
            order.processedAt = new Date();
        }
        orders.set(orderId, order);
        saveData();
        return order;
    }
    return null;
}

// ========== بوت الشحن (واجهة المستخدمين) ==========

chargingBot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || '';
    const firstName = msg.from.first_name || '';
    
    console.log(`🎮 مستخدم جديد: ${chatId} (@${username})`);
    
    const user = getUser(chatId);
    updateUser(chatId, { username, firstName });
    
    showMainMenu(chatId, user);
});

chargingBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const user = getUser(chatId);
    
    // تحديث نشاط المستخدم
    updateUser(chatId, {});
    
    // الحصول على حالة المستخدم الحالية
    const userState = userStates.get(chatId);
    
    // إذا كان هناك عملية جارية
    if (userState) {
        await handleUserState(chatId, text, msg, userState, user);
        return;
    }
    
    // إذا كان المستخدم يريد إلغاء العملية
    if (text === '🚫 إلغاء العملية') {
        userStates.delete(chatId);
        showMainMenu(chatId, user);
        return;
    }
    
    // معالجة الأوامر الرئيسية
    if (!text) return;
    
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
            
        case '🏠 الرئيسية':
            showMainMenu(chatId, user);
            break;
            
        case '🆘 المساعدة':
            showHelp(chatId);
            break;
            
        default:
            // التحقق إذا كان اختيار خدمة
            if (text.startsWith('🎮 ')) {
                const serviceName = text.replace('🎮 ', '').split(' - ')[0];
                selectService(chatId, user, serviceName);
            } else {
                showMainMenu(chatId, user);
            }
    }
});

// ========== واجهة المستخدم الرئيسية ==========

function showMainMenu(chatId, user) {
    userStates.delete(chatId);
    
    const activeServices = Array.from(services.values()).filter(s => s.isActive).length;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '🎮 الخدمات'],
                ['📋 طلباتي', '💰 رصيدي'],
                ['🆘 المساعدة', '🏠 الرئيسية']
            ],
            resize_keyboard: true
        }
    };
    
    const message = `🎮 *مرحباً بك في بوت شحن Free Fire*\n\n` +
                   `👤 ${user.firstName || 'عزيزي المستخدم'}\n` +
                   `💰 رصيدك: *${user.balance}$*\n` +
                   `🎯 خصمك: *${user.discount}%*\n` +
                   `📦 ${activeServices} خدمة متاحة\n\n` +
                   `📌 *اختر من القائمة:*`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function showServicesMenu(chatId, user) {
    const activeServices = Array.from(services.values())
        .filter(s => s.isActive && s.stock > 0)
        .sort((a, b) => a.priority - b.priority);
    
    if (activeServices.length === 0) {
        chargingBot.sendMessage(chatId,
            '⚠️ *لا توجد خدمات متاحة حالياً*\n\n' +
            'يرجى المحاولة لاحقاً أو التواصل مع الدعم.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [['🏠 الرئيسية']],
                    resize_keyboard: true
                }
            }
        );
        return;
    }
    
    let message = `🎮 *الخدمات المتاحة*\n\n` +
                 `💰 رصيدك: *${user.balance}$*\n` +
                 `🎯 خصمك: *${user.discount}%*\n\n` +
                 `📦 *اختر خدمة:*\n\n`;
    
    // تجميع الخدمات حسب التصنيف
    const servicesByCategory = {};
    activeServices.forEach(service => {
        if (!servicesByCategory[service.category]) {
            servicesByCategory[service.category] = [];
        }
        servicesByCategory[service.category].push(service);
    });
    
    // عرض الخدمات
    Object.keys(servicesByCategory).forEach(category => {
        message += `📁 *${category}:*\n`;
        servicesByCategory[category].forEach(service => {
            const finalPrice = service.price * (1 - (user.discount / 100));
            message += `🎮 ${service.name}\n`;
            message += `   💰 ${finalPrice.toFixed(2)}$ | 📦 ${service.stock}\n\n`;
        });
    });
    
    // إنشاء أزرار الخدمات
    const keyboardRows = [];
    activeServices.forEach(service => {
        const finalPrice = service.price * (1 - (user.discount / 100));
        keyboardRows.push([`🎮 ${service.name} - ${finalPrice.toFixed(2)}$`]);
    });
    
    keyboardRows.push(['🏠 الرئيسية', '🚫 إلغاء العملية']);
    
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
    const service = Array.from(services.values())
        .find(s => s.name === serviceName && s.isActive && s.stock > 0);
    
    if (!service) {
        chargingBot.sendMessage(chatId,
            '❌ *الخدمة غير متاحة*\n\n' +
            'يرجى اختيار خدمة أخرى.',
            { parse_mode: 'Markdown' }
        );
        showServicesMenu(chatId, user);
        return;
    }
    
    const finalPrice = service.price * (1 - (user.discount / 100));
    
    if (user.balance < finalPrice) {
        chargingBot.sendMessage(chatId,
            `❌ *رصيدك غير كافي*\n\n` +
            `💰 رصيدك: ${user.balance}$\n` +
            `💵 السعر: ${finalPrice.toFixed(2)}$\n\n` +
            `💡 يرجى شحن رصيد أولاً.`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    chargingBot.sendMessage(chatId,
        `🎮 *${service.name}*\n\n` +
        `📝 ${service.description}\n` +
        `💰 السعر: *${finalPrice.toFixed(2)}$*\n` +
        `📦 المخزون: ${service.stock}\n\n` +
        `🆔 *الرجاء إرسال ID الخاص بك في Free Fire:*`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء العملية']],
                resize_keyboard: true
            }
        }
    );
    
    userStates.set(chatId, {
        type: 'awaiting_game_id',
        serviceId: service.id,
        serviceName: service.name,
        price: finalPrice,
        username: user.username,
        firstName: user.firstName
    });
}

// ========== معالجة حالات المستخدم ==========

async function handleUserState(chatId, text, msg, state, user) {
    try {
        // زر الإلغاء يعمل في أي حالة
        if (text === '🚫 إلغاء العملية' || text === '🏠 الرئيسية') {
            userStates.delete(chatId);
            showMainMenu(chatId, user);
            return;
        }
        
        switch(state.type) {
            case 'awaiting_deposit_amount':
                await handleDepositAmount(chatId, text, user);
                break;
                
            case 'awaiting_deposit_receipt':
                if (msg.photo) {
                    await handleDepositReceipt(chatId, msg, state, user);
                } else {
                    chargingBot.sendMessage(chatId,
                        '❌ يرجى إرسال صورة إيصال الدفع\n' +
                        'أو اضغط "🚫 إلغاء العملية" للإلغاء',
                        { parse_mode: 'Markdown' }
                    );
                }
                break;
                
            case 'awaiting_game_id':
                await handleGameId(chatId, text, state, user);
                break;
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة حالة المستخدم:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة مرة أخرى');
        userStates.delete(chatId);
        showMainMenu(chatId, user);
    }
}

async function handleGameId(chatId, text, state, user) {
    const gameId = text.trim();
    
    if (!gameId || gameId.length < 3) {
        chargingBot.sendMessage(chatId,
            '❌ *ID غير صالح*\n\n' +
            'الرجاء إدخال ID صحيح (3 أحرف على الأقل)',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // خصم المبلغ من رصيد المستخدم
    user.balance -= state.price;
    user.totalSpent += state.price;
    updateUser(chatId, user);
    
    // تحديث مخزون الخدمة
    const service = services.get(state.serviceId);
    if (service) {
        service.stock -= 1;
        if (service.stock <= 0) {
            service.isActive = false;
        }
        services.set(state.serviceId, service);
        saveData();
    }
    
    // إنشاء الطلب
    const order = createOrder(chatId, 'service', {
        username: state.username,
        firstName: state.firstName,
        amount: state.price,
        serviceName: state.serviceName,
        gameId: gameId
    });
    
    // إرسال إشعار للإدارة
    await sendOrderNotification(order);
    
    userStates.delete(chatId);
    
    chargingBot.sendMessage(chatId,
        `✅ *تم تقديم طلبك بنجاح!*\n\n` +
        `🎮 الخدمة: ${state.serviceName}\n` +
        `💰 المبلغ: ${state.price}$\n` +
        `🆔 رقم الطلب: ${order.orderId}\n` +
        `🎮 ID اللعبة: ${gameId}\n` +
        `💰 الرصيد المتبقي: ${user.balance}$\n\n` +
        `⏳ *جاري تنفيذ طلبك...*\n` +
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

// ========== نظام شحن الرصيد ==========

function startDepositProcess(chatId) {
    chargingBot.sendMessage(chatId,
        `💳 *شحن الرصيد*\n\n` +
        `الرجاء إدخال المبلغ (بالدولار):\n` +
        `مثال: 5 أو 10.5\n\n` +
        `📌 الحد الأدنى: 1$\n` +
        `📌 الحد الأقصى: 1000$`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء العملية']],
                resize_keyboard: true
            }
        }
    );
    
    userStates.set(chatId, {
        type: 'awaiting_deposit_amount',
        step: 1
    });
}

async function handleDepositAmount(chatId, text, user) {
    const amount = parseFloat(text);
    
    if (isNaN(amount) || amount < 1 || amount > 1000) {
        chargingBot.sendMessage(chatId,
            '❌ *مبلغ غير صالح*\n\n' +
            'الرجاء إدخال مبلغ بين 1$ و 1000$',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    chargingBot.sendMessage(chatId,
        `💰 *طلب شحن رصيد*\n\n` +
        `💵 المبلغ: *${amount}$*\n\n` +
        `📋 *تعليمات الدفع:*\n` +
        `1. قم بتحويل *${amount}$* إلى:\n` +
        `   🆔 *${PAYMENT_ID}*\n` +
        `2. بعد التحويل، أرسل *صورة إيصال الدفع*\n\n` +
        `⚠️ *تأكد من:*\n` +
        `• صحة المبلغ المحول\n` +
        `• وضوح صورة الإيصال`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء العملية']],
                resize_keyboard: true
            }
        }
    );
    
    userStates.set(chatId, {
        type: 'awaiting_deposit_receipt',
        amount: amount,
        username: user.username,
        firstName: user.firstName,
        step: 2
    });
}

async function handleDepositReceipt(chatId, msg, state, user) {
    try {
        console.log(`📸 استلام صورة إيصال من ${chatId}`);
        
        const photoId = msg.photo[msg.photo.length - 1].file_id;
        
        // إنشاء طلب الشحن
        const order = createOrder(chatId, 'deposit', {
            username: state.username,
            firstName: state.firstName,
            amount: state.amount,
            paymentProof: photoId
        });
        
        // إرسال إشعار للإدارة
        await sendDepositNotification(order, photoId);
        
        userStates.delete(chatId);
        
        chargingBot.sendMessage(chatId,
            `✅ *تم استلام إيصال الدفع*\n\n` +
            `💰 المبلغ: ${state.amount}$\n` +
            `🆔 رقم الطلب: ${order.orderId}\n` +
            `📅 الوقت: ${new Date().toLocaleString('ar-SA')}\n\n` +
            `⏳ *جاري مراجعة الإيصال...*\n` +
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
        chargingBot.sendMessage(chatId,
            '❌ حدث خطأ في معالجة الصورة، يرجى المحاولة مرة أخرى',
            { parse_mode: 'Markdown' }
        );
    }
}

// ========== دوال أخرى للمستخدمين ==========

function showUserOrders(chatId) {
    const userOrders = Array.from(orders.values())
        .filter(o => o.userId === chatId)
        .sort((a, b) => b.createdAt - a.createdAt);
    
    if (userOrders.length === 0) {
        chargingBot.sendMessage(chatId,
            '📭 *لا توجد طلبات سابقة*\n\n' +
            'يمكنك البدء بطلبك الأول!',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [['🎮 الخدمات', '🏠 الرئيسية']],
                    resize_keyboard: true
                }
            }
        );
        return;
    }
    
    let message = `📋 *طلباتي*\n\n`;
    
    userOrders.slice(0, 10).forEach(order => {
        const icon = order.type === 'deposit' ? '💳' : '🎮';
        const status = getStatusText(order.status);
        
        message += `${icon} ${order.serviceName || 'شحن رصيد'}\n`;
        message += `💰 ${order.amount}$ | ${status}\n`;
        message += `🆔 ${order.orderId}\n`;
        message += `📅 ${order.createdAt.toLocaleDateString('ar-SA')}\n\n`;
    });
    
    if (userOrders.length > 10) {
        message += `📖 و ${userOrders.length - 10} طلباً آخر...\n\n`;
    }
    
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
        `📦 عدد الطلبات: *${user.ordersCount}*\n\n` +
        `💡 لشحن الرصيد، اضغط على "💳 شحن رصيد"`,
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
                    `4. انتظر التأكيد\n\n` +
                    `🎮 *شراء الخدمات:*\n` +
                    `1. اضغط "🎮 الخدمات"\n` +
                    `2. اختر الخدمة\n` +
                    `3. أدخل ID اللعبة\n` +
                    `4. انتظر التنفيذ\n\n` +
                    `🚫 *إلغاء العملية:*\n` +
                    `يمكنك إلغاء أي عملية بالنقر على زر "🚫 إلغاء العملية"`;
    
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
        'processing': '🔄 جاري التنفيذ',
        'completed': '✅ مكتمل',
        'cancelled': '❌ ملغى'
    };
    return statusMap[status] || status;
}

// ========== إرسال الإشعارات للإدارة ==========

async function sendOrderNotification(order) {
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    let sentCount = 0;
    
    const message = `📦 *طلب خدمة جديد*\n\n` +
                   `👤 ${order.firstName || '@' + order.username}\n` +
                   `🆔 \`${order.userId}\`\n` +
                   `🎮 ${order.serviceName}\n` +
                   `💰 ${order.amount}$\n` +
                   `🎮 ID: \`${order.gameId}\`\n` +
                   `🆔 ${order.orderId}\n` +
                   `📅 ${order.createdAt.toLocaleString('ar-SA')}`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ إكمال', callback_data: `complete_${order.orderId}` },
                { text: '❌ إلغاء', callback_data: `cancel_${order.orderId}` }
            ],
            [
                { text: '💬 مراسلة', url: `tg://user?id=${order.userId}` }
            ]
        ]
    };
    
    for (const adminId of admins) {
        try {
            await adminBot.sendMessage(adminId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            sentCount++;
        } catch (error) {
            console.error(`❌ فشل إرسال إشعار للإدمن ${adminId}:`, error.message);
        }
    }
    
    return sentCount > 0;
}

async function sendDepositNotification(order, photoId) {
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    let sentCount = 0;
    
    const message = `💳 *طلب شحن جديد*\n\n` +
                   `👤 ${order.firstName || '@' + order.username}\n` +
                   `🆔 \`${order.userId}\`\n` +
                   `💰 ${order.amount}$\n` +
                   `🆔 ${order.orderId}\n` +
                   `📅 ${order.createdAt.toLocaleString('ar-SA')}`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ تأكيد', callback_data: `confirm_deposit_${order.orderId}` },
                { text: '❌ رفض', callback_data: `reject_deposit_${order.orderId}` }
            ],
            [
                { text: '💬 مراسلة', url: `tg://user?id=${order.userId}` }
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
            sentCount++;
        } catch (error) {
            console.error(`❌ فشل إرسال إشعار للإدمن ${adminId}:`, error.message);
            
            // إرسال رسالة بدون صورة كبديل
            try {
                await adminBot.sendMessage(adminId, `📸 ${message}\n\n⚠️ لا يمكن عرض الصورة`, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
                sentCount++;
            } catch (e) {}
        }
    }
    
    return sentCount > 0;
}

// ========== بوت الإدارة ==========

adminBot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول');
        return;
    }
    
    console.log(`👑 أدمن دخل: ${chatId}`);
    showAdminMainMenu(chatId);
});

adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!isAdmin(chatId)) return;
    
    console.log(`📩 أدمن: ${text}`);
    
    const adminState = adminStates.get(chatId);
    
    if (adminState) {
        await handleAdminState(chatId, text, adminState);
        return;
    }
    
    if (!text) return;
    
    // معالجة الأوامر الرئيسية
    switch(text) {
        case '/start':
        case '🏠 الرئيسية':
            showAdminMainMenu(chatId);
            break;
            
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
            
        case '🚫 إلغاء':
            adminStates.delete(chatId);
            showAdminMainMenu(chatId);
            break;
            
        default:
            // التحقق من أزرار إدارة الخدمات
            if (text.startsWith('✏️ تعديل ')) {
                const serviceId = text.replace('✏️ تعديل ', '');
                startEditServiceMenu(chatId, serviceId);
            } else if (text.startsWith('🗑️ حذف ')) {
                const serviceId = text.replace('🗑️ حذف ', '');
                startDeleteServiceProcess(chatId, serviceId);
            } else if (text.startsWith('🔁 ')) {
                const serviceId = text.replace('🔁 ', '');
                toggleServiceStatusAndNotify(chatId, serviceId);
            } else {
                showAdminMainMenu(chatId);
            }
    }
});

function isAdmin(chatId) {
    return chatId == ADMIN_ID || chatId == SECOND_ADMIN_ID;
}

function showAdminMainMenu(chatId) {
    adminStates.delete(chatId);
    
    const pendingOrders = Array.from(orders.values())
        .filter(o => o.status === 'pending' || o.status === 'pending_payment').length;
    
    const activeServices = Array.from(services.values())
        .filter(s => s.isActive).length;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['📦 إدارة الخدمات', '📋 الطلبات'],
                ['💳 الشحنات', '👥 المستخدمين'],
                ['📊 الإحصائيات', '🆕 إضافة خدمة'],
                ['🔄 تحديث', '🚫 إلغاء']
            ],
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId,
        `👑 *لوحة التحكم*\n\n` +
        `📊 *إحصائيات سريعة:*\n` +
        `📦 الخدمات: ${services.size} (${activeServices} مفعلة)\n` +
        `📋 الطلبات النشطة: ${pendingOrders}\n` +
        `👥 المستخدمين: ${users.size}\n\n` +
        `🎯 *اختر من القائمة:*`,
        { parse_mode: 'Markdown', ...keyboard }
    );
}

// ========== إدارة الخدمات في لوحة التحكم ==========

function showServicesManagement(chatId) {
    const allServices = Array.from(services.values())
        .sort((a, b) => b.createdAt - a.createdAt);
    
    if (allServices.length === 0) {
        adminBot.sendMessage(chatId,
            '📭 *لا توجد خدمات*\n\n' +
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
    message += `📊 إجمالي: ${allServices.length}\n\n`;
    
    // عرض الخدمات مع أزرار التحكم
    allServices.slice(0, 5).forEach(service => {
        const status = service.isActive ? '🟢' : '🔴';
        message += `${status} *${service.name}*\n`;
        message += `💰 ${service.price}$ | 📦 ${service.stock}\n`;
        message += `🆔 ${service.id}\n\n`;
    });
    
    if (allServices.length > 5) {
        message += `📖 و ${allServices.length - 5} خدمة أخرى...\n\n`;
    }
    
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
    adminStates.set(chatId, {
        type: 'adding_service',
        step: 1,
        data: {}
    });
    
    adminBot.sendMessage(chatId,
        `🆕 *إضافة خدمة جديدة*\n\n` +
        `📝 *الخطوة 1:* أدخل اسم الخدمة\n` +
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

function startEditServiceMenu(chatId, serviceId) {
    const service = services.get(serviceId);
    
    if (!service) {
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        return;
    }
    
    adminStates.set(chatId, {
        type: 'editing_service',
        serviceId: serviceId,
        step: 1
    });
    
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

function startDeleteServiceProcess(chatId, serviceId) {
    const service = services.get(serviceId);
    
    if (!service) {
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        return;
    }
    
    adminStates.set(chatId, {
        type: 'deleting_service',
        serviceId: serviceId
    });
    
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

async function handleAdminState(chatId, text, state) {
    try {
        if (text === '🚫 إلغاء') {
            adminStates.delete(chatId);
            showAdminMainMenu(chatId);
            return;
        }
        
        switch(state.type) {
            case 'adding_service':
                await handleAddServiceStep(chatId, text, state);
                break;
                
            case 'editing_service':
                await handleEditServiceStep(chatId, text, state);
                break;
                
            case 'deleting_service':
                await handleDeleteService(chatId, text, state);
                break;
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة حالة الأدمن:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ');
        adminStates.delete(chatId);
        showAdminMainMenu(chatId);
    }
}

async function handleAddServiceStep(chatId, text, state) {
    switch(state.step) {
        case 1:
            state.data.name = text;
            state.step = 2;
            adminBot.sendMessage(chatId,
                `✅ *تم حفظ الاسم*\n\n` +
                `📝 *الخطوة 2:* أدخل وصف الخدمة`,
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 2:
            state.data.description = text;
            state.step = 3;
            adminBot.sendMessage(chatId,
                `✅ *تم حفظ الوصف*\n\n` +
                `📝 *الخطوة 3:* أدخل السعر ($)`,
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 3:
            const price = parseFloat(text);
            if (isNaN(price) || price <= 0) {
                adminBot.sendMessage(chatId, '❌ سعر غير صالح');
                return;
            }
            state.data.price = price;
            state.step = 4;
            adminBot.sendMessage(chatId,
                `✅ *تم حفظ السعر*\n\n` +
                `📝 *الخطوة 4:* أدخل المخزون`,
                { parse_mode: 'Markdown' }
            );
            break;
            
        case 4:
            const stock = parseInt(text);
            if (isNaN(stock) || stock < 0) {
                adminBot.sendMessage(chatId, '❌ مخزون غير صالح');
                return;
            }
            state.data.stock = stock;
            
            // إضافة الخدمة
            const service = addService(
                state.data.name,
                state.data.description,
                state.data.price,
                state.data.stock,
                'جواهر'
            );
            
            adminStates.delete(chatId);
            
            adminBot.sendMessage(chatId,
                `🎉 *تمت إضافة الخدمة*\n\n` +
                `🎮 ${service.name}\n` +
                `💰 ${service.price}$\n` +
                `📦 ${service.stock}\n` +
                `🆔 ${service.id}`,
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
    
    adminStates.set(chatId, state);
}

async function handleEditServiceStep(chatId, text, state) {
    const service = services.get(state.serviceId);
    if (!service) return;
    
    if (text.startsWith('✏️ تعديل اسم ')) {
        state.editingField = 'name';
        adminBot.sendMessage(chatId, 'أدخل الاسم الجديد:');
    } else if (text.startsWith('✏️ تعديل وصف ')) {
        state.editingField = 'description';
        adminBot.sendMessage(chatId, 'أدخل الوصف الجديد:');
    } else if (text.startsWith('✏️ تعديل سعر ')) {
        state.editingField = 'price';
        adminBot.sendMessage(chatId, 'أدخل السعر الجديد:');
    } else if (text.startsWith('✏️ تعديل مخزون ')) {
        state.editingField = 'stock';
        adminBot.sendMessage(chatId, 'أدخل المخزون الجديد:');
    } else {
        // معالجة القيمة المدخلة
        let value = text;
        let isValid = true;
        
        if (state.editingField === 'price') {
            value = parseFloat(text);
            if (isNaN(value) || value <= 0) {
                adminBot.sendMessage(chatId, '❌ سعر غير صالح');
                isValid = false;
            }
        } else if (state.editingField === 'stock') {
            value = parseInt(text);
            if (isNaN(value) || value < 0) {
                adminBot.sendMessage(chatId, '❌ مخزون غير صالح');
                isValid = false;
            }
        }
        
        if (isValid) {
            const updates = {};
            updates[state.editingField] = value;
            updateService(state.serviceId, updates);
            
            adminStates.delete(chatId);
            
            adminBot.sendMessage(chatId,
                `✅ *تم التعديل بنجاح*\n\n` +
                `🎮 ${service.name}\n` +
                `🔄 ${state.editingField}: ${value}`,
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
    
    adminStates.set(chatId, state);
}

async function handleDeleteService(chatId, text, state) {
    if (text === '✅ نعم، احذف الخدمة') {
        const service = services.get(state.serviceId);
        if (service) {
            deleteService(state.serviceId);
            
            adminStates.delete(chatId);
            
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
    } else {
        adminStates.delete(chatId);
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
    const messageId = callbackQuery.message.message_id;
    
    if (!isAdmin(chatId)) {
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
                
                // تحديث رسالة الأدمن
                adminBot.editMessageText(
                    `✅ *تم إكمال الطلب*\n\n` +
                    `👤 ${order.firstName || '@' + order.username}\n` +
                    `🎮 ${order.serviceName}\n` +
                    `💰 ${order.amount}$\n` +
                    `🆔 ${order.orderId}`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    }
                );
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: '✅ تم الإكمال' });
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
                
                // تحديث رسالة الأدمن
                adminBot.editMessageText(
                    `❌ *تم إلغاء الطلب*\n\n` +
                    `👤 ${order.firstName || '@' + order.username}\n` +
                    `🎮 ${order.serviceName}\n` +
                    `💰 ${order.amount}$\n` +
                    `💳 تم إرجاع المبلغ`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    }
                );
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ تم الإلغاء' });
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
                    `🎉 يمكنك الآن شراء الخدمات`,
                    { parse_mode: 'Markdown' }
                );
                
                // تحديث رسالة الأدمن
                adminBot.editMessageText(
                    `✅ *تم تأكيد الشحن*\n\n` +
                    `👤 ${order.firstName || '@' + order.username}\n` +
                    `💰 ${order.amount}$\n` +
                    `💳 تم إضافة الرصيد\n` +
                    `🆔 ${order.orderId}`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    }
                );
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: '✅ تم التأكيد' });
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
                    `⚠️ يرجى التحقق والمحاولة مرة أخرى`,
                    { parse_mode: 'Markdown' }
                );
                
                // تحديث رسالة الأدمن
                adminBot.editMessageText(
                    `❌ *تم رفض الشحن*\n\n` +
                    `👤 ${order.firstName || '@' + order.username}\n` +
                    `💰 ${order.amount}$\n` +
                    `❌ تم إبلاغ المستخدم\n` +
                    `🆔 ${order.orderId}`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown'
                    }
                );
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ تم الرفض' });
            }
        }
    } catch (error) {
        console.error('❌ خطأ في Callback:', error);
        adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ حدث خطأ' });
    }
});

// ========== دوال أخرى للوحة التحكم ==========

function showAdminStats(chatId) {
    const totalUsers = users.size;
    const totalOrders = orders.size;
    const completedOrders = Array.from(orders.values())
        .filter(o => o.status === 'completed').length;
    const totalRevenue = Array.from(orders.values())
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + o.amount, 0);
    
    adminBot.sendMessage(chatId,
        `📊 *إحصائيات*\n\n` +
        `👥 المستخدمين: ${totalUsers}\n` +
        `📦 الطلبات: ${totalOrders}\n` +
        `✅ المكتملة: ${completedOrders}\n` +
        `💰 الإيرادات: ${totalRevenue.toFixed(2)}$`,
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
    const allOrders = Array.from(orders.values())
        .sort((a, b) => b.createdAt - a.createdAt);
    
    if (allOrders.length === 0) {
        adminBot.sendMessage(chatId, '📭 *لا توجد طلبات*', { parse_mode: 'Markdown' });
        return;
    }
    
    let message = '📋 *جميع الطلبات*\n\n';
    
    allOrders.slice(0, 10).forEach(order => {
        const icon = order.type === 'deposit' ? '💳' : '🎮';
        const status = getStatusText(order.status);
        
        message += `${icon} ${order.serviceName || 'شحن رصيد'}\n`;
        message += `👤 @${order.username} | 💰 ${order.amount}$\n`;
        message += `🆔 ${order.orderId} | ${status}\n\n`;
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
    const depositOrders = Array.from(orders.values())
        .filter(o => o.type === 'deposit' && o.status === 'pending_payment');
    
    if (depositOrders.length === 0) {
        adminBot.sendMessage(chatId, '💳 *لا توجد طلبات شحن*', { parse_mode: 'Markdown' });
        return;
    }
    
    adminBot.sendMessage(chatId,
        `💳 *طلبات الشحن*\n\n` +
        `📊 بانتظار التأكيد: ${depositOrders.length}`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🏠 الرئيسية']],
                resize_keyboard: true
            }
        }
    );
}

function showUsersList(chatId) {
    const allUsers = Array.from(users.values())
        .sort((a, b) => b.lastActive - a.lastActive);
    
    if (allUsers.length === 0) {
        adminBot.sendMessage(chatId, '👥 *لا يوجد مستخدمين*', { parse_mode: 'Markdown' });
        return;
    }
    
    let message = '👥 *المستخدمين*\n\n';
    
    allUsers.slice(0, 10).forEach(user => {
        message += `👤 ${user.firstName || '@' + user.username}\n`;
        message += `💰 ${user.balance}$ | 📦 ${user.ordersCount}\n`;
        message += `🆔 ${user.userId}\n\n`;
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

console.log('🚀 بدء تشغيل نظام البوتات...');

// تحميل البيانات
loadData();

console.log('✅ النظام جاهز للعمل!');
console.log(`🤖 بوت المستخدمين: @Diamouffbot`);
console.log(`👑 بوت الإدارة: @otzhabot`);
console.log(`📊 المستخدمين: ${users.size} | الخدمات: ${services.size} | الطلبات: ${orders.size}`);

// حفظ البيانات كل 5 دقائق
setInterval(saveData, 5 * 60 * 1000);

// تشغيل سيرفر ويب
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>نظام بوتات Free Fire</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                h1 { color: #333; }
                .stats { background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px; display: inline-block; }
                .stat { margin: 10px; font-size: 18px; }
            </style>
        </head>
        <body>
            <h1>🎮 نظام بوتات Free Fire</h1>
            <div class="stats">
                <div class="stat">👥 المستخدمين: ${users.size}</div>
                <div class="stat">📦 الخدمات: ${services.size}</div>
                <div class="stat">📋 الطلبات: ${orders.size}</div>
                <div class="stat">✅ النظام يعمل بنجاح</div>
            </div>
            <p>⏰ ${new Date().toLocaleString('ar-SA')}</p>
        </body>
        </html>
    `);
});

server.listen(PORT, () => {
    console.log(`🌐 السيرفر يعمل على المنفذ: ${PORT}`);
});

console.log('🎉 تم تشغيل النظام بنجاح!');
