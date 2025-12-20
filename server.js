const TelegramBot = require('node-telegram-bot-api');

// === إعداد التوكنات ===
const CHARGING_BOT_TOKEN = '8223596744:AAGHOMQ3Sjk3-X_Z7eXXnL5drAXaHXglLFg';
const ADMIN_BOT_TOKEN = '8216188569:AAEEA1q_os_6XfSJrUDLDkkQxZXh-3OMAVU';

// === إعداد المدراء ===
const ADMIN_ID = 7656412227;
const SECOND_ADMIN_ID = 7450109529;

// إنشاء البوتات
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

const users = new Map();
const services = new Map();
const orders = new Map();
const userActions = new Map();
const adminActions = new Map();

// ========== إضافة خدمات افتراضية ==========

function initializeDefaultServices() {
    // مسح أي خدمات موجودة مسبقاً
    services.clear();
    
    // إضافة خدمات Free Fire الأساسية
    addService('جواهر فري فاير 100+10', 'اشتري 100 جوهرة واحصل على 10 مجاناً', 1, 100, true);
    addService('جواهر فري فاير 500+50', 'اشتري 500 جوهرة واحصل على 50 مجاناً', 5, 50, true);
    addService('جواهر فري فاير 1000+100', 'اشتري 1000 جوهرة واحصل على 100 مجاناً', 10, 30, true);
    
    // إضافة خدمات إضافية
    addService('جواهر فري فاير 2000+200', 'اشتري 2000 جوهرة واحصل على 200 مجاناً', 20, 20, true);
    addService('جواهر فري فاير 5000+500', 'اشتري 5000 جوهرة واحصل على 500 مجاناً', 45, 10, true);
    addService('جواهر فري فاير 10000+1000', 'اشتري 10000 جوهرة واحصل على 1000 مجاناً', 85, 5, true);
    
    // إضافة خدمات خاصة
    addService('باس موسم فري فاير', 'اشتراك باس الموسم الكامل', 8, 50, true);
    addService('حزمة أسلحة نادرة', 'حزمة أسلبة مميزة مع سكنات', 15, 25, true);
    addService('بطاقات تطوير الشخصية', 'بطاقات لرفع مستوى الشخصيات', 3, 100, true);
    
    console.log(`✅ تم تهيئة ${services.size} خدمة افتراضية`);
}

function addService(name, description, price, stock, isActive = true) {
    const serviceId = `SERV${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
    const service = {
        id: serviceId,
        name: name,
        description: description,
        price: parseFloat(price),
        stock: parseInt(stock),
        isActive: isActive,
        createdAt: new Date(),
        category: 'Free Fire',
        imageUrl: '',
        priority: 1
    };
    services.set(serviceId, service);
    console.log(`✅ تمت إضافة خدمة: ${name} - ${price}$`);
    return service;
}

function updateService(serviceId, updates) {
    const service = services.get(serviceId);
    if (service) {
        Object.assign(service, updates);
        service.updatedAt = new Date();
        services.set(serviceId, service);
        console.log(`🔄 تم تحديث الخدمة: ${service.name}`);
        return service;
    }
    return null;
}

function deleteService(serviceId) {
    const service = services.get(serviceId);
    if (service) {
        services.delete(serviceId);
        console.log(`🗑️ تم حذف الخدمة: ${service.name}`);
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
        console.log(`🔄 تم تغيير حالة الخدمة ${service.name} إلى: ${service.isActive ? 'مفعل' : 'معطل'}`);
        return service;
    }
    return null;
}

// ========== دوال المساعدة ==========

function getUser(userId) {
    if (!users.has(userId)) {
        users.set(userId, {
            userId: userId,
            username: '',
            balance: 0,
            discount: 0,
            ordersCount: 0,
            isActive: true,
            lastActive: new Date()
        });
    }
    return users.get(userId);
}

function saveUser(user) {
    users.set(user.userId, user);
    return user;
}

// ========== بوت الشحن (واجهة المستخدم) ==========

chargingBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username || 'بدون';
    
    console.log(`📩 رسالة من ${chatId} (${username}): ${text}`);
    
    let user = getUser(chatId);
    user.username = username;
    user.lastActive = new Date();
    saveUser(user);
    
    try {
        const action = userActions.get(chatId);
        if (action) {
            await handleUserAction(chatId, text, action, msg, user);
            return;
        }
        
        if (text === '/start') {
            showMainMenu(chatId, user);
        } else if (text === '💳 شحن رصيد') {
            // ... (نفس كود الشحن السابق)
        } else if (text === '🎮 الخدمات') {
            showServicesMenu(chatId, user);
        } else if (text === '🎮 عرض الخدمات') {
            showServicesMenu(chatId, user);
        } else if (text === '📋 طلباتي') {
            // ... (نفس كود الطلبات السابق)
        } else if (text === '💰 رصيدي') {
            // ... (نفس كود الرصيد السابق)
        } else if (text === '🏠 الرئيسية') {
            showMainMenu(chatId, user);
        } else if (text.startsWith('🎮 ')) {
            const serviceName = text.replace('🎮 ', '');
            selectService(chatId, user, serviceName);
        } else {
            showMainMenu(chatId, user);
        }
    } catch (error) {
        console.error('❌ خطأ في بوت الشحن:', error);
    }
});

function showMainMenu(chatId, user) {
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['💳 شحن رصيد', '🎮 عرض الخدمات'],
                ['📋 طلباتي', '💰 رصيدي'],
                ['🏠 الرئيسية']
            ],
            resize_keyboard: true
        }
    };
    
    const activeServices = Array.from(services.values()).filter(s => s.isActive).length;
    
    chargingBot.sendMessage(chatId, 
        `🎮 *مرحباً بك في متجر جواهر فري فاير*\n\n` +
        `💰 رصيدك: ${user.balance}$\n` +
        `🎯 خصمك: ${user.discount}%\n` +
        `📦 الخدمات المتاحة: ${activeServices}\n\n` +
        `اختر من القائمة:`,
        { parse_mode: 'Markdown', ...keyboard }
    );
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
    
    let message = `🎮 *قائمة الخدمات المتاحة*\n\n` +
                 `💰 رصيدك الحالي: *${user.balance}$*\n` +
                 `🎯 خصمك الحالي: *${user.discount}%*\n\n` +
                 `📊 *الخدمات:*\n\n`;
    
    // تقسيم الخدمات إلى مجموعات حسب التصنيف
    const categories = {};
    activeServices.forEach(service => {
        if (!categories[service.category]) {
            categories[service.category] = [];
        }
        categories[service.category].push(service);
    });
    
    Object.keys(categories).forEach(category => {
        message += `📁 *${category}:*\n`;
        categories[category].forEach(service => {
            const finalPrice = service.price * (1 - (user.discount / 100));
            const priceText = user.discount > 0 ? 
                `~~${service.price}$~~ *${finalPrice.toFixed(2)}$*` : 
                `*${service.price}$*`;
            
            message += `🎮 ${service.name}\n`;
            message += `   💰 ${priceText} | 📦 ${service.stock} متبقي\n`;
            message += `   📝 ${service.description}\n\n`;
        });
    });
    
    const keyboardButtons = [];
    activeServices.forEach(service => {
        const finalPrice = service.price * (1 - (user.discount / 100));
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

function selectService(chatId, user, serviceName) {
    // إزالة السعر من اسم الخدمة إذا كان موجوداً
    const cleanServiceName = serviceName.split(' - ')[0];
    
    const service = Array.from(services.values())
        .find(s => s.name === cleanServiceName && s.isActive && s.stock > 0);
    
    if (!service) {
        chargingBot.sendMessage(chatId,
            '❌ *هذه الخدمة غير متاحة حالياً*\n\n' +
            'الرجاء اختيار خدمة أخرى من القائمة.',
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
            `💵 سعر الخدمة: ${finalPrice.toFixed(2)}$\n\n` +
            `الرجاء شحن رصيد أولاً.`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    chargingBot.sendMessage(chatId,
        `🎮 *${service.name}*\n\n` +
        `📝 ${service.description}\n` +
        `💰 السعر: ${finalPrice.toFixed(2)}$\n` +
        `📦 المخزون: ${service.stock}\n\n` +
        `🆔 *الرجاء إرسال ID الخاص بك في فري فاير:*`,
        { parse_mode: 'Markdown' }
    );
    
    userActions.set(chatId, {
        type: 'awaiting_game_id',
        serviceId: service.id,
        serviceName: service.name,
        price: finalPrice,
        username: user.username
    });
}

// ========== بوت الإدارة (إدارة الخدمات) ==========

adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // التحقق من صلاحية الأدمن
    if (chatId !== ADMIN_ID && chatId !== SECOND_ADMIN_ID) {
        adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول');
        return;
    }
    
    console.log(`👑 رسالة أدمن من ${chatId}: ${text}`);
    
    try {
        const action = adminActions.get(chatId);
        if (action) {
            await handleAdminAction(chatId, text, action, msg);
            return;
        }
        
        if (text === '/start' || text === '/admin' || text === '🏠 الرئيسية') {
            showAdminMainMenu(chatId);
        } else if (text === '📊 الإحصائيات') {
            showAdminStats(chatId);
        } else if (text === '📦 إدارة الخدمات') {
            showServicesManagement(chatId);
        } else if (text === '🆕 إضافة خدمة') {
            startAddServiceProcess(chatId);
        } else if (text === '📋 قائمة الخدمات') {
            showAllServicesList(chatId);
        } else if (text === '🎮 عرض الخدمات للمستخدمين') {
            showServicesPreview(chatId);
        } else if (text === '🔄 تحديث') {
            showAdminMainMenu(chatId);
        } else if (text.startsWith('✏️ تعديل ')) {
            const serviceId = text.replace('✏️ تعديل ', '');
            startEditServiceProcess(chatId, serviceId);
        } else if (text.startsWith('🗑️ حذف ')) {
            const serviceId = text.replace('🗑️ حذف ', '');
            confirmDeleteService(chatId, serviceId);
        } else if (text.startsWith('🔁 تفعيل/تعطيل ')) {
            const serviceId = text.replace('🔁 تفعيل/تعطيل ', '');
            toggleService(chatId, serviceId);
        }
    } catch (error) {
        console.error('❌ خطأ في بوت الإدارة:', error);
    }
});

function showAdminMainMenu(chatId) {
    const activeServices = Array.from(services.values()).filter(s => s.isActive).length;
    const totalServices = services.size;
    const lowStockServices = Array.from(services.values()).filter(s => s.stock < 10).length;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['📦 إدارة الخدمات', '📋 قائمة الخدمات'],
                ['🆕 إضافة خدمة', '🎮 عرض الخدمات للمستخدمين'],
                ['📊 الإحصائيات', '🔄 تحديث']
            ],
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId,
        `👑 *لوحة تحكم إدارة الخدمات*\n\n` +
        `📊 *إحصائيات الخدمات:*\n` +
        `• إجمالي الخدمات: ${totalServices}\n` +
        `• الخدمات المفعلة: ${activeServices}\n` +
        `• مخزون منخفض: ${lowStockServices}\n\n` +
        `🎯 *اختر من القائمة:*`,
        { parse_mode: 'Markdown', ...keyboard }
    );
}

function showServicesManagement(chatId) {
    const allServices = Array.from(services.values())
        .sort((a, b) => b.createdAt - a.createdAt);
    
    if (allServices.length === 0) {
        adminBot.sendMessage(chatId,
            '📭 *لا توجد خدمات حالياً*\n\n' +
            'اضغط على "🆕 إضافة خدمة" لبدء إضافة خدمات جديدة.',
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
                 `📊 إجمالي الخدمات: ${allServices.length}\n\n` +
                 `🎯 *الخدمات الأخيرة:*\n\n`;
    
    // عرض 10 خدمات فقط في القائمة الرئيسية
    const recentServices = allServices.slice(0, 10);
    
    const keyboardButtons = [];
    
    recentServices.forEach(service => {
        const status = service.isActive ? '🟢' : '🔴';
        const stockStatus = service.stock > 10 ? '🟢' :
                          service.stock > 0 ? '🟡' : '🔴';
        
        message += `${status} *${service.name}*\n`;
        message += `   🆔 ${service.id}\n`;
        message += `   💰 ${service.price}$ | 📦 ${stockStatus} ${service.stock}\n`;
        message += `   📅 ${service.createdAt.toLocaleDateString('ar-SA')}\n\n`;
        
        // إضافة أزرار التحكم لكل خدمة
        keyboardButtons.push([
            `✏️ تعديل ${service.id}`,
            `🗑️ حذف ${service.id}`
        ]);
        keyboardButtons.push([
            `🔁 تفعيل/تعطيل ${service.id}`
        ]);
    });
    
    keyboardButtons.push(['📋 قائمة الخدمات', '🆕 إضافة خدمة']);
    keyboardButtons.push(['🏠 الرئيسية']);
    
    const keyboard = {
        reply_markup: {
            keyboard: keyboardButtons,
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function showAllServicesList(chatId) {
    const allServices = Array.from(services.values())
        .sort((a, b) => a.priority - b.priority);
    
    if (allServices.length === 0) {
        adminBot.sendMessage(chatId, '📭 *لا توجد خدمات*', { parse_mode: 'Markdown' });
        return;
    }
    
    let message = `📋 *قائمة جميع الخدمات*\n\n`;
    
    // تجميع الخدمات حسب التصنيف
    const servicesByCategory = {};
    allServices.forEach(service => {
        if (!servicesByCategory[service.category]) {
            servicesByCategory[service.category] = [];
        }
        servicesByCategory[service.category].push(service);
    });
    
    Object.keys(servicesByCategory).forEach(category => {
        message += `📁 *${category}:*\n`;
        servicesByCategory[category].forEach((service, index) => {
            const status = service.isActive ? '🟢' : '🔴';
            const stockStatus = service.stock > 10 ? '🟢' :
                              service.stock > 0 ? '🟡' : '🔴';
            
            message += `${index + 1}. ${status} ${service.name}\n`;
            message += `   🆔: ${service.id}\n`;
            message += `   💰: ${service.price}$ | 📦: ${stockStatus} ${service.stock}\n`;
            message += `   📝: ${service.description.substring(0, 50)}${service.description.length > 50 ? '...' : ''}\n\n`;
        });
    });
    
    message += `📊 *الملخص:*\n`;
    message += `• إجمالي الخدمات: ${allServices.length}\n`;
    message += `• مفعلة: ${allServices.filter(s => s.isActive).length}\n`;
    message += `• مخزون منخفض: ${allServices.filter(s => s.stock < 10).length}`;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['✏️ تعديل خدمات', '🗑️ حذف خدمات'],
                ['📦 إدارة الخدمات', '🏠 الرئيسية']
            ],
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function startAddServiceProcess(chatId) {
    adminBot.sendMessage(chatId,
        `🆕 *إضافة خدمة جديدة*\n\n` +
        `📝 *الخطوة 1/5:*\n` +
        `أدخل اسم الخدمة:\n` +
        `مثال: "جواهر فري فاير 1000+100"`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء']],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }
    );
    
    adminActions.set(chatId, {
        type: 'awaiting_service_name',
        step: 1
    });
}

async function handleAdminAction(chatId, text, action, msg) {
    console.log(`🔄 معالجة إجراء أدمن: ${action.type}`);
    
    try {
        if (text === '🚫 إلغاء' || text === '🏠 الرئيسية') {
            adminActions.delete(chatId);
            showAdminMainMenu(chatId);
            return;
        }
        
        switch(action.type) {
            case 'awaiting_service_name':
                await handleServiceName(chatId, text, action);
                break;
                
            case 'awaiting_service_description':
                await handleServiceDescription(chatId, text, action);
                break;
                
            case 'awaiting_service_price':
                await handleServicePrice(chatId, text, action);
                break;
                
            case 'awaiting_service_stock':
                await handleServiceStock(chatId, text, action);
                break;
                
            case 'awaiting_service_category':
                await handleServiceCategory(chatId, text, action);
                break;
                
            case 'awaiting_edit_field':
                await handleEditField(chatId, text, action);
                break;
                
            case 'confirming_delete':
                await handleConfirmDelete(chatId, text, action);
                break;
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة إجراء الأدمن:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة مرة أخرى');
        adminActions.delete(chatId);
        showAdminMainMenu(chatId);
    }
}

async function handleServiceName(chatId, text, action) {
    if (!text || text.trim().length < 3) {
        adminBot.sendMessage(chatId, '❌ اسم الخدمة يجب أن يكون على الأقل 3 أحرف');
        return;
    }
    
    adminActions.set(chatId, {
        type: 'awaiting_service_description',
        step: 2,
        serviceData: { name: text.trim() }
    });
    
    adminBot.sendMessage(chatId,
        `✅ *تم حفظ الاسم*\n\n` +
        `📝 *الخطوة 2/5:*\n` +
        `أدخل وصف الخدمة:\n` +
        `مثال: "اشتري 1000 جوهرة واحصل على 100 مجاناً"`,
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

async function handleServiceDescription(chatId, text, action) {
    if (!text || text.trim().length < 10) {
        adminBot.sendMessage(chatId, '❌ الوصف يجب أن يكون على الأقل 10 أحرف');
        return;
    }
    
    action.serviceData.description = text.trim();
    action.type = 'awaiting_service_price';
    action.step = 3;
    
    adminActions.set(chatId, action);
    
    adminBot.sendMessage(chatId,
        `✅ *تم حفظ الوصف*\n\n` +
        `📝 *الخطوة 3/5:*\n` +
        `أدخل سعر الخدمة (بالدولار):\n` +
        `مثال: "10" أو "5.5"`,
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

async function handleServicePrice(chatId, text, action) {
    const price = parseFloat(text);
    
    if (isNaN(price) || price <= 0) {
        adminBot.sendMessage(chatId, '❌ السعر يجب أن يكون رقماً أكبر من 0');
        return;
    }
    
    action.serviceData.price = price;
    action.type = 'awaiting_service_stock';
    action.step = 4;
    
    adminActions.set(chatId, action);
    
    adminBot.sendMessage(chatId,
        `✅ *تم حفظ السعر*\n\n` +
        `📝 *الخطوة 4/5:*\n` +
        `أدخل كمية المخزون:\n` +
        `مثال: "100"`,
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

async function handleServiceStock(chatId, text, action) {
    const stock = parseInt(text);
    
    if (isNaN(stock) || stock < 0) {
        adminBot.sendMessage(chatId, '❌ المخزون يجب أن يكون رقماً صحيحاً غير سالب');
        return;
    }
    
    action.serviceData.stock = stock;
    action.type = 'awaiting_service_category';
    action.step = 5;
    
    adminActions.set(chatId, action);
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['Free Fire', 'باقات خاصة'],
                ['أسلحة', 'شخصيات'],
                ['عروض محدودة', '🚫 إلغاء']
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
}

async function handleServiceCategory(chatId, text, action) {
    if (!text || text === '🚫 إلغاء') {
        adminActions.delete(chatId);
        showAdminMainMenu(chatId);
        return;
    }
    
    const serviceData = action.serviceData;
    serviceData.category = text;
    serviceData.isActive = true;
    serviceData.priority = services.size + 1;
    
    // إضافة الخدمة
    const service = addService(
        serviceData.name,
        serviceData.description,
        serviceData.price,
        serviceData.stock,
        true
    );
    
    service.category = serviceData.category;
    service.priority = serviceData.priority;
    
    adminActions.delete(chatId);
    
    adminBot.sendMessage(chatId,
        `🎉 *تم إضافة الخدمة بنجاح!*\n\n` +
        `🎮 الاسم: ${service.name}\n` +
        `📝 الوصف: ${service.description}\n` +
        `💰 السعر: ${service.price}$\n` +
        `📦 المخزون: ${service.stock}\n` +
        `📁 التصنيف: ${service.category}\n` +
        `🆔 المعرف: ${service.id}\n\n` +
        `✅ الخدمة الآن متاحة للمستخدمين`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['📦 إدارة الخدمات', '🆕 إضافة خدمة'], ['🏠 الرئيسية']],
                resize_keyboard: true
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
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                ['✏️ تعديل الاسم', '✏️ تعديل الوصف'],
                ['✏️ تعديل السعر', '✏️ تعديل المخزون'],
                ['✏️ تعديل التصنيف', '✏️ تعديل الأولوية'],
                ['🚫 إلغاء']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId,
        `✏️ *تعديل الخدمة*\n\n` +
        `🎮 ${service.name}\n` +
        `🆔 ${service.id}\n\n` +
        `اختر ما تريد تعديله:`,
        {
            parse_mode: 'Markdown',
            ...keyboard
        }
    );
    
    adminActions.set(chatId, {
        type: 'awaiting_edit_selection',
        serviceId: serviceId
    });
}

// معالجة اختيار الحقل للتعديل
adminBot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    
    if (data.startsWith('edit_field_')) {
        const [_, serviceId, field] = data.split('_');
        await handleEditFieldSelection(chatId, serviceId, field);
    }
});

async function handleEditFieldSelection(chatId, serviceId, field) {
    const service = services.get(serviceId);
    if (!service) return;
    
    let fieldName = '';
    let example = '';
    
    switch(field) {
        case 'name':
            fieldName = 'الاسم';
            example = 'جواهر فري فاير 1000+100';
            break;
        case 'description':
            fieldName = 'الوصف';
            example = 'اشتري 1000 جوهرة واحصل على 100 مجاناً';
            break;
        case 'price':
            fieldName = 'السعر';
            example = '10 أو 5.5';
            break;
        case 'stock':
            fieldName = 'المخزون';
            example = '100';
            break;
        case 'category':
            fieldName = 'التصنيف';
            example = 'Free Fire';
            break;
        case 'priority':
            fieldName = 'الأولوية';
            example = '1 (رقم أقل يعني عرض أول)';
            break;
    }
    
    adminBot.sendMessage(chatId,
        `✏️ *تعديل ${fieldName}*\n\n` +
        `الخدمة: ${service.name}\n` +
        `القيمة الحالية: ${service[field]}\n\n` +
        `أدخل القيمة الجديدة:\n` +
        `مثال: ${example}`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🚫 إلغاء']],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }
    );
    
    adminActions.set(chatId, {
        type: 'awaiting_edit_field',
        serviceId: serviceId,
        field: field
    });
}

async function handleEditField(chatId, text, action) {
    const service = services.get(action.serviceId);
    if (!service) {
        adminActions.delete(chatId);
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        return;
    }
    
    let newValue;
    let isValid = true;
    let errorMessage = '';
    
    switch(action.field) {
        case 'name':
            if (text.length < 3) {
                isValid = false;
                errorMessage = '❌ الاسم يجب أن يكون على الأقل 3 أحرف';
            } else {
                newValue = text.trim();
            }
            break;
            
        case 'description':
            if (text.length < 10) {
                isValid = false;
                errorMessage = '❌ الوصف يجب أن يكون على الأقل 10 أحرف';
            } else {
                newValue = text.trim();
            }
            break;
            
        case 'price':
            newValue = parseFloat(text);
            if (isNaN(newValue) || newValue <= 0) {
                isValid = false;
                errorMessage = '❌ السعر يجب أن يكون رقماً أكبر من 0';
            }
            break;
            
        case 'stock':
            newValue = parseInt(text);
            if (isNaN(newValue) || newValue < 0) {
                isValid = false;
                errorMessage = '❌ المخزون يجب أن يكون رقماً صحيحاً غير سالب';
            }
            break;
            
        case 'category':
            newValue = text.trim();
            break;
            
        case 'priority':
            newValue = parseInt(text);
            if (isNaN(newValue) || newValue < 1) {
                isValid = false;
                errorMessage = '❌ الأولوية يجب أن تكون رقماً أكبر من 0';
            }
            break;
    }
    
    if (!isValid) {
        adminBot.sendMessage(chatId, errorMessage);
        return;
    }
    
    // تحديث الخدمة
    const updates = {};
    updates[action.field] = newValue;
    updateService(action.serviceId, updates);
    
    adminActions.delete(chatId);
    
    adminBot.sendMessage(chatId,
        `✅ *تم التعديل بنجاح*\n\n` +
        `🎮 ${service.name}\n` +
        `🔄 ${action.field}: ${newValue}\n\n` +
        `📅 تم التحديث: ${new Date().toLocaleString('ar-SA')}`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['📦 إدارة الخدمات', '🏠 الرئيسية']],
                resize_keyboard: true
            }
        }
    );
}

function confirmDeleteService(chatId, serviceId) {
    const service = services.get(serviceId);
    
    if (!service) {
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        return;
    }
    
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
    
    adminActions.set(chatId, {
        type: 'confirming_delete',
        serviceId: serviceId
    });
}

async function handleConfirmDelete(chatId, text, action) {
    if (text === '✅ نعم، احذف الخدمة') {
        const service = services.get(action.serviceId);
        
        if (service) {
            const serviceName = service.name;
            deleteService(action.serviceId);
            
            adminBot.sendMessage(chatId,
                `🗑️ *تم حذف الخدمة بنجاح*\n\n` +
                `🎮 ${serviceName}\n` +
                `🆔 ${action.serviceId}\n\n` +
                `✅ تم الحذف بشكل نهائي`,
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
        adminBot.sendMessage(chatId, '✅ تم إلغاء عملية الحذف');
    }
    
    adminActions.delete(chatId);
}

function toggleService(chatId, serviceId) {
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

function showServicesPreview(chatId) {
    const activeServices = Array.from(services.values())
        .filter(s => s.isActive)
        .sort((a, b) => a.priority - b.priority);
    
    if (activeServices.length === 0) {
        adminBot.sendMessage(chatId,
            '📭 *لا توجد خدمات مفعلة حالياً*\n\n' +
            'يجب تفعيل الخدمات أولاً ليتم عرضها للمستخدمين.',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    let message = `👁️ *عرض الخدمات كما يراها المستخدمون*\n\n` +
                 `📊 عدد الخدمات: ${activeServices.length}\n\n` +
                 `🎮 *قائمة الخدمات:*\n\n`;
    
    activeServices.forEach((service, index) => {
        message += `${index + 1}. ${service.name}\n`;
        message += `   💰 ${service.price}$ | 📦 ${service.stock}\n`;
        message += `   📝 ${service.description}\n\n`;
    });
    
    message += `📱 *ملاحظة:*\nسيتم عرض هذه الخدمات للمستخدمين مع أزرار الاختيار.`;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                activeServices.slice(0, 3).map(s => `🎮 ${s.name}`),
                activeServices.slice(3, 6).map(s => `🎮 ${s.name}`),
                ['🏠 الرئيسية']
            ].filter(row => row.length > 0),
            resize_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...keyboard
    });
}

function showAdminStats(chatId) {
    const totalServices = services.size;
    const activeServices = Array.from(services.values()).filter(s => s.isActive).length;
    const lowStockServices = Array.from(services.values()).filter(s => s.stock < 10).length;
    const outOfStockServices = Array.from(services.values()).filter(s => s.stock === 0).length;
    
    // تجميع حسب التصنيف
    const categories = {};
    services.forEach(service => {
        if (!categories[service.category]) {
            categories[service.category] = 0;
        }
        categories[service.category]++;
    });
    
    let message = `📊 *إحصائيات الخدمات*\n\n` +
                 `📈 *الأساسية:*\n` +
                 `• إجمالي الخدمات: ${totalServices}\n` +
                 `• مفعلة: ${activeServices}\n` +
                 `• مخزون منخفض: ${lowStockServices}\n` +
                 `• نفذ المخزون: ${outOfStockServices}\n\n` +
                 `📁 *حسب التصنيف:*\n`;
    
    Object.keys(categories).forEach(category => {
        message += `• ${category}: ${categories[category]} خدمة\n`;
    });
    
    // الخدمات الأكثر مبيعاً (محاكاة)
    const topServices = Array.from(services.values())
        .sort((a, b) => b.price - a.price)
        .slice(0, 5);
    
    message += `\n💰 *أعلى الأسعار:*\n`;
    topServices.forEach((service, index) => {
        message += `${index + 1}. ${service.name}: ${service.price}$\n`;
    });
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['📦 إدارة الخدمات', '🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

// ========== تشغيل النظام ==========

console.log('🚀 بدء تشغيل نظام إدارة الخدمات...');
console.log('🤖 بوت المستخدمين: جاهز');
console.log('👑 بوت الإدارة: جاهز');

// تهيئة الخدمات الافتراضية
initializeDefaultServices();

console.log('✅ تم تحميل الخدمات:');
services.forEach(service => {
    console.log(`   🎮 ${service.name} - ${service.price}$ (${service.stock} متبقي)`);
});

console.log('🔧 نظام إدارة الخدمات جاهز!');
console.log('🎯 الميزات المتاحة:');
console.log('   1. عرض الخدمات للمستخدمين');
console.log('   2. إضافة خدمات جديدة');
console.log('   3. تعديل الخدمات الحالية');
console.log('   4. حذف الخدمات');
console.log('   5. تفعيل/تعطيل الخدمات');
console.log('   6. إدارة المخزون');
console.log('   7. عرض إحصائيات مفصلة');

// إرسال رسالة بدء التشغيل للمدراء
setTimeout(() => {
    try {
        const serviceCount = services.size;
        adminBot.sendMessage(ADMIN_ID, 
            '✅ *نظام إدارة الخدمات يعمل بنجاح*\n\n' +
            `📦 عدد الخدمات: ${serviceCount}\n` +
            `🎯 جاهز للاستخدام\n` +
            `⏱️ ${new Date().toLocaleString('ar-SA')}\n\n` +
            `استخدم "📦 إدارة الخدمات" للبدء`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.log('⚠️ لا يمكن إرسال رسالة بدء التشغيل للمسؤول');
    }
}, 2000);

// كود ليبقى السيرفر نشطاً
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`نظام إدارة خدمات Free Fire يعمل - الخدمات: ${services.size}`);
});

server.listen(PORT, () => {
    console.log(`🌐 السيرفر يعمل على المنفذ: ${PORT}`);
});

console.log('🎉 النظام جاهز بالكامل!');
