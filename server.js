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

const users = new Map(); // {userId: {balance, username}}
const depositRequests = new Map(); // {requestId: {userId, amount, photoId, username, status}}

let requestCounter = 1;

// ========== تسجيل المستخدمين ==========

function getUser(userId) {
    if (!users.has(userId)) {
        users.set(userId, {
            userId: userId,
            username: '',
            balance: 0,
            isActive: true,
            lastActive: new Date()
        });
    }
    return users.get(userId);
}

function saveUser(user) {
    users.set(user.userId, user);
}

// ========== بوت الشحن - السهل والبسيط ==========

const userActions = new Map();

chargingBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username || 'بدون';
    
    const user = getUser(chatId);
    user.username = username;
    saveUser(user);
    
    try {
        // إذا كان يرسل صورة إيصال
        if (msg.photo) {
            const action = userActions.get(chatId);
            if (action && action.type === 'awaiting_receipt') {
                await handleDepositReceipt(chatId, msg.photo, action.amount, user);
                return;
            }
        }
        
        // الأوامر الرئيسية
        if (text === '/start') {
            showMainMenu(chatId, user);
        } else if (text === '💳 شحن رصيد') {
            startDepositProcess(chatId);
        } else if (text === '💰 رصيدي') {
            showBalance(chatId, user);
        } else if (text === '📋 طلباتي') {
            showMyRequests(chatId);
        } else if (text === '🏠 الرئيسية') {
            showMainMenu(chatId, user);
        } else if (text === 'ℹ️ المساعدة') {
            showHelp(chatId);
        } else {
            // إذا كتب مبلغ مباشرة
            const amount = parseFloat(text);
            if (!isNaN(amount) && amount > 0) {
                await handleDepositAmount(chatId, amount, user);
            } else {
                showMainMenu(chatId, user);
            }
        }
    } catch (error) {
        console.error('خطأ في بوت الشحن:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة لاحقاً');
    }
});

function showMainMenu(chatId, user) {
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '💰 رصيدي'],
                ['📋 طلباتي', 'ℹ️ المساعدة']
            ],
            resize_keyboard: true
        }
    };
    
    const message = `🎮 *بوت الشحن*\n\n💰 رصيدك: ${user.balance}$\n\nاختر من القائمة:`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function startDepositProcess(chatId) {
    chargingBot.sendMessage(chatId, 
        '💳 *شحن الرصيد*\n\nأرسل المبلغ الذي تريد شحنه (بالدولار):\nمثال: 5', 
        { 
            parse_mode: 'Markdown',
            reply_markup: { remove_keyboard: true }
        }
    );
}

async function handleDepositAmount(chatId, amount, user) {
    const message = `💰 *طلب شحن*\n\n💵 المبلغ: ${amount}$\n\n📋 *طريقة الدفع:*\n1. قم بتحويل ${amount}$ إلى:\nID: ${PAYMENT_ID}\n\n2. بعد التحويل، أرسل صورة إيصال الدفع هنا\n\n⚠️ *ملاحظة:*\n- سيتم التحقق من الإيصال\n- قد يستغرق التحقق بضع دقائق`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown'
    });
    
    userActions.set(chatId, { type: 'awaiting_receipt', amount });
}

async function handleDepositReceipt(chatId, photo, amount, user) {
    const photoId = photo[photo.length - 1].file_id;
    
    // إنشاء طلب شحن
    const requestId = `REQ${requestCounter++}`;
    const depositRequest = {
        requestId,
        userId: chatId,
        username: user.username,
        amount,
        photoId,
        status: 'pending',
        createdAt: new Date()
    };
    
    depositRequests.set(requestId, depositRequest);
    
    // إرسال للأدمن
    await sendDepositToAdmin(depositRequest);
    
    // تأكيد للمستخدم
    chargingBot.sendMessage(chatId,
        `✅ *تم استلام إيصال الدفع*\n\n💰 المبلغ: ${amount}$\n🆔 رقم الطلب: ${requestId}\n\n⏳ *جاري مراجعة طلبك من قبل الإدارة...*`,
        { parse_mode: 'Markdown' }
    );
    
    userActions.delete(chatId);
    showMainMenu(chatId, user);
}

function showBalance(chatId, user) {
    chargingBot.sendMessage(chatId,
        `💰 *رصيدك*\n\n💵 الرصيد الحالي: ${user.balance}$\n\nلشحن رصيد اضغط على "شحن رصيد"`,
        { parse_mode: 'Markdown' }
    );
}

function showMyRequests(chatId) {
    const myRequests = Array.from(depositRequests.values())
        .filter(req => req.userId === chatId)
        .slice(-5);
    
    if (myRequests.length === 0) {
        chargingBot.sendMessage(chatId, '📭 *لا توجد طلبات سابقة*', {
            parse_mode: 'Markdown'
        });
        return;
    }
    
    let message = '📋 *طلباتك الأخيرة:*\n\n';
    
    myRequests.forEach(req => {
        const status = req.status === 'confirmed' ? '✅ مكتمل' :
                     req.status === 'cancelled' ? '❌ ملغى' : '⏳ قيد المراجعة';
        
        message += `💰 ${req.amount}$\n`;
        message += `🆔 ${req.requestId}\n`;
        message += `📅 ${req.createdAt.toLocaleDateString('ar-SA')}\n`;
        message += `🔄 ${status}\n\n`;
    });
    
    chargingBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

function showHelp(chatId) {
    chargingBot.sendMessage(chatId,
        'ℹ️ *مركز المساعدة*\n\n📞 للتواصل: @Diamouffbot\n\n💰 *طريقة الشحن:*\n1. اضغط على "شحن رصيد"\n2. أدخل المبلغ\n3. أرسل صورة الإيصال\n4. انتظر تأكيد الإدارة',
        { parse_mode: 'Markdown' }
    );
}

// ========== إرسال طلب الشحن للأدمن ==========

async function sendDepositToAdmin(depositRequest) {
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    
    const message = `💳 *طلب شحن جديد*\n\n👤 المستخدم: @${depositRequest.username || 'بدون'}\n🆔 ID: ${depositRequest.userId}\n💰 المبلغ: ${depositRequest.amount}$\n🆔 رقم الطلب: ${depositRequest.requestId}\n📅 الوقت: ${depositRequest.createdAt.toLocaleString('ar-SA')}`;
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { 
                        text: '✅ تأكيد الدفع', 
                        callback_data: `confirm_${depositRequest.requestId}` 
                    },
                    { 
                        text: '❌ إلغاء الطلب', 
                        callback_data: `cancel_${depositRequest.requestId}` 
                    }
                ]
            ]
        }
    };
    
    for (const adminId of admins) {
        try {
            await adminBot.sendPhoto(adminId, depositRequest.photoId, {
                caption: message,
                parse_mode: 'Markdown',
                ...keyboard
            });
            
            console.log(`📨 تم إرسال طلب ${depositRequest.requestId} إلى الأدمن ${adminId}`);
        } catch (error) {
            console.error(`❌ فشل إرسال إلى الأدمن ${adminId}:`, error.message);
        }
    }
}

// ========== بوت الإدارة - البسيط ==========

adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // التحقق من صلاحية الأدمن
    if (chatId !== ADMIN_ID && chatId !== SECOND_ADMIN_ID) {
        adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول');
        return;
    }
    
    try {
        if (text === '/start' || text === '🏠 الرئيسية') {
            showAdminMainMenu(chatId);
        } else if (text === '📊 الإحصائيات') {
            showAdminStatistics(chatId);
        } else if (text === '📋 الطلبات المعلقة') {
            showPendingRequests(chatId);
        } else if (text === '👤 إضافة رصيد') {
            adminBot.sendMessage(chatId, '💰 *إضافة رصيد*\n\nأرسل المبلغ:', {
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true }
            });
        } else {
            showAdminMainMenu(chatId);
        }
    } catch (error) {
        console.error('خطأ في بوت الإدارة:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ أثناء المعالجة');
    }
});

function showAdminMainMenu(chatId) {
    const pendingCount = Array.from(depositRequests.values())
        .filter(req => req.status === 'pending').length;
    
    const totalUsers = users.size;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['📊 الإحصائيات', '📋 الطلبات المعلقة'],
                ['👤 إضافة رصيد', '🏠 الرئيسية']
            ],
            resize_keyboard: true
        }
    };
    
    const message = `👑 *لوحة التحكم*\n\n📊 إحصائيات سريعة:\n📦 الطلبات المعلقة: ${pendingCount}\n👥 المستخدمين: ${totalUsers}\n\n🔔 *كل طلبات الشحن تصل هنا تلقائياً مع زرين فقط:*\n✅ تأكيد الدفع - ❌ إلغاء الطلب`;
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function showAdminStatistics(chatId) {
    const totalRequests = depositRequests.size;
    const confirmedRequests = Array.from(depositRequests.values())
        .filter(req => req.status === 'confirmed').length;
    const cancelledRequests = Array.from(depositRequests.values())
        .filter(req => req.status === 'cancelled').length;
    const pendingRequests = totalRequests - confirmedRequests - cancelledRequests;
    
    const totalAmount = Array.from(depositRequests.values())
        .filter(req => req.status === 'confirmed')
        .reduce((sum, req) => sum + req.amount, 0);
    
    const message = `📊 *إحصائيات النظام*\n\n📦 إجمالي الطلبات: ${totalRequests}\n✅ المؤكدة: ${confirmedRequests}\n❌ الملغاة: ${cancelledRequests}\n⏳ المعلقة: ${pendingRequests}\n💰 إجمالي المشحون: ${totalAmount}$\n👥 المستخدمين: ${users.size}`;
    
    adminBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

function showPendingRequests(chatId) {
    const pendingRequests = Array.from(depositRequests.values())
        .filter(req => req.status === 'pending');
    
    if (pendingRequests.length === 0) {
        adminBot.sendMessage(chatId, '📭 *لا توجد طلبات معلقة*', {
            parse_mode: 'Markdown'
        });
        return;
    }
    
    let message = `📋 *الطلبات المعلقة (${pendingRequests.length})*\n\n`;
    
    pendingRequests.forEach(req => {
        message += `💰 ${req.amount}$\n👤 @${req.username || 'بدون'}\n🆔 ${req.requestId}\n📅 ${req.createdAt.toLocaleDateString('ar-SA')}\n\n`;
    });
    
    adminBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

// ========== معالجة زر التاكيد والإلغاء ==========

adminBot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    
    try {
        if (data.startsWith('confirm_')) {
            const requestId = data.split('_')[1];
            const request = depositRequests.get(requestId);
            
            if (!request) {
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'الطلب غير موجود' });
                return;
            }
            
            // تحديث حالة الطلب
            request.status = 'confirmed';
            
            // زيادة رصيد المستخدم
            const user = getUser(request.userId);
            user.balance += request.amount;
            saveUser(user);
            
            // إعلام المستخدم
            try {
                await chargingBot.sendMessage(request.userId,
                    `✅ *تم تأكيد شحن الرصيد*\n\n💰 المبلغ: ${request.amount}$\n💳 تم إضافة المبلغ إلى رصيدك\n💵 رصيدك الجديد: ${user.balance}$\n🆔 رقم الطلب: ${request.requestId}\n\nشكراً لاستخدامك خدماتنا!`,
                    { parse_mode: 'Markdown' }
                );
            } catch (e) {
                console.error('فشل إرسال إشعار للمستخدم:', e.message);
            }
            
            adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم تأكيد الدفع وإضافة الرصيد' });
            
            // تحديث رسالة الأدمن
            adminBot.editMessageCaption(
                `✅ *تم تأكيد الدفع*\n\n👤 @${request.username || 'بدون'}\n💰 ${request.amount}$\n💳 تم إضافة الرصيد للمستخدم\n⏰ ${new Date().toLocaleString('ar-SA')}`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
            
        } else if (data.startsWith('cancel_')) {
            const requestId = data.split('_')[1];
            const request = depositRequests.get(requestId);
            
            if (!request) {
                adminBot.answerCallbackQuery(callbackQuery.id, { text: 'الطلب غير موجود' });
                return;
            }
            
            // تحديث حالة الطلب
            request.status = 'cancelled';
            
            // إعلام المستخدم
            try {
                await chargingBot.sendMessage(request.userId,
                    `❌ *فشل التحويل*\n\n💰 المبلغ: ${request.amount}$\n🆔 رقم الطلب: ${request.requestId}\n\nالرجاء التحقق من الإيصال والمحاولة مرة أخرى أو التواصل مع الدعم`,
                    { parse_mode: 'Markdown' }
                );
            } catch (e) {
                console.error('فشل إرسال إشعار للمستخدم:', e.message);
            }
            
            adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم إلغاء الطلب' });
            
            // تحديث رسالة الأدمن
            adminBot.editMessageCaption(
                `❌ *تم إلغاء الطلب*\n\n👤 @${request.username || 'بدون'}\n💰 ${request.amount}$\n⏰ ${new Date().toLocaleString('ar-SA')}`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }
            );
        }
    } catch (error) {
        console.error('خطأ في معالجة Callback:', error);
        adminBot.answerCallbackQuery(callbackQuery.id, { text: 'حدث خطأ' });
    }
});

// ========== تشغيل النظام ==========

console.log('🚀 بدء تشغيل نظام البوتات...');
console.log('🤖 بوت الشحن: @Diamouffbot');
console.log('👑 بوت التحكم: @otzhabot');
console.log('✅ النظام يعمل بنجاح!');
console.log('🔔 كل طلب شحن يصل للأدمن مع زرين فقط: تأكيد ❌ إلغاء');

// للنشر على Render
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Charging Bot System - Simple Admin Panel');
});

server.listen(PORT, () => {
    console.log(`🌐 السيرفر يعمل على المنفذ: ${PORT}`);
});
