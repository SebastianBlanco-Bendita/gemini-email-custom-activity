// Load environment variables
require('dotenv').config();

// Core modules
const path = require('path');

// External dependencies
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const bodyParser = require('body-parser');

// Services
const GeminiService = require('./services/geminiService');
const SalesforceService = require('./services/salesforceService');
const ActivityService = require('./services/activityService');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// ========================
// Middleware configuration
// ========================

// Security headers with strict CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net"], // JS CDN permitido
            connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "*.salesforce.com", "*.marketingcloudapis.com"],
            imgSrc: ["'self'", "data:"],
            styleSrc: ["'self'", "'unsafe-inline'"], // Para permitir estilos inline
        },
    },
}));

app.use(compression());           // Gzip compression
app.use(cors());                  // Enable CORS
app.use(bodyParser.json());       // Parse application/json

// ========================
// Static files & main route
// ========================

app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========================
// API Endpoints
// ========================

// Ejecutar actividad
app.post('/execute', async (req, res) => {
    try {
        const payload = req.body;

        // Procesar la solicitud con Gemini + Salesforce
        const geminiResponse = await GeminiService.process(payload);
        const salesforceResult = await SalesforceService.sendData(geminiResponse);

        res.status(200).json({ success: true, data: salesforceResult });
    } catch (error) {
        console.error('Error en /execute:', error);
        res.status(500).json({ success: false, error: 'Error al ejecutar la actividad' });
    }
});

// Guardar configuración
app.post('/save', async (req, res) => {
    try {
        const config = req.body;

        // Guardar configuración (simulado o real)
        const result = await ActivityService.saveConfig(config);

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error en /save:', error);
        res.status(500).json({ success: false, error: 'Error al guardar configuración' });
    }
});

// Cargar configuración
app.get('/load', async (req, res) => {
    try {
        const config = await ActivityService.loadConfig();
        res.status(200).json({ success: true, data: config });
    } catch (error) {
        console.error('Error en /load:', error);
        res.status(500).json({ success: false, error: 'Error al cargar configuración' });
    }
});

// ========================
// Start server
// ========================

app.listen(PORT, () => {
    console.log(`🚀 Servidor listo en el puerto ${PORT}`);
});
