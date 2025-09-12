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

// Middleware de seguridad con CSP estricta
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net"], // Solo permite scripts propios y del CDN de Postmonger
            connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "*.salesforce.com", "*.marketingcloudapis.com"],
            imgSrc: ["'self'", "data:"],
            styleSrc: ["'self'", "'unsafe-inline'"] // Permite estilos en el <head> de index.html
        },
    },
}));

app.use(compression());
app.use(cors());
app.use(bodyParser.json());

// **IMPORTANTE**: Servir todos los archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal ahora sirve el index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === EL RESTO DE TUS ENDPOINTS (/execute, /save, etc.) VAN AQUÍ SIN CAMBIOS ===
// ... (pega aquí el resto de tus endpoints de app.js)

app.listen(PORT, () => {
    console.log(`🚀 Servidor listo en el puerto ${PORT}`);
});