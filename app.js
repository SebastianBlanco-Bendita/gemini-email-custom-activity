require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const bodyParser = require('body-parser');

// Importa los servicios
const GeminiService = require('./services/geminiService');
const SalesforceService = require('./services/salesforceService');
const ActivityService = require('./services/activityService');

// ========================
// Instanciación de Servicios
// ========================
const geminiService = new GeminiService(process.env.GEMINI_API_KEY);
const salesforceService = new SalesforceService({
    clientId: process.env.SFMC_CLIENT_ID,
    clientSecret: process.env.SFMC_CLIENT_SECRET,
    subdomain: process.env.SFMC_SUBDOMAIN,
    accountId: process.env.SFMC_ACCOUNT_ID,
});
const activityService = new ActivityService(geminiService, salesforceService);

// Inicializa la app
const app = express();
const PORT = process.env.PORT || 3000;

// ========================
// Middleware
// ========================

// Configuración de seguridad para permitir que SFMC cargue la app en un iframe
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", 
                "https://cdn.jsdelivr.net", // Permite Postmonger y Bootstrap JS
                "https://code.jquery.com"   // Permite jQuery
            ],
            styleSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
            frameAncestors: ["'self'", "*.exacttarget.com", "*.marketingcloudapps.com"]
        }
    }
}));

app.use(compression());
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));


// ========================
// Rutas de la Actividad Custom de SFMC
// ========================

// El Journey ejecuta la actividad para un contacto
app.post('/execute', async (req, res) => {
    try {
        const inArguments = req.body.inArguments[0] || {};
        
        const executionData = {
            contactKey: inArguments.ContactKey,
            email: inArguments.Mail,
            firstName: inArguments.FirstName,
            city: inArguments.City,
            interestCategory: inArguments.InterestCategory,
            emailTemplate: inArguments.emailTemplate,
            subject: inArguments.subject,
        };

        const result = await activityService.executeEmailSend(executionData);
        
        console.log('Execution result:', result);
        res.status(200).json({ success: true, result });
    } catch (error) {
        console.error('Error en /execute:', error);
        res.status(500).json({ success: false, error: 'Error al ejecutar la actividad' });
    }
});

// El usuario guarda la configuración de la actividad
app.post('/save', (req, res) => {
    console.log('Configuración guardada.');
    res.status(200).json({ success: true });
});

// El usuario publica el Journey
app.post('/publish', (req, res) => {
    console.log('Journey publicado.');
    res.status(200).json({ success: true });
});

// SFMC valida la actividad antes de publicar
app.post('/validate', (req, res) => {
    console.log('Validando actividad...');
    res.status(200).json({ success: true });
});

// Ruta para detener la actividad (opcional)
app.post('/stop', (req, res) => {
    console.log('Actividad detenida.');
    res.status(200).json({ success: true });
});

// Sirve el index.html en la ruta raíz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor listo en el puerto ${PORT}`);
});
