require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

// إعداد التوكنات
const CHARGING_BOT_TOKEN = '8223596744:AAGHOMQ3Sjk3-X_Z7eXXnL5drAXaHXglLFg';
const ADMIN_BOT_TOKEN = '8216188569:AAEEA1q_os_6XfSJrUDLDkkQxZXh-3OMAVU';
const ADMIN_ID = 7450109529;
const PAYMENT_ID = '953936100';

// إنشاء البوتات
const chargingBot = new TelegramBot(CHARGING_BOT_TOKEN, { polling: true });
const adminBot = new TelegramBot(ADMIN_BOT_TOKEN, { polling: true });

// اتصال MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/charging_bot', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// تعريف الموديلات
const userSchema = new mongoose.Schema({
    userId: { type: Number, required: true, unique: true },
    username: String,
    balance: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    lastActive: { type: Date, default: Date.now },
    commissionRate: { type: Number, default: 3 },
    referrals: [Number]
});

const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    quantity: { type: Number, default: 0 },
    stock: { type: Number, required: true },
    category: String
});

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    userId: { type: Number, required: true },
    username: String,
    serviceId: mongoose.Schema.Types.ObjectId,
    serviceName: String,
    amount: Number,
    gameId: String,
    status: { 
        type: String, 
        enum: ['pending', 'completed', 'cancelled', 'waiting_payment'], 
        default: 'pending' 
    },
    paymentProof: String,
    adminResponse: String,
    createdAt: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
    userId: Number,
    type: { type: String, enum: ['deposit', 'withdrawal', 'transfer', 'purchase'] },
    amount: Number,
    description: String,
    date: { type: Date, default: Date.now }
});

// إنشاء الموديلات
const User = mongoose.model('User', userSchema);
const Service = mongoose.model('Service', serviceSchema);
const Order = mongoose.model('Order', orderSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

// متغيرات مؤقتة للعمليات
const adminActions = new Map();
const userActions = new Map();

// ========== إدارة البوت (لوحة التحكم) ==========

// لوحة تحكم الأدمن الرئيسية
function showAdminPanel(chatId) {
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['📊 الإحصائيات', '👤 منح رصيد'],
                ['🎁 إضافة خدمة', '📋 الطلبات'],
                ['💰 طلبات الشحن', '🏷️ منح خصم'],
                ['📢 إرسال إشعار', '⚙️ الإعدادات']
            ],
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId, 'مرحباً بك في لوحة التحكم الإدارية', keyboard);
}

// إحصائيات النظام
async function getStatistics() {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ 
        lastActive: { $gt: new Date(Date.now() - 7*24*60*60*1000) } 
    });
    const inactiveUsers = totalUsers - activeUsers;
    
    const totalDeposits = await Transaction.aggregate([
        { $match: { type: 'deposit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalJewels = await Transaction.aggregate([
        { $match: { type: 'purchase', description: /جواهر|جوهرة/i } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    return {
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalDeposits: totalDeposits[0]?.total || 0,
        totalJewels: totalJewels[0]?.total || 0
    };
}

// معالجة رسائل الأدمن
adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (chatId != ADMIN_ID) {
        return adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول إلى هذه اللوحة');
    }
    
    try {
        switch(text) {
            case '/start':
                showAdminPanel(chatId);
                break;
                
            case '📊 الإحصائيات':
                const stats = await getStatistics();
                const statsMessage = `
📈 **إحصائيات النظام**:
👥 عدد المستخدمين: ${stats.totalUsers}
✅ المستخدمين النشطين: ${stats.activeUsers}
❌ المستخدمين غير النشطين: ${stats.inactiveUsers}
💰 إجمالي الشحنات: ${stats.totalDeposits}$
💎 الجواهر المشحونة: ${stats.totalJewels}
                `;
                adminBot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
                break;
                
            case '👤 منح رصيد':
                adminBot.sendMessage(chatId, 'الرجاء إرسال قيمة الرصيد الذي تود إرساله (بالدولار):');
                adminActions.set(chatId, 'awaiting_balance_amount');
                break;
                
            case '🎁 إضافة خدمة':
                adminBot.sendMessage(chatId, 'أرسل اسم الخدمة الجديدة:');
                adminActions.set(chatId, 'awaiting_service_name');
                break;
                
            case '📋 الطلبات':
                await showPendingOrders(chatId);
                break;
                
            case '💰 طلبات الشحن':
                await showDepositRequests(chatId);
                break;
                
            case '🏷️ منح خصم':
                adminBot.sendMessage(chatId, 'أرسل يوزر أو ID المستخدم لمنحه الخصم:');
                adminActions.set(chatId, 'awaiting_discount_user');
                break;
                
            default:
                const action = adminActions.get(chatId);
                if (action) {
                    await handleAdminAction(chatId, text, action);
                }
                break;
        }
    } catch (error) {
        console.error('Admin bot error:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ أثناء المعالجة');
    }
});

// معالجة إجراءات الأدمن
async function handleAdminAction(chatId, text, action) {
    switch(action) {
        case 'awaiting_balance_amount':
            const amount = parseFloat(text);
            if (isNaN(amount) || amount <= 0) {
                adminBot.sendMessage(chatId, '❌ قيمة غير صحيحة. الرجاء إرسال رقم صحيح');
                return;
            }
            adminActions.set(chatId, { type: 'send_balance', amount });
            adminBot.sendMessage(chatId, `✅ تم تحديد المبلغ: ${amount}$\nالآن أرسل يوزر أو ID المستخدم:`);
            break;
            
        case 'awaiting_service_name':
            adminActions.set(chatId, { type: 'add_service', name: text });
            adminBot.sendMessage(chatId, 'أرسل وصف الخدمة:');
            break;
            
        case 'awaiting_discount_user':
            const discountUser = await findUser(text);
            if (!discountUser) {
                adminBot.sendMessage(chatId, '❌ المستخدم غير موجود');
                return;
            }
            adminActions.set(chatId, { type: 'set_discount', userId: discountUser.userId });
            adminBot.sendMessage(chatId, `أرسل نسبة الخصم للمستخدم ${discountUser.username || discountUser.userId} (مثال: 10):`);
            break;
            
        default:
            if (action.type === 'send_balance') {
                const user = await findUser(text);
                if (!user) {
                    adminBot.sendMessage(chatId, '❌ المستخدم غير موجود');
                    return;
                }
                
                user.balance += action.amount;
                await user.save();
                
                await Transaction.create({
                    userId: user.userId,
                    type: 'transfer',
                    amount: action.amount,
                    description: `تحويل من الأدمن`
                });
                
                // إرسال إشعار للمستخدم
                try {
                    await chargingBot.sendMessage(user.userId, `🎉 تم استلام ${action.amount}$ في رصيدك\nرصيدك الحالي: ${user.balance}$`);
                } catch (e) {}
                
                adminBot.sendMessage(chatId, '✅ تم التحويل بنجاح');
                adminActions.delete(chatId);
                showAdminPanel(chatId);
                
            } else if (action.type === 'add_service') {
                if (action.description) {
                    const price = parseFloat(text);
                    if (isNaN(price) || price <= 0) {
                        adminBot.sendMessage(chatId, '❌ سعر غير صحيح');
                        return;
                    }
                    action.price = price;
                    adminBot.sendMessage(chatId, 'أرسل كمية الخدمة المتاحة:');
                } else if (action.price) {
                    const quantity = parseInt(text);
                    if (isNaN(quantity) || quantity <= 0) {
                        adminBot.sendMessage(chatId, '❌ كمية غير صحيحة');
                        return;
                    }
                    
                    const service = await Service.create({
                        name: action.name,
                        description: action.description,
                        price: action.price,
                        stock: quantity,
                        quantity: 0
                    });
                    
                    adminBot.sendMessage(chatId, `✅ تم إضافة الخدمة:\n📦 ${service.name}\n💰 ${service.price}$\n📊 الكمية: ${service.stock}`);
                    adminActions.delete(chatId);
                    showAdminPanel(chatId);
                } else {
                    action.description = text;
                    adminBot.sendMessage(chatId, 'أرسل سعر الخدمة (بالدولار):');
                }
                
            } else if (action.type === 'set_discount') {
                const discount = parseInt(text);
                if (isNaN(discount) || discount < 0 || discount > 100) {
                    adminBot.sendMessage(chatId, '❌ نسبة خصم غير صحيحة');
                    return;
                }
                
                const user = await User.findOne({ userId: action.userId });
                user.discount = discount;
                await user.save();
                
                adminBot.sendMessage(chatId, `✅ تم منح خصم ${discount}% للمستخدم`);
                adminActions.delete(chatId);
                showAdminPanel(chatId);
            }
            break;
    }
}

// ========== بوت الشحن (للمستخدمين) ==========

// لوحة المستخدم الرئيسية
function showUserPanel(chatId) {
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '🎮 الخدمات'],
                ['📋 طلباتي', '👥 التسويق بالعمولة'],
                ['📢 قناة البوت', 'ℹ️ المساعدة']
            ],
            resize_keyboard: true
        }
    };
    
    chargingBot.sendMessage(chatId, 'مرحباً بك في بوت الشحن', keyboard);
}

// التسجيل التلقائي للمستخدمين
async function registerUser(userId, username) {
    let user = await User.findOne({ userId });
    if (!user) {
        user = await User.create({
            userId,
            username,
            balance: 0,
            isActive: true,
            lastActive: new Date()
        });
    } else {
        user.lastActive = new Date();
        user.isActive = true;
        await user.save();
    }
    return user;
}

// معالجة رسائل المستخدمين
chargingBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username;
    
    // تسجيل/تحديث المستخدم
    await registerUser(chatId, username);
    
    try {
        switch(text) {
            case '/start':
                showUserPanel(chatId);
                break;
                
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
                chargingBot.sendMessage(chatId, '📢 قناة البوت: @otzhabot');
                break;
                
            case 'ℹ️ المساعدة':
                chargingBot.sendMessage(chatId, 'للتواصل مع الدعم:\n@Diamouffbot');
                break;
                
            default:
                const action = userActions.get(chatId);
                if (action) {
                    await handleUserAction(chatId, text, action, msg);
                }
                break;
        }
    } catch (error) {
        console.error('Charging bot error:', error);
        chargingBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة لاحقاً');
    }
});

// عرض طرق الدفع
function showDepositMethods(chatId) {
    const message = `
💳 **شحن الرصيد**

الرجاء إدخال كمية الدولار التي تريد شحنها:
مثال: 5
(5 تعني 5 دولار)

*يتم الدفع عبر Binance فقط*
    `;
    
    chargingBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    userActions.set(chatId, 'awaiting_deposit_amount');
}

// معالجة إجراءات المستخدم
async function handleUserAction(chatId, text, action, msg) {
    switch(action) {
        case 'awaiting_deposit_amount':
            const amount = parseFloat(text);
            if (isNaN(amount) || amount <= 0) {
                chargingBot.sendMessage(chatId, '❌ قيمة غير صحيحة');
                return;
            }
            
            const depositMessage = `
💰 **طلب شحن رصيد**
المبلغ: ${amount}$

📋 **إرشادات الدفع**:
1. قم بتحويل ${amount}$ إلى العنوان التالي:
ID: ${PAYMENT_ID}

2. بعد التحويل، أرسل صورة إيصال الدفع هنا

⚠️ **ملاحظة**: 
- الرصيد سيضاف بعد تأكيد الإدارة
- تأكد من صحة العنوان
            `;
            
            chargingBot.sendMessage(chatId, depositMessage, { parse_mode: 'Markdown' });
            userActions.set(chatId, { type: 'deposit', amount });
            break;
            
        case 'awaiting_service_selection':
            const serviceId = text;
            const service = await Service.findById(serviceId);
            if (!service) {
                chargingBot.sendMessage(chatId, '❌ الخدمة غير متوفرة');
                return;
            }
            
            const user = await User.findOne({ userId: chatId });
            const finalPrice = service.price * (1 - (user.discount / 100));
            
            if (user.balance < finalPrice) {
                chargingBot.sendMessage(chatId, `❌ رصيدك غير كافي\nرصيدك: ${user.balance}$\nسعر الخدمة: ${finalPrice}$`);
                userActions.delete(chatId);
                showUserPanel(chatId);
                return;
            }
            
            userActions.set(chatId, { type: 'service_purchase', serviceId, price: finalPrice });
            chargingBot.sendMessage(chatId, `🎮 ${service.name}\n💰 السعر بعد الخصم: ${finalPrice}$\n\nأرسل ID الخاص بك في اللعبة:`);
            break;
            
        case 'awaiting_game_id':
            const gameId = text;
            const purchaseAction = userActions.get(chatId);
            
            const orderId = `ORD${Date.now()}${Math.floor(Math.random()*1000)}`;
            const order = await Order.create({
                orderId,
                userId: chatId,
                username: msg.from.username,
                serviceId: purchaseAction.serviceId,
                serviceName: purchaseAction.serviceName,
                amount: purchaseAction.price,
                gameId,
                status: 'pending'
            });
            
            // خصم المبلغ من رصيد المستخدم
            const buyer = await User.findOne({ userId: chatId });
            buyer.balance -= purchaseAction.price;
            await buyer.save();
            
            // تسجيل العملية
            await Transaction.create({
                userId: chatId,
                type: 'purchase',
                amount: purchaseAction.price,
                description: `شراء خدمة: ${purchaseAction.serviceName}`
            });
            
            // إرسال الطلب للأدمن
            const orderMessage = `
📦 **طلب جديد**
👤 المستخدم: @${msg.from.username || 'بدون'} (${chatId})
🎮 الخدمة: ${purchaseAction.serviceName}
💰 السعر: ${purchaseAction.price}$
🎮 ID اللعبة: ${gameId}
🆔 رقم الطلب: ${orderId}

للتحقق:
/complete_${orderId}
/cancel_${orderId}
            `;
            
            adminBot.sendMessage(ADMIN_ID, orderMessage);
            
            chargingBot.sendMessage(chatId, `✅ تم تقديم طلبك\nرقم الطلب: ${orderId}\nستتم معالجة طلبك خلال 24 ساعة`);
            userActions.delete(chatId);
            showUserPanel(chatId);
            break;
            
        default:
            if (action.type === 'deposit' && msg.photo) {
                // معالجة صورة الإيصال
                const photoId = msg.photo[msg.photo.length - 1].file_id;
                
                const depositOrderId = `DEP${Date.now()}${Math.floor(Math.random()*1000)}`;
                const depositOrder = await Order.create({
                    orderId: depositOrderId,
                    userId: chatId,
                    username: msg.from.username,
                    amount: action.amount,
                    status: 'waiting_payment',
                    paymentProof: photoId
                });
                
                // إرسال للأدمن للموافقة
                const depositMessage = `
💳 **طلب شحن جديد**
👤 المستخدم: @${msg.from.username || 'بدون'} (${chatId})
💰 المبلغ: ${action.amount}$
🆔 رقم الطلب: ${depositOrderId}

📸 وصل الدفع:
                `;
                
                await adminBot.sendPhoto(ADMIN_ID, photoId, {
                    caption: depositMessage,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '✅ تأكيد الدفع', callback_data: `confirm_deposit_${depositOrderId}` },
                                { text: '❌ رفض الدفع', callback_data: `reject_deposit_${depositOrderId}` }
                            ]
                        ]
                    }
                });
                
                chargingBot.sendMessage(chatId, '✅ تم استلام إيصال الدفع\nسيتم مراجعة طلبك من قبل الإدارة');
                userActions.delete(chatId);
                showUserPanel(chatId);
            }
            break;
    }
}

// ========== دوال المساعدة ==========

async function findUser(identifier) {
    if (!isNaN(identifier)) {
        return await User.findOne({ userId: parseInt(identifier) });
    } else if (identifier.startsWith('@')) {
        return await User.findOne({ username: identifier.substring(1) });
    }
    return null;
}

async function showPendingOrders(chatId) {
    const orders = await Order.find({ status: 'pending' }).limit(20);
    
    if (orders.length === 0) {
        adminBot.sendMessage(chatId, '📭 لا توجد طلبات معلقة');
        return;
    }
    
    let message = '📋 **الطلبات المعلقة**:\n\n';
    orders.forEach((order, index) => {
        message += `${index + 1}. ${order.serviceName}\n`;
        message += `👤 @${order.username || 'بدون'} (${order.userId})\n`;
        message += `🎮 ID: ${order.gameId}\n`;
        message += `💰 ${order.amount}$\n`;
        message += `🆔 ${order.orderId}\n\n`;
    });
    
    adminBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function showDepositRequests(chatId) {
    const deposits = await Order.find({ status: 'waiting_payment' }).limit(20);
    
    if (deposits.length === 0) {
        adminBot.sendMessage(chatId, '💳 لا توجد طلبات شحن معلقة');
        return;
    }
    
    deposits.forEach(async (deposit) => {
        const message = `
💳 **طلب شحن**
👤 المستخدم: ${deposit.userId}
💰 المبلغ: ${deposit.amount}$
🆔 رقم الطلب: ${deposit.orderId}
        `;
        
        await adminBot.sendPhoto(chatId, deposit.paymentProof, {
            caption: message,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ تأكيد', callback_data: `confirm_deposit_${deposit.orderId}` },
                        { text: '❌ رفض', callback_data: `reject_deposit_${deposit.orderId}` }
                    ]
                ]
            }
        });
    });
}

async function showServices(chatId) {
    const services = await Service.find({ stock: { $gt: 0 } });
    
    if (services.length === 0) {
        chargingBot.sendMessage(chatId, '⚠️ لا توجد خدمات متاحة حالياً');
        return;
    }
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: services.map(service => [
                {
                    text: `${service.name} - ${service.price}$`,
                    callback_data: `service_${service._id}`
                }
            ])
        }
    };
    
    chargingBot.sendMessage(chatId, '🎮 **الخدمات المتاحة**:', {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

async function showUserOrders(chatId) {
    const orders = await Order.find({ userId: chatId }).sort({ createdAt: -1 }).limit(10);
    
    if (orders.length === 0) {
        chargingBot.sendMessage(chatId, '📭 لا توجد طلبات سابقة');
        return;
    }
    
    let message = '📋 **طلباتك السابقة**:\n\n';
    orders.forEach((order, index) => {
        let statusEmoji = '⏳';
        if (order.status === 'completed') statusEmoji = '✅';
        if (order.status === 'cancelled') statusEmoji = '❌';
        
        message += `${statusEmoji} ${order.serviceName || 'شحن رصيد'}\n`;
        message += `💰 ${order.amount}$\n`;
        message += `📅 ${order.createdAt.toLocaleDateString()}\n`;
        message += `الحالة: ${getStatusText(order.status)}\n`;
        message += `🆔 ${order.orderId}\n\n`;
    });
    
    chargingBot.sendMessage(chatId, message);
}

function showCommissionInfo(chatId) {
    const message = `
👥 **التسويق بالعمولة**

معدل عمولتك: 3%

🎯 **كيف تعمل**:
1. شارك رابط الإحالة الخاص بك
2. كل عملية شراء من المستخدمين الذين جلبهم
3. تحصل على 3% من قيمة كل عملية

📊 **لجني الأرباح**:
- شجع الآخرين على التسجيل عبر رابطك
- كلما زاد عدد المستخدمين، زادت أرباحك

💡 **نصائح**:
- شارك البوت في مجموعات الألعاب
- قدم تجربتك الإيجابية
- ساعد الآخرين في استخدام البوت
    `;
    
    chargingBot.sendMessage(chatId, message);
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

chargingBot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    
    if (data.startsWith('service_')) {
        const serviceId = data.split('_')[1];
        const service = await Service.findById(serviceId);
        
        if (!service) {
            chargingBot.answerCallbackQuery(callbackQuery.id, { text: 'الخدمة غير متوفرة' });
            return;
        }
        
        const message = `
🎮 **${service.name}**
💰 السعر: ${service.price}$

${service.description || ''}

📝 **تفاصيل الخدمة**:
⏱️ البدأ : 0 / 24 ساعة
🟢 تعمل لجميع أنحاء العالم
📊 الكمية المتاحة: ${service.stock}

🆔 **ضع ID الخاص بك في اللعبة**
        `;
        
        chargingBot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        userActions.set(chatId, { 
            type: 'service_purchase', 
            serviceId, 
            serviceName: service.name,
            price: service.price 
        });
        userActions.set(chatId, 'awaiting_game_id');
        
        chargingBot.answerCallbackQuery(callbackQuery.id);
    }
});

adminBot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    
    if (data.startsWith('confirm_deposit_')) {
        const orderId = data.split('_')[2];
        const order = await Order.findOne({ orderId });
        
        if (!order) {
            adminBot.answerCallbackQuery(callbackQuery.id, { text: 'الطلب غير موجود' });
            return;
        }
        
        const user = await User.findOne({ userId: order.userId });
        user.balance += order.amount;
        await user.save();
        
        order.status = 'completed';
        order.adminResponse = 'تم التأكيد';
        await order.save();
        
        await Transaction.create({
            userId: order.userId,
            type: 'deposit',
            amount: order.amount,
            description: 'شحن رصيد'
        });
        
        // إعلام المستخدم
        try {
            await chargingBot.sendMessage(order.userId, `✅ تم تأكيد شحن الرصيد\nتم إضافة ${order.amount}$ إلى رصيدك\nرصيدك الحالي: ${user.balance}$`);
        } catch (e) {}
        
        adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم تأكيد الدفع' });
        adminBot.editMessageText('✅ تم تأكيد الدفع', {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id
        });
        
    } else if (data.startsWith('reject_deposit_')) {
        const orderId = data.split('_')[2];
        const order = await Order.findOne({ orderId });
        
        if (!order) {
            adminBot.answerCallbackQuery(callbackQuery.id, { text: 'الطلب غير موجود' });
            return;
        }
        
        order.status = 'cancelled';
        order.adminResponse = 'تم الرفض';
        await order.save();
        
        // إعلام المستخدم
        try {
            await chargingBot.sendMessage(order.userId, '❌ لم يتم تأكيد الدفع\nالرجاء إعادة المحاولة أو التواصل مع الدعم');
        } catch (e) {}
        
        adminBot.answerCallbackQuery(callbackQuery.id, { text: 'تم رفض الدفع' });
        adminBot.editMessageText('❌ تم رفض الدفع', {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id
        });
    }
});

// ========== تشغيل السيرفر ==========

const PORT = process.env.PORT || 3000;

// Middleware للتحقق من الصحة
chargingBot.on('polling_error', (error) => {
    console.error('Charging bot polling error:', error);
});

adminBot.on('polling_error', (error) => {
    console.error('Admin bot polling error:', error);
});

console.log('✅ نظام البوتات يعمل بنجاح');
console.log('🤖 بوت الشحن: @Diamouffbot');
console.log('👑 بوت الإدارة: @otzhabot');
console.log(`🚀 السيرفر يعمل على المنفذ: ${PORT}`);
