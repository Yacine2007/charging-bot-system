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
addService('جواهر فري فاير 100+10', 'اشتري 100 جوهرة واحصل على 10 مجاناً\n⏱️ البدأ : 0 / 24 ساعة\n🟢 تعمل لجميع أنحاء العالم\n🆔 ضع ID فري فاير الخاص بك', 1, 100);
addService('جواهر فري فاير 500+50', 'اشتري 500 جوهرة واحصل على 50 مجاناً\n⏱️ البدأ : 0 / 24 ساعة\n🟢 تعمل لجميع أنحاء العالم\n🆔 ضع ID فري فاير الخاص بك', 5, 50);
addService('جواهر فري فاير 1000+100', 'اشتري 1000 جوهرة واحصل على 100 مجاناً\n⏱️ البدأ : 0 / 24 ساعة\n🟢 تعمل لجميع أنحاء العالم\n🆔 ضع ID فري فاير الخاص بك', 10, 30);

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

// ========== إرسال إشعارات إلى المدراء ==========

async function notifyAdmins(message, options = {}) {
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    
    for (const adminId of admins) {
        try {
            if (options.photo) {
                await adminBot.sendPhoto(adminId, options.photo, {
                    caption: message,
                    parse_mode: 'Markdown',
                    reply_markup: options.reply_markup
                });
            } else {
                await adminBot.sendMessage(adminId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: options.reply_markup
                });
            }
        } catch (error) {
            console.log(`فشل إرسال إشعار للمسؤول ${adminId}:`, error.message);
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
        // إذا كان هناك إجراء قيد الانتظار
        const action = userActions.get(chatId);
        if (action) {
            await handleUserAction(chatId, text, action, msg, user);
            return;
        }
        
        // الأوامر الرئيسية
        if (text === '/start') {
            showMainMenu(chatId, user);
        } else if (text === '💳 شحن رصيد') {
            startDepositProcess(chatId);
        } else if (text === '🎮 الخدمات') {
            showServicesMenu(chatId, user);
        } else if (text === '📋 طلباتي') {
            showUserOrders(chatId);
        } else if (text === '👥 التسويق بالعمولة') {
            showCommissionInfo(chatId, user);
        } else if (text === '💰 رصيدي') {
            showBalance(chatId, user);
        } else if (text === '🏠 القائمة الرئيسية') {
            showMainMenu(chatId, user);
        } else if (text === '📢 قناة البوت') {
            showChannelInfo(chatId);
        } else if (text === 'ℹ️ المساعدة') {
            showHelpInfo(chatId);
        } else {
            showMainMenu(chatId, user);
        }
    } catch (error) {
        console.error('Charging bot error:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة لاحقاً');
        showMainMenu(chatId, user);
    }
});

// ========== واجهة المستخدم الرئيسية ==========

function showMainMenu(chatId, user) {
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '🎮 الخدمات'],
                ['📋 طلباتي', '💰 رصيدي'],
                ['👥 التسويق بالعمولة', 'ℹ️ المساعدة'],
                ['📢 قناة البوت']
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

// ========== عملية شحن الرصيد ==========

function startDepositProcess(chatId) {
    const message = `💳 *شحن الرصيد*\n\nالرجاء إدخال كمية الدولار التي تريد شحنها:\nمثال: 5 (تعني 5 دولار)\n\n*طريقة الدفع: بينانس فقط*`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 إلغاء والعودة']],
            resize_keyboard: true
        }
    });
    
    userActions.set(chatId, { type: 'deposit_amount' });
}

// ========== عرض الخدمات ==========

function showServicesMenu(chatId, user) {
    const servicesList = getServices().filter(s => s.stock > 0);
    
    if (servicesList.length === 0) {
        chargingBot.sendMessage(chatId, '⚠️ *لا توجد خدمات متاحة حالياً*', {
            parse_mode: 'Markdown'
        });
        return;
    }
    
    const keyboardButtons = servicesList.map(service => {
        const finalPrice = service.price * (1 - (user.discount / 100));
        return [`🎮 ${service.name} - ${finalPrice.toFixed(2)}$`];
    });
    
    keyboardButtons.push(['🏠 القائمة الرئيسية']);
    
    const keyboard = {
        reply_markup: {
            keyboard: keyboardButtons,
            resize_keyboard: true
        }
    };
    
    let message = `🎮 *الخدمات المتاحة*\n\n💰 رصيدك: ${user.balance}$\n🎯 خصمك: ${user.discount}%\n\nاختر الخدمة:`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
    
    userActions.set(chatId, { type: 'select_service' });
}

// ========== معالجة إجراءات المستخدم ==========

async function handleUserAction(chatId, text, action, msg, user) {
    try {
        // إلغاء العملية
        if (text === '🏠 إلغاء والعودة') {
            userActions.delete(chatId);
            showMainMenu(chatId, user);
            return;
        }
        
        switch (action.type) {
            case 'deposit_amount':
                await handleDepositAmount(chatId, text, user);
                break;
                
            case 'deposit_waiting_receipt':
                if (msg.photo) {
                    await handleDepositReceipt(chatId, msg.photo, action.amount, user);
                } else {
                    chargingBot.sendMessage(chatId, '❌ يرجى إرسال صورة الإيصال فقط');
                }
                break;
                
            case 'select_service':
                await handleServiceSelection(chatId, text, user);
                break;
                
            case 'service_waiting_game_id':
                await handleGameId(chatId, text, action, user);
                break;
        }
    } catch (error) {
        console.error('Error in user action:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ أثناء المعالجة');
        userActions.delete(chatId);
        showMainMenu(chatId, user);
    }
}

// ========== معالجة شحن الرصيد ==========

async function handleDepositAmount(chatId, text, user) {
    const amount = parseFloat(text);
    
    if (isNaN(amount) || amount <= 0) {
        chargingBot.sendMessage(chatId, '❌ قيمة غير صحيحة. الرجاء إدخال رقم صحيح أكبر من 0');
        return;
    }
    
    const message = `💰 *طلب شحن رصيد*\n\n💵 المبلغ: ${amount}$\n\n📋 *تعليمات الدفع:*\n1. قم بتحويل ${amount}$ إلى:\nID: ${PAYMENT_ID}\n2. بعد التحويل، أرسل صورة إيصال الدفع هنا\n\n⚠️ *ملاحظة:*\n- سيتحقق الأدمن من الإيصال\n- قد يستغرق التحقق بضع دقائق`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['📸 إرسال الإيصال', '🏠 إلغاء']],
            resize_keyboard: true
        }
    });
    
    userActions.set(chatId, { type: 'deposit_waiting_receipt', amount });
}

async function handleDepositReceipt(chatId, photo, amount, user) {
    const photoId = photo[photo.length - 1].file_id;
    
    // إنشاء طلب الشحن
    const depositOrder = createDepositOrder(chatId, user.username, amount, photoId);
    
    // إشعار الأدمن
    const adminMessage = `💳 *طلب شحن جديد*\n\n👤 المستخدم: @${user.username || 'بدون'} (${chatId})\n💰 المبلغ: ${amount}$\n🆔 رقم الطلب: ${depositOrder.orderId}\n📅 الوقت: ${new Date().toLocaleString('ar-SA')}`;
    
    const adminKeyboard = {
        inline_keyboard: [
            [
                { text: '✅ تأكيد الدفع', callback_data: `confirm_deposit_${depositOrder.orderId}` },
                { text: '❌ رفض الدفع', callback_data: `reject_deposit_${depositOrder.orderId}` }
            ],
            [
                { text: '💬 مراسلة المستخدم', url: `tg://user?id=${chatId}` }
            ]
        ]
    };
    
    await notifyAdmins(adminMessage, {
        photo: photoId,
        reply_markup: adminKeyboard
    });
    
    // تأكيد للمستخدم
    chargingBot.sendMessage(chatId, 
        `✅ *تم استلام إيصال الدفع*\n\n💰 المبلغ: ${amount}$\n🆔 رقم الطلب: ${depositOrder.orderId}\n\n📞 سيتم مراجعة طلبك من قبل الإدارة قريباً`, 
        { parse_mode: 'Markdown' }
    );
    
    userActions.delete(chatId);
    showMainMenu(chatId, user);
}

// ========== معالجة الخدمات ==========

async function handleServiceSelection(chatId, text, user) {
    const serviceText = text.replace('🎮 ', '').split(' - ')[0];
    const service = getServices().find(s => s.name === serviceText);
    
    if (!service) {
        chargingBot.sendMessage(chatId, '❌ الخدمة غير متوفرة');
        userActions.delete(chatId);
        showMainMenu(chatId, user);
        return;
    }
    
    const finalPrice = service.price * (1 - (user.discount / 100));
    
    // التحقق من الرصيد
    if (user.balance < finalPrice) {
        const message = `❌ *رصيدك غير كافي*\n\n💰 رصيدك الحالي: ${user.balance}$\n💵 سعر الخدمة: ${finalPrice}$\n\nيرجى شحن رصيد أولاً`;
        
        chargingBot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['💳 شحن رصيد', '🏠 القائمة الرئيسية']],
                resize_keyboard: true
            }
        });
        
        userActions.delete(chatId);
        return;
    }
    
    const message = `🎮 *${service.name}*\n\n📝 ${service.description}\n💰 السعر: ${service.price}$\n🎯 خصمك: ${user.discount}%\n💵 السعر النهائي: ${finalPrice}$\n\n🆔 *الرجاء إرسال ID الخاص بك في اللعبة:*`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 إلغاء']],
            resize_keyboard: true
        }
    });
    
    userActions.set(chatId, {
        type: 'service_waiting_game_id',
        serviceId: service.id,
        serviceName: service.name,
        price: finalPrice
    });
}

async function handleGameId(chatId, text, action, user) {
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
    
    // إشعار الأدمن
    const adminMessage = `📦 *طلب خدمة جديد*\n\n👤 المستخدم: @${user.username || 'بدون'} (${chatId})\n🎮 الخدمة: ${action.serviceName}\n💰 السعر: ${action.price}$\n🎮 ID اللعبة: ${gameId}\n🆔 رقم الطلب: ${order.orderId}\n📅 الوقت: ${new Date().toLocaleString('ar-SA')}`;
    
    const adminKeyboard = {
        inline_keyboard: [
            [
                { text: '✅ إكمال الطلب', callback_data: `complete_${order.orderId}` },
                { text: '❌ إلغاء الطلب', callback_data: `cancel_${order.orderId}` }
            ],
            [
                { text: '💬 مراسلة المستخدم', url: `tg://user?id=${chatId}` }
            ]
        ]
    };
    
    await notifyAdmins(adminMessage, { reply_markup: adminKeyboard });
    
    // تأكيد للمستخدم
    chargingBot.sendMessage(chatId,
        `✅ *تم تقديم طلبك*\n\n🎮 الخدمة: ${action.serviceName}\n💰 المبلغ: ${action.price}$\n🆔 رقم الطلب: ${order.orderId}\n🎮 ID اللعبة: ${gameId}\n\n📞 سيتم معالجة طلبك خلال 24 ساعة`,
        { parse_mode: 'Markdown' }
    );
    
    userActions.delete(chatId);
    showMainMenu(chatId, user);
}

// ========== دوال العرض الأخرى ==========

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

function showCommissionInfo(chatId, user) {
    const message = `👥 *التسويق بالعمولة*\n\n🎯 معدل عمولتك: ${user.commissionRate}%\n\n💰 *كيفية العمل:*\n1. شارك رابط الإحالة الخاص بك\n2. كل عملية شراء يقوم بها المستخدمون الذين جلبهم\n3. تحصل على ${user.commissionRate}% من قيمة كل عملية\n\n📊 *لجني الأرباح:*\n- شجع الآخرين على التسجيل عبر رابطك\n- كلما زاد عدد المستخدمين، زادت أرباحك`;
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [[
                { text: '🔗 الحصول على رابط الإحالة', callback_data: 'get_referral' }
            ]]
        }
    };
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function showBalance(chatId, user) {
    const message = `💰 *رصيدك*\n\n💵 الرصيد الحالي: ${user.balance}$\n🎯 نسبة الخصم: ${user.discount}%\n\nيمكنك شحن رصيد عبر زر "شحن رصيد" أو استخدامه لطلب الخدمات`;
    
    chargingBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

function showChannelInfo(chatId) {
    const message = `📢 *قناة البوت*\n\nانضم إلى قناتنا الرسمية:\n@otzhabot\n\nللحصول على آخر التحديثات والعروض الخاصة`;
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [[
                { text: '📢 انضم للقناة', url: 'https://t.me/otzhabot' }
            ]]
        }
    };
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function showHelpInfo(chatId) {
    const message = `ℹ️ *مركز المساعدة*\n\n🔸 للتواصل مع الدعم: @Diamouffbot\n🔸 أوقات العمل: 24/7\n\n📞 *خدمات الدعم:*\n• استفسارات عن الخدمات\n• مشاكل في الدفع\n• متابعة الطلبات\n• اقتراحات وتحسينات`;
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [[
                { text: '💬 تواصل مع الدعم', url: 'https://t.me/Diamouffbot' }
            ]]
        }
    };
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

// ========== معالجة Callback Queries ==========

chargingBot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    
    try {
        if (data === 'get_referral') {
            const referralLink = `https://t.me/Diamouffbot?start=ref_${chatId}`;
            const message = `🔗 *رابط الإحالة الخاص بك*\n\n${referralLink}\n\nشارك هذا الرابط مع أصدقائك واكسب ${getUser(chatId).commissionRate}% من كل عملية شراء يقومون بها!`;
            
            chargingBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }
        
        chargingBot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
        console.error('Callback error:', error);
        chargingBot.answerCallbackQuery(callbackQuery.id, { text: 'حدث خطأ' });
    }
});

// ========== بوت الإدارة (لوحة التحكم) ==========

const adminActions = new Map();

adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // التحقق من صلاحية الأدمن
    if (chatId !== ADMIN_ID && chatId !== SECOND_ADMIN_ID) {
        adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول إلى لوحة التحكم');
        return;
    }
    
    registerUser(chatId, msg.from.username);
    
    try {
        if (text === '/start' || text === '🏠 الرئيسية') {
            showAdminDashboard(chatId);
            return;
        }
        
        const action = adminActions.get(chatId);
        if (action) {
            await handleAdminAction(chatId, text, action);
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
                
            case '📋 الطلبات':
                await showAdminOrders(chatId);
                break;
                
            case '💰 طلبات الشحن':
                await showAdminDeposits(chatId);
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
                
            case '🔄 تحديث':
                showAdminDashboard(chatId);
                break;
                
            default:
                showAdminDashboard(chatId);
                break;
        }
    } catch (error) {
        console.error('Admin bot error:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ أثناء المعالجة');
        showAdminDashboard(chatId);
    }
});

// ========== لوحة تحكم الأدمن ==========

function showAdminDashboard(chatId) {
    const totalUsers = users.size;
    const pendingOrders = getOrders().filter(o => o.status === 'pending').length;
    const depositRequests = getOrders().filter(o => o.status === 'waiting_payment').length;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['📊 الإحصائيات', '👤 منح رصيد'],
                ['📋 الطلبات', '💰 طلبات الشحن'],
                ['🎁 إضافة خدمة', '🏷️ منح خصم'],
                ['📢 إرسال إشعار', '🔄 تحديث']
            ],
            resize_keyboard: true
        }
    };
    
    const message = `👑 *لوحة التحكم*\n\n📊 الإحصائيات:\n👥 المستخدمين: ${totalUsers}\n📦 الطلبات المعلقة: ${pendingOrders}\n💳 طلبات الشحن: ${depositRequests}\n\nاختر من القائمة:`;
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

// ========== دوال الأدمن ==========

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
                        `✅ *تم إضافة الخدمة*\n\n📦 الاسم: ${service.name}\n💰 السعر: ${service.price}$\n📊 الكمية: ${service.stock}`,
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
        console.error('Admin action error:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ');
        adminActions.delete(chatId);
        showAdminDashboard(chatId);
    }
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

async function showAdminOrders(chatId) {
    const pendingOrders = getOrders().filter(o => o.status === 'pending');
    
    if (pendingOrders.length === 0) {
        adminBot.sendMessage(chatId, '📭 *لا توجد طلبات معلقة*', { parse_mode: 'Markdown' });
        return;
    }
    
    for (const order of pendingOrders.slice(0, 10)) {
        const message = `📦 *طلب خدمة*\n\n👤 @${order.username || 'بدون'} (${order.userId})\n🎮 ${order.serviceName}\n💰 ${order.amount}$\n🆔 ${order.gameId}\n📅 ${order.createdAt.toLocaleString('ar-SA')}\n🆔 ${order.orderId}`;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ إكمال', callback_data: `complete_${order.orderId}` },
                    { text: '❌ إلغاء', callback_data: `cancel_${order.orderId}` }
                ]
            ]
        };
        
        adminBot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }
}

async function showAdminDeposits(chatId) {
    const depositRequests = getOrders().filter(o => o.status === 'waiting_payment');
    
    if (depositRequests.length === 0) {
        adminBot.sendMessage(chatId, '💳 *لا توجد طلبات شحن*', { parse_mode: 'Markdown' });
        return;
    }
    
    for (const deposit of depositRequests.slice(0, 10)) {
        const message = `💳 *طلب شحن*\n\n👤 @${deposit.username || 'بدون'} (${deposit.userId})\n💰 ${deposit.amount}$\n📅 ${deposit.createdAt.toLocaleString('ar-SA')}\n🆔 ${deposit.orderId}`;
        
        if (deposit.paymentProof) {
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ تأكيد', callback_data: `confirm_deposit_${deposit.orderId}` },
                        { text: '❌ رفض', callback_data: `reject_deposit_${deposit.orderId}` }
                    ]
                ]
            };
            
            await adminBot.sendPhoto(chatId, deposit.paymentProof, {
                caption: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } else {
            adminBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }
    }
}

// ========== معالجة Callback Queries للأدمن ==========

adminBot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    
    try {
        if (data.startsWith('complete_')) {
            const orderId = data.split('_')[1];
            const order = orders.get(orderId);
            
            if (order) {
                order.status = 'completed';
                
                try {
                    await chargingBot.sendMessage(order.userId,
                        `✅ *تم إكمال طلبك*\n\n🎮 ${order.serviceName}\n💰 ${order.amount}$\n🆔 ${order.orderId}\n\nشكراً لاستخدامك خدماتنا!`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم إكمال الطلب' });
                adminBot.editMessageText(`✅ تم إكمال الطلب ${orderId}`, {
                    chat_id: chatId,
                    message_id: messageId
                });
            }
            
        } else if (data.startsWith('cancel_')) {
            const orderId = data.split('_')[1];
            const order = orders.get(orderId);
            
            if (order) {
                order.status = 'cancelled';
                
                // إرجاع المبلغ للمستخدم
                const user = getUser(order.userId);
                user.balance += order.amount;
                saveUser(user);
                
                try {
                    await chargingBot.sendMessage(order.userId,
                        `❌ *تم إلغاء طلبك*\n\n🎮 ${order.serviceName}\n💰 ${order.amount}$\n🆔 ${order.orderId}\n\nتم إرجاع ${order.amount}$ إلى رصيدك`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم إلغاء الطلب' });
                adminBot.editMessageText(`❌ تم إلغاء الطلب ${orderId}`, {
                    chat_id: chatId,
                    message_id: messageId
                });
            }
            
        } else if (data.startsWith('confirm_deposit_')) {
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
                
                try {
                    await chargingBot.sendMessage(order.userId,
                        `✅ *تم تأكيد شحن الرصيد*\n\n💰 ${order.amount}$\n💳 رصيدك الجديد: ${user.balance}$\n🆔 ${order.orderId}`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم تأكيد الدفع' });
                adminBot.editMessageText(`✅ تم تأكيد شحن ${order.amount}$`, {
                    chat_id: chatId,
                    message_id: messageId
                });
            }
            
        } else if (data.startsWith('reject_deposit_')) {
            const orderId = data.split('_')[2];
            const order = orders.get(orderId);
            
            if (order) {
                order.status = 'cancelled';
                
                try {
                    await chargingBot.sendMessage(order.userId,
                        `❌ *لم يتم تأكيد الدفع*\n\n💰 ${order.amount}$\n🆔 ${order.orderId}\n\nالرجاء التحقق والمحاولة مرة أخرى`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم رفض الدفع' });
                adminBot.editMessageText(`❌ تم رفض شحن ${order.amount}$`, {
                    chat_id: chatId,
                    message_id: messageId
                });
            }
        }
    } catch (error) {
        console.error('Admin callback error:', error);
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
