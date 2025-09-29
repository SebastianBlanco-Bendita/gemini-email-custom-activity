'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // ========================
    // Inicialización
    // ========================
    const connection = new Postmonger.Session();
    let payload = {};
    let initialInArguments = {};
    let currentStep = 1;

    // Elementos del DOM
    const steps = {
        1: document.getElementById('step1'),
        2: document.getElementById('step2')
    };
    const emailTemplateSelect = document.getElementById('emailTemplate');
    const customSubjectInput = document.getElementById('customSubject');
    const templatePreview = document.getElementById('templatePreview');

    // ========================
    // Vista previa de plantilla
    // ========================
    function updateTemplatePreview() {
        const descriptions = {
            default: '<strong>Email General:</strong> Contenido adaptado a cada contacto.',
            promotional: '<strong>Email Promocional:</strong> Incluye ofertas y llamadas a la acción.',
            informational: '<strong>Email Informativo:</strong> Comparte conocimiento de valor.',
            welcome: '<strong>Email de Bienvenida:</strong> Saludo cálido para nuevos contactos.'
        };
        templatePreview.innerHTML = descriptions[emailTemplateSelect.value] || '';
    }

    // ========================
    // Navegación y UI
    // ========================
    function showStep(step, direction) {
        currentStep = step;
        if (direction) {
            connection.trigger('updateButton', {
                button: 'next',
                visible: step < Object.keys(steps).length,
                enabled: true
            });
            connection.trigger('updateButton', {
                button: 'back',
                visible: step > 1,
                enabled: true
            });
        }
        
        // Muestra el paso actual en la UI de SFMC
        connection.trigger('gotoStep', step);
    }
    
    // ========================
    // Guardar configuración
    // ========================
    function save() {
        const emailTemplate = emailTemplateSelect.value;
        const subject = customSubjectInput.value.trim();

        // Combina los argumentos iniciales con los valores de la UI
        const finalInArguments = { ...initialInArguments };
        finalInArguments.emailTemplate = emailTemplate;
        if (subject) {
            finalInArguments.subject = subject;
        }

        // Estructura el payload como espera SFMC
        payload.arguments.execute.inArguments = [finalInArguments];
        payload.metaData.isConfigured = true;

        console.log('Guardando payload:', JSON.stringify(payload, null, 2));
        connection.trigger('updateActivity', payload);
    }

    // ========================
    // Inicializar la actividad
    // ========================
    function initialize(data) {
        if (data) {
            payload = data;
        }
        
        const inArguments = payload.arguments?.execute?.inArguments?.[0] || {};
        
        // Guarda los argumentos que vienen del Journey por separado
        Object.keys(inArguments).forEach(key => {
            if (!['emailTemplate', 'subject'].includes(key)) {
                initialInArguments[key] = inArguments[key];
            }
        });
        
        // Carga la configuración guardada en la UI
        emailTemplateSelect.value = inArguments.emailTemplate || 'default';
        customSubjectInput.value = inArguments.subject || '';
        
        updateTemplatePreview();
        showStep(1); // Inicia en el primer paso
    }
    
    // ========================
    // Eventos de Postmonger
    // ========================
    connection.on('initActivity', initialize);
    connection.on('clickedNext', save); // Guardar al hacer clic en Siguiente o Hecho
    connection.on('gotoStep', showStep);
    
    // ========================
    // Eventos del DOM
    // ========================
    emailTemplateSelect.addEventListener('change', updateTemplatePreview);
    
    // Notifica a SFMC que la UI está lista
    connection.trigger('ready');
    updateTemplatePreview();
});
