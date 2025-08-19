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
            connectSrc: ["'self'", "https://api.gemini.com", "*.salesforce.com", "*.marketingcloudapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

app.use(compression());
app.use(cors({
    origin: ['https://mc.salesforce.com', 'https://*.marketingcloudapps.com'],
    credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use('/public', express.static(path.join(__dirname, 'public')));

// Ruta de salud
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Rutas de la custom activity
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/config.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'config.json'));
});

// Endpoint para validar la configuración
app.post('/validate', async (req, res) => {
    try {
        console.log('Validating configuration:', req.body);
        
        const { arguments: args } = req.body;
        
        if (!args || !args.emailTemplate || !args.contactKey) {
            return res.status(400).json({
                error: 'Missing required configuration parameters'
            });
        }

        res.json({ 
            valid: true, 
            message: 'Configuration validated successfully' 
        });
        
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ 
            error: 'Validation failed', 
            details: error.message 
        });
    }
});

// Endpoint principal de ejecución
app.post('/execute', async (req, res) => {
    try {
        console.log('Executing custom activity:', JSON.stringify(req.body, null, 2));
        
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

        if (!args.ContactKey || !args.Mail) {
            throw new Error('ContactKey and Mail are required fields');
        }

        // Inicializar servicios
        const geminiService = new GeminiService(process.env.GEMINI_API_KEY);
        const salesforceService = new SalesforceService({
            clientId: process.env.SFMC_CLIENT_ID,
            clientSecret: process.env.SFMC_CLIENT_SECRET,
            subdomain: process.env.SFMC_SUBDOMAIN,
            accountId: process.env.SFMC_ACCOUNT_ID
        });

        const activityService = new ActivityService(geminiService, salesforceService);

        // Ejecutar el envío de email
        const result = await activityService.executeEmailSend({
            contactKey: args.ContactKey,
            firstName: args.FirstName || 'Estimado Cliente',
            city: args.City || 'su ciudad',
            interestCategory: args.InterestCategory || 'nuestros productos',
            email: args.Mail,
            emailTemplate: args.emailTemplate || 'default',
            subject: args.subject || 'Mensaje personalizado para ti'
        });

        console.log('Execution result:', result);

        res.json({
            status: 'success',
            message: 'Email sent successfully',
            data: {
                contactKey: args.ContactKey,
                email: args.Mail,
                messageId: result.messageId || 'generated',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Execution error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to execute custom activity',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint de publicación (opcional)
app.post('/publish', (req, res) => {
    console.log('Activity published:', req.body);
    res.json({ status: 'published' });
});

// Endpoint de parada (opcional)
app.post('/stop', (req, res) => {
    console.log('Activity stopped:', req.body);
    res.json({ status: 'stopped' });
});

// Manejo de errores
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Gemini Email Custom Activity running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📧 Ready to send personalized emails with Gemini Pro!`);
});
