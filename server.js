const TelegramBot = require('node-telegram-bot-api');

// === إعداد التوكنات ===
const CHARGING_BOT_TOKEN = '8223596744:AAGHOMQ3Sjk3-X_Z7eXXnL5drAXaHXglLFg';
const ADMIN_BOT_TOKEN = '8216188569:AAEEA1q_os_6XfSJrUDLDkkQxZXh-3OMAVU';

// === إعداد المدراء ===
const ADMIN_ID = 7656412227; // أنت (Yacine)
const SECOND_ADMIN_ID = 7450109529; // صديقك
const PAYMENT_ID = '953936100';

// إنشاء البوتات
const chargingBot = new TelegramBot(CHARGING_BOT_TOKEN, { polling: true });
const adminBot = new TelegramBot(ADMIN_BOT_TOKEN, { polling: true });

// ========== تخزين البيانات في الذاكرة ==========

const users = new Map();
const services = new Map();
const orders = new Map();
const transactions = [];

// ========== دوال إدارة البيانات ==========

function getUser(userId) {
    if (!users.has(userId)) {
        users.set(userId, {
            userId: userId,
            username: '',
            balance: 0,
            discount: 0,
            isActive: true,
            lastActive: new Date(),
            commissionRate: 3,
            referrals: []
        });
    }
    return users.get(userId);
}

function saveUser(user) {
    users.set(user.userId, user);
    return user;
}

function findUser(identifier) {
    for (const user of users.values()) {
        if (user.userId.toString() === identifier) return user;
        if (user.username === identifier || user.username === identifier.replace('@', '')) return user;
    }
    return null;
}

function registerUser(userId, username) {
    const user = getUser(userId);
    user.username = username || user.username;
    user.lastActive = new Date();
    saveUser(user);
    return user;
}

// ========== دوال إدارة الخدمات ==========

let serviceCounter = 1;
function addService(name, description, price, stock) {
    const serviceId = `S${serviceCounter++}`;
    const service = { id: serviceId, name, description, price, stock };
    services.set(serviceId, service);
    return service;
}

// إضافة خدمات افتراضية
addService('جواهر فري فاير 100+10', 'اشتري 100 جوهرة واحصل على 10 مجاناً', 1, 100);
addService('جواهر فري فاير 500+50', 'اشتري 500 جوهرة واحصل على 50 مجاناً', 5, 50);
addService('جواهر فري فاير 1000+100', 'اشتري 1000 جوهرة واحصل على 100 مجاناً', 10, 30);

function getServices() {
    return Array.from(services.values());
}

// ========== دوال إدارة الطلبات ==========

let orderCounter = 1;
function createOrder(userId, username, serviceName, amount, gameId, status = 'pending') {
    const orderId = `ORD${orderCounter++}`;
    const order = {
        orderId,
        userId,
        username,
        serviceName,
        amount,
        gameId,
        status,
        paymentProof: '',
        createdAt: new Date()
    };
    orders.set(orderId, order);
    return order;
}

function createDepositOrder(userId, username, amount, paymentProof) {
    const orderId = `DEP${orderCounter++}`;
    const order = {
        orderId,
        userId,
        username,
        serviceName: 'شحن رصيد',
        amount,
        gameId: '',
        status: 'waiting_payment',
        paymentProof,
        createdAt: new Date()
    };
    orders.set(orderId, order);
    return order;
}

function getOrders() {
    return Array.from(orders.values());
}

function updateOrder(orderId, updates) {
    const order = orders.get(orderId);
    if (order) {
        Object.assign(order, updates);
    }
    return order;
}

// ========== إرسال إشعارات مباشرة إلى المدراء ==========

async function sendDepositNotificationToAdmins(depositOrder, photoId) {
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    
    for (const adminId of admins) {
        try {
            const message = `💳 *طلب شحن جديد*\n\n` +
                          `👤 المستخدم: @${depositOrder.username || 'بدون'}\n` +
                          `🆔 ID: ${depositOrder.userId}\n` +
                          `💰 المبلغ: ${depositOrder.amount}$\n` +
                          `🆔 رقم الطلب: ${depositOrder.orderId}\n` +
                          `📅 الوقت: ${depositOrder.createdAt.toLocaleString('ar-SA')}\n\n` +
                          `⚡ *أزرار التحكم:*`;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ تأكيد وإضافة الرصيد', callback_data: `confirm_deposit_${depositOrder.orderId}` },
                        { text: '❌ إلغاء وإعلام المستخدم', callback_data: `cancel_deposit_${depositOrder.orderId}` }
                    ],
                    [
                        { text: '💬 مراسلة المستخدم', url: `tg://user?id=${depositOrder.userId}` }
                    ]
                ]
            };
            
            // إرسال الصورة مع الإشعار
            await adminBot.sendPhoto(adminId, photoId, {
                caption: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
            // إرسال إشعار صوتي للمسؤول
            try {
                await adminBot.sendChatAction(adminId, 'typing');
            } catch (e) {}
            
        } catch (error) {
            console.log(`❌ فشل إرسال إشعار للمسؤول ${adminId}:`, error.message);
        }
    }
}

async function sendServiceNotificationToAdmins(serviceOrder) {
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    
    for (const adminId of admins) {
        try {
            const message = `📦 *طلب خدمة جديد*\n\n` +
                          `👤 المستخدم: @${serviceOrder.username || 'بدون'}\n` +
                          `🆔 ID: ${serviceOrder.userId}\n` +
                          `🎮 الخدمة: ${serviceOrder.serviceName}\n` +
                          `💰 السعر: ${serviceOrder.amount}$\n` +
                          `🆔 ID اللعبة: ${serviceOrder.gameId}\n` +
                          `🆔 رقم الطلب: ${serviceOrder.orderId}\n` +
                          `📅 الوقت: ${serviceOrder.createdAt.toLocaleString('ar-SA')}\n\n` +
                          `⚡ *أزرار التحكم:*`;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ إكمال الطلب', callback_data: `complete_${serviceOrder.orderId}` },
                        { text: '❌ إلغاء الطلب', callback_data: `cancel_${serviceOrder.orderId}` }
                    ],
                    [
                        { text: '💬 مراسلة المستخدم', url: `tg://user?id=${serviceOrder.userId}` }
                    ]
                ]
            };
            
            await adminBot.sendMessage(adminId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
            // إرسال إشعار صوتي للمسؤول
            try {
                await adminBot.sendChatAction(adminId, 'typing');
            } catch (e) {}
            
        } catch (error) {
            console.log(`❌ فشل إرسال إشعار للمسؤول ${adminId}:`, error.message);
        }
    }
}

// ========== بوت الشحن - الواجهة البسيطة ==========

const userActions = new Map();

chargingBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username;
    
    registerUser(chatId, username);
    const user = getUser(chatId);
    
    try {
        const action = userActions.get(chatId);
        if (action) {
            await handleUserAction(chatId, text, action, msg, user);
            return;
        }
        
        if (text === '/start') {
            showMainMenu(chatId, user);
        } else if (text === '💳 شحن رصيد') {
            startDepositProcess(chatId);
        } else if (text === '🎮 الخدمات') {
            showServicesMenu(chatId, user);
        } else if (text === '📋 طلباتي') {
            showUserOrders(chatId);
        } else if (text === '💰 رصيدي') {
            showBalance(chatId, user);
        } else if (text === '🏠 الرئيسية') {
            showMainMenu(chatId, user);
        } else {
            showMainMenu(chatId, user);
        }
    } catch (error) {
        console.error('❌ خطأ في بوت الشحن:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة لاحقاً');
        showMainMenu(chatId, user);
    }
});

function showMainMenu(chatId, user) {
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '🎮 الخدمات'],
                ['📋 طلباتي', '💰 رصيدي'],
                ['🏠 الرئيسية']
            ],
            resize_keyboard: true
        }
    };
    
    const message = `🎮 *مرحباً بك في بوت الشحن*\n\n💰 رصيدك: ${user.balance}$\n🎯 خصمك: ${user.discount}%\n\nاختر من القائمة:`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function startDepositProcess(chatId) {
    const message = `💳 *شحن الرصيد*\n\nالرجاء إدخال المبلغ الذي تريد شحنه (بالدولار):\nمثال: 5`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 إلغاء والعودة']],
            resize_keyboard: true
        }
    });
    
    userActions.set(chatId, { type: 'awaiting_deposit_amount' });
}

function showServicesMenu(chatId, user) {
    const servicesList = getServices().filter(s => s.stock > 0);
    
    if (servicesList.length === 0) {
        chargingBot.sendMessage(chatId, '⚠️ *لا توجد خدمات متاحة حالياً*', {
            parse_mode: 'Markdown'
        });
        return;
    }
    
    let message = `🎮 *الخدمات المتاحة*\n\n💰 رصيدك: ${user.balance}$\n🎯 خصمك: ${user.discount}%\n\n`;
    
    const keyboardButtons = [];
    
    servicesList.forEach(service => {
        const finalPrice = service.price * (1 - (user.discount / 100));
        message += `📦 ${service.name}\n💰 ${service.price}$ → ${finalPrice.toFixed(2)}$ (بعد الخصم)\n\n`;
        
        keyboardButtons.push([`🎮 ${service.name} - ${finalPrice.toFixed(2)}$`]);
    });
    
    keyboardButtons.push(['🏠 الرئيسية']);
    
    const keyboard = {
        reply_markup: {
            keyboard: keyboardButtons,
            resize_keyboard: true
        }
    };
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
    
    userActions.set(chatId, { type: 'awaiting_service_selection' });
}

async function handleUserAction(chatId, text, action, msg, user) {
    try {
        if (text === '🏠 إلغاء والعودة' || text === '🏠 الرئيسية') {
            userActions.delete(chatId);
            showMainMenu(chatId, user);
            return;
        }
        
        switch(action.type) {
            case 'awaiting_deposit_amount':
                const amount = parseFloat(text);
                if (isNaN(amount) || amount <= 0) {
                    chargingBot.sendMessage(chatId, '❌ قيمة غير صحيحة. الرجاء إدخال رقم صحيح أكبر من 0');
                    return;
                }
                
                const depositMessage = `💰 *طلب شحن رصيد*\n\n💵 المبلغ: ${amount}$\n\n📋 *تعليمات الدفع:*\n1. قم بتحويل ${amount}$ إلى:\nID: ${PAYMENT_ID}\n2. بعد التحويل، أرسل صورة إيصال الدفع هنا`;
                
                chargingBot.sendMessage(chatId, depositMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [['📸 إرسال الإيصال', '🏠 إلغاء']],
                        resize_keyboard: true
                    }
                });
                
                userActions.set(chatId, { type: 'awaiting_deposit_receipt', amount });
                break;
                
            case 'awaiting_service_selection':
                const serviceText = text.replace('🎮 ', '').split(' - ')[0];
                const service = getServices().find(s => s.name === serviceText);
                
                if (!service) {
                    chargingBot.sendMessage(chatId, '❌ الخدمة غير متوفرة');
                    userActions.delete(chatId);
                    showMainMenu(chatId, user);
                    return;
                }
                
                const finalPrice = service.price * (1 - (user.discount / 100));
                
                if (user.balance < finalPrice) {
                    chargingBot.sendMessage(chatId,
                        `❌ *رصيدك غير كافي*\n\n💰 رصيدك الحالي: ${user.balance}$\n💵 سعر الخدمة: ${finalPrice}$\n\nيرجى شحن رصيد أولاً`,
                        { parse_mode: 'Markdown' }
                    );
                    
                    userActions.delete(chatId);
                    return;
                }
                
                chargingBot.sendMessage(chatId,
                    `🎮 *${service.name}*\n\n💰 السعر: ${service.price}$\n🎯 خصمك: ${user.discount}%\n💵 السعر النهائي: ${finalPrice}$\n\n🆔 *الرجاء إرسال ID الخاص بك في اللعبة:*`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            keyboard: [['🏠 إلغاء']],
                            resize_keyboard: true
                        }
                    }
                );
                
                userActions.set(chatId, {
                    type: 'awaiting_game_id',
                    serviceId: service.id,
                    serviceName: service.name,
                    price: finalPrice
                });
                break;
                
            case 'awaiting_game_id':
                const gameId = text.trim();
                if (!gameId) {
                    chargingBot.sendMessage(chatId, '❌ يرجى إدخال ID صحيح');
                    return;
                }
                
                // خصم المبلغ من رصيد المستخدم
                user.balance -= action.price;
                saveUser(user);
                
                // إنشاء الطلب
                const order = createOrder(chatId, user.username, action.serviceName, action.price, gameId);
                
                // تسجيل العملية
                transactions.push({
                    userId: chatId,
                    type: 'purchase',
                    amount: action.price,
                    description: `شراء خدمة: ${action.serviceName}`,
                    date: new Date()
                });
                
                // إرسال إشعار مباشر للأدمن
                await sendServiceNotificationToAdmins(order);
                
                // تأكيد للمستخدم
                chargingBot.sendMessage(chatId,
                    `✅ *تم تقديم طلبك*\n\n🎮 الخدمة: ${action.serviceName}\n💰 المبلغ: ${action.price}$\n🆔 رقم الطلب: ${order.orderId}\n🎮 ID اللعبة: ${gameId}\n\n📞 سيتم معالجة طلبك خلال 24 ساعة`,
                    { parse_mode: 'Markdown' }
                );
                
                userActions.delete(chatId);
                showMainMenu(chatId, user);
                break;
        }
        
        // معالجة صورة الإيصال
        if (action.type === 'awaiting_deposit_receipt' && msg.photo) {
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            
            // إنشاء طلب الشحن
            const depositOrder = createDepositOrder(chatId, user.username, action.amount, photoId);
            
            // إرسال إشعار مباشر للأدمن مع الصورة
            await sendDepositNotificationToAdmins(depositOrder, photoId);
            
            // تأكيد للمستخدم
            chargingBot.sendMessage(chatId,
                `✅ *تم استلام إيصال الدفع*\n\n💰 المبلغ: ${action.amount}$\n🆔 رقم الطلب: ${depositOrder.orderId}\n\n📞 سيتم مراجعة طلبك من قبل الإدارة قريباً`,
                { parse_mode: 'Markdown' }
            );
            
            userActions.delete(chatId);
            showMainMenu(chatId, user);
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة إجراء المستخدم:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ أثناء المعالجة');
        userActions.delete(chatId);
        showMainMenu(chatId, user);
    }
}

function showUserOrders(chatId) {
    const userOrders = getOrders().filter(o => o.userId === chatId);
    
    if (userOrders.length === 0) {
        chargingBot.sendMessage(chatId, '📭 *لا توجد طلبات سابقة*', {
            parse_mode: 'Markdown'
        });
        return;
    }
    
    let message = '📋 *طلباتي*\n\n';
    
    userOrders.forEach(order => {
        const status = order.status === 'pending' ? '⏳ قيد الانتظار' :
                      order.status === 'completed' ? '✅ مكتمل' :
                      order.status === 'cancelled' ? '❌ ملغى' :
                      order.status === 'waiting_payment' ? '💳 بانتظار الدفع' : order.status;
        
        message += `🎮 ${order.serviceName}\n`;
        message += `💰 ${order.amount}$\n`;
        message += `📅 ${order.createdAt.toLocaleDateString('ar-SA')}\n`;
        message += `🔄 ${status}\n`;
        message += `🆔 ${order.orderId}\n\n`;
    });
    
    chargingBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

function showBalance(chatId, user) {
    chargingBot.sendMessage(chatId,
        `💰 *رصيدك*\n\n💵 الرصيد الحالي: ${user.balance}$\n🎯 نسبة الخصم: ${user.discount}%\n\nيمكنك شحن رصيد عبر زر "شحن رصيد"`,
        { parse_mode: 'Markdown' }
    );
}

// ========== بوت الإدارة - استقبال مباشر للطلبات مع إشعارات ==========

adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (chatId !== ADMIN_ID && chatId !== SECOND_ADMIN_ID) {
        adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول إلى لوحة التحكم');
        return;
    }
    
    registerUser(chatId, msg.from.username);
    
    try {
        if (text === '/start' || text === '🏠 الرئيسية' || text === '🔄 تحديث') {
            showAdminDashboard(chatId);
            return;
        }
        
        switch(text) {
            case '📊 الإحصائيات':
                await showAdminStatistics(chatId);
                break;
                
            case '👤 منح رصيد':
                adminBot.sendMessage(chatId, '💰 *منح رصيد*\n\nأرسل المبلغ (بالدولار):', {
                    parse_mode: 'Markdown',
                    reply_markup: { remove_keyboard: true }
                });
                adminActions.set(chatId, { type: 'add_balance', step: 1 });
                break;
                
            case '📋 الطلبات النشطة':
                await showActiveOrders(chatId);
                break;
                
            case '💰 طلبات الشحن':
                await showPendingDeposits(chatId);
                break;
                
            case '🎁 إضافة خدمة':
                adminBot.sendMessage(chatId, '🎮 *إضافة خدمة جديدة*\n\nأرسل اسم الخدمة:', {
                    parse_mode: 'Markdown',
                    reply_markup: { remove_keyboard: true }
                });
                adminActions.set(chatId, { type: 'add_service', step: 1 });
                break;
                
            case '🏷️ منح خصم':
                adminBot.sendMessage(chatId, '🎯 *منح خصم*\n\nأرسل يوزر أو ID المستخدم:', {
                    parse_mode: 'Markdown',
                    reply_markup: { remove_keyboard: true }
                });
                adminActions.set(chatId, { type: 'set_discount', step: 1 });
                break;
                
            case '📢 إرسال إشعار':
                adminBot.sendMessage(chatId, '📢 *إرسال إشعار*\n\nأرسل الرسالة:', {
                    parse_mode: 'Markdown',
                    reply_markup: { remove_keyboard: true }
                });
                adminActions.set(chatId, { type: 'broadcast', step: 1 });
                break;
                
            default:
                showAdminDashboard(chatId);
                break;
        }
    } catch (error) {
        console.error('❌ خطأ في بوت الإدارة:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ أثناء المعالجة');
        showAdminDashboard(chatId);
    }
});

const adminActions = new Map();

function showAdminDashboard(chatId) {
    const pendingOrders = getOrders().filter(o => o.status === 'pending').length;
    const depositRequests = getOrders().filter(o => o.status === 'waiting_payment').length;
    const totalUsers = users.size;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['📊 الإحصائيات', '👤 منح رصيد'],
                ['📋 الطلبات النشطة', '💰 طلبات الشحن'],
                ['🎁 إضافة خدمة', '🏷️ منح خصم'],
                ['📢 إرسال إشعار', '🔄 تحديث']
            ],
            resize_keyboard: true
        }
    };
    
    const message = `👑 *لوحة التحكم*\n\n📊 *الإحصائيات الفورية:*\n👥 المستخدمين: ${totalUsers}\n📦 الطلبات المعلقة: ${pendingOrders}\n💳 طلبات الشحن: ${depositRequests}\n\n🔔 *جميع الطلبات تصل هنا مع أزرار التحكم!*`;
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

async function showAdminStatistics(chatId) {
    const totalUsers = users.size;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = Array.from(users.values()).filter(u => new Date(u.lastActive) > weekAgo).length;
    
    const allOrders = getOrders();
    const completedOrders = allOrders.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + o.amount, 0);
    
    const message = `📊 *إحصائيات النظام*\n\n👥 المستخدمين: ${totalUsers}\n✅ النشطين: ${activeUsers}\n❌ غير النشطين: ${totalUsers - activeUsers}\n💰 الإيرادات: ${totalRevenue}$\n📦 الطلبات المكتملة: ${completedOrders.length}\n💳 طلبات الشحن: ${allOrders.filter(o => o.serviceName === 'شحن رصيد').length}`;
    
    adminBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function showActiveOrders(chatId) {
    const activeOrders = getOrders().filter(o => o.status === 'pending');
    
    if (activeOrders.length === 0) {
        adminBot.sendMessage(chatId, '📭 *لا توجد طلبات نشطة*', { parse_mode: 'Markdown' });
        return;
    }
    
    for (const order of activeOrders.slice(0, 10)) {
        const message = `📦 *طلب نشط*\n\n👤 @${order.username || 'بدون'} (${order.userId})\n🎮 ${order.serviceName}\n💰 ${order.amount}$\n🆔 ID اللعبة: ${order.gameId}\n🆔 رقم الطلب: ${order.orderId}\n📅 ${order.createdAt.toLocaleString('ar-SA')}`;
        
        adminBot.sendMessage(chatId, message, {
            parse_mode: 'Markdown'
        });
    }
}

async function showPendingDeposits(chatId) {
    const depositRequests = getOrders().filter(o => o.status === 'waiting_payment');
    
    if (depositRequests.length === 0) {
        adminBot.sendMessage(chatId, '💳 *لا توجد طلبات شحن معلقة*', { parse_mode: 'Markdown' });
        return;
    }
    
    for (const deposit of depositRequests.slice(0, 10)) {
        const message = `💳 *طلب شحن معلق*\n\n👤 @${deposit.username || 'بدون'} (${deposit.userId})\n💰 ${deposit.amount}$\n🆔 رقم الطلب: ${deposit.orderId}\n📅 ${deposit.createdAt.toLocaleString('ar-SA')}`;
        
        adminBot.sendMessage(chatId, message, {
            parse_mode: 'Markdown'
        });
    }
}

async function handleAdminAction(chatId, text, action) {
    try {
        switch(action.type) {
            case 'add_balance':
                if (action.step === 1) {
                    const amount = parseFloat(text);
                    if (isNaN(amount) || amount <= 0) {
                        adminBot.sendMessage(chatId, '❌ قيمة غير صحيحة');
                        adminActions.delete(chatId);
                        showAdminDashboard(chatId);
                        return;
                    }
                    action.amount = amount;
                    action.step = 2;
                    adminActions.set(chatId, action);
                    adminBot.sendMessage(chatId, `💰 المبلغ: ${amount}$\n\nأرسل يوزر أو ID المستخدم:`);
                } else if (action.step === 2) {
                    const user = findUser(text);
                    if (!user) {
                        adminBot.sendMessage(chatId, '❌ المستخدم غير موجود');
                        adminActions.delete(chatId);
                        showAdminDashboard(chatId);
                        return;
                    }
                    
                    user.balance += action.amount;
                    saveUser(user);
                    
                    transactions.push({
                        userId: user.userId,
                        type: 'transfer',
                        amount: action.amount,
                        description: 'تحويل من الأدمن',
                        date: new Date()
                    });
                    
                    // إعلام المستخدم
                    try {
                        await chargingBot.sendMessage(user.userId,
                            `🎉 *تم استلام تحويل*\n\n💰 المبلغ: ${action.amount}$\n💳 رصيدك الجديد: ${user.balance}$\n👤 من: الإدارة`,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (e) {}
                    
                    adminBot.sendMessage(chatId, `✅ تم إضافة ${action.amount}$ إلى رصيد ${user.username || user.userId}`);
                    adminActions.delete(chatId);
                    showAdminDashboard(chatId);
                }
                break;
                
            case 'add_service':
                if (action.step === 1) {
                    action.name = text;
                    action.step = 2;
                    adminActions.set(chatId, action);
                    adminBot.sendMessage(chatId, '📝 أرسل وصف الخدمة:');
                } else if (action.step === 2) {
                    action.description = text;
                    action.step = 3;
                    adminActions.set(chatId, action);
                    adminBot.sendMessage(chatId, '💰 أرسل سعر الخدمة (بالدولار):');
                } else if (action.step === 3) {
                    const price = parseFloat(text);
                    if (isNaN(price) || price <= 0) {
                        adminBot.sendMessage(chatId, '❌ سعر غير صحيح');
                        adminActions.delete(chatId);
                        showAdminDashboard(chatId);
                        return;
                    }
                    action.price = price;
                    action.step = 4;
                    adminActions.set(chatId, action);
                    adminBot.sendMessage(chatId, '📊 أرسل الكمية المتاحة:');
                } else if (action.step === 4) {
                    const stock = parseInt(text);
                    if (isNaN(stock) || stock <= 0) {
                        adminBot.sendMessage(chatId, '❌ كمية غير صحيحة');
                        adminActions.delete(chatId);
                        showAdminDashboard(chatId);
                        return;
                    }
                    
                    const service = addService(action.name, action.description, action.price, stock);
                    
                    adminBot.sendMessage(chatId,
                        `✅ *تم إضافة الخدمة*\n\n📦 الاسم: ${service.name}\n📝 الوصف: ${service.description}\n💰 السعر: ${service.price}$\n📊 الكمية: ${service.stock}`,
                        { parse_mode: 'Markdown' }
                    );
                    
                    adminActions.delete(chatId);
                    showAdminDashboard(chatId);
                }
                break;
                
            case 'set_discount':
                if (action.step === 1) {
                    const user = findUser(text);
                    if (!user) {
                        adminBot.sendMessage(chatId, '❌ المستخدم غير موجود');
                        adminActions.delete(chatId);
                        showAdminDashboard(chatId);
                        return;
                    }
                    action.userId = user.userId;
                    action.step = 2;
                    adminActions.set(chatId, action);
                    adminBot.sendMessage(chatId, `👤 المستخدم: ${user.username || user.userId}\n\nأرسل نسبة الخصم (0-100):`);
                } else if (action.step === 2) {
                    const discount = parseInt(text);
                    if (isNaN(discount) || discount < 0 || discount > 100) {
                        adminBot.sendMessage(chatId, '❌ نسبة غير صحيحة');
                        adminActions.delete(chatId);
                        showAdminDashboard(chatId);
                        return;
                    }
                    
                    const user = getUser(action.userId);
                    user.discount = discount;
                    saveUser(user);
                    
                    // إعلام المستخدم
                    try {
                        await chargingBot.sendMessage(user.userId,
                            `🎉 *تم تحديث خصمك*\n\n🎯 الخصم الجديد: ${discount}%\n\nيمكنك الآن الاستفادة من الخصم على جميع الخدمات!`,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (e) {}
                    
                    adminBot.sendMessage(chatId, `✅ تم منح خصم ${discount}% للمستخدم`);
                    adminActions.delete(chatId);
                    showAdminDashboard(chatId);
                }
                break;
                
            case 'broadcast':
                if (action.step === 1) {
                    const message = text;
                    let sent = 0;
                    let failed = 0;
                    
                    for (const user of users.values()) {
                        try {
                            await chargingBot.sendMessage(user.userId,
                                `📢 *إشعار من الإدارة*\n\n${message}`,
                                { parse_mode: 'Markdown' }
                            );
                            sent++;
                        } catch (e) {
                            failed++;
                        }
                    }
                    
                    adminBot.sendMessage(chatId,
                        `✅ *تم إرسال الإشعار*\n\n📤 أرسل إلى: ${sent} مستخدم\n❌ فشل: ${failed} مستخدم`,
                        { parse_mode: 'Markdown' }
                    );
                    
                    adminActions.delete(chatId);
                    showAdminDashboard(chatId);
                }
                break;
        }
    } catch (error) {
        console.error('❌ خطأ في إجراء الأدمن:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ');
        adminActions.delete(chatId);
        showAdminDashboard(chatId);
    }
}

// ========== معالجة Callback Queries للأدمن ==========

adminBot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    
    try {
        if (data.startsWith('confirm_deposit_')) {
            const orderId = data.split('_')[2];
            const order = orders.get(orderId);
            
            if (order) {
                order.status = 'completed';
                
                const user = getUser(order.userId);
                user.balance += order.amount;
                saveUser(user);
                
                transactions.push({
                    userId: order.userId,
                    type: 'deposit',
                    amount: order.amount,
                    description: 'شحن رصيد',
                    date: new Date()
                });
                
                // إشعار للمستخدم
                try {
                    await chargingBot.sendMessage(order.userId,
                        `✅ *تم تأكيد شحن الرصيد*\n\n💰 المبلغ: ${order.amount}$\n💳 رصيدك الجديد: ${user.balance}$\n🆔 رقم الطلب: ${order.orderId}`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
                
                // تحديث رسالة الأدمن
                const updatedMessage = `✅ *تم تأكيد الشحن*\n\n👤 @${order.username || 'بدون'} (${order.userId})\n💰 ${order.amount}$\n💳 تم إضافة الرصيد\n🆔 ${order.orderId}`;
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم تأكيد الدفع وإضافة الرصيد' });
                adminBot.editMessageText(updatedMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                });
            }
            
        } else if (data.startsWith('cancel_deposit_')) {
            const orderId = data.split('_')[2];
            const order = orders.get(orderId);
            
            if (order) {
                order.status = 'cancelled';
                
                // إشعار للمستخدم
                try {
                    await chargingBot.sendMessage(order.userId,
                        `❌ *فشل تأكيد الدفع*\n\n💰 المبلغ: ${order.amount}$\n🆔 رقم الطلب: ${order.orderId}\n\nالرجاء التحقق من الإيصال والمحاولة مرة أخرى`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
                
                // تحديث رسالة الأدمن
                const updatedMessage = `❌ *تم رفض الشحن*\n\n👤 @${order.username || 'بدون'} (${order.userId})\n💰 ${order.amount}$\n❌ تم إبلاغ المستخدم بالفشل\n🆔 ${order.orderId}`;
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم إلغاء الدفع وإعلام المستخدم' });
                adminBot.editMessageText(updatedMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                });
            }
            
        } else if (data.startsWith('complete_')) {
            const orderId = data.split('_')[1];
            const order = orders.get(orderId);
            
            if (order) {
                order.status = 'completed';
                
                // إشعار للمستخدم
                try {
                    await chargingBot.sendMessage(order.userId,
                        `✅ *تم إكمال طلبك*\n\n🎮 ${order.serviceName}\n💰 ${order.amount}$\n🆔 ${order.orderId}\n\nشكراً لاستخدامك خدماتنا!`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
                
                // تحديث رسالة الأدمن
                const updatedMessage = `✅ *تم إكمال الطلب*\n\n👤 @${order.username || 'بدون'} (${order.userId})\n🎮 ${order.serviceName}\n💰 ${order.amount}$\n🆔 ${order.orderId}`;
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم إكمال الطلب' });
                adminBot.editMessageText(updatedMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                });
            }
            
        } else if (data.startsWith('cancel_')) {
            const orderId = data.split('_')[1];
            const order = orders.get(orderId);
            
            if (order) {
                order.status = 'cancelled';
                
                const user = getUser(order.userId);
                user.balance += order.amount;
                saveUser(user);
                
                // إشعار للمستخدم
                try {
                    await chargingBot.sendMessage(order.userId,
                        `❌ *تم إلغاء طلبك*\n\n🎮 ${order.serviceName}\n💰 ${order.amount}$\n🆔 ${order.orderId}\n\nتم إرجاع ${order.amount}$ إلى رصيدك`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
                
                // تحديث رسالة الأدمن
                const updatedMessage = `❌ *تم إلغاء الطلب*\n\n👤 @${order.username || 'بدون'} (${order.userId})\n🎮 ${order.serviceName}\n💰 ${order.amount}$\n🆔 ${order.orderId}`;
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم إلغاء الطلب وإرجاع المبلغ' });
                adminBot.editMessageText(updatedMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                });
            }
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة Callback:', error);
        adminBot.answerCallbackQuery(callbackQuery.id, { text: 'حدث خطأ' });
    }
});

// ========== تشغيل النظام ==========

console.log('🚀 بدء تشغيل نظام البوتات...');
console.log('🤖 بوت الشحن: @Diamouffbot');
console.log('👑 بوت الإدارة: @otzhabot');
console.log('👤 المسؤول الرئيسي: ' + ADMIN_ID);
console.log('👤 المسؤول الثاني: ' + SECOND_ADMIN_ID);
console.log('✅ النظام يعمل بنجاح!');
console.log('🔔 جميع الطلبات تصل مباشرة إلى بوت التحكم مع إشعارات!');

// إضافة هذا الجزء للنشر على Render
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot system is running! All orders go directly to admin panel.');
});

server.listen(PORT, () => {
    console.log(`🌐 السيرفر يعمل على المنفذ: ${PORT}`);
});
