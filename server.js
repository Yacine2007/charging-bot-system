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

// ========== تعريف الصلاحيات والمستخدمين ==========

const USER_ROLES = {
    SUPER_ADMIN: 'super_admin',     // صلاحيات كاملة
    ADMIN: 'admin',                 // صلاحيات إدارة عادية
    SUPPORT: 'support',             // صلاحيات دعم (تأكيد طلبات فقط)
    VIEWER: 'viewer'                // صلاحيات مشاهدة فقط
};

// المستخدمون الإداريون المسبقون
const adminUsers = new Map();
adminUsers.set(ADMIN_ID.toString(), {
    id: ADMIN_ID,
    username: 'Yacine',
    role: USER_ROLES.SUPER_ADMIN,
    permissions: ['all']
});

adminUsers.set(SECOND_ADMIN_ID.toString(), {
    id: SECOND_ADMIN_ID,
    username: 'صديقك',
    role: USER_ROLES.ADMIN,
    permissions: ['statistics', 'add_balance', 'view_orders', 'confirm_deposits', 'add_service', 'set_discount']
});

// ========== تخزين البيانات في الذاكرة ==========

const users = new Map(); // {userId: {userId, username, balance, discount, isActive, lastActive}}
const services = new Map(); // {serviceId: {id, name, description, price, stock}}
const orders = new Map(); // {orderId: {orderId, userId, username, serviceName, amount, gameId, status, paymentProof}}
const transactions = []; // {userId, type, amount, description, date}

// ========== دوال التحقق من الصلاحيات ==========

function isAdmin(userId) {
    return adminUsers.has(userId.toString());
}

function getUserRole(userId) {
    const user = adminUsers.get(userId.toString());
    return user ? user.role : null;
}

function hasPermission(userId, permission) {
    const user = adminUsers.get(userId.toString());
    if (!user) return false;
    
    if (user.role === USER_ROLES.SUPER_ADMIN) return true;
    if (user.permissions.includes('all')) return true;
    if (user.permissions.includes(permission)) return true;
    
    return false;
}

function checkAdminAccess(chatId) {
    if (!isAdmin(chatId)) {
        const keyboard = { remove_keyboard: true };
        adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول إلى لوحة التحكم', keyboard);
        return false;
    }
    return true;
}

// ========== لوحة التحكم الرئيسية ==========

function showAdminPanel(chatId) {
    if (!checkAdminAccess(chatId)) return;
    
    const userRole = getUserRole(chatId);
    let keyboardLayout = [];
    
    // إحصائيات - متاح للجميع
    if (hasPermission(chatId, 'statistics') || hasPermission(chatId, 'all')) {
        keyboardLayout.push(['📊 الإحصائيات']);
    }
    
    // الصف الأول: منح رصيد وإضافة خدمة
    const row1 = [];
    if (hasPermission(chatId, 'add_balance') || hasPermission(chatId, 'all')) {
        row1.push('👤 منح رصيد');
    }
    if (hasPermission(chatId, 'add_service') || hasPermission(chatId, 'all')) {
        row1.push('🎁 إضافة خدمة');
    }
    if (row1.length > 0) keyboardLayout.push(row1);
    
    // الصف الثاني: الطلبات وطلبات الشحن
    const row2 = [];
    if (hasPermission(chatId, 'view_orders') || hasPermission(chatId, 'all')) {
        row2.push('📋 الطلبات');
    }
    if (hasPermission(chatId, 'confirm_deposits') || hasPermission(chatId, 'all')) {
        row2.push('💰 طلبات الشحن');
    }
    if (row2.length > 0) keyboardLayout.push(row2);
    
    // الصف الثالث: منح خصم وإدارة المدراء
    const row3 = [];
    if (hasPermission(chatId, 'set_discount') || hasPermission(chatId, 'all')) {
        row3.push('🏷️ منح خصم');
    }
    if (hasPermission(chatId, 'manage_admins') || hasPermission(chatId, 'all')) {
        row3.push('👥 إدارة المدراء');
    }
    if (row3.length > 0) keyboardLayout.push(row3);
    
    // الصف الرابع: إرسال إشعار وتحديث البيانات
    keyboardLayout.push(['📢 إرسال إشعار', '🔄 تحديث البيانات']);
    
    const roleName = userRole === USER_ROLES.SUPER_ADMIN ? '👑 مسؤول رئيسي' : 
                    userRole === USER_ROLES.ADMIN ? '👨‍💼 مسؤول' :
                    userRole === USER_ROLES.SUPPORT ? '🛠️ دعم فني' : '👀 مشاهد';
    
    const keyboard = {
        reply_markup: {
            keyboard: keyboardLayout,
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
    
    const adminInfo = adminUsers.get(chatId.toString());
    const welcomeMessage = `👑 *مرحباً ${adminInfo.username}*\n\n🔸 الصلاحية: ${roleName}\n🔸 ID: ${chatId}\n\nاختر من الأزرار أدناه:`;
    
    adminBot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

// ========== لوحة المستخدم الرئيسية ==========

function showUserPanel(chatId) {
    const user = getUser(chatId);
    const balance = user ? user.balance : 0;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '🎮 الخدمات'],
                ['📋 طلباتي', '👥 التسويق بالعمولة'],
                ['💰 رصيدي', '🏠 القائمة الرئيسية'],
                ['📢 قناة البوت', 'ℹ️ المساعدة']
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
    
    const welcomeMessage = `🎮 *مرحباً بك في بوت الشحن*\n\n💰 رصيدك الحالي: ${balance}$\n🎯 خصمك: ${user ? user.discount : 0}%\n\nاختر من الأزرار أدناه:`;
    
    chargingBot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

// ========== دوال إدارة المستخدمين ==========

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

// ========== دوال إدارة الخدمات ==========

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
addService('جواهر فري فاير 100+10', 'اشتري 100 جوهرة واحصل على 10 مجاناً\n⏱️ البدأ : 0 / 24 ساعة\n🟢 تعمل لجميع أنحاء العالم', 1, 100);
addService('جواهر فري فاير 500+50', 'اشتري 500 جوهرة واحصل على 50 مجاناً\n⏱️ البدأ : 0 / 24 ساعة\n🟢 تعمل لجميع أنحاء العالم', 5, 50);
addService('جواهر فري فاير 1000+100', 'اشتري 1000 جوهرة واحصل على 100 مجاناً\n⏱️ البدأ : 0 / 24 ساعة\n🟢 تعمل لجميع أنحاء العالم', 10, 30);

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

// ========== معالجة بوت الإدارة ==========

const adminActions = new Map();

adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // تسجيل الأدمن كمستخدم
    registerUser(chatId, msg.from.username);
    
    try {
        if (text === '/start' || text === '🏠 الرئيسية' || text === '🔄 تحديث البيانات') {
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
                if (hasPermission(chatId, 'statistics')) {
                    await showStatistics(chatId);
                } else {
                    adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية لعرض الإحصائيات');
                }
                break;
                
            case '👤 منح رصيد':
                if (hasPermission(chatId, 'add_balance')) {
                    adminBot.sendMessage(chatId, '💰 *منح رصيد*\n\nالرجاء إرسال قيمة الرصيد الذي تود إرساله (بالدولار):\nمثال: 5', {
                        parse_mode: 'Markdown',
                        reply_markup: { remove_keyboard: true }
                    });
                    adminActions.set(chatId, { type: 'send_balance', step: 1 });
                } else {
                    adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية لمنح الرصيد');
                }
                break;
                
            case '🎁 إضافة خدمة':
                if (hasPermission(chatId, 'add_service')) {
                    adminBot.sendMessage(chatId, '🎮 *إضافة خدمة جديدة*\n\nأرسل اسم الخدمة:', {
                        parse_mode: 'Markdown',
                        reply_markup: { remove_keyboard: true }
                    });
                    adminActions.set(chatId, { type: 'add_service', step: 1 });
                } else {
                    adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية لإضافة خدمات');
                }
                break;
                
            case '📋 الطلبات':
                if (hasPermission(chatId, 'view_orders')) {
                    await showPendingOrders(chatId);
                } else {
                    adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية لعرض الطلبات');
                }
                break;
                
            case '💰 طلبات الشحن':
                if (hasPermission(chatId, 'confirm_deposits')) {
                    await showDepositRequests(chatId);
                } else {
                    adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية لعرض طلبات الشحن');
                }
                break;
                
            case '🏷️ منح خصم':
                if (hasPermission(chatId, 'set_discount')) {
                    adminBot.sendMessage(chatId, '🎯 *منح خصم*\n\nأرسل يوزر أو ID المستخدم:', {
                        parse_mode: 'Markdown',
                        reply_markup: { remove_keyboard: true }
                    });
                    adminActions.set(chatId, { type: 'set_discount', step: 1 });
                } else {
                    adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية لمنح الخصم');
                }
                break;
                
            case '👥 إدارة المدراء':
                if (hasPermission(chatId, 'manage_admins')) {
                    await showAdminManagement(chatId);
                } else {
                    adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية لإدارة المدراء');
                }
                break;
                
            case '📢 إرسال إشعار':
                if (hasPermission(chatId, 'broadcast')) {
                    adminBot.sendMessage(chatId, '📢 *إرسال إشعار لجميع المستخدمين*\n\nأرسل الرسالة:', {
                        parse_mode: 'Markdown',
                        reply_markup: { remove_keyboard: true }
                    });
                    adminActions.set(chatId, { type: 'broadcast', step: 1 });
                } else {
                    adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية لإرسال الإشعارات');
                }
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
                        const notification = `🎉 *تم استلام تحويل جديد*\n\n💰 المبلغ: ${action.amount}$\n💳 رصيدك الحالي: ${user.balance}$\n👤 المرسل: الإدارة\n\nشكراً لاستخدامك خدماتنا!`;
                        
                        await chargingBot.sendMessage(user.userId, notification, { 
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [[
                                    { text: '🎮 عرض الخدمات', callback_data: 'show_services' }
                                ]]
                            }
                        });
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
                    
                    // إعلام المستخدم
                    try {
                        await chargingBot.sendMessage(user.userId, 
                            `🎉 *تم تحديث خصمك*\n\n🎯 نسبة الخصم الجديدة: ${discount}%\n\nيمكنك الآن الاستفادة من الخصم على جميع الخدمات!`, 
                            { parse_mode: 'Markdown' }
                        );
                    } catch (e) {}
                    
                    adminBot.sendMessage(chatId, `✅ تم منح خصم ${discount}% للمستخدم ${user.username || user.userId}`);
                    adminActions.delete(chatId);
                    showAdminPanel(chatId);
                }
                break;
                
            case 'broadcast':
                if (action.step === 1) {
                    const message = text;
                    let sentCount = 0;
                    let failedCount = 0;
                    
                    for (const user of users.values()) {
                        try {
                            await chargingBot.sendMessage(user.userId, 
                                `📢 *إشعار من الإدارة*\n\n${message}\n\nمع تحيات فريق الدعم`, 
                                { parse_mode: 'Markdown' }
                            );
                            sentCount++;
                        } catch (e) {
                            failedCount++;
                        }
                    }
                    
                    adminBot.sendMessage(chatId, 
                        `✅ *تم إرسال الإشعار*\n\n📤 أرسل إلى: ${sentCount} مستخدم\n❌ فشل الإرسال: ${failedCount} مستخدم`, 
                        { parse_mode: 'Markdown' }
                    );
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

async function showAdminManagement(chatId) {
    let message = '👥 *إدارة المدراء*\n\n';
    
    for (const [id, admin] of adminUsers) {
        const roleEmoji = admin.role === USER_ROLES.SUPER_ADMIN ? '👑' : 
                         admin.role === USER_ROLES.ADMIN ? '👨‍💼' : 
                         admin.role === USER_ROLES.SUPPORT ? '🛠️' : '👀';
        
        message += `${roleEmoji} ${admin.username}\n`;
        message += `🔸 ID: ${id}\n`;
        message += `🔸 الصلاحية: ${admin.role}\n\n`;
    }
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '➕ إضافة مسؤول', callback_data: 'add_admin' },
                    { text: '➖ إزالة مسؤول', callback_data: 'remove_admin' }
                ],
                [
                    { text: '🔄 تحديث الصلاحيات', callback_data: 'update_permissions' }
                ]
            ]
        }
    };
    
    adminBot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...keyboard });
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
    
    const statsMessage = `📊 *إحصائيات النظام*\n\n👥 عدد المستخدمين: ${totalUsers}\n✅ المستخدمين النشطين: ${activeUsers}\n❌ المستخدمين غير النشطين: ${totalUsers - activeUsers}\n💰 إجمالي الشحنات: ${totalDeposits}$\n💎 الجواهر المشحونة: ${totalJewels}\n📦 عدد الخدمات: ${services.size}\n📋 عدد الطلبات: ${orders.size}`;
    
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
                    ],
                    [
                        { text: '💬 مراسلة المستخدم', url: `tg://user?id=${order.userId}` }
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
                        ],
                        [
                            { text: '💬 مراسلة المستخدم', url: `tg://user?id=${deposit.userId}` }
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
        if (text === '/start' || text === '🏠 الرئيسية' || text === '💰 رصيدي') {
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
                const channelKeyboard = {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '📢 انضم لقناة البوت', url: 'https://t.me/otzhabot' }
                        ]]
                    }
                };
                chargingBot.sendMessage(chatId, '📢 *قناة البوت الرسمية*\n\n@otzhabot\n\nانضم للقناة للحصول على آخر التحديثات والعروض!', { 
                    parse_mode: 'Markdown',
                    ...channelKeyboard 
                });
                break;
                
            case 'ℹ️ المساعدة':
                const helpKeyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '💬 تواصل مع الدعم', url: 'https://t.me/Diamouffbot' }
                            ],
                            [
                                { text: '📖 التعليمات', callback_data: 'faq' },
                                { text: '⚙️ الإعدادات', callback_data: 'settings' }
                            ]
                        ]
                    }
                };
                
                chargingBot.sendMessage(chatId, 
                    '🆘 *مركز المساعدة*\n\n' +
                    '🔸 للتواصل مع الدعم: @Diamouffbot\n' +
                    '🔸 أوقات العمل: 24/7\n' +
                    '🔸 وقت الاستجابة: خلال 15 دقيقة\n\n' +
                    '📞 *طرق الدعم المتاحة:*\n' +
                    '• استفسارات عن الخدمات\n' +
                    '• مشاكل في الدفع\n' +
                    '• استفسارات عن الطلبات\n' +
                    '• اقتراحات وتحسينات', 
                    { 
                        parse_mode: 'Markdown',
                        ...helpKeyboard 
                    }
                );
                break;
                
            default:
                // إذا كان المستخدم أدمن، عرض لوحة التحكم
                if (isAdmin(chatId)) {
                    const adminKeyboard = {
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '👑 الذهاب إلى لوحة التحكم', url: 'https://t.me/otzhabot' }
                            ]]
                        }
                    };
                    chargingBot.sendMessage(chatId, '👑 *مرحباً أيها المسؤول*\n\nيمكنك الانتقال إلى لوحة التحكم عبر الرابط أدناه:', {
                        parse_mode: 'Markdown',
                        ...adminKeyboard
                    });
                } else {
                    showUserPanel(chatId);
                }
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
        reply_markup: { 
            keyboard: [['🏠 إلغاء والعودة']],
            resize_keyboard: true,
            one_time_keyboard: true 
        }
    });
    userActions.set(chatId, { type: 'deposit', step: 1 });
}

async function showServices(chatId) {
    const availableServices = getServices().filter(s => s.stock > 0);
    
    if (availableServices.length === 0) {
        chargingBot.sendMessage(chatId, '⚠️ *لا توجد خدمات متاحة حالياً*\n\nيرجى المحاولة لاحقاً أو التواصل مع الدعم.', { 
            parse_mode: 'Markdown' 
        });
        return;
    }
    
    const user = getUser(chatId);
    let message = `🎮 *الخدمات المتاحة*\n\n💰 رصيدك: ${user.balance}$\n🎯 خصمك: ${user.discount}%\n\nاختر الخدمة التي تريدها:\n\n`;
    
    const keyboardButtons = [];
    
    availableServices.forEach(service => {
        const finalPrice = service.price * (1 - (user.discount / 100));
        message += `🎮 ${service.name}\n💰 ${service.price}$ → ${finalPrice.toFixed(2)}$ (بعد الخصم)\n📝 ${service.description}\n\n`;
        
        keyboardButtons.push([`🎮 ${service.name} - ${finalPrice.toFixed(2)}$`]);
    });
    
    keyboardButtons.push(['🏠 القائمة الرئيسية']);
    
    const keyboard = {
        reply_markup: {
            keyboard: keyboardButtons,
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
    
    userActions.set(chatId, { type: 'select_service', step: 1 });
}

async function showUserOrders(chatId) {
    const userOrders = getOrders().filter(o => o.userId === chatId).slice(0, 10);
    
    if (userOrders.length === 0) {
        const keyboard = {
            reply_markup: {
                inline_keyboard: [[
                    { text: '🎮 عرض الخدمات', callback_data: 'show_services' },
                    { text: '💳 شحن رصيد', callback_data: 'deposit' }
                ]]
            }
        };
        
        chargingBot.sendMessage(chatId, '📭 *لا توجد طلبات سابقة*\n\nيمكنك البدء بطلب خدمة جديدة!', { 
            parse_mode: 'Markdown',
            ...keyboard 
        });
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
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔄 تحديث القائمة', callback_data: 'refresh_orders' }
                ],
                [
                    { text: '🎮 طلب خدمة جديدة', callback_data: 'new_order' }
                ]
            ]
        }
    };
    
    chargingBot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...keyboard });
}

function showCommissionInfo(chatId) {
    const user = getUser(chatId);
    const commissionRate = user.commissionRate || 3;
    
    const message = `👥 *التسويق بالعمولة*\n\n🎯 معدل عمولتك: ${commissionRate}%\n\n💰 *كيف تعمل:*\n1. شارك رابط الإحالة الخاص بك\n2. كل عملية شراء من المستخدمين الذين جلبهم\n3. تحصل على ${commissionRate}% من قيمة كل عملية\n\n📊 *لجني الأرباح:*\n- شجع الآخرين على التسجيل عبر رابطك\n- كلما زاد عدد المستخدمين، زادت أرباحك\n\n💡 *نصائح:*\n- شارك البوت في مجموعات الألعاب\n- قدم تجربتك الإيجابية\n- ساعد الآخرين في استخدام البوت`;
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📋 الحصول على رابط الإحالة', callback_data: 'get_referral_link' }
                ],
                [
                    { text: '💰 أرباحي', callback_data: 'my_earnings' },
                    { text: '👥 المستخدمين المدعوين', callback_data: 'my_referrals' }
                ]
            ]
        }
    };
    
    chargingBot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...keyboard });
}

async function handleUserAction(chatId, text, action, msg) {
    try {
        if (text === '🏠 إلغاء والعودة') {
            userActions.delete(chatId);
            showUserPanel(chatId);
            return;
        }
        
        switch(action.type) {
            case 'deposit':
                if (action.step === 1) {
                    const amount = parseFloat(text);
                    if (isNaN(amount) || amount <= 0) {
                        chargingBot.sendMessage(chatId, '❌ قيمة غير صحيحة\nالرجاء إرسال رقم صحيح أكبر من 0');
                        return;
                    }
                    
                    const depositMessage = `💰 *طلب شحن رصيد*\n\n💵 المبلغ: ${amount}$\n\n📋 *إرشادات الدفع:*\n1. قم بتحويل ${amount}$ إلى العنوان التالي:\nID: ${PAYMENT_ID}\n\n2. بعد التحويل، أرسل صورة إيصال الدفع هنا\n\n⚠️ *ملاحظة:*\n- الرصيد سيضاف بعد تأكيد الإدارة\n- تأكد من صحة العنوان\n- قد تستغرق العملية بضع دقائق`;
                    
                    const keyboard = {
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '📸 إرسال صورة الإيصال', callback_data: 'send_receipt' }
                            ]]
                        }
                    };
                    
                    chargingBot.sendMessage(chatId, depositMessage, { 
                        parse_mode: 'Markdown',
                        ...keyboard 
                    });
                    
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
                        const keyboard = {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: '💳 شحن رصيد', callback_data: 'deposit_now' }
                                    ],
                                    [
                                        { text: '🏠 العودة', callback_data: 'back_to_main' }
                                    ]
                                ]
                            }
                        };
                        
                        chargingBot.sendMessage(chatId, 
                            `❌ *رصيدك غير كافي*\n\n💰 رصيدك الحالي: ${user.balance}$\n💵 سعر الخدمة: ${finalPrice}$\n\nيرجى شحن رصيد أولاً`, 
                            { 
                                parse_mode: 'Markdown',
                                ...keyboard 
                            }
                        );
                        userActions.delete(chatId);
                        return;
                    }
                    
                    const serviceMessage = `🎮 *${service.name}*\n\n📝 الوصف: ${service.description}\n💰 السعر: ${service.price}$\n🎯 خصمك: ${user.discount}%\n💵 السعر النهائي: ${finalPrice}$\n\n⏱️ البدأ : 0 / 24 ساعة\n🟢 تعمل لجميع أنحاء العالم\n\n🆔 *أرسل ID الخاص بك في اللعبة:*`;
                    
                    chargingBot.sendMessage(chatId, serviceMessage, {
                        parse_mode: 'Markdown',
                        reply_markup: { 
                            keyboard: [['🏠 إلغاء والعودة']],
                            resize_keyboard: true,
                            one_time_keyboard: true 
                        }
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
                                ],
                                [
                                    { text: '💬 مراسلة المستخدم', url: `tg://user?id=${chatId}` }
                                ]
                            ]
                        }
                    };
                    
                    adminBot.sendMessage(ADMIN_ID, orderMessage, { parse_mode: 'Markdown', ...keyboard });
                    
                    // إرسال نسخة للمسؤول الثاني إذا كان موجوداً
                    if (SECOND_ADMIN_ID) {
                        adminBot.sendMessage(SECOND_ADMIN_ID, orderMessage, { parse_mode: 'Markdown', ...keyboard });
                    }
                    
                    const userKeyboard = {
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '📋 متابعة طلباتي', callback_data: 'my_orders' },
                                { text: '🎮 طلب خدمة أخرى', callback_data: 'new_service' }
                            ]]
                        }
                    };
                    
                    chargingBot.sendMessage(chatId, 
                        `✅ *تم تقديم طلبك*\n\n🎮 الخدمة: ${action.serviceName}\n💰 المبلغ: ${action.price}$\n🆔 رقم الطلب: ${order.orderId}\n🎮 ID اللعبة: ${gameId}\n\n📞 ستتم معالجة طلبك خلال 24 ساعة`, 
                        { 
                            parse_mode: 'Markdown',
                            ...userKeyboard 
                        }
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
                        ],
                        [
                            { text: '💬 مراسلة المستخدم', url: `tg://user?id=${chatId}` }
                        ]
                    ]
                }
            };
            
            await adminBot.sendPhoto(ADMIN_ID, photoId, {
                caption: depositMessage,
                parse_mode: 'Markdown',
                ...keyboard
            });
            
            // إرسال نسخة للمسؤول الثاني إذا كان موجوداً
            if (SECOND_ADMIN_ID) {
                await adminBot.sendPhoto(SECOND_ADMIN_ID, photoId, {
                    caption: depositMessage,
                    parse_mode: 'Markdown',
                    ...keyboard
                });
            }
            
            const userKeyboard = {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '📋 متابعة طلباتي', callback_data: 'my_orders' },
                        { text: '🏠 العودة للرئيسية', callback_data: 'back_to_main' }
                    ]]
                }
            };
            
            chargingBot.sendMessage(chatId, 
                `✅ *تم استلام إيصال الدفع*\n\n💰 المبلغ: ${amount}$\n🆔 رقم الطلب: ${depositOrder.orderId}\n\n📞 سيتم مراجعة طلبك من قبل الإدارة قريباً`, 
                { 
                    parse_mode: 'Markdown',
                    ...userKeyboard 
                }
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
        'pending': 'قيد الانتظار ⏳',
        'completed': 'مكتمل ✅',
        'cancelled': 'ملغى ❌',
        'waiting_payment': 'بانتظار الدفع 💳'
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
                const notification = `✅ *تم تأكيد شحن الرصيد*\n\n💰 المبلغ: ${order.amount}$\n💳 رصيدك الحالي: ${user.balance}$\n🆔 رقم الطلب: ${order.orderId}\n\nشكراً لاستخدامك خدماتنا!`;
                
                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🎮 عرض الخدمات', callback_data: 'show_services' },
                            { text: '💳 شحن رصيد', callback_data: 'deposit' }
                        ]]
                    }
                };
                
                await chargingBot.sendMessage(order.userId, notification, { 
                    parse_mode: 'Markdown',
                    ...keyboard 
                });
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
            
        } else if (data === 'add_admin') {
            adminBot.sendMessage(chatId, 'أرسل ID المستخدم الذي تريد إضافته كمسؤول:');
            adminActions.set(chatId, { type: 'add_admin', step: 1 });
            
        } else if (data === 'remove_admin') {
            adminBot.sendMessage(chatId, 'أرسل ID المسؤول الذي تريد إزالته:');
            adminActions.set(chatId, { type: 'remove_admin', step: 1 });
            
        } else if (data === 'update_permissions') {
            adminBot.sendMessage(chatId, 'أرسل ID المسؤول الذي تريد تحديث صلاحيته:');
            adminActions.set(chatId, { type: 'update_permissions', step: 1 });
        }
    } catch (error) {
        console.error('Callback error:', error);
        adminBot.answerCallbackQuery(callbackQuery.id, { text: 'حدث خطأ' });
    }
});

chargingBot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    
    try {
        switch(data) {
            case 'show_services':
                await showServices(chatId);
                break;
                
            case 'deposit':
                showDepositMethods(chatId);
                break;
                
            case 'deposit_now':
                showDepositMethods(chatId);
                break;
                
            case 'my_orders':
                await showUserOrders(chatId);
                break;
                
            case 'new_order':
            case 'new_service':
                await showServices(chatId);
                break;
                
            case 'refresh_orders':
                await showUserOrders(chatId);
                break;
                
            case 'back_to_main':
                showUserPanel(chatId);
                break;
                
            case 'get_referral_link':
                const referralLink = `https://t.me/Diamouffbot?start=ref_${chatId}`;
                const referralMessage = `👥 *رابط الإحالة الخاص بك*\n\n🔗 ${referralLink}\n\n📊 شارك هذا الرابط مع أصدقائك واكسب ${getUser(chatId).commissionRate}% من كل عملية شراء يقومون بها!`;
                
                chargingBot.sendMessage(chatId, referralMessage, { parse_mode: 'Markdown' });
                break;
                
            case 'my_earnings':
                const earnings = transactions
                    .filter(t => t.description && t.description.includes('عمولة'))
                    .reduce((sum, t) => sum + t.amount, 0);
                    
                chargingBot.sendMessage(chatId, `💰 *أرباحك من التسويق*\n\n💵 إجمالي الأرباح: ${earnings}$`, { parse_mode: 'Markdown' });
                break;
                
            case 'send_receipt':
                chargingBot.sendMessage(chatId, '📸 *إرسال صورة الإيصال*\n\nيرجى إرسال صورة إيصال الدفع الآن:', { parse_mode: 'Markdown' });
                break;
                
            case 'faq':
                const faqMessage = `📖 *الأسئلة الشائعة*\n\n` +
                    `❓ *كيف أشحن رصيد؟*\n` +
                    `➡️ اختر "شحن رصيد" ثم اتبع التعليمات\n\n` +
                    `❓ *كيف أطلب خدمة؟*\n` +
                    `➡️ اختر "الخدمات" ثم اختر الخدمة المطلوبة\n\n` +
                    `❓ *كم وقت يستغرق تنفيذ الطلب؟*\n` +
                    `➡️ خلال 24 ساعة كحد أقصى\n\n` +
                    `❓ *كيف أحصل على خصم؟*\n` +
                    `➡️ تواصل مع الدعم للحصول على خصم خاص`;
                    
                chargingBot.sendMessage(chatId, faqMessage, { parse_mode: 'Markdown' });
                break;
        }
        
        chargingBot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
        console.error('Charging callback error:', error);
        chargingBot.answerCallbackQuery(callbackQuery.id, { text: 'حدث خطأ' });
    }
});

// ========== تشغيل النظام ==========

console.log('🚀 بدء تشغيل نظام البوتات...');
console.log('🤖 بوت الشحن: @Diamouffbot');
console.log('👑 بوت الإدارة: @otzhabot');
console.log('👤 المسؤول الرئيسي (أنت): ' + ADMIN_ID + ' (Yacine)');
console.log('👤 المسؤول الثاني: ' + SECOND_ADMIN_ID);
console.log('✅ النظام يعمل بنجاح!');
