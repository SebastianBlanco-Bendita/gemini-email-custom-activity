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

// Middleware de seguridad MEJORADO
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // Permitimos scripts de nuestro propio dominio y del CDN de Postmonger.
            // Eliminamos 'unsafe-inline' para mayor seguridad.
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
            // Para los estilos, como estarán en el propio HTML, necesitamos 'unsafe-inline'.
            // También puedes mover el CSS a un archivo .css y quitar 'unsafe-inline'.
            styleSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "*.salesforce.com", "*.marketingcloudapis.com"],
            imgSrc: ["'self'", "data:"], // Más restrictivo y seguro
        },
    },
}));

app.use(compression());
app.use(cors()); // CORS puede ser más simple si no necesitas credenciales específicas.
app.use(bodyParser.json({ limit: '10mb' }));

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal ahora sirve el index.html desde la carpeta estática
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// El resto de tus rutas y lógica de servidor permanecen igual...
// (endpoints /config.json, /execute, /save, /publish, /validate, /stop, etc.)

// === INICIO DEL CÓDIGO EXISTENTE (SIN CAMBIOS) ===
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
    next();
});
app.get('/config.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'config.json'));
});
app.post('/validate', (req, res) => {
    console.log('Validating configuration:', JSON.stringify(req.body, null, 2));
    res.json({ valid: true });
});
app.post('/save', (req, res) => {
    console.log('Saving configuration:', JSON.stringify(req.body, null, 2));
    res.json({ success: true });
});
app.post('/publish', (req, res) => {
    console.log('Publishing activity:', JSON.stringify(req.body, null, 2));
    res.json({ success: true });
});
app.post('/stop', (req, res) => {
    console.log('Stopping activity:', JSON.stringify(req.body, null, 2));
    res.json({ success: true });
});
app.post('/execute', async (req, res) => {
    try {
        console.log('=== EXECUTING CUSTOM ACTIVITY ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        const args = req.body.inArguments[0] || {};
        if (!args.ContactKey || !args.Mail) {
            throw new Error('ContactKey and Mail are required');
        }
        const geminiService = new GeminiService(process.env.GEMINI_API_KEY);
        const salesforceService = new SalesforceService({
            clientId: process.env.SFMC_CLIENT_ID,
            clientSecret: process.env.SFMC_CLIENT_SECRET,
            subdomain: process.env.SFMC_SUBDOMAIN,
            accountId: process.env.SFMC_ACCOUNT_ID
        });
        const activityService = new ActivityService(geminiService, salesforceService);
        const result = await activityService.executeEmailSend({
            contactKey: args.ContactKey,
            firstName: args.FirstName,
            city: args.City,
            interestCategory: args.InterestCategory,
            email: args.Mail,
            emailTemplate: args.emailTemplate,
            subject: args.subject
        });
        res.status(200).json({ success: true, result });
    } catch (error) {
        console.error('Execution error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
// === FIN DEL CÓDIGO EXISTENTE (SIN CAMBIOS) ===