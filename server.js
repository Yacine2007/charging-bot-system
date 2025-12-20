const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const fs = require('fs');

// === إعداد التوكنات ===
const CHARGING_BOT_TOKEN = '8223596744:AAGHOMQ3Sjk3-X_Z7eXXnL5drAXaHXglLFg';
const ADMIN_BOT_TOKEN = '8216188569:AAEEA1q_os_6XfSJrUDLDkkQxZXh-3OMAVU';

// === إعداد المدراء ===
const ADMIN_ID = 7656412227;
const SECOND_ADMIN_ID = 7450109529;
const PAYMENT_ID = '953936100';

// === إنشاء البوتات مع إعدادات متقدمة ===
const chargingBot = new TelegramBot(CHARGING_BOT_TOKEN, {
    polling: {
        interval: 300,
        autoStart: true,
        params: { timeout: 10 }
    },
    request: {
        agentOptions: {
            keepAlive: true
        }
    }
});

const adminBot = new TelegramBot(ADMIN_BOT_TOKEN, {
    polling: {
        interval: 300,
        autoStart: true,
        params: { timeout: 10 }
    },
    request: {
        agentOptions: {
            keepAlive: true
        }
    }
});

// ========== تخزين البيانات ==========
const users = new Map();
const services = new Map();
const orders = new Map();
const userStates = new Map();
const adminStates = new Map();

// ========== تهيئة الخدمات الافتراضية ==========
function initializeServices() {
    const defaultServices = [
        { name: 'جواهر فري فاير 100+10', description: 'اشتري 100 جوهرة واحصل على 10 مجاناً', price: 1, stock: 100, category: 'جواهر' },
        { name: 'جواهر فري فاير 500+50', description: 'اشتري 500 جوهرة واحصل على 50 مجاناً', price: 5, stock: 50, category: 'جواهر' },
        { name: 'جواهر فري فاير 1000+100', description: 'اشتري 1000 جوهرة واحصل على 100 مجاناً', price: 10, stock: 30, category: 'جواهر' },
        { name: 'باس موسم فري فاير', description: 'اشتراك باس الموسم الكامل مع مكافآت حصرية', price: 8, stock: 50, category: 'باقات' },
        { name: 'حزمة أسلبة نادرة', description: 'حزمة أسلبة مميزة مع سكنات حصرية', price: 15, stock: 25, category: 'أسلبة' }
    ];

    services.clear();
    defaultServices.forEach(service => {
        const serviceId = `SERV${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
        services.set(serviceId, {
            id: serviceId,
            name: service.name,
            description: service.description,
            price: service.price,
            stock: service.stock,
            category: service.category,
            isActive: true,
            createdAt: new Date(),
            priority: services.size + 1
        });
    });
    
    console.log(`✅ تم تهيئة ${services.size} خدمة افتراضية`);
}

// ========== دوال إدارة الخدمات ==========
function addService(name, description, price, stock, category) {
    const serviceId = `SERV${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
    const service = {
        id: serviceId,
        name: name,
        description: description,
        price: parseFloat(price),
        stock: parseInt(stock),
        category: category || 'عام',
        isActive: true,
        createdAt: new Date(),
        priority: services.size + 1
    };
    services.set(serviceId, service);
    return service;
}

function updateService(serviceId, updates) {
    const service = services.get(serviceId);
    if (service) {
        Object.assign(service, updates);
        service.updatedAt = new Date();
        services.set(serviceId, service);
        return service;
    }
    return null;
}

function deleteService(serviceId) {
    return services.delete(serviceId);
}

function toggleServiceStatus(serviceId) {
    const service = services.get(serviceId);
    if (service) {
        service.isActive = !service.isActive;
        service.updatedAt = new Date();
        services.set(serviceId, service);
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
            createdAt: new Date()
        });
    }
    return users.get(userId);
}

function updateUser(userId, updates) {
    const user = getUser(userId);
    Object.assign(user, updates);
    user.lastActive = new Date();
    users.set(userId, user);
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
        type: type,
        amount: data.amount,
        serviceName: data.serviceName,
        gameId: data.gameId,
        paymentProof: data.paymentProof,
        status: type === 'deposit' ? 'pending_payment' : 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    orders.set(orderId, order);
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
        return order;
    }
    return null;
}

// ========== دالة تحميل الصور ==========
async function downloadPhoto(fileId, bot) {
    return new Promise((resolve, reject) => {
        bot.getFile(fileId).then(file => {
            const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
            
            https.get(fileUrl, (response) => {
                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve(buffer);
                });
                response.on('error', reject);
            });
        }).catch(reject);
    });
}

// ========== بوت الشحن (واجهة المستخدم) ==========

// معالجة الأمر /start
chargingBot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || '';
    const firstName = msg.from.first_name || '';
    
    console.log(`🟢 مستخدم جديد: ${chatId} - @${username}`);
    
    const user = getUser(chatId);
    updateUser(chatId, { username: username, firstName: firstName });
    
    showMainMenu(chatId, user);
});

// معالجة جميع الرسائل النصية
chargingBot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const text = msg.text;
    const user = getUser(chatId);
    
    console.log(`📩 رسالة من ${chatId}: ${text || 'صورة'}`);
    
    // تحديث آخر نشاط
    updateUser(chatId, {});
    
    // التحقق من حالة المستخدم
    const userState = userStates.get(chatId);
    
    if (userState) {
        await handleUserState(chatId, text, msg, userState, user);
        return;
    }
    
    if (!text) return;
    
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
            
        case '🏠 الرئيسية':
            showMainMenu(chatId, user);
            break;
            
        case '🆘 المساعدة':
            showHelp(chatId);
            break;
            
        default:
            // التحقق إذا كان النص هو اختيار خدمة
            if (text.startsWith('🎮 ')) {
                const serviceName = text.replace('🎮 ', '').split(' - ')[0];
                selectService(chatId, user, serviceName);
            } else {
                showMainMenu(chatId, user);
            }
    }
});

// معالجة الحالات المختلفة للمستخدم
async function handleUserState(chatId, text, msg, state, user) {
    try {
        switch(state.type) {
            case 'awaiting_deposit_amount':
                await handleDepositAmount(chatId, text, user);
                break;
                
            case 'awaiting_deposit_receipt':
                if (msg.photo) {
                    await handleDepositReceipt(chatId, msg, state, user);
                } else if (text === '🏠 إلغاء') {
                    userStates.delete(chatId);
                    showMainMenu(chatId, user);
                } else {
                    chargingBot.sendMessage(chatId, '❌ يجب إرسال صورة إيصال الدفع');
                }
                break;
                
            case 'awaiting_game_id':
                await handleGameId(chatId, text, state, user);
                break;
                
            default:
                userStates.delete(chatId);
                showMainMenu(chatId, user);
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة حالة المستخدم:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة مرة أخرى');
        userStates.delete(chatId);
        showMainMenu(chatId, user);
    }
}

// ========== دوال واجهة المستخدم ==========

function showMainMenu(chatId, user) {
    userStates.delete(chatId);
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '🎮 الخدمات'],
                ['📋 طلباتي', '💰 رصيدي'],
                ['🆘 المساعدة', '🏠 الرئيسية']
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
    
    const message = `🎮 *مرحباً بك في متجر جواهر فري فاير*\n\n` +
                   `👤 مرحباً ${user.firstName || 'عزيزي'}\n` +
                   `💰 رصيدك: *${user.balance}$*\n` +
                   `🎯 خصمك: *${user.discount}%*\n` +
                   `📊 طلباتك: *${user.ordersCount}*\n\n` +
                   `📌 *اختر من القائمة:*`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function showServicesMenu(chatId, user) {
    const activeServices = Array.from(services.values())
        .filter(service => service.isActive && service.stock > 0)
        .sort((a, b) => a.priority - b.priority);
    
    if (activeServices.length === 0) {
        chargingBot.sendMessage(chatId, 
            '⚠️ *لا توجد خدمات متاحة حالياً*\n\n' +
            'يرجى المحاولة لاحقاً أو التواصل مع الدعم.',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    let message = `🎮 *الخدمات المتاحة*\n\n` +
                 `💰 رصيدك الحالي: *${user.balance}$*\n\n` +
                 `📦 *اختر الخدمة:*\n\n`;
    
    // تجميع الخدمات حسب التصنيف
    const servicesByCategory = {};
    activeServices.forEach(service => {
        if (!servicesByCategory[service.category]) {
            servicesByCategory[service.category] = [];
        }
        servicesByCategory[service.category].push(service);
    });
    
    Object.keys(servicesByCategory).forEach(category => {
        message += `📁 *${category}:*\n`;
        servicesByCategory[category].forEach(service => {
            const finalPrice = service.price * (1 - (user.discount / 100));
            message += `🎮 ${service.name}\n`;
            message += `   💰 ${finalPrice.toFixed(2)}$ | 📦 ${service.stock} متبقي\n`;
            message += `   📝 ${service.description}\n\n`;
        });
    });
    
    // إنشاء أزرار الخدمات
    const keyboardRows = [];
    activeServices.forEach(service => {
        const finalPrice = service.price * (1 - (user.discount / 100));
        keyboardRows.push([`🎮 ${service.name} - ${finalPrice.toFixed(2)}$`]);
    });
    
    keyboardRows.push(['🏠 الرئيسية']);
    
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
            '❌ *هذه الخدمة غير متاحة حالياً*\n\n' +
            'يرجى اختيار خدمة أخرى من القائمة.',
            { parse_mode: 'Markdown' }
        );
        showServicesMenu(chatId, user);
        return;
    }
    
    const finalPrice = service.price * (1 - (user.discount / 100));
    
    if (user.balance < finalPrice) {
        chargingBot.sendMessage(chatId,
            `❌ *رصيدك غير كافي*\n\n` +
            `💰 رصيدك الحالي: *${user.balance}$*\n` +
            `💵 سعر الخدمة: *${finalPrice.toFixed(2)}$*\n\n` +
            `الرجاء شحن رصيد أولاً من قائمة "💳 شحن رصيد"`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    chargingBot.sendMessage(chatId,
        `🎮 *${service.name}*\n\n` +
        `📝 ${service.description}\n` +
        `💰 السعر النهائي: *${finalPrice.toFixed(2)}$*\n` +
        `📦 المخزون المتاح: ${service.stock}\n\n` +
        `🆔 *الرجاء إرسال ID الخاص بك في فري فاير:*\n\n` +
        `💡 *ملاحظة:*\n` +
        `• الـ ID يظهر في صفحة الملف الشخصي\n` +
        `• تأكد من إدخاله بشكل صحيح\n` +
        `• لا يمكن تغييره بعد الإرسال`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🏠 إلغاء']],
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

async function handleGameId(chatId, text, state, user) {
    if (text === '🏠 إلغاء') {
        userStates.delete(chatId);
        showMainMenu(chatId, user);
        return;
    }
    
    const gameId = text.trim();
    
    if (!gameId || gameId.length < 3) {
        chargingBot.sendMessage(chatId,
            '❌ *ID غير صالح*\n\n' +
            'الرجاء إدخال ID صحيح للعبة\n' +
            'يجب أن يكون على الأقل 3 أحرف',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // خصم المبلغ من رصيد المستخدم
    user.balance -= state.price;
    user.ordersCount += 1;
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
        `📞 *حالة الطلب:*\n` +
        `⏳ جاري تنفيذ طلبك\n` +
        `⏱️ الوقت المتوقع: 5-15 دقيقة\n\n` +
        `🔔 ستتلقى إشعاراً عند اكتمال الطلب`,
        { parse_mode: 'Markdown' }
    );
    
    setTimeout(() => showMainMenu(chatId, user), 3000);
}

function startDepositProcess(chatId) {
    chargingBot.sendMessage(chatId,
        `💳 *شحن الرصيد*\n\n` +
        `الرجاء إدخال المبلغ الذي تريد شحنه (بالدولار):\n\n` +
        `📌 *ملاحظات:*\n` +
        `• الحد الأدنى: 1$\n` +
        `• الحد الأقصى: 1000$\n` +
        `• مثال: 5 أو 10.5`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🏠 إلغاء']],
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
    if (text === '🏠 إلغاء') {
        userStates.delete(chatId);
        showMainMenu(chatId, user);
        return;
    }
    
    const amount = parseFloat(text);
    
    if (isNaN(amount) || amount < 1 || amount > 1000) {
        chargingBot.sendMessage(chatId,
            '❌ *مبلغ غير صالح*\n\n' +
            'الرجاء إدخال مبلغ بين 1$ و 1000$\n' +
            'مثال: 5 أو 10.5',
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
        `2. بعد التحويل، أرسل *صورة إيصال الدفع* هنا\n\n` +
        `⚠️ *ملاحظات مهمة:*\n` +
        `• تأكد من صحة المبلغ المحول\n` +
        `• الصورة يجب أن تكون واضحة\n` +
        `• المعالجة تستغرق 1-5 دقائق\n\n` +
        `📸 الآن، أرسل صورة الإيصال:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🏠 إلغاء']],
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
        
        // تحميل الصورة
        const photoId = msg.photo[msg.photo.length - 1].file_id;
        const photoBuffer = await downloadPhoto(photoId, chargingBot);
        
        // إنشاء طلب الشحن
        const order = createOrder(chatId, 'deposit', {
            username: state.username,
            firstName: state.firstName,
            amount: state.amount,
            paymentProof: photoBuffer
        });
        
        // إرسال إشعار للإدارة
        await sendDepositNotification(order, photoBuffer);
        
        userStates.delete(chatId);
        
        chargingBot.sendMessage(chatId,
            `✅ *تم استلام إيصال الدفع بنجاح!*\n\n` +
            `💰 المبلغ: *${state.amount}$*\n` +
            `🆔 رقم الطلب: *${order.orderId}*\n` +
            `📅 الوقت: ${new Date().toLocaleString('ar-SA')}\n\n` +
            `📞 *حالة الطلب:*\n` +
            `⏳ جاري مراجعة الإيصال\n` +
            `⏱️ الوقت المتوقع: 1-5 دقائق\n\n` +
            `🔔 ستتلقى إشعاراً عند تأكيد الشحن`,
            { parse_mode: 'Markdown' }
        );
        
        setTimeout(() => showMainMenu(chatId, user), 3000);
        
    } catch (error) {
        console.error('❌ خطأ في معالجة الإيصال:', error);
        chargingBot.sendMessage(chatId,
            '❌ حدث خطأ في معالجة الصورة، يرجى المحاولة مرة أخرى',
            { parse_mode: 'Markdown' }
        );
    }
}

function showUserOrders(chatId) {
    const userOrders = Array.from(orders.values())
        .filter(order => order.userId === chatId)
        .sort((a, b) => b.createdAt - a.createdAt);
    
    if (userOrders.length === 0) {
        chargingBot.sendMessage(chatId,
            '📭 *لا توجد طلبات سابقة*\n\n' +
            'لم تقم بأي طلبات حتى الآن.',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    let message = `📋 *طلباتي*\n\n`;
    
    userOrders.forEach((order, index) => {
        if (index < 10) { // عرض آخر 10 طلبات فقط
            const icon = order.type === 'deposit' ? '💳' : '🎮';
            const status = getOrderStatusText(order.status);
            
            message += `${icon} *${order.serviceName || 'شحن رصيد'}*\n`;
            message += `💰 ${order.amount}$ | ${status}\n`;
            message += `🆔 ${order.orderId}\n`;
            message += `📅 ${order.createdAt.toLocaleDateString('ar-SA')}\n\n`;
        }
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
        `💵 الرصيد الحالي: *${user.balance}$*\n` +
        `🎯 نسبة الخصم: *${user.discount}%*\n` +
        `📊 إجمالي المشتريات: *${user.totalSpent}$*\n` +
        `📦 عدد الطلبات: *${user.ordersCount}*\n\n` +
        `💡 *لشحن الرصيد:*\nاضغط على "💳 شحن رصيد"`,
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
    const helpText = `🆘 *دليل استخدام البوت*\n\n` +
                    `💳 *شحن الرصيد:*\n` +
                    `1. اضغط على "💳 شحن رصيد"\n` +
                    `2. أدخل المبلغ\n` +
                    `3. أرسل صورة إيصال الدفع\n` +
                    `4. انتظر تأكيد الإدارة\n\n` +
                    `🎮 *شراء الخدمات:*\n` +
                    `1. اضغط على "🎮 الخدمات"\n` +
                    `2. اختر الخدمة المطلوبة\n` +
                    `3. أدخل ID اللعبة\n` +
                    `4. انتظر تنفيذ الطلب\n\n` +
                    `📞 *الدعم الفني:*\n` +
                    `للشكاوى والاستفسارات:\n` +
                    `@Diamouffbot_support`;
    
    chargingBot.sendMessage(chatId, helpText, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

function getOrderStatusText(status) {
    const statusMap = {
        'pending': '⏳ قيد الانتظار',
        'pending_payment': '💳 بانتظار الدفع',
        'processing': '🔄 قيد المعالجة',
        'completed': '✅ مكتمل',
        'cancelled': '❌ ملغى',
        'failed': '❌ فشل'
    };
    return statusMap[status] || status;
}

// ========== دوال إرسال الإشعارات للإدارة ==========

async function sendOrderNotification(order) {
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    let sentCount = 0;
    
    const message = `📦 *طلب خدمة جديد*\n\n` +
                   `👤 المستخدم: ${order.firstName || '@' + order.username}\n` +
                   `🆔 ID: \`${order.userId}\`\n` +
                   `🎮 الخدمة: *${order.serviceName}*\n` +
                   `💰 المبلغ: *${order.amount}$*\n` +
                   `🎮 ID اللعبة: \`${order.gameId}\`\n` +
                   `🆔 رقم الطلب: \`${order.orderId}\`\n` +
                   `📅 الوقت: ${order.createdAt.toLocaleString('ar-SA')}\n\n` +
                   `⚡ *أزرار التحكم:*`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ إكمال الطلب', callback_data: `complete_order_${order.orderId}` },
                { text: '❌ إلغاء الطلب', callback_data: `cancel_order_${order.orderId}` }
            ],
            [
                { text: '💬 مراسلة المستخدم', url: `tg://user?id=${order.userId}` }
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
            console.log(`✅ تم إرسال إشعار طلب خدمة للإدمن ${adminId}`);
        } catch (error) {
            console.error(`❌ فشل إرسال إشعار للإدمن ${adminId}:`, error.message);
        }
    }
    
    return sentCount > 0;
}

async function sendDepositNotification(order, photoBuffer) {
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    let sentCount = 0;
    
    const message = `💳 *طلب شحن جديد*\n\n` +
                   `👤 المستخدم: ${order.firstName || '@' + order.username}\n` +
                   `🆔 ID: \`${order.userId}\`\n` +
                   `💰 المبلغ: *${order.amount}$*\n` +
                   `🆔 رقم الطلب: \`${order.orderId}\`\n` +
                   `📅 الوقت: ${order.createdAt.toLocaleString('ar-SA')}\n\n` +
                   `⚡ *أزرار التحكم:*`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ تأكيد الدفع', callback_data: `confirm_deposit_${order.orderId}` },
                { text: '❌ رفض الدفع', callback_data: `reject_deposit_${order.orderId}` }
            ],
            [
                { text: '💬 مراسلة المستخدم', url: `tg://user?id=${order.userId}` }
            ]
        ]
    };
    
    for (const adminId of admins) {
        try {
            if (photoBuffer) {
                await adminBot.sendPhoto(adminId, photoBuffer, {
                    caption: message,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            } else {
                await adminBot.sendMessage(adminId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
            sentCount++;
            console.log(`✅ تم إرسال إشعار شحن للإدمن ${adminId}`);
        } catch (error) {
            console.error(`❌ فشل إرسال إشعار للإدمن ${adminId}:`, error.message);
        }
    }
    
    return sentCount > 0;
}

// ========== بوت الإدارة ==========

// معالجة الأمر /start للأدمن
adminBot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول');
        return;
    }
    
    console.log(`👑 أدمن دخل: ${chatId}`);
    showAdminMainMenu(chatId);
});

// معالجة الرسائل النصية للأدمن
adminBot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!isAdmin(chatId)) return;
    
    console.log(`📩 رسالة أدمن من ${chatId}: ${text}`);
    
    // التحقق من حالة الأدمن
    const adminState = adminStates.get(chatId);
    
    if (adminState) {
        await handleAdminState(chatId, text, msg, adminState);
        return;
    }
    
    if (!text) return;
    
    // معالجة الأوامر الرئيسية
    switch(text) {
        case '🏠 الرئيسية':
            showAdminMainMenu(chatId);
            break;
            
        case '📊 الإحصائيات':
            showStatistics(chatId);
            break;
            
        case '📦 إدارة الخدمات':
            showServicesManagement(chatId);
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
            
        case '🆕 إضافة خدمة':
            startAddServiceProcess(chatId);
            break;
            
        case '🔄 تحديث':
            showAdminMainMenu(chatId);
            break;
            
        default:
            // التحقق إذا كان النص هو أمر إدارة خدمة
            if (text.startsWith('✏️ تعديل ')) {
                const serviceId = text.replace('✏️ تعديل ', '');
                startEditServiceProcess(chatId, serviceId);
            } else if (text.startsWith('🗑️ حذف ')) {
                const serviceId = text.replace('🗑️ حذف ', '');
                confirmDeleteService(chatId, serviceId);
            } else if (text.startsWith('🔁 ')) {
                const serviceId = text.replace('🔁 ', '');
                toggleServiceAndNotify(chatId, serviceId);
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
                ['🔄 تحديث']
            ],
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId,
        `👑 *لوحة تحكم الأدمن*\n\n` +
        `📊 *الإحصائيات السريعة:*\n` +
        `📦 الطلبات النشطة: ${pendingOrders}\n` +
        `🎮 الخدمات المفعلة: ${activeServices}\n` +
        `👥 المستخدمين: ${users.size}\n\n` +
        `🎯 *اختر من القائمة:*`,
        {
            parse_mode: 'Markdown',
            ...keyboard
        }
    );
}

function showStatistics(chatId) {
    const totalUsers = users.size;
    const activeUsers = Array.from(users.values())
        .filter(u => {
            const diff = Date.now() - new Date(u.lastActive).getTime();
            return diff < 7 * 24 * 60 * 60 * 1000; // نشط خلال أسبوع
        }).length;
    
    const totalOrders = orders.size;
    const completedOrders = Array.from(orders.values())
        .filter(o => o.status === 'completed').length;
    
    const totalRevenue = Array.from(orders.values())
        .filter(o => o.status === 'completed')
        .reduce((sum, order) => sum + order.amount, 0);
    
    const activeServices = Array.from(services.values())
        .filter(s => s.isActive).length;
    
    adminBot.sendMessage(chatId,
        `📊 *إحصائيات مفصلة*\n\n` +
        `👥 *المستخدمين:*\n` +
        `• الإجمالي: ${totalUsers}\n` +
        `• النشطين: ${activeUsers}\n` +
        `• النسبة: ${((activeUsers / totalUsers) * 100 || 0).toFixed(1)}%\n\n` +
        `📦 *الطلبات:*\n` +
        `• الإجمالي: ${totalOrders}\n` +
        `• المكتملة: ${completedOrders}\n` +
        `• النسبة: ${((completedOrders / totalOrders) * 100 || 0).toFixed(1)}%\n\n` +
        `💰 *الإيرادات:*\n` +
        `• الإجمالي: ${totalRevenue.toFixed(2)}$\n` +
        `• متوسط الطلب: ${(totalRevenue / completedOrders || 0).toFixed(2)}$\n\n` +
        `🎮 *الخدمات:*\n` +
        `• الإجمالي: ${services.size}\n` +
        `• المفعلة: ${activeServices}`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🏠 الرئيسية']],
                resize_keyboard: true
            }
        }
    );
}

function showServicesManagement(chatId) {
    const allServices = Array.from(services.values())
        .sort((a, b) => b.createdAt - a.createdAt);
    
    if (allServices.length === 0) {
        adminBot.sendMessage(chatId,
            '📭 *لا توجد خدمات*\n\n' +
            'استخدم "🆕 إضافة خدمة" لبدء إضافة خدمات.',
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
    
    let message = `📦 *إدارة الخدمات*\n\n` +
                 `📊 العدد الإجمالي: ${allServices.length}\n\n` +
                 `🎯 *آخر الخدمات:*\n\n`;
    
    // إنشاء أزرار الخدمات
    const keyboardRows = [];
    
    allServices.slice(0, 10).forEach(service => {
        const status = service.isActive ? '🟢' : '🔴';
        const stockStatus = service.stock > 10 ? '🟢' :
                          service.stock > 0 ? '🟡' : '🔴';
        
        message += `${status} *${service.name}*\n`;
        message += `💰 ${service.price}$ | 📦 ${stockStatus} ${service.stock}\n`;
        message += `🆔 ${service.id}\n\n`;
        
        // أزرار التحكم لكل خدمة
        keyboardRows.push([
            `✏️ تعديل ${service.id}`,
            `🗑️ حذف ${service.id}`
        ]);
        keyboardRows.push([
            `🔁 ${service.id}`
        ]);
    });
    
    if (allServices.length > 10) {
        message += `📖 و ${allServices.length - 10} خدمة أخرى...\n\n`;
    }
    
    keyboardRows.push(['🆕 إضافة خدمة', '📋 جميع الخدمات']);
    keyboardRows.push(['🏠 الرئيسية']);
    
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

function showAllOrders(chatId) {
    const allOrders = Array.from(orders.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20);
    
    if (allOrders.length === 0) {
        adminBot.sendMessage(chatId, '📭 *لا توجد طلبات*', { parse_mode: 'Markdown' });
        return;
    }
    
    let message = `📋 *آخر 20 طلب*\n\n`;
    
    allOrders.forEach((order, index) => {
        const icon = order.type === 'deposit' ? '💳' : '🎮';
        const status = getOrderStatusText(order.status);
        
        message += `${index + 1}. ${icon} ${order.serviceName || 'شحن رصيد'}\n`;
        message += `   👤 @${order.username} | 💰 ${order.amount}$\n`;
        message += `   🆔 ${order.orderId} | ${status}\n`;
        message += `   📅 ${order.createdAt.toLocaleDateString('ar-SA')}\n\n`;
    });
    
    message += `📊 *الملخص:*\n`;
    message += `• الإجمالي: ${orders.size}\n`;
    message += `• قيد الانتظار: ${Array.from(orders.values()).filter(o => o.status === 'pending' || o.status === 'pending_payment').length}`;
    
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
        .filter(o => o.type === 'deposit' && o.status === 'pending_payment')
        .sort((a, b) => b.createdAt - a.createdAt);
    
    if (depositOrders.length === 0) {
        adminBot.sendMessage(chatId, '💳 *لا توجد طلبات شحن*', { parse_mode: 'Markdown' });
        return;
    }
    
    let message = `💳 *طلبات الشحن*\n\n`;
    message += `📊 بانتظار التأكيد: ${depositOrders.length}\n\n`;
    
    depositOrders.forEach((order, index) => {
        if (index < 10) {
            message += `${index + 1}. 👤 @${order.username}\n`;
            message += `   💰 ${order.amount}$ | 🆔 ${order.orderId}\n`;
            message += `   📅 ${order.createdAt.toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit' })}\n\n`;
        }
    });
    
    if (depositOrders.length > 10) {
        message += `📖 و ${depositOrders.length - 10} طلباً آخر...\n\n`;
    }
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

function showUsersList(chatId) {
    const allUsers = Array.from(users.values())
        .sort((a, b) => b.lastActive - a.lastActive)
        .slice(0, 15);
    
    if (allUsers.length === 0) {
        adminBot.sendMessage(chatId, '👥 *لا يوجد مستخدمين*', { parse_mode: 'Markdown' });
        return;
    }
    
    let message = `👥 *آخر 15 مستخدم نشط*\n\n`;
    
    allUsers.forEach((user, index) => {
        const daysSinceActive = Math.floor((Date.now() - new Date(user.lastActive).getTime()) / (1000 * 60 * 60 * 24));
        const activity = daysSinceActive === 0 ? '🟢 اليوم' :
                        daysSinceActive <= 1 ? '🟢 أمس' :
                        daysSinceActive <= 7 ? '🟡 هذا الأسبوع' : '🔴 قديم';
        
        message += `${index + 1}. 👤 ${user.firstName || '@' + user.username}\n`;
        message += `   🆔 ${user.userId}\n`;
        message += `   💰 ${user.balance}$ | 📦 ${user.ordersCount} طلب\n`;
        message += `   📅 النشاط: ${activity}\n\n`;
    });
    
    message += `📊 *الإجمالي:* ${users.size} مستخدم`;
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

// ========== معالجة Callback Queries للأدمن ==========

adminBot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    
    if (!isAdmin(chatId)) {
        adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ غير مصرح' });
        return;
    }
    
    console.log(`🔘 ضغط أدمن على زر: ${data}`);
    
    try {
        if (data.startsWith('complete_order_')) {
            const orderId = data.replace('complete_order_', '');
            await completeOrder(chatId, orderId, callbackQuery.id, messageId);
            
        } else if (data.startsWith('cancel_order_')) {
            const orderId = data.replace('cancel_order_', '');
            await cancelOrder(chatId, orderId, callbackQuery.id, messageId);
            
        } else if (data.startsWith('confirm_deposit_')) {
            const orderId = data.replace('confirm_deposit_', '');
            await confirmDeposit(chatId, orderId, callbackQuery.id, messageId);
            
        } else if (data.startsWith('reject_deposit_')) {
            const orderId = data.replace('reject_deposit_', '');
            await rejectDeposit(chatId, orderId, callbackQuery.id, messageId);
        }
        
    } catch (error) {
        console.error('❌ خطأ في معالجة Callback:', error);
        adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ حدث خطأ' });
    }
});

async function completeOrder(adminId, orderId, callbackQueryId, messageId) {
    const order = orders.get(orderId);
    
    if (!order || order.status !== 'pending') {
        adminBot.answerCallbackQuery(callbackQueryId, { text: '❌ الطلب غير موجود أو تم معالجته' });
        return;
    }
    
    // تحديث حالة الطلب
    updateOrderStatus(orderId, 'completed', adminId);
    
    // إرسال إشعار للمستخدم
    try {
        await chargingBot.sendMessage(order.userId,
            `✅ *تم إكمال طلبك بنجاح!*\n\n` +
            `🎮 الخدمة: ${order.serviceName}\n` +
            `💰 المبلغ: ${order.amount}$\n` +
            `🆔 رقم الطلب: ${order.orderId}\n` +
            `🎮 ID اللعبة: ${order.gameId}\n\n` +
            `🎉 تم تنفيذ طلبك، يمكنك التحقق منه في اللعبة الآن.`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error(`❌ فشل إرسال إشعار للمستخدم ${order.userId}:`, error);
    }
    
    // تحديث رسالة الأدمن
    await adminBot.editMessageText(
        `✅ *تم إكمال الطلب*\n\n` +
        `👤 المستخدم: @${order.username}\n` +
        `🎮 الخدمة: ${order.serviceName}\n` +
        `💰 المبلغ: ${order.amount}$\n` +
        `🆔 رقم الطلب: ${order.orderId}\n` +
        `👨‍💼 تم بواسطة: ${adminId}\n` +
        `📅 الوقت: ${new Date().toLocaleString('ar-SA')}`,
        {
            chat_id: adminId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );
    
    adminBot.answerCallbackQuery(callbackQueryId, { text: '✅ تم إكمال الطلب' });
}

async function cancelOrder(adminId, orderId, callbackQueryId, messageId) {
    const order = orders.get(orderId);
    
    if (!order || order.status !== 'pending') {
        adminBot.answerCallbackQuery(callbackQueryId, { text: '❌ الطلب غير موجود أو تم معالجته' });
        return;
    }
    
    // إرجاع المبلغ للمستخدم
    const user = getUser(order.userId);
    user.balance += order.amount;
    updateUser(order.userId, user);
    
    // تحديث حالة الطلب
    updateOrderStatus(orderId, 'cancelled', adminId);
    
    // إرسال إشعار للمستخدم
    try {
        await chargingBot.sendMessage(order.userId,
            `❌ *تم إلغاء طلبك*\n\n` +
            `🎮 الخدمة: ${order.serviceName}\n` +
            `💰 المبلغ: ${order.amount}$\n` +
            `🆔 رقم الطلب: ${order.orderId}\n\n` +
            `💳 *تم إرجاع المبلغ:*\n` +
            `تم إرجاع ${order.amount}$ إلى رصيدك\n` +
            `💰 رصيدك الجديد: ${user.balance}$\n\n` +
            `📞 للاستفسار، تواصل مع الدعم.`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error(`❌ فشل إرسال إشعار للمستخدم ${order.userId}:`, error);
    }
    
    // تحديث رسالة الأدمن
    await adminBot.editMessageText(
        `❌ *تم إلغاء الطلب*\n\n` +
        `👤 المستخدم: @${order.username}\n` +
        `🎮 الخدمة: ${order.serviceName}\n` +
        `💰 المبلغ: ${order.amount}$\n` +
        `💳 تم إرجاع المبلغ\n` +
        `🆔 رقم الطلب: ${order.orderId}\n` +
        `👨‍💼 تم بواسطة: ${adminId}\n` +
        `📅 الوقت: ${new Date().toLocaleString('ar-SA')}`,
        {
            chat_id: adminId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );
    
    adminBot.answerCallbackQuery(callbackQueryId, { text: '❌ تم إلغاء الطلب وإرجاع المبلغ' });
}

async function confirmDeposit(adminId, orderId, callbackQueryId, messageId) {
    const order = orders.get(orderId);
    
    if (!order || order.status !== 'pending_payment') {
        adminBot.answerCallbackQuery(callbackQueryId, { text: '❌ الطلب غير موجود أو تم معالجته' });
        return;
    }
    
    // إضافة الرصيد للمستخدم
    const user = getUser(order.userId);
    user.balance += order.amount;
    user.totalSpent += order.amount;
    updateUser(order.userId, user);
    
    // تحديث حالة الطلب
    updateOrderStatus(orderId, 'completed', adminId);
    
    // إرسال إشعار للمستخدم
    try {
        await chargingBot.sendMessage(order.userId,
            `✅ *تم تأكيد شحن رصيدك بنجاح!*\n\n` +
            `💰 المبلغ: ${order.amount}$\n` +
            `💳 الرصيد الجديد: ${user.balance}$\n` +
            `🆔 رقم الطلب: ${order.orderId}\n\n` +
            `🎉 يمكنك الآن شراء الخدمات من قائمة "🎮 الخدمات"`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error(`❌ فشل إرسال إشعار للمستخدم ${order.userId}:`, error);
    }
    
    // تحديث رسالة الأدمن
    await adminBot.editMessageText(
        `✅ *تم تأكيد الشحن*\n\n` +
        `👤 المستخدم: @${order.username}\n` +
        `💰 المبلغ: ${order.amount}$\n` +
        `💳 تم إضافة الرصيد\n` +
        `🆔 رقم الطلب: ${order.orderId}\n` +
        `👨‍💼 تم بواسطة: ${adminId}\n` +
        `📅 الوقت: ${new Date().toLocaleString('ar-SA')}`,
        {
            chat_id: adminId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );
    
    adminBot.answerCallbackQuery(callbackQueryId, { text: '✅ تم تأكيد الدفع وإضافة الرصيد' });
}

async function rejectDeposit(adminId, orderId, callbackQueryId, messageId) {
    const order = orders.get(orderId);
    
    if (!order || order.status !== 'pending_payment') {
        adminBot.answerCallbackQuery(callbackQueryId, { text: '❌ الطلب غير موجود أو تم معالجته' });
        return;
    }
    
    // تحديث حالة الطلب
    updateOrderStatus(orderId, 'cancelled', adminId);
    
    // إرسال إشعار للمستخدم
    try {
        await chargingBot.sendMessage(order.userId,
            `❌ *فشل تأكيد الدفع*\n\n` +
            `💰 المبلغ: ${order.amount}$\n` +
            `🆔 رقم الطلب: ${order.orderId}\n\n` +
            `⚠️ *الأسباب المحتملة:*\n` +
            `• المبلغ غير مطابق\n` +
            `• الإيصال غير واضح\n` +
            `• معلومات غير مكتملة\n\n` +
            `💡 *الحل:*\n` +
            `• تحقق من المبلغ المدعوم\n` +
            `• أرسل إيصالاً واضحاً\n` +
            `• تأكد من إدخال المبلغ الصحيح`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error(`❌ فشل إرسال إشعار للمستخدم ${order.userId}:`, error);
    }
    
    // تحديث رسالة الأدمن
    await adminBot.editMessageText(
        `❌ *تم رفض الشحن*\n\n` +
        `👤 المستخدم: @${order.username}\n` +
        `💰 المبلغ: ${order.amount}$\n` +
        `❌ تم إبلاغ المستخدم\n` +
        `🆔 رقم الطلب: ${order.orderId}\n` +
        `👨‍💼 تم بواسطة: ${adminId}\n` +
        `📅 الوقت: ${new Date().toLocaleString('ar-SA')}`,
        {
            chat_id: adminId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );
    
    adminBot.answerCallbackQuery(callbackQueryId, { text: '❌ تم رفض الدفع وإعلام المستخدم' });
}

// ========== دوال إدارة الخدمات للأدمن ==========

function startAddServiceProcess(chatId) {
    adminStates.set(chatId, {
        type: 'adding_service',
        step: 1,
        data: {}
    });
    
    adminBot.sendMessage(chatId,
        `🆕 *إضافة خدمة جديدة*\n\n` +
        `📝 *الخطوة 1/5:*\n` +
        `أدخل اسم الخدمة:\n` +
        `مثال: "جواهر فري فاير 5000+500"`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء']],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }
    );
}

function startEditServiceProcess(chatId, serviceId) {
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
                ['✏️ تعديل الاسم', '✏️ تعديل الوصف'],
                ['✏️ تعديل السعر', '✏️ تعديل المخزون'],
                ['🚫 إلغاء']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId,
        `✏️ *تعديل الخدمة*\n\n` +
        `🎮 ${service.name}\n` +
        `💰 ${service.price}$ | 📦 ${service.stock}\n\n` +
        `اختر ما تريد تعديله:`,
        {
            parse_mode: 'Markdown',
            ...keyboard
        }
    );
}

async function handleAdminState(chatId, text, msg, state) {
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
    }
}

async function handleAddServiceStep(chatId, text, state) {
    switch(state.step) {
        case 1: // اسم الخدمة
            if (text.length < 3) {
                adminBot.sendMessage(chatId, '❌ الاسم يجب أن يكون على الأقل 3 أحرف');
                return;
            }
            state.data.name = text;
            state.step = 2;
            
            adminBot.sendMessage(chatId,
                `✅ *تم حفظ الاسم*\n\n` +
                `📝 *الخطوة 2/5:*\n` +
                `أدخل وصف الخدمة:\n` +
                `مثال: "اشتري 5000 جوهرة واحصل على 500 مجاناً"`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [['🚫 إلغاء']],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                }
            );
            break;
            
        case 2: // وصف الخدمة
            if (text.length < 10) {
                adminBot.sendMessage(chatId, '❌ الوصف يجب أن يكون على الأقل 10 أحرف');
                return;
            }
            state.data.description = text;
            state.step = 3;
            
            adminBot.sendMessage(chatId,
                `✅ *تم حفظ الوصف*\n\n` +
                `📝 *الخطوة 3/5:*\n` +
                `أدخل سعر الخدمة (بالدولار):\n` +
                `مثال: "45" أو "10.5"`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [['🚫 إلغاء']],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                }
            );
            break;
            
        case 3: // سعر الخدمة
            const price = parseFloat(text);
            if (isNaN(price) || price <= 0) {
                adminBot.sendMessage(chatId, '❌ السعر يجب أن يكون رقماً أكبر من 0');
                return;
            }
            state.data.price = price;
            state.step = 4;
            
            adminBot.sendMessage(chatId,
                `✅ *تم حفظ السعر*\n\n` +
                `📝 *الخطوة 4/5:*\n` +
                `أدخل كمية المخزون:\n` +
                `مثال: "50"`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [['🚫 إلغاء']],
                        resize_keyboard: true,
                        one_time_keyboard: true
                    }
                }
            );
            break;
            
        case 4: // المخزون
            const stock = parseInt(text);
            if (isNaN(stock) || stock < 0) {
                adminBot.sendMessage(chatId, '❌ المخزون يجب أن يكون رقماً صحيحاً غير سالب');
                return;
            }
            state.data.stock = stock;
            state.step = 5;
            
            const keyboard = {
                reply_markup: {
                    keyboard: [
                        ['جواهر', 'باقات'],
                        ['أسلبة', 'عروض خاصة'],
                        ['🚫 إلغاء']
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            };
            
            adminBot.sendMessage(chatId,
                `✅ *تم حفظ المخزون*\n\n` +
                `📝 *الخطوة 5/5:*\n` +
                `اختر تصنيف الخدمة:`,
                {
                    parse_mode: 'Markdown',
                    ...keyboard
                }
            );
            break;
            
        case 5: // التصنيف
            const service = addService(
                state.data.name,
                state.data.description,
                state.data.price,
                state.data.stock,
                text
            );
            
            adminStates.delete(chatId);
            
            adminBot.sendMessage(chatId,
                `🎉 *تمت إضافة الخدمة بنجاح!*\n\n` +
                `🎮 الاسم: ${service.name}\n` +
                `📝 الوصف: ${service.description}\n` +
                `💰 السعر: ${service.price}$\n` +
                `📦 المخزون: ${service.stock}\n` +
                `📁 التصنيف: ${service.category}\n` +
                `🆔 المعرف: ${service.id}\n\n` +
                `✅ الخدمة متاحة الآن للمستخدمين`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [['📦 إدارة الخدمات', '🆕 إضافة خدمة'], ['🏠 الرئيسية']],
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
    if (!service) {
        adminStates.delete(chatId);
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        return;
    }
    
    if (text === '✏️ تعديل الاسم') {
        state.editingField = 'name';
        state.step = 2;
        
        adminBot.sendMessage(chatId,
            `✏️ *تعديل اسم الخدمة*\n\n` +
            `الاسم الحالي: ${service.name}\n\n` +
            `أدخل الاسم الجديد:`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [['🚫 إلغاء']],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );
        
    } else if (text === '✏️ تعديل الوصف') {
        state.editingField = 'description';
        state.step = 2;
        
        adminBot.sendMessage(chatId,
            `✏️ *تعديل وصف الخدمة*\n\n` +
            `الوصف الحالي: ${service.description}\n\n` +
            `أدخل الوصف الجديد:`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [['🚫 إلغاء']],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );
        
    } else if (text === '✏️ تعديل السعر') {
        state.editingField = 'price';
        state.step = 2;
        
        adminBot.sendMessage(chatId,
            `✏️ *تعديل سعر الخدمة*\n\n` +
            `السعر الحالي: ${service.price}$\n\n` +
            `أدخل السعر الجديد:`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [['🚫 إلغاء']],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );
        
    } else if (text === '✏️ تعديل المخزون') {
        state.editingField = 'stock';
        state.step = 2;
        
        adminBot.sendMessage(chatId,
            `✏️ *تعديل مخزون الخدمة*\n\n` +
            `المخزون الحالي: ${service.stock}\n\n` +
            `أدخل المخزون الجديد:`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [['🚫 إلغاء']],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );
        
    } else if (state.step === 2) {
        // معالجة قيمة الحقل الجديد
        let newValue;
        let isValid = true;
        
        switch(state.editingField) {
            case 'name':
                if (text.length < 3) {
                    adminBot.sendMessage(chatId, '❌ الاسم يجب أن يكون على الأقل 3 أحرف');
                    isValid = false;
                } else {
                    newValue = text;
                }
                break;
                
            case 'description':
                if (text.length < 10) {
                    adminBot.sendMessage(chatId, '❌ الوصف يجب أن يكون على الأقل 10 أحرف');
                    isValid = false;
                } else {
                    newValue = text;
                }
                break;
                
            case 'price':
                newValue = parseFloat(text);
                if (isNaN(newValue) || newValue <= 0) {
                    adminBot.sendMessage(chatId, '❌ السعر يجب أن يكون رقماً أكبر من 0');
                    isValid = false;
                }
                break;
                
            case 'stock':
                newValue = parseInt(text);
                if (isNaN(newValue) || newValue < 0) {
                    adminBot.sendMessage(chatId, '❌ المخزون يجب أن يكون رقماً صحيحاً غير سالب');
                    isValid = false;
                }
                break;
        }
        
        if (isValid) {
            const updates = {};
            updates[state.editingField] = newValue;
            updateService(state.serviceId, updates);
            
            adminStates.delete(chatId);
            
            adminBot.sendMessage(chatId,
                `✅ *تم التعديل بنجاح*\n\n` +
                `🎮 ${service.name}\n` +
                `🔄 ${state.editingField}: ${newValue}\n\n` +
                `📅 تم التحديث في: ${new Date().toLocaleString('ar-SA')}`,
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
    
    if (isValid !== false) {
        adminStates.set(chatId, state);
    }
}

function confirmDeleteService(chatId, serviceId) {
    const service = services.get(serviceId);
    if (!service) {
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        return;
    }
    
    adminStates.set(chatId, {
        type: 'confirming_delete',
        serviceId: serviceId
    });
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['✅ نعم، احذف الخدمة'],
                ['🚫 لا، إلغاء الحذف']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId,
        `⚠️ *تأكيد حذف الخدمة*\n\n` +
        `🎮 ${service.name}\n` +
        `💰 ${service.price}$ | 📦 ${service.stock}\n` +
        `🆔 ${service.id}\n\n` +
        `❌ *تحذير:*\n` +
        `لا يمكن التراجع عن حذف الخدمة!\n` +
        `هل أنت متأكد من الحذف؟`,
        {
            parse_mode: 'Markdown',
            ...keyboard
        }
    );
}

function toggleServiceAndNotify(chatId, serviceId) {
    const service = toggleServiceStatus(serviceId);
    
    if (service) {
        adminBot.sendMessage(chatId,
            `🔄 *تم تغيير حالة الخدمة*\n\n` +
            `🎮 ${service.name}\n` +
            `📊 الحالة: ${service.isActive ? '🟢 مفعل' : '🔴 معطل'}\n` +
            `🆔 ${service.id}`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [['📦 إدارة الخدمات', '🏠 الرئيسية']],
                    resize_keyboard: true
                }
            }
        );
    } else {
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
    }
}

// ========== تشغيل النظام ==========

console.log('🚀 بدء تشغيل نظام بوتات Free Fire...');

// تهيئة الخدمات
initializeServices();

console.log('✅ تم تحميل النظام بنجاح!');
console.log(`🤖 بوت المستخدمين: جاهز (@Diamouffbot)`);
console.log(`👑 بوت الإدارة: جاهز (@otzhabot)`);
console.log(`📊 عدد الخدمات: ${services.size}`);
console.log('🎯 النظام يعمل بكامل طاقته!');

// إرسال رسالة بدء التشغيل للمدراء
setTimeout(() => {
    try {
        adminBot.sendMessage(ADMIN_ID, 
            '✅ *النظام يعمل بنجاح*\n\n' +
            `🤖 البوت الأول: @Diamouffbot\n` +
            `👑 البوت الثاني: @otzhabot\n` +
            `📦 الخدمات: ${services.size}\n` +
            `⏱️ ${new Date().toLocaleString('ar-SA')}\n\n` +
            `🎯 جاهز لاستقبال الطلبات!`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.log('⚠️ لا يمكن إرسال رسالة بدء التشغيل للمسؤول');
    }
}, 2000);

// تشغيل سيرفر ويب للحفاظ على التشغيل
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Free Fire Bots System\nUsers: ${users.size} | Orders: ${orders.size} | Services: ${services.size}`);
});

server.listen(PORT, () => {
    console.log(`🌐 السيرفر يعمل على المنفذ: ${PORT}`);
});

// دالة للحفاظ على النظام نشطاً
setInterval(() => {
    console.log(`🔄 النظام نشط | المستخدمين: ${users.size} | الطلبات: ${orders.size} | ${new Date().toLocaleString('ar-SA')}`);
}, 300000);

console.log('🎉 النظام جاهز بالكامل!');
