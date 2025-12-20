const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const fs = require('fs');

// === إعداد التوكنات ===
const CHARGING_BOT_TOKEN = '8223596744:AAGHOMQ3Sjk3-X_Z7eXXnL5drAXaHXglLFg';
const ADMIN_BOT_TOKEN = '8216188569:AAEEA1q_os_6XfSJrUDLDkkQxZXh-3OMAVU';

// === إعداد المدراء ===
const ADMIN_ID = 7656412227; // أنت (Yacine)
const SECOND_ADMIN_ID = 7450109529; // صديقك
const PAYMENT_ID = '953936100';

// إنشاء البوتات مع إعدادات متقدمة
const chargingBot = new TelegramBot(CHARGING_BOT_TOKEN, { 
    polling: { 
        interval: 300,
        autoStart: true,
        params: { timeout: 10 },
        retryTimeout: 1000
    },
    filepath: false
});

const adminBot = new TelegramBot(ADMIN_BOT_TOKEN, { 
    polling: { 
        interval: 300,
        autoStart: true,
        params: { timeout: 10 },
        retryTimeout: 1000
    },
    filepath: false
});

// ========== تخزين البيانات المحسّن ==========

const users = new Map();
const services = new Map();
const orders = new Map();
const userActions = new Map();
const orderAuditLog = [];

// ========== إضافة خدمات افتراضية ==========

function initializeServices() {
    const defaultServices = [
        { name: 'جواهر فري فاير 100+10', description: 'اشتري 100 جوهرة واحصل على 10 مجاناً', price: 1, stock: 100 },
        { name: 'جواهر فري فاير 500+50', description: 'اشتري 500 جوهرة واحصل على 50 مجاناً', price: 5, stock: 50 },
        { name: 'جواهر فري فاير 1000+100', description: 'اشتري 1000 جوهرة واحصل على 100 مجاناً', price: 10, stock: 30 }
    ];
    
    defaultServices.forEach(service => {
        const serviceId = `S${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
        services.set(serviceId, {
            id: serviceId,
            name: service.name,
            description: service.description,
            price: service.price,
            stock: service.stock,
            createdAt: new Date()
        });
    });
    
    console.log(`✅ تم تهيئة ${services.size} خدمة افتراضية`);
}

// ========== دوال المساعدة المحسنة ==========

function getUser(userId) {
    if (!users.has(userId)) {
        users.set(userId, {
            userId: userId,
            username: '',
            firstName: '',
            lastName: '',
            balance: 0,
            discount: 0,
            totalSpent: 0,
            ordersCount: 0,
            isActive: true,
            lastActive: new Date(),
            createdAt: new Date(),
            language: 'ar'
        });
    }
    return users.get(userId);
}

function saveUser(user) {
    users.set(user.userId, user);
    return user;
}

function addService(name, description, price, stock) {
    const serviceId = `S${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    const service = {
        id: serviceId,
        name,
        description,
        price,
        stock,
        createdAt: new Date(),
        isActive: true
    };
    services.set(serviceId, service);
    return service;
}

let orderCounter = 1;

function createDepositOrder(userId, username, amount, paymentProof) {
    const orderId = `DEP${orderCounter++}_${Date.now()}`;
    const order = {
        orderId,
        userId,
        username: username || 'بدون',
        firstName: '',
        lastName: '',
        type: 'deposit',
        amount,
        paymentProof,
        status: 'waiting_payment',
        adminAction: null,
        adminId: null,
        notes: '',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    orders.set(orderId, order);
    console.log(`📝 تم إنشاء طلب شحن: ${orderId} للمستخدم ${userId}`);
    logOrderAudit(orderId, 'created', 'system', { amount });
    return order;
}

function createServiceOrder(userId, username, serviceName, amount, gameId) {
    const orderId = `ORD${orderCounter++}_${Date.now()}`;
    const order = {
        orderId,
        userId,
        username: username || 'بدون',
        firstName: '',
        lastName: '',
        type: 'service',
        serviceName,
        amount,
        gameId,
        status: 'pending',
        adminAction: null,
        adminId: null,
        notes: '',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    orders.set(orderId, order);
    console.log(`📝 تم إنشاء طلب خدمة: ${orderId} للمستخدم ${userId}`);
    logOrderAudit(orderId, 'created', 'system', { serviceName, amount });
    return order;
}

function logOrderAudit(orderId, action, adminId, details) {
    const log = {
        logId: `LOG${Date.now()}${Math.random().toString(36).substr(2, 6)}`,
        orderId,
        action,
        adminId,
        timestamp: new Date(),
        details: JSON.stringify(details),
        ip: '127.0.0.1'
    };
    orderAuditLog.push(log);
    console.log(`📊 سجل تدقيق: ${action} على ${orderId} بواسطة ${adminId}`);
}

// ========== دالة نقل الصور والبيانات بين البوتات ==========

async function downloadPhotoToBuffer(fileId, bot) {
    try {
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
        
        return new Promise((resolve, reject) => {
            https.get(fileUrl, (response) => {
                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve(buffer);
                });
                response.on('error', reject);
            });
        });
    } catch (error) {
        console.error('❌ خطأ في تحميل الصورة:', error);
        throw error;
    }
}

async function sendAdminNotification(order, photoBuffer = null) {
    console.log(`📤 إرسال إشعار للمسؤولين عن الطلب: ${order.orderId}`);
    
    const admins = [ADMIN_ID, SECOND_ADMIN_ID];
    let successCount = 0;
    
    for (const adminId of admins) {
        try {
            let message = '';
            let keyboard = { inline_keyboard: [] };
            
            if (order.type === 'deposit') {
                message = `💳 *طلب شحن جديد*\n\n` +
                         `👤 المستخدم: @${order.username}\n` +
                         `🆔 ID: \`${order.userId}\`\n` +
                         `💰 المبلغ: *${order.amount}$*\n` +
                         `🆔 رقم الطلب: \`${order.orderId}\`\n` +
                         `📅 الوقت: ${order.createdAt.toLocaleString('ar-SA')}\n` +
                         `⏳ الحالة: ⏳ بانتظار الدفع\n\n` +
                         `⚡ *أزرار التحكم:*`;
                
                keyboard.inline_keyboard = [
                    [
                        { text: '✅ تأكيد الدفع', callback_data: `confirm_deposit_${order.orderId}` },
                        { text: '❌ رفض الدفع', callback_data: `reject_deposit_${order.orderId}` }
                    ],
                    [
                        { text: '📝 إضافة ملاحظة', callback_data: `note_${order.orderId}` },
                        { text: '💬 مراسلة', url: `tg://user?id=${order.userId}` }
                    ]
                ];
                
                // إرسال مع صورة إذا كانت متوفرة
                if (photoBuffer) {
                    await adminBot.sendPhoto(adminId, photoBuffer, {
                        caption: message,
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
                    console.log(`✅ تم إرسال صورة الإيصال للإدمن ${adminId}`);
                } else {
                    await adminBot.sendMessage(adminId, message, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
                }
                
            } else {
                message = `📦 *طلب خدمة جديد*\n\n` +
                         `👤 المستخدم: @${order.username}\n` +
                         `🆔 ID: \`${order.userId}\`\n` +
                         `🎮 الخدمة: *${order.serviceName}*\n` +
                         `💰 السعر: *${order.amount}$*\n` +
                         `🆔 ID اللعبة: \`${order.gameId}\`\n` +
                         `🆔 رقم الطلب: \`${order.orderId}\`\n` +
                         `📅 الوقت: ${order.createdAt.toLocaleString('ar-SA')}\n` +
                         `⏳ الحالة: ⏳ قيد المعالجة\n\n` +
                         `⚡ *أزرار التحكم:*`;
                
                keyboard.inline_keyboard = [
                    [
                        { text: '✅ إكمال الطلب', callback_data: `complete_${order.orderId}` },
                        { text: '❌ إلغاء الطلب', callback_data: `cancel_${order.orderId}` }
                    ],
                    [
                        { text: '📝 إضافة ملاحظة', callback_data: `note_${order.orderId}` },
                        { text: '💬 مراسلة', url: `tg://user?id=${order.userId}` }
                    ]
                ];
                
                await adminBot.sendMessage(adminId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
            
            // إرسال إشعار بصري
            try {
                await adminBot.sendChatAction(adminId, 'typing');
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {}
            
            successCount++;
            console.log(`✅ تم إرسال إشعار بنجاح للمسؤول ${adminId}`);
            
        } catch (error) {
            console.error(`❌ فشل إرسال إشعار للمسؤول ${adminId}:`, error.message);
            // محاولة بديلة
            try {
                await adminBot.sendMessage(adminId, `🚨 تنبيه: طلب جديد ${order.orderId} يحتاج معالجة`);
            } catch (e) {}
        }
    }
    
    return successCount > 0;
}

// ========== بوت الشحن (Diamouffbot) ==========

chargingBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username || 'بدون';
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';
    
    console.log(`📩 رسالة من ${chatId} (${username}): ${text || 'رسالة غير نصية'}`);
    
    // تسجيل/تحديث بيانات المستخدم
    let user = getUser(chatId);
    user.username = username;
    user.firstName = firstName;
    user.lastName = lastName;
    user.lastActive = new Date();
    saveUser(user);
    
    try {
        // التحقق من الإجراءات المعلقة
        const action = userActions.get(chatId);
        if (action) {
            await handleUserAction(chatId, text, action, msg, user);
            return;
        }
        
        // معالجة الأوامر الرئيسية
        if (text === '/start') {
            sendWelcomeMessage(chatId, user);
        } else if (text === '/help' || text === '🆘 المساعدة') {
            sendHelpMessage(chatId);
        } else if (text === '💳 شحن رصيد') {
            startDepositProcess(chatId);
        } else if (text === '🎮 الخدمات') {
            showServicesMenu(chatId, user);
        } else if (text === '📋 طلباتي') {
            showUserOrders(chatId, user);
        } else if (text === '💰 رصيدي') {
            showUserBalance(chatId, user);
        } else if (text === '🏠 الرئيسية') {
            sendWelcomeMessage(chatId, user);
        } else if (text === 'ℹ️ معلومات البوت') {
            sendBotInfo(chatId);
        } else {
            sendWelcomeMessage(chatId, user);
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة الرسالة:', error);
        chargingBot.sendMessage(chatId, 
            '❌ حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى\nإذا استمرت المشكلة، تواصل مع الدعم الفني.',
            { parse_mode: 'Markdown' }
        );
    }
});

function sendWelcomeMessage(chatId, user) {
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '🎮 الخدمات'],
                ['📋 طلباتي', '💰 رصيدي'],
                ['ℹ️ معلومات البوت', '🆘 المساعدة']
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
    
    const welcomeText = `🎮 *مرحباً بك في Free Fire Diamonds Bot*\n\n` +
                       `👤 *معلومات حسابك:*\n` +
                       `💰 الرصيد: *${user.balance}$*\n` +
                       `🎯 الخصم: *${user.discount}%*\n` +
                       `📊 الطلبات: *${user.ordersCount}*\n\n` +
                       `📌 *اختر من القائمة:*`;
    
    chargingBot.sendMessage(chatId, welcomeText, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function sendHelpMessage(chatId) {
    const helpText = `🆘 *دليل استخدام البوت*\n\n` +
                    `💳 *شحن الرصيد:*\n` +
                    `1. اضغط على "💳 شحن رصيد"\n` +
                    `2. أدخل المبلغ\n` +
                    `3. أرسل صورة إيصال الدفع\n` +
                    `4. انتظر تأكيد الإدارة\n\n` +
                    `🎮 *شراء الخدمات:*\n` +
                    `1. اضغط على "🎮 الخدمات"\n` +
                    `2. اختر الخدمة\n` +
                    `3. أدخل ID اللعبة\n` +
                    `4. انتظر تنفيذ الطلب\n\n` +
                    `📞 *الدعم الفني:*\n` +
                    `للشكاوى والاستفسارات، تواصل مع:\n` +
                    `@Diamouffbot_support`;
    
    chargingBot.sendMessage(chatId, helpText, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

function sendBotInfo(chatId) {
    const infoText = `ℹ️ *معلومات البوت*\n\n` +
                    `🤖 اسم البوت: Diamonds Charger\n` +
                    `⚡ إصدار النظام: 2.0\n` +
                    `📅 تاريخ التأسيس: 2024\n` +
                    `👨‍💼 المطور: Yacine\n\n` +
                    `✅ ميزات النظام:\n` +
                    `• شحن رصيد آمن\n` +
                    `• متابعة الطلبات لحظياً\n` +
                    `• إشعارات فورية\n` +
                    `• دعم 24/7\n\n` +
                    `🔒 جميع المعاملات مشفرة وآمنة`;
    
    chargingBot.sendMessage(chatId, infoText, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

function startDepositProcess(chatId) {
    const depositText = `💳 *شحن الرصيد*\n\n` +
                       `الرجاء إدخال المبلغ الذي تريد شحنه (بالدولار):\n\n` +
                       `📌 *ملاحظات مهمة:*\n` +
                       `• الحد الأدنى: 1$\n` +
                       `• الحد الأقصى: 1000$\n` +
                       `• مثال: 5 أو 10.5`;
    
    chargingBot.sendMessage(chatId, depositText, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 إلغاء والعودة']],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
    
    userActions.set(chatId, { 
        type: 'awaiting_deposit_amount',
        timestamp: new Date()
    });
}

function showServicesMenu(chatId, user) {
    if (services.size === 0) {
        chargingBot.sendMessage(chatId, '⚠️ *لا توجد خدمات متاحة حالياً*\n\nيرجى المحاولة لاحقاً.', {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🏠 الرئيسية']],
                resize_keyboard: true
            }
        });
        return;
    }
    
    let message = `🎮 *الخدمات المتاحة*\n\n` +
                 `💰 رصيدك الحالي: *${user.balance}$*\n` +
                 `🎯 خصمك الحالي: *${user.discount}%*\n\n` +
                 `📦 *قائمة الخدمات:*\n\n`;
    
    const keyboardButtons = [];
    let serviceIndex = 1;
    
    services.forEach(service => {
        if (service.isActive && service.stock > 0) {
            const finalPrice = service.price * (1 - (user.discount / 100));
            const discountText = user.discount > 0 ? 
                ` ~~${service.price}$~~ → *${finalPrice.toFixed(2)}$*` : 
                ` *${finalPrice.toFixed(2)}$*`;
            
            message += `${serviceIndex}. ${service.name}\n`;
            message += `   💰 السعر: ${discountText}\n`;
            message += `   📦 المخزون: ${service.stock}\n\n`;
            
            keyboardButtons.push([`🎮 ${service.name}`]);
            serviceIndex++;
        }
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
    
    userActions.set(chatId, { 
        type: 'awaiting_service_selection',
        timestamp: new Date()
    });
}

async function handleUserAction(chatId, text, action, msg, user) {
    console.log(`🔄 معالجة إجراء ${action.type} للمستخدم ${chatId}`);
    
    try {
        if (text === '🏠 إلغاء والعودة' || text === '🏠 الرئيسية') {
            userActions.delete(chatId);
            sendWelcomeMessage(chatId, user);
            return;
        }
        
        switch(action.type) {
            case 'awaiting_deposit_amount':
                await handleDepositAmount(chatId, text, user);
                break;
                
            case 'awaiting_deposit_receipt':
                await handleDepositReceipt(chatId, text, action, msg, user);
                break;
                
            case 'awaiting_service_selection':
                await handleServiceSelection(chatId, text, user);
                break;
                
            case 'awaiting_game_id':
                await handleGameId(chatId, text, action, user);
                break;
                
            default:
                userActions.delete(chatId);
                sendWelcomeMessage(chatId, user);
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة إجراء المستخدم:', error);
        chargingBot.sendMessage(chatId, 
            '❌ حدث خطأ في المعالجة، يرجى المحاولة مرة أخرى',
            { parse_mode: 'Markdown' }
        );
        userActions.delete(chatId);
        sendWelcomeMessage(chatId, user);
    }
}

async function handleDepositAmount(chatId, text, user) {
    const amount = parseFloat(text);
    
    if (isNaN(amount) || amount <= 0) {
        chargingBot.sendMessage(chatId, 
            '❌ *قيمة غير صحيحة*\n\nالرجاء إدخال رقم صحيح أكبر من 0\nمثال: 5 أو 10.5',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    if (amount < 1) {
        chargingBot.sendMessage(chatId, 
            '❌ *المبلغ أقل من الحد الأدنى*\n\nالحد الأدنى للشحن هو 1$',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    if (amount > 1000) {
        chargingBot.sendMessage(chatId, 
            '❌ *المبلغ أكبر من الحد الأقصى*\n\nالحد الأقصى للشحن هو 1000$',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    const paymentText = `💰 *طلب شحن رصيد*\n\n` +
                       `💵 المبلغ: *${amount}$*\n\n` +
                       `📋 *تعليمات الدفع:*\n` +
                       `1. قم بتحويل *${amount}$* إلى:\n` +
                       `   🆔 *${PAYMENT_ID}*\n` +
                       `2. بعد التحويل، أرسل *صورة إيصال الدفع* هنا\n\n` +
                       `⚠️ *ملاحظات مهمة:*\n` +
                       `• تأكد من صحة المبلغ\n` +
                       `• الصورة يجب أن تكون واضحة\n` +
                       `• المعالجة تستغرق 1-5 دقائق\n\n` +
                       `📸 الآن، أرسل صورة الإيصال:`;
    
    chargingBot.sendMessage(chatId, paymentText, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 إلغاء والعودة']],
            resize_keyboard: true
        }
    });
    
    userActions.set(chatId, { 
        type: 'awaiting_deposit_receipt', 
        amount: amount,
        username: user.username,
        firstName: user.firstName,
        timestamp: new Date()
    });
}

async function handleDepositReceipt(chatId, text, action, msg, user) {
    if (msg.photo) {
        console.log(`📸 استلام صورة إيصال من ${chatId}`);
        
        try {
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            const photoBuffer = await downloadPhotoToBuffer(photoId, chargingBot);
            
            const depositOrder = createDepositOrder(
                chatId, 
                action.username, 
                action.amount, 
                'صورة إيصال'
            );
            
            depositOrder.firstName = user.firstName;
            depositOrder.lastName = user.lastName;
            
            const sent = await sendAdminNotification(depositOrder, photoBuffer);
            
            if (sent) {
                const successText = `✅ *تم استلام إيصال الدفع بنجاح*\n\n` +
                                   `💰 المبلغ: *${action.amount}$*\n` +
                                   `🆔 رقم الطلب: \`${depositOrder.orderId}\`\n` +
                                   `📅 الوقت: ${depositOrder.createdAt.toLocaleString('ar-SA')}\n\n` +
                                   `📞 *حالة الطلب:*\n` +
                                   `⏳ جاري مراجعة الإيصال\n` +
                                   `⏱️ الوقت المتوقع: 1-5 دقائق\n\n` +
                                   `🔔 ستتلقى إشعاراً عند التأكيد`;
                
                chargingBot.sendMessage(chatId, successText, {
                    parse_mode: 'Markdown'
                });
                
                chargingBot.sendMessage(chatId, 
                    `💡 *نصيحة:*\nاحفظ رقم طلبك: \`${depositOrder.orderId}\`\nللمتابعة مع الدعم إذا لزم الأمر.`,
                    { parse_mode: 'Markdown' }
                );
            } else {
                chargingBot.sendMessage(chatId,
                    `⚠️ *تم استلام الإيصال*\n\n` +
                    `لكن هناك مشكلة في إرسال الإشعار للإدارة\n` +
                    `🆔 الرقم: \`${depositOrder.orderId}\`\n` +
                    `📞 يرجى التواصل مع الدعم يدوياً`,
                    { parse_mode: 'Markdown' }
                );
            }
            
        } catch (error) {
            console.error('❌ خطأ في معالجة صورة الإيصال:', error);
            
            const depositOrder = createDepositOrder(
                chatId, 
                action.username, 
                action.amount, 
                'فشل تحميل الصورة'
            );
            
            await sendAdminNotification(depositOrder);
            
            chargingBot.sendMessage(chatId,
                `⚠️ *تم استلام طلبك*\n\n` +
                `لكن هناك مشكلة في الصورة\n` +
                `💰 المبلغ: *${action.amount}$*\n` +
                `🆔 الرقم: \`${depositOrder.orderId}\`\n\n` +
                `📞 تم إرسال الطلب للإدارة بدون الصورة\n` +
                `سيتواصل معك المسؤول قريباً`,
                { parse_mode: 'Markdown' }
            );
        }
        
        userActions.delete(chatId);
        setTimeout(() => sendWelcomeMessage(chatId, user), 2000);
        
    } else {
        chargingBot.sendMessage(chatId,
            '❌ *يجب إرسال صورة إيصال الدفع*\n\n' +
            'الرجاء إرسال صورة واضحة للإيصال\n' +
            'أو اضغط "🏠 إلغاء والعودة" للإلغاء',
            { parse_mode: 'Markdown' }
        );
    }
}

async function handleServiceSelection(chatId, text, user) {
    const serviceName = text.replace('🎮 ', '').trim();
    const service = Array.from(services.values())
        .find(s => s.name === serviceName && s.isActive && s.stock > 0);
    
    if (!service) {
        chargingBot.sendMessage(chatId,
            '❌ *الخدمة غير متاحة*\n\n' +
            'الرجاء اختيار خدمة من القائمة',
            { parse_mode: 'Markdown' }
        );
        showServicesMenu(chatId, user);
        return;
    }
    
    const finalPrice = service.price * (1 - (user.discount / 100));
    
    if (user.balance < finalPrice) {
        const neededAmount = (finalPrice - user.balance).toFixed(2);
        chargingBot.sendMessage(chatId,
            `❌ *رصيدك غير كافي*\n\n` +
            `💰 رصيدك الحالي: *${user.balance}$*\n` +
            `💵 سعر الخدمة: *${finalPrice.toFixed(2)}$*\n` +
            `📉 الناقص: *${neededAmount}$*\n\n` +
            `💡 *الحل:*\n` +
            `1. شحن رصيد من "💳 شحن رصيد"\n` +
            `2. أو اختيار خدمة أخرى`,
            { parse_mode: 'Markdown' }
        );
        userActions.delete(chatId);
        return;
    }
    
    chargingBot.sendMessage(chatId,
        `🎮 *${service.name}*\n\n` +
        `📝 الوصف: ${service.description}\n` +
        `💰 السعر: *${finalPrice.toFixed(2)}$*\n` +
        `📦 المخزون: ${service.stroک}\n\n` +
        `🆔 *الرجاء إرسال ID الخاص بك في Free Fire:*\n\n` +
        `💡 *ملاحظة:*\n` +
        `• تأكد من صحة الـ ID\n` +
        `• لا يمكن تغييره بعد الإرسال\n` +
        `• الـ ID يظهر في صفحة الملف الشخصي`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🏠 إلغاء والعودة']],
                resize_keyboard: true
            }
        }
    );
    
    userActions.set(chatId, {
        type: 'awaiting_game_id',
        serviceId: service.id,
        serviceName: service.name,
        price: finalPrice,
        username: user.username,
        firstName: user.firstName,
        timestamp: new Date()
    });
}

async function handleGameId(chatId, text, action, user) {
    const gameId = text.trim();
    
    if (!gameId || gameId.length < 3) {
        chargingBot.sendMessage(chatId,
            '❌ *ID غير صحيح*\n\n' +
            'الرجاء إدخال ID صحيح للعبة\n' +
            'يجب أن يكون على الأقل 3 أحرف',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // خصم المبلغ من رصيد المستخدم
    user.balance -= action.price;
    user.ordersCount += 1;
    user.totalSpent += action.price;
    saveUser(user);
    
    // تحديث مخزون الخدمة
    const service = Array.from(services.values())
        .find(s => s.id === action.serviceId);
    if (service) {
        service.stock -= 1;
        if (service.stock <= 0) {
            service.isActive = false;
        }
    }
    
    // إنشاء طلب الخدمة
    const order = createServiceOrder(
        chatId, 
        action.username, 
        action.serviceName, 
        action.price, 
        gameId
    );
    order.firstName = user.firstName;
    
    // إرسال إشعار للإدارة
    const sent = await sendAdminNotification(order);
    
    if (sent) {
        const orderText = `✅ *تم تقديم طلبك بنجاح*\n\n` +
                         `🎮 الخدمة: *${action.serviceName}*\n` +
                         `💰 المبلغ: *${action.price}$*\n` +
                         `🆔 رقم الطلب: \`${order.orderId}\`\n` +
                         `🎮 ID اللعبة: \`${gameId}\`\n` +
                         `💰 الرصيد المتبقي: *${user.balance}$*\n\n` +
                         `📞 *حالة الطلب:*\n` +
                         `⏳ جاري تنفيذ الطلب\n` +
                         `⏱️ الوقت المتوقع: 5-15 دقيقة\n\n` +
                         `🔔 ستتلقى إشعاراً عند الإكمال`;
        
        chargingBot.sendMessage(chatId, orderText, {
            parse_mode: 'Markdown'
        });
    } else {
        chargingBot.sendMessage(chatId,
            `⚠️ *تم تقديم طلبك*\n\n` +
            `لكن هناك مشكلة في إرسال الإشعار\n` +
            `🆔 الرقم: \`${order.orderId}\`\n` +
            `📞 يرجى الانتظار أو التواصل مع الدعم`,
            { parse_mode: 'Markdown' }
        );
    }
    
    userActions.delete(chatId);
    setTimeout(() => sendWelcomeMessage(chatId, user), 3000);
}

function showUserOrders(chatId, user) {
    const userOrders = Array.from(orders.values())
        .filter(o => o.userId === chatId)
        .sort((a, b) => b.createdAt - a.createdAt);
    
    if (userOrders.length === 0) {
        chargingBot.sendMessage(chatId,
            '📭 *لا توجد طلبات سابقة*\n\n' +
            'لم تقم بأي طلبات حتى الآن\n' +
            'ابدأ بطلبك الأول من "🎮 الخدمات"',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    let message = `📋 *طلباتي السابقة*\n\n` +
                 `📊 إجمالي الطلبات: *${userOrders.length}*\n\n`;
    
    const pendingOrders = userOrders.filter(o => o.status === 'pending' || o.status === 'waiting_payment');
    if (pendingOrders.length > 0) {
        message += `⏳ *الطلبات قيد المعالجة: ${pendingOrders.length}*\n\n`;
        pendingOrders.forEach(order => {
            message += `${order.type === 'deposit' ? '💳' : '🎮'} ${order.serviceName || 'شحن رصيد'}\n`;
            message += `💰 ${order.amount}$ | 🆔 ${order.orderId}\n`;
            message += `📅 ${order.createdAt.toLocaleDateString('ar-SA')}\n`;
            message += `🔄 ${getStatusText(order.status)}\n\n`;
        });
    }
    
    const completedOrders = userOrders.filter(o => o.status === 'completed');
    if (completedOrders.length > 0) {
        message += `✅ *الطلبات المكتملة: ${completedOrders.length}*\n\n`;
        completedOrders.slice(0, 5).forEach(order => {
            message += `${order.type === 'deposit' ? '💳' : '🎮'} ${order.serviceName || 'شحن رصيد'}\n`;
            message += `💰 ${order.amount}$ | 📅 ${order.createdAt.toLocaleDateString('ar-SA')}\n\n`;
        });
        
        if (completedOrders.length > 5) {
            message += `📖 و ${completedOrders.length - 5} طلبات أخرى...\n\n`;
        }
    }
    
    message += `💡 *معلومات:*\nيمكنك متابعة طلباتك الحالية هنا`;
    
    chargingBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

function getStatusText(status) {
    const statusMap = {
        'pending': '⏳ قيد المعالجة',
        'completed': '✅ مكتمل',
        'cancelled': '❌ ملغى',
        'waiting_payment': '💳 بانتظار الدفع'
    };
    return statusMap[status] || status;
}

function showUserBalance(chatId, user) {
    const balanceText = `💰 *معلومات الرصيد*\n\n` +
                       `💵 الرصيد الحالي: *${user.balance}$*\n` +
                       `🎯 نسبة الخصم: *${user.discount}%*\n` +
                       `📊 إجمالي المشتريات: *${user.totalSpent}$*\n` +
                       `📦 عدد الطلبات: *${user.ordersCount}*\n\n` +
                       `💡 *كيفية زيادة الخصم:*\n` +
                       `• كل 10 طلبات → +1% خصم\n` +
                       `• كل 100$ إنفاق → +2% خصم\n\n` +
                       `📈 *توقعات:*\n` +
                       `الطلبات للخصم التالي: ${10 - (user.ordersCount % 10)} طلبات\n` +
                       `المبلغ للخصم التالي: ${100 - (user.totalSpent % 100)}$`;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد'],
                ['🏠 الرئيسية']
            ],
            resize_keyboard: true
        }
    };
    
    chargingBot.sendMessage(chatId, balanceText, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

// ========== بوت الإدارة (Otzhabot) ==========

adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    console.log(`👑 رسالة أدمن من ${chatId}: ${text}`);
    
    // التحقق من صلاحية الأدمن
    if (chatId !== ADMIN_ID && chatId !== SECOND_ADMIN_ID) {
        adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول إلى لوحة التحكم');
        return;
    }
    
    try {
        if (text === '/start' || text === '/admin' || text === '🏠 الرئيسية') {
            showAdminDashboard(chatId);
        } else if (text === '📊 الإحصائيات') {
            showAdminStats(chatId);
        } else if (text === '📋 الطلبات') {
            showAllOrders(chatId);
        } else if (text === '💳 الشحنات') {
            showDepositOrders(chatId);
        } else if (text === '👥 المستخدمين') {
            showUsersList(chatId);
        } else if (text === '🎮 الخدمات') {
            showServicesManagement(chatId);
        } else if (text === '🔄 تحديث') {
            showAdminDashboard(chatId);
        } else if (text === '📢 إشعار') {
            askForBroadcast(chatId);
        } else if (text.startsWith('/broadcast ')) {
            sendBroadcast(chatId, text.replace('/broadcast ', ''));
        }
    } catch (error) {
        console.error('❌ خطأ في بوت الإدارة:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ في المعالجة');
    }
});

function showAdminDashboard(chatId) {
    const pendingOrders = Array.from(orders.values())
        .filter(o => o.status === 'pending').length;
    const depositOrders = Array.from(orders.values())
        .filter(o => o.status === 'waiting_payment').length;
    const totalUsers = users.size;
    const todayOrders = Array.from(orders.values())
        .filter(o => {
            const today = new Date();
            const orderDate = new Date(o.createdAt);
            return orderDate.toDateString() === today.toDateString();
        }).length;
    
    const dashboardText = `👑 *لوحة التحكم الإدارية*\n\n` +
                         `📊 *إحصائيات سريعة:*\n` +
                         `📦 طلبات الخدمات: *${pendingOrders}*\n` +
                         `💳 طلبات الشحن: *${depositOrders}*\n` +
                         `👥 المستخدمين: *${totalUsers}*\n` +
                         `📈 طلبات اليوم: *${todayOrders}*\n\n` +
                         `⚡ *الأدوات السريعة:*\n` +
                         `جميع الطلبات تصل هنا تلقائياً`;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['📋 الطلبات', '💳 الشحنات'],
                ['👥 المستخدمين', '🎮 الخدمات'],
                ['📊 الإحصائيات', '📢 إشعار'],
                ['🔄 تحديث']
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
    
    adminBot.sendMessage(chatId, dashboardText, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function showAdminStats(chatId) {
    const totalUsers = users.size;
    const activeUsers = Array.from(users.values())
        .filter(u => {
            const lastActive = new Date(u.lastActive);
            const now = new Date();
            const diffDays = (now - lastActive) / (1000 * 60 * 60 * 24);
            return diffDays <= 7;
        }).length;
    
    const totalOrders = orders.size;
    const completedOrders = Array.from(orders.values())
        .filter(o => o.status === 'completed').length;
    
    const totalRevenue = Array.from(orders.values())
        .filter(o => o.status === 'completed')
        .reduce((sum, order) => sum + order.amount, 0);
    
    const todayRevenue = Array.from(orders.values())
        .filter(o => {
            if (o.status !== 'completed') return false;
            const today = new Date();
            const orderDate = new Date(o.createdAt);
            return orderDate.toDateString() === today.toDateString();
        })
        .reduce((sum, order) => sum + order.amount, 0);
    
    const statsText = `📊 *إحصائيات مفصلة*\n\n` +
                     `👥 *المستخدمين:*\n` +
                     `• إجمالي المستخدمين: *${totalUsers}*\n` +
                     `• المستخدمين النشطين: *${activeUsers}*\n` +
                     `• نسبة النشاط: *${((activeUsers / totalUsers) * 100 || 0).toFixed(1)}%*\n\n` +
                     `📦 *الطلبات:*\n` +
                     `• إجمالي الطلبات: *${totalOrders}*\n` +
                     `• الطلبات المكتملة: *${completedOrders}*\n` +
                     `• نسبة الإنجاز: *${((completedOrders / totalOrders) * 100 || 0).toFixed(1)}%*\n\n` +
                     `💰 *الإيرادات:*\n` +
                     `• إجمالي الإيرادات: *${totalRevenue.toFixed(2)}$*\n` +
                     `• إيرادات اليوم: *${todayRevenue.toFixed(2)}$*\n` +
                     `• متوسط الطلب: *${(totalRevenue / completedOrders || 0).toFixed(2)}$*\n\n` +
                     `📅 *آخر تحديث:* ${new Date().toLocaleString('ar-SA')}`;
    
    adminBot.sendMessage(chatId, statsText, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

function showAllOrders(chatId) {
    const allOrders = Array.from(orders.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20);
    
    if (allOrders.length === 0) {
        adminBot.sendMessage(chatId, '📭 *لا توجد طلبات*', {
            parse_mode: 'Markdown'
        });
        return;
    }
    
    let message = `📋 *آخر 20 طلب*\n\n`;
    
    allOrders.forEach((order, index) => {
        const icon = order.type === 'deposit' ? '💳' : '🎮';
        const statusIcon = order.status === 'pending' ? '⏳' :
                         order.status === 'completed' ? '✅' :
                         order.status === 'cancelled' ? '❌' : '💳';
        
        message += `${index + 1}. ${icon} ${statusIcon} ${order.serviceName || 'شحن رصيد'}\n`;
        message += `   👤 @${order.username} | 💰 ${order.amount}$\n`;
        message += `   🆔 ${order.orderId} | 📅 ${order.createdAt.toLocaleDateString('ar-SA')}\n`;
        
        if (order.type === 'service' && order.gameId) {
            message += `   🎮 ID: \`${order.gameId}\`\n`;
        }
        
        message += `\n`;
    });
    
    message += `📊 *الملخص:*\n`;
    message += `• إجمالي الطلبات: ${orders.size}\n`;
    message += `• قيد الانتظار: ${Array.from(orders.values()).filter(o => o.status === 'pending').length}\n`;
    message += `• بانتظار الدفع: ${Array.from(orders.values()).filter(o => o.status === 'waiting_payment').length}`;
    
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
        .filter(o => o.type === 'deposit')
        .sort((a, b) => b.createdAt - a.createdAt);
    
    if (depositOrders.length === 0) {
        adminBot.sendMessage(chatId, '💳 *لا توجد طلبات شحن*', {
            parse_mode: 'Markdown'
        });
        return;
    }
    
    const waitingDeposits = depositOrders.filter(o => o.status === 'waiting_payment');
    
    let message = `💳 *طلبات الشحن*\n\n`;
    message += `📊 *المعلومات:*\n`;
    message += `• إجمالي طلبات الشحن: *${depositOrders.length}*\n`;
    message += `• بانتظار التأكيد: *${waitingDeposits.length}*\n`;
    message += `• إجمالي المبالغ: *${depositOrders.reduce((sum, o) => sum + o.amount, 0)}$*\n\n`;
    
    if (waitingDeposits.length > 0) {
        message += `⏳ *طلبات تحتاج معالجة:*\n\n`;
        waitingDeposits.slice(0, 10).forEach((order, index) => {
            message += `${index + 1}. 👤 @${order.username}\n`;
            message += `   💰 ${order.amount}$ | 🆔 ${order.orderId}\n`;
            message += `   📅 ${order.createdAt.toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit' })}\n\n`;
        });
        
        if (waitingDeposits.length > 10) {
            message += `📖 و ${waitingDeposits.length - 10} طلباً آخر...\n\n`;
        }
    }
    
    message += `💡 *ملاحظة:*\nجميع طلبات الشحن تصل مع إشعارات خاصة تحتوي على أزرار التحكم.`;
    
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
        adminBot.sendMessage(chatId, '👥 *لا يوجد مستخدمين*', {
            parse_mode: 'Markdown'
        });
        return;
    }
    
    let message = `👥 *آخر 15 مستخدم نشط*\n\n`;
    
    allUsers.forEach((user, index) => {
        const daysSinceActive = Math.floor((new Date() - new Date(user.lastActive)) / (1000 * 60 * 60 * 24));
        const activityStatus = daysSinceActive === 0 ? '🟢 اليوم' :
                              daysSinceActive <= 1 ? '🟢 قريب' :
                              daysSinceActive <= 3 ? '🟡 متوسط' : '🔴 غير نشط';
        
        message += `${index + 1}. 👤 ${user.firstName || 'بدون'} (@${user.username || 'بدون'})\n`;
        message += `   🆔 \`${user.userId}\`\n`;
        message += `   💰 ${user.balance}$ | 📦 ${user.ordersCount} طلب\n`;
        message += `   📅 النشاط: ${activityStatus} (${daysSinceActive} يوم)\n\n`;
    });
    
    message += `📊 *إجمالي المستخدمين:* ${users.size}\n`;
    message += `📅 *آخر تحديث:* ${new Date().toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`;
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

function showServicesManagement(chatId) {
    const allServices = Array.from(services.values());
    
    if (allServices.length === 0) {
        adminBot.sendMessage(chatId, '🎮 *لا توجد خدمات*', {
            parse_mode: 'Markdown'
        });
        return;
    }
    
    let message = `🎮 *إدارة الخدمات*\n\n`;
    
    allServices.forEach((service, index) => {
        const status = service.isActive ? '🟢 مفعل' : '🔴 معطل';
        const stockStatus = service.stock > 10 ? '🟢' :
                          service.stock > 0 ? '🟡' : '🔴';
        
        message += `${index + 1}. ${service.name}\n`;
        message += `   💰 ${service.price}$ | 📦 ${stockStatus} ${service.stock}\n`;
        message += `   🆔 ${service.id} | ${status}\n`;
        
        if (service.description) {
            message += `   📝 ${service.description.substring(0, 50)}${service.description.length > 50 ? '...' : ''}\n`;
        }
        
        message += `\n`;
    });
    
    message += `📊 *المعلومات:*\n`;
    message += `• إجمالي الخدمات: ${allServices.length}\n`;
    message += `• الخدمات المفعلة: ${allServices.filter(s => s.isActive).length}\n`;
    message += `• الخدمات المتاحة: ${allServices.filter(s => s.stock > 0).length}`;
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

function askForBroadcast(chatId) {
    adminBot.sendMessage(chatId,
        `📢 *إرسال إشعار جماعي*\n\n` +
        `الرجاء إرسال الرسالة التي تريد إرسالها لجميع المستخدمين:\n\n` +
        `📌 *ملاحظات:*\n` +
        `• يمكنك استخدام Markdown\n` +
        `• الإشعار يصل لـ ${users.size} مستخدم\n` +
        `• لا يمكن التراجع عن الإرسال`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء الإرسال']],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }
    );
}

async function sendBroadcast(chatId, message) {
    if (!message || message.trim() === '') {
        adminBot.sendMessage(chatId, '❌ يجب إدخال رسالة للإرسال');
        return;
    }
    
    adminBot.sendMessage(chatId, `⏳ جاري إرسال الإشعار لـ ${users.size} مستخدم...`);
    
    let successCount = 0;
    let failCount = 0;
    let current = 0;
    const totalUsers = users.size;
    
    for (const [userId, user] of users) {
        current++;
        
        try {
            await chargingBot.sendMessage(userId, message, {
                parse_mode: 'Markdown'
            });
            successCount++;
            
            // تحديث حالة الإرسال كل 10 مستخدمين
            if (current % 10 === 0) {
                adminBot.sendMessage(chatId,
                    `📤 الإرسال جارٍ...\n` +
                    `✅ تم: ${successCount} | ❌ فشل: ${failCount}\n` +
                    `📊 التقدم: ${current}/${totalUsers}`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            // تأخير لتجنب حظر تيليغرام
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            failCount++;
            console.error(`❌ فشل إرسال للمستخدم ${userId}:`, error.message);
        }
    }
    
    const resultText = `✅ *تم الانتهاء من الإرسال الجماعي*\n\n` +
                      `📊 *النتائج:*\n` +
                      `• ✅ ناجح: ${successCount} مستخدم\n` +
                      `• ❌ فاشل: ${failCount} مستخدم\n` +
                      `• 📊 النسبة: ${((successCount / totalUsers) * 100).toFixed(1)}%\n\n` +
                      `⏱️ الوقت: ${new Date().toLocaleString('ar-SA')}`;
    
    adminBot.sendMessage(chatId, resultText, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

// ========== معالجة Callback Queries المحسنة ==========

adminBot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const adminId = chatId;
    
    console.log(`🔘 ضغط على زر: ${data} من الإدمن ${adminId}`);
    
    try {
        // فك تشفير بيانات الطلب من الـ callback_data
        if (data.startsWith('confirm_deposit_')) {
            await handleConfirmDeposit(callbackQuery, data, adminId, messageId);
        } else if (data.startsWith('reject_deposit_')) {
            await handleRejectDeposit(callbackQuery, data, adminId, messageId);
        } else if (data.startsWith('complete_')) {
            await handleCompleteOrder(callbackQuery, data, adminId, messageId);
        } else if (data.startsWith('cancel_')) {
            await handleCancelOrder(callbackQuery, data, adminId, messageId);
        } else if (data.startsWith('note_')) {
            await handleAddNote(callbackQuery, data, adminId, messageId);
        } else {
            adminBot.answerCallbackQuery(callbackQuery.id, {
                text: '❌ أمر غير معروف'
            });
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة Callback:', error);
        adminBot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ حدث خطأ في المعالجة'
        });
    }
});

async function handleConfirmDeposit(callbackQuery, data, adminId, messageId) {
    const orderId = data.replace('confirm_deposit_', '');
    const order = orders.get(orderId);
    
    if (!order) {
        adminBot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ الطلب غير موجود'
        });
        return;
    }
    
    if (order.status !== 'waiting_payment') {
        adminBot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ الطلب تم معالجته مسبقاً'
        });
        return;
    }
    
    // تحديث حالة الطلب
    order.status = 'completed';
    order.adminAction = 'confirmed';
    order.adminId = adminId;
    order.updatedAt = new Date();
    order.notes += `\n✅ تم التأكيد بواسطة ${adminId} في ${new Date().toLocaleString('ar-SA')}`;
    
    // إضافة الرصيد للمستخدم
    const user = getUser(order.userId);
    user.balance += order.amount;
    user.totalSpent += order.amount;
    saveUser(user);
    
    // تسجيل التدقيق
    logOrderAudit(orderId, 'deposit_confirmed', adminId, { amount: order.amount });
    
    // إرسال إشعار للمستخدم
    try {
        await chargingBot.sendMessage(order.userId,
            `✅ *تم تأكيد شحن رصيدك بنجاح*\n\n` +
            `💰 المبلغ: *${order.amount}$*\n` +
            `💳 الرصيد الجديد: *${user.balance}$*\n` +
            `🆔 رقم الطلب: \`${order.orderId}\`\n` +
            `📅 وقت التأكيد: ${new Date().toLocaleString('ar-SA')}\n\n` +
            `🎉 يمكنك الآن شراء الخدمات من "🎮 الخدمات"`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error(`❌ فشل إرسال إشعار للمستخدم ${order.userId}:`, error.message);
    }
    
    // تحديث رسالة الأدمن
    await adminBot.editMessageText(
        `✅ *تم تأكيد الشحن بنجاح*\n\n` +
        `👤 المستخدم: @${order.username}\n` +
        `🆔 ID: \`${order.userId}\`\n` +
        `💰 المبلغ: *${order.amount}$*\n` +
        `💳 الرصيد المضاف: *${order.amount}$*\n` +
        `🆔 رقم الطلب: \`${order.orderId}\`\n` +
        `👨‍💼 تم بواسطة: ${adminId}\n` +
        `📅 وقت التأكيد: ${new Date().toLocaleString('ar-SA')}`,
        {
            chat_id: adminId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );
    
    adminBot.answerCallbackQuery(callbackQuery.id, {
        text: '✅ تم تأكيد الدفع وإضافة الرصيد'
    });
}

async function handleRejectDeposit(callbackQuery, data, adminId, messageId) {
    const orderId = data.replace('reject_deposit_', '');
    const order = orders.get(orderId);
    
    if (!order) {
        adminBot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ الطلب غير موجود'
        });
        return;
    }
    
    if (order.status !== 'waiting_payment') {
        adminBot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ الطلب تم معالجته مسبقاً'
        });
        return;
    }
    
    // تحديث حالة الطلب
    order.status = 'cancelled';
    order.adminAction = 'rejected';
    order.adminId = adminId;
    order.updatedAt = new Date();
    order.notes += `\n❌ تم الرفض بواسطة ${adminId} في ${new Date().toLocaleString('ar-SA')}`;
    
    // تسجيل التدقيق
    logOrderAudit(orderId, 'deposit_rejected', adminId, { amount: order.amount });
    
    // إرسال إشعار للمستخدم
    try {
        await chargingBot.sendMessage(order.userId,
            `❌ *فشل تأكيد الدفع*\n\n` +
            `💰 المبلغ: *${order.amount}$*\n` +
            `🆔 رقم الطلب: \`${order.orderId}\`\n` +
            `📅 وقت الرفض: ${new Date().toLocaleString('ar-SA')}\n\n` +
            `ℹ️ *الأسباب المحتملة:*\n` +
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
        console.error(`❌ فشل إرسال إشعار للمستخدم ${order.userId}:`, error.message);
    }
    
    // تحديث رسالة الأدمن
    await adminBot.editMessageText(
        `❌ *تم رفض طلب الشحن*\n\n` +
        `👤 المستخدم: @${order.username}\n` +
        `🆔 ID: \`${order.userId}\`\n` +
        `💰 المبلغ: *${order.amount}$*\n` +
        `🆔 رقم الطلب: \`${order.orderId}\`\n` +
        `👨‍💼 تم بواسطة: ${adminId}\n` +
        `📅 وقت الرفض: ${new Date().toLocaleString('ar-SA')}\n\n` +
        `📝 *ملاحظة:*\nتم إبلاغ المستخدم بالرفض ويمكنه المحاولة مرة أخرى.`,
        {
            chat_id: adminId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );
    
    adminBot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ تم رفض الدفع وإعلام المستخدم'
    });
}

async function handleCompleteOrder(callbackQuery, data, adminId, messageId) {
    const orderId = data.replace('complete_', '');
    const order = orders.get(orderId);
    
    if (!order) {
        adminBot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ الطلب غير موجود'
        });
        return;
    }
    
    if (order.status !== 'pending') {
        adminBot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ الطلب تم معالجته مسبقاً'
        });
        return;
    }
    
    // تحديث حالة الطلب
    order.status = 'completed';
    order.adminAction = 'completed';
    order.adminId = adminId;
    order.updatedAt = new Date();
    order.notes += `\n✅ تم الإكمال بواسطة ${adminId} في ${new Date().toLocaleString('ar-SA')}`;
    
    // تسجيل التدقيق
    logOrderAudit(orderId, 'service_completed', adminId, { service: order.serviceName });
    
    // إرسال إشعار للمستخدم
    try {
        await chargingBot.sendMessage(order.userId,
            `✅ *تم إكمال طلبك بنجاح*\n\n` +
            `🎮 الخدمة: *${order.serviceName}*\n` +
            `💰 المبلغ: *${order.amount}$*\n` +
            `🆔 رقم الطلب: \`${order.orderId}\`\n` +
            `🎮 ID اللعبة: \`${order.gameId}\`\n` +
            `📅 وقت الإكمال: ${new Date().toLocaleString('ar-SA')}\n\n` +
            `🎉 *تمت العملية بنجاح!*\n` +
            `يمكنك التحقق من حسابك في اللعبة الآن.`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error(`❌ فشل إرسال إشعار للمستخدم ${order.userId}:`, error.message);
    }
    
    // تحديث رسالة الأدمن
    await adminBot.editMessageText(
        `✅ *تم إكمال طلب الخدمة*\n\n` +
        `👤 المستخدم: @${order.username}\n` +
        `🆔 ID: \`${order.userId}\`\n` +
        `🎮 الخدمة: *${order.serviceName}*\n` +
        `💰 السعر: *${order.amount}$*\n` +
        `🎮 ID اللعبة: \`${order.gameId}\`\n` +
        `🆔 رقم الطلب: \`${order.orderId}\`\n` +
        `👨‍💼 تم بواسطة: ${adminId}\n` +
        `📅 وقت الإكمال: ${new Date().toLocaleString('ar-SA')}`,
        {
            chat_id: adminId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );
    
    adminBot.answerCallbackQuery(callbackQuery.id, {
        text: '✅ تم إكمال الطلب'
    });
}

async function handleCancelOrder(callbackQuery, data, adminId, messageId) {
    const orderId = data.replace('cancel_', '');
    const order = orders.get(orderId);
    
    if (!order) {
        adminBot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ الطلب غير موجود'
        });
        return;
    }
    
    if (order.status !== 'pending') {
        adminBot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ الطلب تم معالجته مسبقاً'
        });
        return;
    }
    
    // تحديث حالة الطلب
    order.status = 'cancelled';
    order.adminAction = 'cancelled';
    order.adminId = adminId;
    order.updatedAt = new Date();
    order.notes += `\n❌ تم الإلغاء بواسطة ${adminId} في ${new Date().toLocaleString('ar-SA')}`;
    
    // إرجاع المبلغ للمستخدم
    const user = getUser(order.userId);
    user.balance += order.amount;
    saveUser(user);
    
    // تسجيل التدقيق
    logOrderAudit(orderId, 'service_cancelled', adminId, { service: order.serviceName });
    
    // إرسال إشعار للمستخدم
    try {
        await chargingBot.sendMessage(order.userId,
            `❌ *تم إلغاء طلبك*\n\n` +
            `🎮 الخدمة: *${order.serviceName}*\n` +
            `💰 المبلغ: *${order.amount}$*\n` +
            `🆔 رقم الطلب: \`${order.orderId}\`\n` +
            `📅 وقت الإلغاء: ${new Date().toLocaleString('ar-SA')}\n\n` +
            `💳 *تم إرجاع المبلغ:*\n` +
            `تم إرجاع *${order.amount}$* إلى رصيدك\n` +
            `💰 رصيدك الحالي: *${user.balance}$*\n\n` +
            `ℹ️ *للإستفسار:*\nتواصل مع الدعم الفني`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error(`❌ فشل إرسال إشعار للمستخدم ${order.userId}:`, error.message);
    }
    
    // تحديث رسالة الأدمن
    await adminBot.editMessageText(
        `❌ *تم إلغاء طلب الخدمة*\n\n` +
        `👤 المستخدم: @${order.username}\n` +
        `🆔 ID: \`${order.userId}\`\n` +
        `🎮 الخدمة: *${order.serviceName}*\n` +
        `💰 السعر: *${order.amount}$*\n` +
        `🆔 رقم الطلب: \`${order.orderId}\`\n` +
        `💳 تم إرجاع المبلغ: *${order.amount}$*\n` +
        `👨‍💼 تم بواسطة: ${adminId}\n` +
        `📅 وقت الإلغاء: ${new Date().toLocaleString('ar-SA')}`,
        {
            chat_id: adminId,
            message_id: messageId,
            parse_mode: 'Markdown'
        }
    );
    
    adminBot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ تم إلغاء الطلب وإرجاع المبلغ'
    });
}

async function handleAddNote(callbackQuery, data, adminId, messageId) {
    const orderId = data.replace('note_', '');
    const order = orders.get(orderId);
    
    if (!order) {
        adminBot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ الطلب غير موجود'
        });
        return;
    }
    
    adminBot.answerCallbackQuery(callbackQuery.id, {
        text: '📝 قم بإرسال الملاحظة الآن'
    });
    
    // نطلب من الأدمن إرسال الملاحظة
    adminBot.sendMessage(adminId,
        `📝 *إضافة ملاحظة للطلب*\n\n` +
        `🆔 رقم الطلب: \`${order.orderId}\`\n` +
        `👤 المستخدم: @${order.username}\n` +
        `💰 المبلغ: ${order.amount}$\n\n` +
        `الرجاء إرسال الملاحظة:`,
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

// ========== تشغيل النظام ==========

console.log('🚀 بدء تشغيل نظام البوتات المتطور...');
console.log('🤖 بوت الشحن: @Diamouffbot');
console.log('👑 بوت الإدارة: @otzhabot');
console.log(`👤 المسؤول الرئيسي: ${ADMIN_ID}`);
console.log(`👤 المسؤول الثانوي: ${SECOND_ADMIN_ID}`);

// تهيئة الخدمات
initializeServices();

console.log('✅ تم تهيئة جميع الخدمات');
console.log('📁 نظام تخزين البيانات جاهز');
console.log('🔧 نظام نقل الصور مفعل');
console.log('🔔 جميع الطلبات تصل مباشرة إلى بوت التحكم!');

// إرسال رسالة بدء التشغيل للمدراء
setTimeout(() => {
    try {
        adminBot.sendMessage(ADMIN_ID, 
            '✅ *نظام البوتات يعمل بنجاح*\n\n' +
            '🤖 البوت الأول: @Diamouffbot\n' +
            '👑 البوت الثاني: @otzhabot\n' +
            '📊 النظام جاهز لاستقبال الطلبات\n' +
            '⏱️ ' + new Date().toLocaleString('ar-SA'),
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.log('⚠️ لا يمكن إرسال رسالة بدء التشغيل للمسؤول');
    }
}, 3000);

// كود ليبقى السيرفر نشطاً
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
                body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    padding: 50px; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .container { 
                    background: rgba(255,255,255,0.1); 
                    padding: 30px; 
                    border-radius: 15px; 
                    backdrop-filter: blur(10px);
                    max-width: 600px; 
                    margin: 0 auto; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }
                h1 { 
                    font-size: 2.5em; 
                    margin-bottom: 20px; 
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                }
                .status { 
                    background: rgba(0,255,0,0.2); 
                    padding: 15px; 
                    border-radius: 10px; 
                    margin: 20px 0; 
                    border: 2px solid #00ff00;
                }
                .bot-info { 
                    background: rgba(255,255,255,0.1); 
                    padding: 15px; 
                    border-radius: 10px; 
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 نظام بوتات Free Fire</h1>
                <div class="status">
                    <h2>✅ النظام يعمل بنجاح</h2>
                    <p>${new Date().toLocaleString('ar-SA')}</p>
                </div>
                <div class="bot-info">
                    <h3>🤖 بوت الشحن</h3>
                    <p>@Diamouffbot</p>
                </div>
                <div class="bot-info">
                    <h3>👑 بوت الإدارة</h3>
                    <p>@otzhabot</p>
                </div>
                <p>📊 المستخدمين: ${users.size} | الطلبات: ${orders.size}</p>
            </div>
        </body>
        </html>
    `);
});

server.listen(PORT, () => {
    console.log(`🌐 السيرفر يعمل على المنفذ: ${PORT}`);
    console.log(`🔗 رابط المراقبة: http://localhost:${PORT}`);
});

// إضافة معالج للأخطاء غير المتوقعة
process.on('uncaughtException', (error) => {
    console.error('🚨 خطأ غير متوقع:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 وعد مرفوض غير معالج:', reason);
});

// دالة للحفاظ على النظام نشطاً
setInterval(() => {
    console.log(`🔄 النظام نشط | المستخدمين: ${users.size} | الطلبات: ${orders.size} | ${new Date().toLocaleString('ar-SA')}`);
}, 300000); // كل 5 دقائق

console.log('🎯 النظام جاهز بالكامل ومحسن!');
