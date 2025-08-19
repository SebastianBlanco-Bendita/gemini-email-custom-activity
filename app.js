require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

const GeminiService = require('./services/geminiService');
const SalesforceService = require('./services/salesforceService');
const ActivityService = require('./services/activityService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://code.jquery.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "*.salesforce.com", "*.marketingcloudapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

app.use(compression());
app.use(cors({
    origin: [
        'https://mc.salesforce.com', 
        'https://*.marketingcloudapps.com',
        'https://*.exacttargetapps.com',
        /https:\/\/.*\.marketingcloudapps\.com$/,
        /https:\/\/.*\.exacttargetapps\.com$/
    ],
    credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Servir archivos estáticos
app.use('/public', express.static(path.join(__dirname, 'public')));

// Ruta de salud mejorada
app.get('/health', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
            gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
            salesforce: (process.env.SFMC_CLIENT_ID && process.env.SFMC_CLIENT_SECRET) ? 'configured' : 'missing'
        },
        uptime: process.uptime(),
        memory: process.memoryUsage()
    };
    
    res.status(200).json(health);
});

// Rutas principales de la custom activity
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/config.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'config.json'));
});

// Endpoint para validar la configuración
app.post('/validate', async (req, res) => {
    try {
        console.log('Validating configuration:', JSON.stringify(req.body, null, 2));
        
        const { arguments: args } = req.body;
        
        if (!args || !args.execute || !args.execute.inArguments) {
            return res.status(400).json({
                error: 'Missing arguments structure'
            });
        }

        const inArgs = args.execute.inArguments[0] || {};
        const validation = {
            contactKey: !!inArgs.ContactKey,
            email: !!inArgs.Mail,
            firstName: !!inArgs.FirstName,
            city: !!inArgs.City,
            interestCategory: !!inArgs.InterestCategory
        };

        const isValid = validation.contactKey && validation.email;

        res.json({ 
            valid: isValid,
            message: isValid ? 'Configuration validated successfully' : 'Missing required fields',
            validation,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ 
            error: 'Validation failed', 
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint principal de ejecución
app.post('/execute', async (req, res) => {
    const startTime = Date.now();
    
    try {
        console.log('=== EXECUTING CUSTOM ACTIVITY ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const { 
            inArguments = [],
            activityObjectID,
            journeyId,
            activityId,
            definitionInstanceId,
            executionMode
        } = req.body;

        // Extraer argumentos de entrada
        const args = inArguments.reduce((acc, arg) => {
            return { ...acc, ...arg };
        }, {});

        console.log('Processed arguments:', args);

        // Validación de campos requeridos
        if (!args.ContactKey || !args.Mail) {
            throw new Error('ContactKey and Mail are required fields');
        }

        // Inicializar servicios
        console.log('Initializing services...');
        const geminiService = new GeminiService(process.env.GEMINI_API_KEY);
        const salesforceService = new SalesforceService({
            clientId: process.env.SFMC_CLIENT_ID,
            clientSecret: process.env.SFMC_CLIENT_SECRET,
            subdomain: process.env.SFMC_SUBDOMAIN,
            accountId: process.env.SFMC_ACCOUNT_ID
        });

        const activityService = new ActivityService(geminiService, salesforceService);

        // Ejecutar el envío de email
        console.log('Executing email send...');
        const result = await activityService.executeEmailSend({
            contactKey: args.ContactKey,
            firstName: args.FirstName || 'Estimado Cliente',
            city: args.City || 'su ciudad',
            interestCategory: args.InterestCategory || 'nuestros productos',
            email: args.Mail,
            emailTemplate: args.emailTemplate || 'default',
            subject: args.subject || null
        });

        const executionTime = Date.now() - startTime;
        console.log(`Execution completed in ${executionTime}ms`);
        console.log('Execution result:', result);

        res.json({
            status: 'success',
            message: 'Email sent successfully',
            data: {
                contactKey: args.ContactKey,
                email: args.Mail,
                messageId: result.messageId || 'generated',
                executionTime: `${executionTime}ms`,
                timestamp: new Date().toISOString(),
                journeyId: journeyId,
                activityId: activityId
            },
            result: result
        });

    } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error('Execution error:', error);
        console.error('Error stack:', error.stack);
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to execute custom activity',
            error: error.message,
            executionTime: `${executionTime}ms`,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint de guardado
app.post('/save', async (req, res) => {
    try {
        console.log('Saving activity configuration:', JSON.stringify(req.body, null, 2));
        
        const { 
            arguments: args,
            metaData,
            configurationArguments 
        } = req.body;

        // Validar configuración básica
        if (!args || !args.execute || !args.execute.inArguments) {
            return res.status(400).json({
                error: 'Invalid configuration structure'
            });
        }

        res.json({
            success: true,
            message: 'Configuration saved successfully',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({
            error: 'Failed to save configuration',
            details: error.message
        });
    }
});

// Endpoint de publicación
app.post('/publish', (req, res) => {
    try {
        console.log('Activity published:', JSON.stringify(req.body, null, 2));
        res.json({ 
            status: 'published',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Publish error:', error);
        res.status(500).json({
            error: 'Failed to publish activity',
            details: error.message
        });
    }
});

// Endpoint de parada
app.post('/stop', (req, res) => {
    try {
        console.log('Activity stopped:', JSON.stringify(req.body, null, 2));
        res.json({ 
            status: 'stopped',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Stop error:', error);
        res.status(500).json({
            error: 'Failed to stop activity',
            details: error.message
        });
    }
});

// Endpoints adicionales para testing y monitoreo
app.post('/test-connection', async (req, res) => {
    try {
        const results = { timestamp: new Date().toISOString(), tests: {} };

        // Test Gemini
        try {
            const geminiService = new GeminiService(process.env.GEMINI_API_KEY);
            const testEmail = await geminiService.generatePersonalizedEmail({
                firstName: 'Test',
                city: 'Test City',
                interestCategory: 'testing'
            });
            
            results.tests.gemini = {
                status: 'success',
                connected: true,
                generated: testEmail.generated || testEmail.fallback
            };
        } catch (geminiError) {
            results.tests.gemini = {
                status: 'error',
                connected: false,
                error: geminiError.message
            };
        }

        // Test Salesforce
        try {
            const salesforceService = new SalesforceService({
                clientId: process.env.SFMC_CLIENT_ID,
                clientSecret: process.env.SFMC_CLIENT_SECRET,
                subdomain: process.env.SFMC_SUBDOMAIN,
                accountId: process.env.SFMC_ACCOUNT_ID
            });

            await salesforceService.authenticate();
            results.tests.salesforce = { status: 'success', connected: true };
        } catch (sfError) {
            results.tests.salesforce = {
                status: 'error',
                connected: false,
                error: sfError.message
            };
        }

        const allPassed = Object.values(results.tests).every(test => test.status === 'success');
        results.overall = { status: allPassed ? 'success' : 'partial', ready: allPassed };

        res.json(results);
    } catch (error) {
        res.status(500).json({
            error: 'Connection test failed',
            details: error.message
        });
    }
});

// Endpoint de preview
app.post('/preview', async (req, res) => {
    try {
        const { 
            firstName = 'Juan',
            city = 'Bogotá',
            interestCategory = 'Tecnología',
            emailTemplate = 'default'
        } = req.body;

        const geminiService = new GeminiService(process.env.GEMINI_API_KEY);
        const activityService = new ActivityService(geminiService, null);

        const [emailContent, subject] = await Promise.all([
            geminiService.generatePersonalizedEmail({ firstName, city, interestCategory }, emailTemplate),
            geminiService.generateSubject({ firstName, city, interestCategory }, emailTemplate)
        ]);

        const htmlContent = activityService.createEmailHTML({
            subject: typeof subject === 'string' ? subject : subject,
            content: emailContent.content,
            firstName,
            footerText: 'Preview - Email no será enviado'
        });

        res.json({
            success: true,
            preview: {
                subject: typeof subject === 'string' ? subject : subject,
                content: emailContent.content,
                htmlContent,
                generated: emailContent.generated,
                template: emailTemplate
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Preview generation failed',
            details: error.message
        });
    }
});

// Manejo de errores global
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('🚀 =======================================');
    console.log(`🤖 Gemini Email Custom Activity`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📧 Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`☁️  Salesforce: ${process.env.SFMC_CLIENT_ID ? '✅ Configured' : '❌ Missing'}`);
    console.log(`🌐 Health: http://localhost:${PORT}/health`);
    console.log(`🔧 Test: http://localhost:${PORT}/test-connection`);
    console.log('🚀 =======================================');
    console.log('📧 Ready to send personalized AI emails!');
});
