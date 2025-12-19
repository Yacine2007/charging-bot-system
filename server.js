const TelegramBot = require('node-telegram-bot-api');

// إعداد التوكنات
const CHARGING_BOT_TOKEN = '8223596744:AAGHOMQ3Sjk3-X_Z7eXXnL5drAXaHXglLFg';
const ADMIN_BOT_TOKEN = '8216188569:AAEEA1q_os_6XfSJrUDLDkkQxZXh-3OMAVU';
const ADMIN_ID = 7450109529;
const PAYMENT_ID = '953936100';

// إنشاء البوتات
const chargingBot = new TelegramBot(CHARGING_BOT_TOKEN, { polling: true });
const adminBot = new TelegramBot(ADMIN_BOT_TOKEN, { polling: true });

// تخزين البيانات في الذاكرة
const users = new Map(); // {userId: {userId, username, balance, discount, isActive, lastActive}}
const services = new Map(); // {serviceId: {id, name, description, price, stock}}
const orders = new Map(); // {orderId: {orderId, userId, username, serviceName, amount, gameId, status, paymentProof}}
const transactions = []; // {userId, type, amount, description, date}

// ========== لوحة التحكم الرئيسية ==========

// لوحة تحكم الأدمن الرئيسية
function showAdminPanel(chatId) {
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['📊 الإحصائيات', '👤 منح رصيد'],
                ['🎁 إضافة خدمة', '📋 الطلبات'],
                ['💰 طلبات الشحن', '🏷️ منح خصم'],
                ['📢 إرسال إشعار', '🔄 تحديث البيانات']
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
    
    adminBot.sendMessage(chatId, '👑 *مرحباً بك في لوحة التحكم الإدارية*\n\nاختر من الأزرار أدناه:', {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

// لوحة المستخدم الرئيسية
function showUserPanel(chatId) {
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '🎮 الخدمات'],
                ['📋 طلباتي', '👥 التسويق بالعمولة'],
                ['📢 قناة البوت', 'ℹ️ المساعدة']
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
    
    chargingBot.sendMessage(chatId, '🎮 *مرحباً بك في بوت الشحن*\n\nاختر من الأزرار أدناه:', {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

// ========== إدارة المستخدمين ==========

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
        if (user.userId.toString() === identifier) {
            return user;
        }
        if (user.username === identifier || user.username === identifier.replace('@', '')) {
            return user;
        }
    }
    return null;
}

function registerUser(userId, username) {
    const user = getUser(userId);
    user.username = username || user.username;
    user.lastActive = new Date();
    user.isActive = true;
    saveUser(user);
    return user;
}

// ========== إدارة الخدمات ==========

let serviceCounter = 1;
function addService(name, description, price, stock) {
    const serviceId = `S${serviceCounter++}`;
    const service = {
        id: serviceId,
        name,
        description,
        price,
        stock
    };
    services.set(serviceId, service);
    return service;
}

function getServices() {
    return Array.from(services.values());
}

function getService(serviceId) {
    return services.get(serviceId);
}

// إضافة بعض الخدمات الافتراضية
addService('جواهر فري فاير 100+10', 'اشتري 100 جوهرة واحصل على 10 مجاناً', 1, 100);
addService('جواهر فري فاير 500+50', 'اشتري 500 جوهرة واحصل على 50 مجاناً', 5, 50);
addService('جواهر فري فاير 1000+100', 'اشتري 1000 جوهرة واحصل على 100 مجاناً', 10, 30);

// ========== إدارة الطلبات ==========

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

function getOrder(orderId) {
    return orders.get(orderId);
}

function updateOrder(orderId, updates) {
    const order = orders.get(orderId);
    if (order) {
        Object.assign(order, updates);
        orders.set(orderId, order);
    }
    return order;
}

// ========== معالجة الأدمن ==========

const adminActions = new Map();

adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (chatId != ADMIN_ID) {
        const keyboard = { remove_keyboard: true };
        return adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول إلى هذه اللوحة', keyboard);
    }
    
    // تسجيل الأدمن كمستخدم
    registerUser(chatId, msg.from.username);
    
    try {
        if (text === '/start' || text === '🏠 الرئيسية') {
            showAdminPanel(chatId);
            return;
        }
        
        const action = adminActions.get(chatId);
        if (action) {
            await handleAdminAction(chatId, text, action);
            return;
        }
        
        switch(text) {
            case '📊 الإحصائيات':
                await showStatistics(chatId);
                break;
                
            case '👤 منح رصيد':
                adminBot.sendMessage(chatId, '💰 *منح رصيد*\n\nالرجاء إرسال قيمة الرصيد الذي تود إرساله (بالدولار):\nمثال: 5', {
                    parse_mode: 'Markdown',
                    reply_markup: { remove_keyboard: true }
                });
                adminActions.set(chatId, { type: 'send_balance', step: 1 });
                break;
                
            case '🎁 إضافة خدمة':
                adminBot.sendMessage(chatId, '🎮 *إضافة خدمة جديدة*\n\nأرسل اسم الخدمة:', {
                    parse_mode: 'Markdown',
                    reply_markup: { remove_keyboard: true }
                });
                adminActions.set(chatId, { type: 'add_service', step: 1 });
                break;
                
            case '📋 الطلبات':
                await showPendingOrders(chatId);
                break;
                
            case '💰 طلبات الشحن':
                await showDepositRequests(chatId);
                break;
                
            case '🏷️ منح خصم':
                adminBot.sendMessage(chatId, '🎯 *منح خصم*\n\nأرسل يوزر أو ID المستخدم:', {
                    parse_mode: 'Markdown',
                    reply_markup: { remove_keyboard: true }
                });
                adminActions.set(chatId, { type: 'set_discount', step: 1 });
                break;
                
            case '📢 إرسال إشعار':
                adminBot.sendMessage(chatId, '📢 *إرسال إشعار لجميع المستخدمين*\n\nأرسل الرسالة:', {
                    parse_mode: 'Markdown',
                    reply_markup: { remove_keyboard: true }
                });
                adminActions.set(chatId, { type: 'broadcast', step: 1 });
                break;
                
            case '🔄 تحديث البيانات':
                showAdminPanel(chatId);
                adminBot.sendMessage(chatId, '✅ تم تحديث لوحة التحكم');
                break;
                
            default:
                if (text.startsWith('/complete_')) {
                    const orderId = text.split('_')[1];
                    await completeOrder(chatId, orderId);
                } else if (text.startsWith('/cancel_')) {
                    const orderId = text.split('_')[1];
                    await cancelOrder(chatId, orderId);
                } else {
                    showAdminPanel(chatId);
                }
                break;
        }
    } catch (error) {
        console.error('Admin bot error:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ أثناء المعالجة');
        showAdminPanel(chatId);
    }
});

async function handleAdminAction(chatId, text, action) {
    try {
        switch(action.type) {
            case 'send_balance':
                if (action.step === 1) {
                    const amount = parseFloat(text);
                    if (isNaN(amount) || amount <= 0) {
                        adminBot.sendMessage(chatId, '❌ قيمة غير صحيحة\nالرجاء إرسال رقم صحيح أكبر من 0');
                        return;
                    }
                    action.amount = amount;
                    action.step = 2;
                    adminActions.set(chatId, action);
                    adminBot.sendMessage(chatId, `✅ تم تحديد المبلغ: ${amount}$\n\nالآن أرسل يوزر أو ID المستخدم:`);
                } else if (action.step === 2) {
                    const user = findUser(text);
                    if (!user) {
                        adminBot.sendMessage(chatId, '❌ المستخدم غير موجود');
                        adminActions.delete(chatId);
                        showAdminPanel(chatId);
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
                    
                    // إرسال إشعار للمستخدم
                    try {
                        const userKeyboard = {
                            reply_markup: {
                                keyboard: [
                                    ['💳 شحن رصيد', '🎮 الخدمات'],
                                    ['📋 طلباتي', '👥 التسويق بالعمولة']
                                ],
                                resize_keyboard: true
                            }
                        };
                        
                        await chargingBot.sendMessage(user.userId, 
                            `🎉 *تم استلام تحويل جديد*\n\n💰 المبلغ: ${action.amount}$\n💳 رصيدك الحالي: ${user.balance}$\n\nشكراً لاستخدامك خدماتنا!`, 
                            { parse_mode: 'Markdown', ...userKeyboard }
                        );
                    } catch (e) {}
                    
                    adminBot.sendMessage(chatId, `✅ تم التحويل بنجاح\nتم إضافة ${action.amount}$ إلى رصيد ${user.username || user.userId}`);
                    adminActions.delete(chatId);
                    showAdminPanel(chatId);
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
                        showAdminPanel(chatId);
                        return;
                    }
                    action.price = price;
                    action.step = 4;
                    adminActions.set(chatId, action);
                    adminBot.sendMessage(chatId, '📊 أرسل كمية الخدمة المتاحة:');
                } else if (action.step === 4) {
                    const stock = parseInt(text);
                    if (isNaN(stock) || stock <= 0) {
                        adminBot.sendMessage(chatId, '❌ كمية غير صحيحة');
                        adminActions.delete(chatId);
                        showAdminPanel(chatId);
                        return;
                    }
                    
                    const service = addService(action.name, action.description, action.price, stock);
                    
                    const serviceMessage = `✅ *تم إضافة الخدمة بنجاح*\n\n📦 الاسم: ${service.name}\n📝 الوصف: ${service.description}\n💰 السعر: ${service.price}$\n📊 الكمية: ${service.stock}\n🆔 المعرف: ${service.id}`;
                    
                    adminBot.sendMessage(chatId, serviceMessage, { parse_mode: 'Markdown' });
                    adminActions.delete(chatId);
                    showAdminPanel(chatId);
                }
                break;
                
            case 'set_discount':
                if (action.step === 1) {
                    const user = findUser(text);
                    if (!user) {
                        adminBot.sendMessage(chatId, '❌ المستخدم غير موجود');
                        adminActions.delete(chatId);
                        showAdminPanel(chatId);
                        return;
                    }
                    action.userId = user.userId;
                    action.step = 2;
                    adminActions.set(chatId, action);
                    adminBot.sendMessage(chatId, `🎯 إعداد خصم للمستخدم: ${user.username || user.userId}\n\nأرسل نسبة الخصم (0-100):`);
                } else if (action.step === 2) {
                    const discount = parseInt(text);
                    if (isNaN(discount) || discount < 0 || discount > 100) {
                        adminBot.sendMessage(chatId, '❌ نسبة غير صحيحة\nيجب أن تكون بين 0 و 100');
                        adminActions.delete(chatId);
                        showAdminPanel(chatId);
                        return;
                    }
                    
                    const user = getUser(action.userId);
                    user.discount = discount;
                    saveUser(user);
                    
                    adminBot.sendMessage(chatId, `✅ تم منح خصم ${discount}% للمستخدم ${user.username || user.userId}`);
                    adminActions.delete(chatId);
                    showAdminPanel(chatId);
                }
                break;
                
            case 'broadcast':
                if (action.step === 1) {
                    const message = text;
                    let sentCount = 0;
                    
                    for (const user of users.values()) {
                        try {
                            await chargingBot.sendMessage(user.userId, 
                                `📢 *إشعار من الإدارة*\n\n${message}\n\nمع تحيات فريق الدعم`, 
                                { parse_mode: 'Markdown' }
                            );
                            sentCount++;
                        } catch (e) {
                            console.log(`فشل إرسال للمستخدم: ${user.userId}`);
                        }
                    }
                    
                    adminBot.sendMessage(chatId, `✅ تم إرسال الإشعار إلى ${sentCount} مستخدم`);
                    adminActions.delete(chatId);
                    showAdminPanel(chatId);
                }
                break;
        }
    } catch (error) {
        console.error('Error in admin action:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ أثناء المعالجة');
        adminActions.delete(chatId);
        showAdminPanel(chatId);
    }
}

async function showStatistics(chatId) {
    const totalUsers = users.size;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let activeUsers = 0;
    
    for (const user of users.values()) {
        if (new Date(user.lastActive) > weekAgo) {
            activeUsers++;
        }
    }
    
    const depositOrders = getOrders().filter(o => o.serviceName === 'شحن رصيد' && o.status === 'completed');
    const totalDeposits = depositOrders.reduce((sum, o) => sum + o.amount, 0);
    
    const jewelOrders = getOrders().filter(o => o.serviceName.includes('جوهر') && o.status === 'completed');
    const totalJewels = jewelOrders.reduce((sum, o) => sum + o.amount, 0);
    
    const statsMessage = `📊 *إحصائيات النظام*\n\n👥 عدد المستخدمين: ${totalUsers}\n✅ المستخدمين النشطين: ${activeUsers}\n❌ المستخدمين غير النشطين: ${totalUsers - activeUsers}\n💰 إجمالي الشحنات: ${totalDeposits}$\n💎 الجواهر المشحونة: ${totalJewels}`;
    
    adminBot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
}

async function showPendingOrders(chatId) {
    const pendingOrders = getOrders().filter(o => o.status === 'pending');
    
    if (pendingOrders.length === 0) {
        adminBot.sendMessage(chatId, '📭 *لا توجد طلبات معلقة*', { parse_mode: 'Markdown' });
        return;
    }
    
    for (const order of pendingOrders.slice(0, 10)) {
        const user = getUser(order.userId);
        const orderMessage = `📦 *طلب خدمة*\n\n👤 المستخدم: @${order.username || 'بدون'} (${order.userId})\n🎮 الخدمة: ${order.serviceName}\n💰 السعر: ${order.amount}$\n🎮 ID اللعبة: ${order.gameId}\n🆔 رقم الطلب: ${order.orderId}\n📅 التاريخ: ${order.createdAt.toLocaleString()}`;
        
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ إكمال الطلب', callback_data: `complete_${order.orderId}` },
                        { text: '❌ إلغاء الطلب', callback_data: `cancel_${order.orderId}` }
                    ]
                ]
            }
        };
        
        adminBot.sendMessage(chatId, orderMessage, { parse_mode: 'Markdown', ...keyboard });
    }
}

async function showDepositRequests(chatId) {
    const depositRequests = getOrders().filter(o => o.status === 'waiting_payment');
    
    if (depositRequests.length === 0) {
        adminBot.sendMessage(chatId, '💳 *لا توجد طلبات شحن معلقة*', { parse_mode: 'Markdown' });
        return;
    }
    
    for (const deposit of depositRequests.slice(0, 10)) {
        const depositMessage = `💳 *طلب شحن رصيد*\n\n👤 المستخدم: @${deposit.username || 'بدون'} (${deposit.userId})\n💰 المبلغ: ${deposit.amount}$\n🆔 رقم الطلب: ${deposit.orderId}\n📅 التاريخ: ${deposit.createdAt.toLocaleString()}`;
        
        if (deposit.paymentProof) {
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ تأكيد الدفع', callback_data: `confirm_deposit_${deposit.orderId}` },
                            { text: '❌ رفض الدفع', callback_data: `reject_deposit_${deposit.orderId}` }
                        ]
                    ]
                }
            };
            
            await adminBot.sendPhoto(chatId, deposit.paymentProof, {
                caption: depositMessage,
                parse_mode: 'Markdown',
                ...keyboard
            });
        } else {
            adminBot.sendMessage(chatId, depositMessage, { parse_mode: 'Markdown' });
        }
    }
}

async function completeOrder(chatId, orderId) {
    const order = getOrder(orderId);
    if (!order) {
        adminBot.sendMessage(chatId, '❌ الطلب غير موجود');
        return;
    }
    
    order.status = 'completed';
    updateOrder(orderId, order);
    
    try {
        await chargingBot.sendMessage(order.userId, 
            `✅ *تم إكمال طلبك*\n\n🎮 الخدمة: ${order.serviceName}\n💰 المبلغ: ${order.amount}$\n🆔 رقم الطلب: ${order.orderId}\n\nشكراً لاستخدامك خدماتنا!`, 
            { parse_mode: 'Markdown' }
        );
    } catch (e) {}
    
    adminBot.sendMessage(chatId, `✅ تم إكمال الطلب ${orderId}`);
}

async function cancelOrder(chatId, orderId) {
    const order = getOrder(orderId);
    if (!order) {
        adminBot.sendMessage(chatId, '❌ الطلب غير موجود');
        return;
    }
    
    order.status = 'cancelled';
    updateOrder(orderId, order);
    
    const user = getUser(order.userId);
    user.balance += order.amount;
    saveUser(user);
    
    try {
        await chargingBot.sendMessage(order.userId, 
            `❌ *تم إلغاء طلبك*\n\n🎮 الخدمة: ${order.serviceName}\n💰 المبلغ: ${order.amount}$\n🆔 رقم الطلب: ${order.orderId}\n\nتم إرجاع ${order.amount}$ إلى رصيدك`, 
            { parse_mode: 'Markdown' }
        );
    } catch (e) {}
    
    adminBot.sendMessage(chatId, `❌ تم إلغاء الطلب ${orderId}`);
}

// ========== معالجة بوت الشحن ==========

const userActions = new Map();

chargingBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username;
    
    // تسجيل/تحديث المستخدم
    registerUser(chatId, username);
    
    try {
        if (text === '/start' || text === '🏠 الرئيسية') {
            showUserPanel(chatId);
            return;
        }
        
        const action = userActions.get(chatId);
        if (action) {
            await handleUserAction(chatId, text, action, msg);
            return;
        }
        
        switch(text) {
            case '💳 شحن رصيد':
                showDepositMethods(chatId);
                break;
                
            case '🎮 الخدمات':
                await showServices(chatId);
                break;
                
            case '📋 طلباتي':
                await showUserOrders(chatId);
                break;
                
            case '👥 التسويق بالعمولة':
                showCommissionInfo(chatId);
                break;
                
            case '📢 قناة البوت':
                chargingBot.sendMessage(chatId, '📢 *قناة البوت الرسمية*\n\n@otzhabot', { parse_mode: 'Markdown' });
                break;
                
            case 'ℹ️ المساعدة':
                chargingBot.sendMessage(chatId, '🆘 *مركز المساعدة*\n\nللتواصل مع الدعم:\n@Diamouffbot\n\nأوقات العمل: 24/7', { parse_mode: 'Markdown' });
                break;
                
            default:
                showUserPanel(chatId);
                break;
        }
    } catch (error) {
        console.error('Charging bot error:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة لاحقاً');
        showUserPanel(chatId);
    }
});

function showDepositMethods(chatId) {
    const message = `💳 *شحن الرصيد*\n\nالرجاء إدخال كمية الدولار التي تريد شحنها:\nمثال: 5\n(5 تعني 5 دولار)\n\n*يتم الدفع عبر Binance فقط*`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
    });
    userActions.set(chatId, { type: 'deposit', step: 1 });
}

async function showServices(chatId) {
    const availableServices = getServices().filter(s => s.stock > 0);
    
    if (availableServices.length === 0) {
        chargingBot.sendMessage(chatId, '⚠️ *لا توجد خدمات متاحة حالياً*', { parse_mode: 'Markdown' });
        return;
    }
    
    const keyboard = {
        reply_markup: {
            keyboard: availableServices.map(service => 
                [`🎮 ${service.name} - ${service.price}$`]
            ).concat([['🏠 الرئيسية']]),
            resize_keyboard: true
        }
    };
    
    chargingBot.sendMessage(chatId, '🎮 *الخدمات المتاحة*\n\nاختر الخدمة التي تريدها:', {
        parse_mode: 'Markdown',
        ...keyboard
    });
    
    userActions.set(chatId, { type: 'select_service', step: 1 });
}

async function showUserOrders(chatId) {
    const userOrders = getOrders().filter(o => o.userId === chatId).slice(0, 10);
    
    if (userOrders.length === 0) {
        chargingBot.sendMessage(chatId, '📭 *لا توجد طلبات سابقة*', { parse_mode: 'Markdown' });
        return;
    }
    
    let message = '📋 *طلباتي السابقة*\n\n';
    userOrders.forEach((order, index) => {
        let statusEmoji = '⏳';
        if (order.status === 'completed') statusEmoji = '✅';
        if (order.status === 'cancelled') statusEmoji = '❌';
        if (order.status === 'waiting_payment') statusEmoji = '💳';
        
        message += `${statusEmoji} *${order.serviceName}*\n`;
        message += `💰 ${order.amount}$\n`;
        message += `📅 ${order.createdAt.toLocaleDateString('ar-SA')}\n`;
        message += `الحالة: ${getStatusText(order.status)}\n`;
        message += `🆔 ${order.orderId}\n\n`;
    });
    
    chargingBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

function showCommissionInfo(chatId) {
    const user = getUser(chatId);
    const commissionRate = user.commissionRate || 3;
    
    const message = `👥 *التسويق بالعمولة*\n\n🎯 معدل عمولتك: ${commissionRate}%\n\n💰 *كيف تعمل:*\n1. شارك رابط الإحالة الخاص بك\n2. كل عملية شراء من المستخدمين الذين جلبهم\n3. تحصل على ${commissionRate}% من قيمة كل عملية\n\n📊 *لجني الأرباح:*\n- شجع الآخرين على التسجيل عبر رابطك\n- كلما زاد عدد المستخدمين، زادت أرباحك\n\n💡 *نصائح:*\n- شارك البوت في مجموعات الألعاب\n- قدم تجربتك الإيجابية\n- ساعد الآخرين في استخدام البوت`;
    
    chargingBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function handleUserAction(chatId, text, action, msg) {
    try {
        switch(action.type) {
            case 'deposit':
                if (action.step === 1) {
                    const amount = parseFloat(text);
                    if (isNaN(amount) || amount <= 0) {
                        chargingBot.sendMessage(chatId, '❌ قيمة غير صحيحة\nالرجاء إرسال رقم صحيح أكبر من 0');
                        return;
                    }
                    
                    const depositMessage = `💰 *طلب شحن رصيد*\n\n💵 المبلغ: ${amount}$\n\n📋 *إرشادات الدفع:*\n1. قم بتحويل ${amount}$ إلى العنوان التالي:\nID: ${PAYMENT_ID}\n\n2. بعد التحويل، أرسل صورة إيصال الدفع هنا\n\n⚠️ *ملاحظة:*\n- الرصيد سيضاف بعد تأكيد الإدارة\n- تأكد من صحة العنوان\n- قد تستغرق العملية بضع دقائق`;
                    
                    chargingBot.sendMessage(chatId, depositMessage, { parse_mode: 'Markdown' });
                    userActions.set(chatId, { type: 'deposit', step: 2, amount });
                }
                break;
                
            case 'select_service':
                if (action.step === 1) {
                    const serviceText = text.replace('🎮 ', '').split(' - ')[0];
                    const service = getServices().find(s => s.name === serviceText);
                    
                    if (!service) {
                        chargingBot.sendMessage(chatId, '❌ الخدمة غير متوفرة');
                        userActions.delete(chatId);
                        showUserPanel(chatId);
                        return;
                    }
                    
                    const user = getUser(chatId);
                    const finalPrice = service.price * (1 - (user.discount / 100));
                    
                    if (user.balance < finalPrice) {
                        chargingBot.sendMessage(chatId, 
                            `❌ *رصيدك غير كافي*\n\n💰 رصيدك الحالي: ${user.balance}$\n💵 سعر الخدمة: ${finalPrice}$\n\nيرجى شحن رصيد أولاً`, 
                            { parse_mode: 'Markdown' }
                        );
                        userActions.delete(chatId);
                        showUserPanel(chatId);
                        return;
                    }
                    
                    const serviceMessage = `🎮 *${service.name}*\n\n📝 الوصف: ${service.description}\n💰 السعر: ${service.price}$\n🎯 خصمك: ${user.discount}%\n💵 السعر النهائي: ${finalPrice}$\n\n⏱️ البدأ : 0 / 24 ساعة\n🟢 تعمل لجميع أنحاء العالم\n\n🆔 *أرسل ID الخاص بك في اللعبة:*`;
                    
                    chargingBot.sendMessage(chatId, serviceMessage, {
                        parse_mode: 'Markdown',
                        reply_markup: { remove_keyboard: true }
                    });
                    
                    userActions.set(chatId, { 
                        type: 'purchase_service', 
                        serviceId: service.id, 
                        serviceName: service.name,
                        price: finalPrice,
                        step: 2 
                    });
                }
                break;
                
            case 'purchase_service':
                if (action.step === 2) {
                    const gameId = text.trim();
                    if (!gameId) {
                        chargingBot.sendMessage(chatId, '❌ يرجى إدخال ID صحيح');
                        return;
                    }
                    
                    const user = getUser(chatId);
                    
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
                    
                    // إرسال الطلب للأدمن
                    const orderMessage = `📦 *طلب جديد*\n\n👤 المستخدم: @${user.username || 'بدون'} (${chatId})\n🎮 الخدمة: ${action.serviceName}\n💰 السعر: ${action.price}$\n🎮 ID اللعبة: ${gameId}\n🆔 رقم الطلب: ${order.orderId}`;
                    
                    const keyboard = {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '✅ إكمال الطلب', callback_data: `complete_${order.orderId}` },
                                    { text: '❌ إلغاء الطلب', callback_data: `cancel_${order.orderId}` }
                                ]
                            ]
                        }
                    };
                    
                    adminBot.sendMessage(ADMIN_ID, orderMessage, { parse_mode: 'Markdown', ...keyboard });
                    
                    chargingBot.sendMessage(chatId, 
                        `✅ *تم تقديم طلبك*\n\n🎮 الخدمة: ${action.serviceName}\n💰 المبلغ: ${action.price}$\n🆔 رقم الطلب: ${order.orderId}\n🎮 ID اللعبة: ${gameId}\n\n📞 ستتم معالجة طلبك خلال 24 ساعة`, 
                        { parse_mode: 'Markdown' }
                    );
                    
                    userActions.delete(chatId);
                    showUserPanel(chatId);
                }
                break;
        }
        
        // معالجة صورة الإيصال للشحن
        if (action && action.type === 'deposit' && action.step === 2 && msg.photo) {
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            const amount = action.amount;
            const user = getUser(chatId);
            
            // إنشاء طلب الشحن
            const depositOrder = createDepositOrder(chatId, user.username, amount, photoId);
            
            // إرسال للأدمن للموافقة
            const depositMessage = `💳 *طلب شحن جديد*\n\n👤 المستخدم: @${user.username || 'بدون'} (${chatId})\n💰 المبلغ: ${amount}$\n🆔 رقم الطلب: ${depositOrder.orderId}`;
            
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ تأكيد الدفع', callback_data: `confirm_deposit_${depositOrder.orderId}` },
                            { text: '❌ رفض الدفع', callback_data: `reject_deposit_${depositOrder.orderId}` }
                        ]
                    ]
                }
            };
            
            await adminBot.sendPhoto(ADMIN_ID, photoId, {
                caption: depositMessage,
                parse_mode: 'Markdown',
                ...keyboard
            });
            
            chargingBot.sendMessage(chatId, 
                `✅ *تم استلام إيصال الدفع*\n\n💰 المبلغ: ${amount}$\n🆔 رقم الطلب: ${depositOrder.orderId}\n\n📞 سيتم مراجعة طلبك من قبل الإدارة قريباً`, 
                { parse_mode: 'Markdown' }
            );
            
            userActions.delete(chatId);
            showUserPanel(chatId);
        }
    } catch (error) {
        console.error('Error in user action:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ أثناء المعالجة');
        userActions.delete(chatId);
        showUserPanel(chatId);
    }
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'قيد الانتظار',
        'completed': 'مكتمل',
        'cancelled': 'ملغى',
        'waiting_payment': 'بانتظار الدفع'
    };
    return statusMap[status] || status;
}

// ========== معالجة Callback Queries ==========

adminBot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    
    try {
        if (data.startsWith('complete_')) {
            const orderId = data.split('_')[1];
            await completeOrder(chatId, orderId);
            adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم إكمال الطلب' });
            
        } else if (data.startsWith('cancel_')) {
            const orderId = data.split('_')[1];
            await cancelOrder(chatId, orderId);
            adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم إلغاء الطلب' });
            
        } else if (data.startsWith('confirm_deposit_')) {
            const orderId = data.split('_')[2];
            const order = getOrder(orderId);
            
            if (!order) {
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'الطلب غير موجود' });
                return;
            }
            
            order.status = 'completed';
            updateOrder(orderId, order);
            
            const user = getUser(order.userId);
            user.balance += order.amount;
            saveUser(user);
            
            // تسجيل العملية
            transactions.push({
                userId: order.userId,
                type: 'deposit',
                amount: order.amount,
                description: 'شحن رصيد',
                date: new Date()
            });
            
            // إعلام المستخدم
            try {
                await chargingBot.sendMessage(order.userId, 
                    `✅ *تم تأكيد شحن الرصيد*\n\n💰 المبلغ: ${order.amount}$\n💳 رصيدك الحالي: ${user.balance}$\n🆔 رقم الطلب: ${order.orderId}\n\nشكراً لاستخدامك خدماتنا!`, 
                    { parse_mode: 'Markdown' }
                );
            } catch (e) {}
            
            adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم تأكيد الدفع' });
            adminBot.editMessageText('✅ تم تأكيد الدفع', {
                chat_id: chatId,
                message_id: messageId
            });
            
        } else if (data.startsWith('reject_deposit_')) {
            const orderId = data.split('_')[2];
            const order = getOrder(orderId);
            
            if (!order) {
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'الطلب غير موجود' });
                return;
            }
            
            order.status = 'cancelled';
            updateOrder(orderId, order);
            
            // إعلام المستخدم
            try {
                await chargingBot.sendMessage(order.userId, 
                    `❌ *لم يتم تأكيد الدفع*\n\n💰 المبلغ: ${order.amount}$\n🆔 رقم الطلب: ${order.orderId}\n\nالرجاء التحقق من الإيصال والمحاولة مرة أخرى أو التواصل مع الدعم`, 
                    { parse_mode: 'Markdown' }
                );
            } catch (e) {}
            
            adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم رفض الدفع' });
            adminBot.editMessageText('❌ تم رفض الدفع', {
                chat_id: chatId,
                message_id: messageId
            });
        }
    } catch (error) {
        console.error('Callback error:', error);
        adminBot.answerCallbackQuery(callbackQuery.id, { text: 'حدث خطأ' });
    }
});

// ========== تشغيل النظام ==========

console.log('🚀 بدء تشغيل نظام البوتات...');
console.log('🤖 بوت الشحن: @Diamouffbot');
console.log('👑 بوت الإدارة: @otzhabot');
console.log('👤 ID الأدمن: ' + ADMIN_ID);
console.log('✅ النظام يعمل بنجاح!');
