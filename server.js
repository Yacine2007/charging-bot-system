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
const userStates = new Map();
const adminStates = new Map();

// ========== تهيئة الخدمات الافتراضية ==========
function initializeServices() {
    services.clear();
    
    const defaultServices = [
        { id: 'SERV1', name: 'جواهر فري فاير 100+10', description: 'اشتري 100 جوهرة واحصل على 10 مجاناً', price: 1, stock: 100, category: 'جواهر', isActive: true },
        { id: 'SERV2', name: 'جواهر فري فاير 500+50', description: 'اشتري 500 جوهرة واحصل على 50 مجاناً', price: 5, stock: 50, category: 'جواهر', isActive: true },
        { id: 'SERV3', name: 'جواهر فري فاير 1000+100', description: 'اشتري 1000 جوهرة واحصل على 100 مجاناً', price: 10, stock: 30, category: 'جواهر', isActive: true },
        { id: 'SERV4', name: 'باس موسم فري فاير', description: 'اشتراك باس الموسم الكامل', price: 8, stock: 50, category: 'باقات', isActive: true },
        { id: 'SERV5', name: 'حزمة أسلبة نادرة', description: 'حزمة أسلبة مميزة مع سكنات', price: 15, stock: 25, category: 'أسلبة', isActive: true }
    ];
    
    defaultServices.forEach(service => {
        services.set(service.id, {
            id: service.id,
            name: service.name,
            description: service.description,
            price: service.price,
            stock: service.stock,
            category: service.category,
            isActive: service.isActive,
            createdAt: new Date(),
            priority: services.size + 1
        });
    });
    
    console.log(`✅ تم تهيئة ${services.size} خدمة افتراضية`);
}

// ========== دوال إدارة الخدمات المحسنة ==========

function addService(name, description, price, stock, category = 'عام') {
    const serviceId = `SERV${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const service = {
        id: serviceId,
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        stock: parseInt(stock),
        category: category.trim(),
        isActive: true,
        createdAt: new Date(),
        priority: services.size + 1
    };
    
    services.set(serviceId, service);
    console.log(`✅ تمت إضافة خدمة: ${name} (${serviceId})`);
    return service;
}

function updateService(serviceId, updates) {
    const service = services.get(serviceId);
    if (service) {
        // تحديث الحقول المطلوبة فقط
        Object.keys(updates).forEach(key => {
            if (key in service) {
                if (key === 'price') {
                    service[key] = parseFloat(updates[key]);
                } else if (key === 'stock') {
                    service[key] = parseInt(updates[key]);
                } else {
                    service[key] = updates[key];
                }
            }
        });
        
        service.updatedAt = new Date();
        services.set(serviceId, service);
        console.log(`✅ تم تحديث خدمة: ${service.name} (${serviceId})`);
        return service;
    }
    return null;
}

function deleteService(serviceId) {
    const service = services.get(serviceId);
    if (service) {
        const deleted = services.delete(serviceId);
        if (deleted) {
            console.log(`✅ تم حذف خدمة: ${service.name} (${serviceId})`);
            return true;
        }
    }
    console.log(`❌ فشل حذف الخدمة: ${serviceId}`);
    return false;
}

function toggleServiceStatus(serviceId) {
    const service = services.get(serviceId);
    if (service) {
        service.isActive = !service.isActive;
        service.updatedAt = new Date();
        services.set(serviceId, service);
        console.log(`✅ تم ${service.isActive ? 'تفعيل' : 'تعطيل'} خدمة: ${service.name}`);
        return service;
    }
    return null;
}

// ========== بوت الإدارة المحسن ==========

adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // التحقق من صلاحية الأدمن
    if (![ADMIN_ID, SECOND_ADMIN_ID].includes(chatId)) {
        adminBot.sendMessage(chatId, '❌ ليس لديك صلاحية للوصول');
        return;
    }
    
    console.log(`👑 رسالة أدمن: ${text} من ${chatId}`);
    
    const adminState = adminStates.get(chatId);
    
    if (adminState) {
        await handleAdminState(chatId, text, adminState);
        return;
    }
    
    // معالجة الأوامر الرئيسية
    switch(text) {
        case '/start':
        case '/admin':
        case '🏠 الرئيسية':
            showAdminMainMenu(chatId);
            break;
            
        case '📊 الإحصائيات':
            showAdminStats(chatId);
            break;
            
        case '📦 إدارة الخدمات':
            showServicesManagement(chatId);
            break;
            
        case '🆕 إضافة خدمة':
            startAddServiceProcess(chatId);
            break;
            
        case '📋 قائمة الخدمات':
            showAllServicesList(chatId);
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
            
        case '🔄 تحديث':
            showAdminMainMenu(chatId);
            break;
            
        default:
            // التحقق من أزرار إدارة الخدمات
            if (text && text.startsWith('✏️ تعديل ')) {
                const serviceId = text.replace('✏️ تعديل ', '');
                startEditServiceMenu(chatId, serviceId);
            } else if (text && text.startsWith('🗑️ حذف ')) {
                const serviceId = text.replace('🗑️ حذف ', '');
                startDeleteServiceProcess(chatId, serviceId);
            } else if (text && text.startsWith('🔁 ')) {
                const serviceId = text.replace('🔁 ', '');
                toggleServiceStatusAndNotify(chatId, serviceId);
            } else {
                showAdminMainMenu(chatId);
            }
    }
});

// ========== دوال لوحة التحكم ==========

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
        `📊 *الإحصائيات:*\n` +
        `📦 الخدمات: ${services.size} (${activeServices} مفعلة)\n` +
        `📋 الطلبات النشطة: ${pendingOrders}\n` +
        `👥 المستخدمين: ${users.size}\n\n` +
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
    
    let message = `📦 *إدارة الخدمات*\n\n`;
    message += `📊 إجمالي الخدمات: ${allServices.length}\n`;
    message += `🟢 مفعلة: ${allServices.filter(s => s.isActive).length}\n`;
    message += `🔴 معطلة: ${allServices.filter(s => !s.isActive).length}\n\n`;
    message += `🎯 *اختر خدمة للتحكم:*\n\n`;
    
    // تقسيم الخدمات إلى مجموعات لعرض أفضل
    const serviceChunks = [];
    for (let i = 0; i < allServices.length; i += 5) {
        serviceChunks.push(allServices.slice(i, i + 5));
    }
    
    // عرض أول 10 خدمات فقط لتجنب مشاكل الحجم
    const displayServices = allServices.slice(0, 10);
    
    displayServices.forEach((service, index) => {
        const status = service.isActive ? '🟢' : '🔴';
        const stockStatus = service.stock > 10 ? '🟢' :
                          service.stock > 0 ? '🟡' : '🔴';
        
        message += `${index + 1}. ${status} *${service.name}*\n`;
        message += `   💰 ${service.price}$ | 📦 ${stockStatus} ${service.stock}\n`;
        message += `   🆔 \`${service.id}\`\n\n`;
    });
    
    if (allServices.length > 10) {
        message += `📖 و ${allServices.length - 10} خدمة أخرى...\n\n`;
    }
    
    // إنشاء أزرار الخدمات بشكل ديناميكي
    const keyboardRows = [];
    
    // أزرار التحكم للخدمات (حد أقصى 5 خدمات في الصفحة)
    const pageServices = allServices.slice(0, 5);
    
    pageServices.forEach(service => {
        keyboardRows.push([
            `✏️ تعديل ${service.id}`,
            `🗑️ حذف ${service.id}`
        ]);
        keyboardRows.push([
            `🔁 ${service.id}`
        ]);
    });
    
    keyboardRows.push(['🆕 إضافة خدمة', '📋 قائمة الخدمات']);
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

function showAllServicesList(chatId) {
    const allServices = Array.from(services.values())
        .sort((a, b) => a.priority - b.priority);
    
    if (allServices.length === 0) {
        adminBot.sendMessage(chatId, '📭 *لا توجد خدمات*', { parse_mode: 'Markdown' });
        return;
    }
    
    let message = `📋 *جميع الخدمات*\n\n`;
    
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
            message += `   💰: ${service.price}$ | 📦: ${stockStatus} ${service.stock}\n`;
            message += `   🆔: \`${service.id}\`\n`;
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

// ========== إضافة خدمة جديدة ==========

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

// ========== تعديل الخدمة ==========

function startEditServiceMenu(chatId, serviceId) {
    const service = services.get(serviceId);
    
    if (!service) {
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        return;
    }
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                [`✏️ تعديل اسم ${serviceId}`],
                [`✏️ تعديل وصف ${serviceId}`],
                [`✏️ تعديل سعر ${serviceId}`],
                [`✏️ تعديل مخزون ${serviceId}`],
                [`✏️ تعديل تصنيف ${serviceId}`],
                ['🚫 إلغاء']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };
    
    adminBot.sendMessage(chatId,
        `✏️ *تعديل الخدمة*\n\n` +
        `🎮 ${service.name}\n` +
        `💰 ${service.price}$ | 📦 ${service.stock}\n` +
        `📝 ${service.description}\n` +
        `📁 ${service.category}\n` +
        `🆔 ${service.id}\n\n` +
        `اختر ما تريد تعديله:`,
        {
            parse_mode: 'Markdown',
            ...keyboard
        }
    );
}

// ========== حذف الخدمة ==========

function startDeleteServiceProcess(chatId, serviceId) {
    const service = services.get(serviceId);
    
    if (!service) {
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        return;
    }
    
    adminStates.set(chatId, {
        type: 'deleting_service',
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
        `📁 ${service.category}\n` +
        `🆔 ${service.id}\n\n` +
        `❌ *تحذير:*\n` +
        `• لا يمكن التراجع عن حذف الخدمة\n` +
        `• سيتم حذفها نهائياً من النظام\n` +
        `• لن يتمكن المستخدمون من رؤيتها\n\n` +
        `هل أنت متأكد من الحذف؟`,
        {
            parse_mode: 'Markdown',
            ...keyboard
        }
    );
}

// ========== تفعيل/تعطيل الخدمة ==========

function toggleServiceStatusAndNotify(chatId, serviceId) {
    const service = toggleServiceStatus(serviceId);
    
    if (service) {
        adminBot.sendMessage(chatId,
            `🔄 *تم تغيير حالة الخدمة*\n\n` +
            `🎮 ${service.name}\n` +
            `📊 الحالة: ${service.isActive ? '🟢 مفعل' : '🔴 معطل'}\n` +
            `🆔 ${service.id}\n\n` +
            `✅ تم التحديث بنجاح`,
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

// ========== معالجة حالات الأدمن ==========

async function handleAdminState(chatId, text, state) {
    try {
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
                
            case 'deleting_service':
                await handleDeleteService(chatId, text, state);
                break;
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة حالة الأدمن:', error);
        adminBot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة مرة أخرى');
        adminStates.delete(chatId);
        showAdminMainMenu(chatId);
    }
}

async function handleAddServiceStep(chatId, text, state) {
    switch(state.step) {
        case 1: // اسم الخدمة
            if (!text || text.trim().length < 3) {
                adminBot.sendMessage(chatId, '❌ اسم الخدمة يجب أن يكون على الأقل 3 أحرف');
                return;
            }
            
            state.data.name = text.trim();
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
            if (!text || text.trim().length < 10) {
                adminBot.sendMessage(chatId, '❌ الوصف يجب أن يكون على الأقل 10 أحرف');
                return;
            }
            
            state.data.description = text.trim();
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
                        ['أخرى', '🚫 إلغاء']
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
            if (!['جواهر', 'باقات', 'أسلبة', 'عروض خاصة', 'أخرى'].includes(text)) {
                adminBot.sendMessage(chatId, '❌ اختر تصنيفاً صحيحاً من القائمة');
                return;
            }
            
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
                `🆔 المعرف: \`${service.id}\`\n` +
                `🟢 الحالة: ${service.isActive ? 'مفعلة' : 'معطلة'}\n\n` +
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
    // هذا سيعالج من خلال أزرار محددة لكل حقل
    // سيتم معالجته في الرسائل الرئيسية
}

async function handleDeleteService(chatId, text, state) {
    if (text === '✅ نعم، احذف الخدمة') {
        const service = services.get(state.serviceId);
        
        if (service) {
            const serviceName = service.name;
            const serviceId = state.serviceId;
            
            // حذف الخدمة
            const deleted = deleteService(state.serviceId);
            
            if (deleted) {
                adminStates.delete(chatId);
                
                adminBot.sendMessage(chatId,
                    `🗑️ *تم حذف الخدمة بنجاح*\n\n` +
                    `🎮 ${serviceName}\n` +
                    `🆔 \`${serviceId}\`\n\n` +
                    `✅ تم الحذف بشكل نهائي من النظام`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            keyboard: [['📦 إدارة الخدمات', '🏠 الرئيسية']],
                            resize_keyboard: true
                        }
                    }
                );
            } else {
                adminBot.sendMessage(chatId,
                    '❌ فشل حذف الخدمة، يرجى المحاولة مرة أخرى',
                    { parse_mode: 'Markdown' }
                );
            }
        } else {
            adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        }
    } else {
        adminStates.delete(chatId);
        adminBot.sendMessage(chatId,
            '✅ تم إلغاء عملية الحذف',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [['📦 إدارة الخدمات', '🏠 الرئيسية']],
                    resize_keyboard: true
                }
            }
        );
    }
}

// ========== معالجة أزرار التعديل التفصيلية ==========

adminBot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    
    if (![ADMIN_ID, SECOND_ADMIN_ID].includes(chatId)) {
        adminBot.answerCallbackQuery(callbackQuery.id, { text: '❌ غير مصرح' });
        return;
    }
    
    console.log(`🔘 callback أدمن: ${data}`);
    
    // يمكن إضافة معالجة callbacks هنا إذا لزم الأمر
});

// ========== معالجة أزرار التعديل المباشرة ==========

// سيكون هناك معالج إضافي للرسائل المباشرة للتعديل
// نحتاج إلى إعادة توجيه الأزرار المناسبة

// ========== دوال إضافية للوحة التحكم ==========

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
    
    const activeServices = Array.from(services.values())
        .filter(s => s.isActive).length;
    
    adminBot.sendMessage(chatId,
        `📊 *إحصائيات مفصلة*\n\n` +
        `👥 *المستخدمين:*\n` +
        `• الإجمالي: ${totalUsers}\n` +
        `• النشطين (7 أيام): ${activeUsers}\n` +
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
        `• المفعلة: ${activeServices}\n` +
        `• المعطلة: ${services.size - activeServices}`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🏠 الرئيسية']],
                resize_keyboard: true
            }
        }
    );
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
        const status = order.status === 'pending' ? '⏳' :
                      order.status === 'completed' ? '✅' :
                      order.status === 'cancelled' ? '❌' : '💳';
        
        message += `${index + 1}. ${icon} ${status} ${order.serviceName || 'شحن رصيد'}\n`;
        message += `   👤 @${order.username} | 💰 ${order.amount}$\n`;
        message += `   🆔 ${order.orderId} | 📅 ${order.createdAt.toLocaleDateString('ar-SA')}\n\n`;
    });
    
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
    
    adminBot.sendMessage(chatId,
        `💳 *طلبات الشحن*\n\n` +
        `📊 بانتظار التأكيد: ${depositOrders.length}\n\n` +
        `استخدم الإشعارات المباشرة للتحكم`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [['🏠 الرئيسية']],
                resize_keyboard: true
            }
        }
    );
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
    
    adminBot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [['🏠 الرئيسية']],
            resize_keyboard: true
        }
    });
}

// ========== معالجة أزرار التعديل الخاصة ==========

// معالج إضافي للرسائل التي تبدأ بأنماط محددة
adminBot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (![ADMIN_ID, SECOND_ADMIN_ID].includes(chatId)) return;
    
    // معالجة أزرار تعديل الخدمات التفصيلية
    if (text && text.startsWith('✏️ تعديل اسم ')) {
        const serviceId = text.replace('✏️ تعديل اسم ', '');
        startEditServiceField(chatId, serviceId, 'name');
    } else if (text && text.startsWith('✏️ تعديل وصف ')) {
        const serviceId = text.replace('✏️ تعديل وصف ', '');
        startEditServiceField(chatId, serviceId, 'description');
    } else if (text && text.startsWith('✏️ تعديل سعر ')) {
        const serviceId = text.replace('✏️ تعديل سعر ', '');
        startEditServiceField(chatId, serviceId, 'price');
    } else if (text && text.startsWith('✏️ تعديل مخزون ')) {
        const serviceId = text.replace('✏️ تعديل مخزون ', '');
        startEditServiceField(chatId, serviceId, 'stock');
    } else if (text && text.startsWith('✏️ تعديل تصنيف ')) {
        const serviceId = text.replace('✏️ تعديل تصنيف ', '');
        startEditServiceField(chatId, serviceId, 'category');
    }
});

function startEditServiceField(chatId, serviceId, field) {
    const service = services.get(serviceId);
    
    if (!service) {
        adminBot.sendMessage(chatId, '❌ الخدمة غير موجودة');
        return;
    }
    
    let fieldName = '';
    let example = '';
    
    switch(field) {
        case 'name':
            fieldName = 'الاسم';
            example = 'جواهر فري فاير 5000+500';
            break;
        case 'description':
            fieldName = 'الوصف';
            example = 'اشتري 5000 جوهرة واحصل على 500 مجاناً';
            break;
        case 'price':
            fieldName = 'السعر';
            example = '45 أو 10.5';
            break;
        case 'stock':
            fieldName = 'المخزون';
            example = '50';
            break;
        case 'category':
            fieldName = 'التصنيف';
            example = 'جواهر';
            break;
    }
    
    adminStates.set(chatId, {
        type: 'editing_service_field',
        serviceId: serviceId,
        field: field,
        fieldName: fieldName
    });
    
    adminBot.sendMessage(chatId,
        `✏️ *تعديل ${fieldName}*\n\n` +
        `🎮 الخدمة: ${service.name}\n` +
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
}

// ========== تشغيل النظام ==========

console.log('🚀 بدء تشغيل نظام إدارة الخدمات...');

// تهيئة الخدمات
initializeServices();

console.log('✅ تم تحميل النظام بنجاح!');
console.log(`🤖 بوت الإدارة: جاهز (@otzhabot)`);
console.log(`📊 عدد الخدمات: ${services.size}`);

// إرسال رسالة بدء التشغيل للمدراء
setTimeout(() => {
    try {
        adminBot.sendMessage(ADMIN_ID, 
            '✅ *نظام إدارة الخدمات يعمل*\n\n' +
            `👑 البوت: @otzhabot\n` +
            `📦 الخدمات: ${services.size}\n` +
            `🛠️ الميزات:\n` +
            `• إضافة خدمات جديدة\n` +
            `• تعديل الخدمات\n` +
            `• حذف الخدمات\n` +
            `• تفعيل/تعطيل الخدمات\n\n` +
            `🎯 جاهز للاستخدام!`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.log('⚠️ لا يمكن إرسال رسالة بدء التشغيل للمسؤول');
    }
}, 2000);

// تشغيل سيرفر ويب
const PORT = process.env.PORT || 3000;
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`خدمات Free Fire - ${services.size} خدمة متاحة`);
});

server.listen(PORT, () => {
    console.log(`🌐 السيرفر يعمل على المنفذ: ${PORT}`);
});

console.log('🎉 نظام إدارة الخدمات جاهز بالكامل!');
