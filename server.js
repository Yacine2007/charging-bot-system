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

// ========== دوال إرسال إشعارات إلى المدراء ==========

async function sendOrderNotificationToAdmins(orderDetails, photoId = null) {
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    
    for (const adminId of admins) {
        try {
            const message = `🔔 *طلب جديد*\n\n` +
                          `👤 المستخدم: @${orderDetails.username || 'بدون'}\n` +
                          `🆔 ID المستخدم: ${orderDetails.userId}\n` +
                          `📦 نوع الطلب: ${orderDetails.type === 'deposit' ? 'شحن رصيد 💳' : 'طلب خدمة 🎮'}\n` +
                          (orderDetails.serviceName ? `🎮 الخدمة: ${orderDetails.serviceName}\n` : '') +
                          `💰 المبلغ: ${orderDetails.amount}$\n` +
                          (orderDetails.gameId ? `🆔 ID اللعبة: ${orderDetails.gameId}\n` : '') +
                          `🆔 رقم الطلب: ${orderDetails.orderId}\n` +
                          `📅 الوقت: ${new Date().toLocaleString('ar-SA')}\n\n` +
                          `⚡ *أزرار التحكم:*`;
            
            const keyboard = {
                reply_markup: {
                    inline_keyboard: []
                }
            };
            
            if (orderDetails.type === 'deposit') {
                keyboard.reply_markup.inline_keyboard = [
                    [
                        { text: '✅ تأكيد الدفع', callback_data: `confirm_deposit_${orderDetails.orderId}` },
                        { text: '❌ رفض الدفع', callback_data: `reject_deposit_${orderDetails.orderId}` }
                    ],
                    [
                        { text: '💬 مراسلة المستخدم', url: `tg://user?id=${orderDetails.userId}` },
                        { text: '📊 عرض الإحصائيات', callback_data: 'show_stats' }
                    ]
                ];
                
                // إرسال الصورة مع الإشعار
                if (photoId) {
                    await adminBot.sendPhoto(adminId, photoId, {
                        caption: message,
                        parse_mode: 'Markdown',
                        ...keyboard
                    });
                } else {
                    await adminBot.sendMessage(adminId, message, {
                        parse_mode: 'Markdown',
                        ...keyboard
                    });
                }
            } else {
                keyboard.reply_markup.inline_keyboard = [
                    [
                        { text: '✅ إكمال الطلب', callback_data: `complete_${orderDetails.orderId}` },
                        { text: '❌ إلغاء الطلب', callback_data: `cancel_${orderDetails.orderId}` }
                    ],
                    [
                        { text: '💬 مراسلة المستخدم', url: `tg://user?id=${orderDetails.userId}` },
                        { text: '📋 عرض جميع الطلبات', callback_data: 'show_all_orders' }
                    ]
                ];
                
                await adminBot.sendMessage(adminId, message, {
                    parse_mode: 'Markdown',
                    ...keyboard
                });
            }
            
            // إرسال إشعار صوتي
            try {
                await adminBot.sendChatAction(adminId, 'typing');
            } catch (e) {}
            
        } catch (error) {
            console.log(`❌ فشل إرسال إشعار للمسؤول ${adminId}:`, error.message);
        }
    }
}

// ========== بوت الشحن - إرسال مباشر للأدمن ==========

const userActions = new Map();
let orderCounter = 1;
let serviceCounter = 1;

// إضافة خدمات افتراضية
services.set('S1', { id: 'S1', name: 'جواهر فري فاير 100+10', description: 'اشتري 100 جوهرة واحصل على 10 مجاناً', price: 1, stock: 100 });
services.set('S2', { id: 'S2', name: 'جواهر فري فاير 500+50', description: 'اشتري 500 جوهرة واحصل على 50 مجاناً', price: 5, stock: 50 });
services.set('S3', { id: 'S3', name: 'جواهر فري فاير 1000+100', description: 'اشتري 1000 جوهرة واحصل على 100 مجاناً', price: 10, stock: 30 });

chargingBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username || 'بدون';
    
    try {
        // إذا كان هناك إجراء قيد الانتظار
        const action = userActions.get(chatId);
        if (action) {
            await handleUserAction(chatId, text, action, msg, username);
            return;
        }
        
        // الأوامر الرئيسية
        if (text === '/start') {
            showMainMenu(chatId);
        } else if (text === '💳 شحن رصيد') {
            startDepositProcess(chatId);
        } else if (text === '🎮 الخدمات') {
            showServicesMenu(chatId);
        } else if (text === '📋 طلباتي') {
            showUserOrders(chatId);
        } else if (text === '💰 رصيدي') {
            showBalance(chatId);
        } else if (text === '🏠 القائمة الرئيسية') {
            showMainMenu(chatId);
        } else if (text === '📢 قناة البوت') {
            showChannelInfo(chatId);
        } else if (text === 'ℹ️ المساعدة') {
            showHelpInfo(chatId);
        } else {
            showMainMenu(chatId);
        }
    } catch (error) {
        console.error('❌ خطأ في بوت الشحن:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة لاحقاً');
    }
});

function showMainMenu(chatId) {
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '🎮 الخدمات'],
                ['📋 طلباتي', '💰 رصيدي'],
                ['👥 التسويق', 'ℹ️ المساعدة'],
                ['📢 قناة البوت']
            ],
            resize_keyboard: true
        }
    };
    
    chargingBot.sendMessage(chatId, '🎮 *مرحباً بك في بوت الشحن*\n\nاختر من القائمة:', {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function startDepositProcess(chatId) {
    chargingBot.sendMessage(chatId, 
        '💳 *شحن الرصيد*\n\nالرجاء إدخال المبلغ الذي تريد شحنه (بالدولار):\nمثال: 5', 
        { 
            parse_mode: 'Markdown',
            reply_markup: { remove_keyboard: true }
        }
    );
    userActions.set(chatId, { type: 'awaiting_deposit_amount' });
}

function showServicesMenu(chatId) {
    let message = '🎮 *الخدمات المتاحة:*\n\n';
    services.forEach(service => {
        message += `📦 ${service.name}\n💰 ${service.price}$\n📝 ${service.description}\n\n`;
    });
    
    const keyboard = {
        reply_markup: {
            keyboard: Array.from(services.values()).map(s => [`🎮 ${s.name}`]),
            resize_keyboard: true
        }
    };
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
    
    userActions.set(chatId, { type: 'awaiting_service_selection' });
}

async function handleUserAction(chatId, text, action, msg, username) {
    try {
        switch(action.type) {
            case 'awaiting_deposit_amount':
                const amount = parseFloat(text);
                if (isNaN(amount) || amount <= 0) {
                    chargingBot.sendMessage(chatId, '❌ قيمة غير صحيحة. الرجاء إدخال رقم صحيح أكبر من 0');
                    return;
                }
                
                const depositMessage = `💰 *طلب شحن رصيد*\n\n💵 المبلغ: ${amount}$\n\n📋 *تعليمات الدفع:*\n1. قم بتحويل ${amount}$ إلى:\nID: ${PAYMENT_ID}\n2. بعد التحويل، أرسل صورة إيصال الدفع هنا`;
                
                chargingBot.sendMessage(chatId, depositMessage, {
                    parse_mode: 'Markdown'
                });
                
                userActions.set(chatId, { type: 'awaiting_deposit_receipt', amount, username });
                break;
                
            case 'awaiting_service_selection':
                const serviceName = text.replace('🎮 ', '');
                const service = Array.from(services.values()).find(s => s.name === serviceName);
                
                if (!service) {
                    chargingBot.sendMessage(chatId, '❌ الخدمة غير متوفرة');
                    userActions.delete(chatId);
                    showMainMenu(chatId);
                    return;
                }
                
                chargingBot.sendMessage(chatId, 
                    `🎮 *${service.name}*\n\n💰 السعر: ${service.price}$\n📝 ${service.description}\n\n🆔 *الرجاء إرسال ID الخاص بك في اللعبة:*`, 
                    { 
                        parse_mode: 'Markdown',
                        reply_markup: { remove_keyboard: true }
                    }
                );
                
                userActions.set(chatId, { 
                    type: 'awaiting_game_id', 
                    service, 
                    username 
                });
                break;
                
            case 'awaiting_game_id':
                const gameId = text.trim();
                if (!gameId) {
                    chargingBot.sendMessage(chatId, '❌ يرجى إدخال ID صحيح');
                    return;
                }
                
                // إنشاء طلب الخدمة
                const serviceOrder = {
                    orderId: `SVC${orderCounter++}`,
                    userId: chatId,
                    username: action.username,
                    type: 'service',
                    serviceName: action.service.name,
                    amount: action.service.price,
                    gameId: gameId,
                    createdAt: new Date()
                };
                
                orders.set(serviceOrder.orderId, serviceOrder);
                
                // إرسال إشعار مباشر للأدمن
                await sendOrderNotificationToAdmins(serviceOrder);
                
                // تأكيد للمستخدم
                chargingBot.sendMessage(chatId,
                    `✅ *تم تقديم طلبك*\n\n🎮 الخدمة: ${action.service.name}\n💰 المبلغ: ${action.service.price}$\n🆔 رقم الطلب: ${serviceOrder.orderId}\n🎮 ID اللعبة: ${gameId}\n\n📞 سيتم معالجة طلبك خلال 24 ساعة`,
                    { parse_mode: 'Markdown' }
                );
                
                userActions.delete(chatId);
                showMainMenu(chatId);
                break;
        }
        
        // معالجة صورة الإيصال
        if (action.type === 'awaiting_deposit_receipt' && msg.photo) {
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            
            // إنشاء طلب الشحن
            const depositOrder = {
                orderId: `DEP${orderCounter++}`,
                userId: chatId,
                username: action.username,
                type: 'deposit',
                amount: action.amount,
                createdAt: new Date()
            };
            
            orders.set(depositOrder.orderId, depositOrder);
            
            // إرسال إشعار مباشر للأدمن مع الصورة
            await sendOrderNotificationToAdmins(depositOrder, photoId);
            
            // تأكيد للمستخدم
            chargingBot.sendMessage(chatId,
                `✅ *تم استلام إيصال الدفع*\n\n💰 المبلغ: ${action.amount}$\n🆔 رقم الطلب: ${depositOrder.orderId}\n\n📞 سيتم مراجعة طلبك من قبل الإدارة قريباً`,
                { parse_mode: 'Markdown' }
            );
            
            userActions.delete(chatId);
            showMainMenu(chatId);
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة إجراء المستخدم:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ أثناء المعالجة');
        userActions.delete(chatId);
        showMainMenu(chatId);
    }
}

function showUserOrders(chatId) {
    const userOrders = Array.from(orders.values()).filter(o => o.userId === chatId);
    
    if (userOrders.length === 0) {
        chargingBot.sendMessage(chatId, '📭 *لا توجد طلبات سابقة*', {
            parse_mode: 'Markdown'
        });
        return;
    }
    
    let message = '📋 *طلباتك:*\n\n';
    
    userOrders.forEach(order => {
        const status = order.status === 'completed' ? '✅ مكتمل' :
                     order.status === 'cancelled' ? '❌ ملغى' :
                     order.status === 'waiting_payment' ? '💳 بانتظار الدفع' : '⏳ قيد الانتظار';
        
        message += `📦 ${order.serviceName || 'شحن رصيد'}\n`;
        message += `💰 ${order.amount}$\n`;
        message += `🆔 ${order.orderId}\n`;
        message += `📅 ${order.createdAt.toLocaleDateString('ar-SA')}\n`;
        message += `🔄 ${status}\n\n`;
    });
    
    chargingBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

function showBalance(chatId) {
    chargingBot.sendMessage(chatId, '💰 *رصيدك*\n\n💵 يمكنك شحن رصيد عبر زر "شحن رصيد"', {
        parse_mode: 'Markdown'
    });
}

function showChannelInfo(chatId) {
    chargingBot.sendMessage(chatId, '📢 *قناة البوت*\n\n@otzhabot', {
        parse_mode: 'Markdown'
    });
}

function showHelpInfo(chatId) {
    chargingBot.sendMessage(chatId, 'ℹ️ *المساعدة*\n\nللتواصل: @Diamouffbot', {
        parse_mode: 'Markdown'
    });
}

// ========== بوت الإدارة - استقبال مباشر للطلبات ==========

adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // التحقق من صلاحية الأدمن
    if (chatId !== ADMIN_ID && chatId !== SECOND_ADMIN_ID) {
        adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول');
        return;
    }
    
    try {
        if (text === '/start') {
            showAdminDashboard(chatId);
        } else if (text === '📊 الإحصائيات') {
            await showStatistics(chatId);
        } else if (text === '📋 جميع الطلبات') {
            await showAllOrders(chatId);
        } else if (text === '💰 طلبات الشحن') {
            await showDepositOrders(chatId);
        } else if (text === '🔄 تحديث') {
            showAdminDashboard(chatId);
        } else if (text === '📢 إرسال إشعار') {
            adminBot.sendMessage(chatId, '📢 *إرسال إشعار*\n\nأرسل الرسالة:', {
                parse_mode: 'Markdown'
            });
        } else {
            showAdminDashboard(chatId);
        }
    } catch (error) {
        console.error('❌ خطأ في بوت الإدارة:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ أثناء المعالجة');
    }
});

function showAdminDashboard(chatId) {
    const pendingOrders = Array.from(orders.values()).filter(o => !o.status || o.status === 'pending').length;
    const depositOrders = Array.from(orders.values()).filter(o => o.type === 'deposit' && (!o.status || o.status === 'waiting_payment')).length;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['📊 الإحصائيات', '📋 جميع الطلبات'],
                ['💰 طلبات الشحن', '📢 إرسال إشعار'],
                ['🔄 تحديث']
            ],
            resize_keyboard: true
        }
    };
    
    const message = `👑 *لوحة التحكم*\n\n📊 إحصائيات فورية:\n📦 الطلبات المعلقة: ${pendingOrders}\n💳 طلبات الشحن: ${depositOrders}\n👥 إجمالي الطلبات: ${orders.size}\n\n🔔 *جميع الطلبات الجديدة تصل هنا تلقائياً!*`;
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

async function showStatistics(chatId) {
    const totalOrders = orders.size;
    const depositOrders = Array.from(orders.values()).filter(o => o.type === 'deposit').length;
    const serviceOrders = Array.from(orders.values()).filter(o => o.type === 'service').length;
    const completedOrders = Array.from(orders.values()).filter(o => o.status === 'completed').length;
    
    const message = `📊 *إحصائيات النظام*\n\n📦 إجمالي الطلبات: ${totalOrders}\n💳 طلبات الشحن: ${depositOrders}\n🎮 طلبات الخدمات: ${serviceOrders}\n✅ المكتملة: ${completedOrders}\n⏳ المعلقة: ${totalOrders - completedOrders}`;
    
    adminBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function showAllOrders(chatId) {
    const allOrders = Array.from(orders.values());
    
    if (allOrders.length === 0) {
        adminBot.sendMessage(chatId, '📭 *لا توجد طلبات*', { parse_mode: 'Markdown' });
        return;
    }
    
    for (const order of allOrders.slice(-10).reverse()) {
        const status = order.status === 'completed' ? '✅' :
                     order.status === 'cancelled' ? '❌' :
                     order.type === 'deposit' ? '💳' : '🎮';
        
        const message = `${status} *${order.serviceName || 'شحن رصيد'}*\n👤 @${order.username || 'بدون'}\n💰 ${order.amount}$\n🆔 ${order.orderId}\n📅 ${order.createdAt.toLocaleString('ar-SA')}`;
        
        adminBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
}

async function showDepositOrders(chatId) {
    const depositOrders = Array.from(orders.values()).filter(o => o.type === 'deposit');
    
    if (depositOrders.length === 0) {
        adminBot.sendMessage(chatId, '💳 *لا توجد طلبات شحن*', { parse_mode: 'Markdown' });
        return;
    }
    
    for (const order of depositOrders.slice(-10).reverse()) {
        const message = `💳 *طلب شحن*\n👤 @${order.username || 'بدون'}\n💰 ${order.amount}$\n🆔 ${order.orderId}\n📅 ${order.createdAt.toLocaleString('ar-SA')}`;
        
        adminBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
}

// ========== معالجة Callback Queries للأدمن ==========

adminBot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    
    try {
        if (data.startsWith('confirm_deposit_')) {
            const orderId = data.split('_')[2];
            const order = orders.get(orderId);
            
            if (order) {
                order.status = 'completed';
                
                // إعلام المستخدم
                try {
                    await chargingBot.sendMessage(order.userId,
                        `✅ *تم تأكيد شحن الرصيد*\n\n💰 ${order.amount}$\n💳 تم إضافة المبلغ إلى رصيدك\n🆔 ${order.orderId}`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم تأكيد الدفع' });
                adminBot.editMessageText(`✅ تم تأكيد شحن ${order.amount}$ للمستخدم @${order.username || order.userId}`, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                });
            }
            
        } else if (data.startsWith('reject_deposit_')) {
            const orderId = data.split('_')[2];
            const order = orders.get(orderId);
            
            if (order) {
                order.status = 'cancelled';
                
                // إعلام المستخدم
                try {
                    await chargingBot.sendMessage(order.userId,
                        `❌ *لم يتم تأكيد الدفع*\n\n💰 ${order.amount}$\n🆔 ${order.orderId}\n\nالرجاء التحقق والمحاولة مرة أخرى`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم رفض الدفع' });
                adminBot.editMessageText(`❌ تم رفض شحن ${order.amount}$`, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                });
            }
            
        } else if (data.startsWith('complete_')) {
            const orderId = data.split('_')[1];
            const order = orders.get(orderId);
            
            if (order) {
                order.status = 'completed';
                
                // إعلام المستخدم
                try {
                    await chargingBot.sendMessage(order.userId,
                        `✅ *تم إكمال طلبك*\n\n🎮 ${order.serviceName}\n💰 ${order.amount}$\n🆔 ${order.orderId}\n\nشكراً لاستخدامك خدماتنا!`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم إكمال الطلب' });
                adminBot.editMessageText(`✅ تم إكمال الطلب ${orderId}`, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                });
            }
            
        } else if (data.startsWith('cancel_')) {
            const orderId = data.split('_')[1];
            const order = orders.get(orderId);
            
            if (order) {
                order.status = 'cancelled';
                
                // إعلام المستخدم
                try {
                    await chargingBot.sendMessage(order.userId,
                        `❌ *تم إلغاء طلبك*\n\n🎮 ${order.serviceName}\n💰 ${order.amount}$\n🆔 ${order.orderId}`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (e) {}
                
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم إلغاء الطلب' });
                adminBot.editMessageText(`❌ تم إلغاء الطلب ${orderId}`, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                });
            }
            
        } else if (data === 'show_stats') {
            await showStatistics(chatId);
            adminBot.answerCallbackQuery(callbackQuery.id);
            
        } else if (data === 'show_all_orders') {
            await showAllOrders(chatId);
            adminBot.answerCallbackQuery(callbackQuery.id);
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
console.log('🔔 جميع الطلبات ستصل مباشرة إلى لوحة التحكم!');

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
