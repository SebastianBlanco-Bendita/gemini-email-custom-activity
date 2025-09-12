document.addEventListener('DOMContentLoaded', function () {
    // Variables globales
    const connection = new Postmonger.Session();
    let payload = {};
    let activityData = {};
    const steps = document.querySelectorAll('.step-content');
    const indicators = document.querySelectorAll('.step');
    
    // Elementos del DOM
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const saveBtn = document.getElementById('saveBtn');
    const emailTemplateSelect = document.getElementById('emailTemplate');
    const customSubjectInput = document.getElementById('customSubject');

    // --- Lógica de la Aplicación ---
    
    // Navegación entre pasos
    function showStep(stepIndex) {
        steps.forEach((step, index) => {
            step.classList.toggle('active', index === stepIndex - 1);
        });
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === stepIndex - 1);
        });

        prevBtn.classList.toggle('hidden', stepIndex === 1);
        nextBtn.classList.toggle('hidden', stepIndex === steps.length);
        saveBtn.classList.toggle('hidden', stepIndex !== steps.length);
    }

    // Actualizar vista previa del template
    function updateTemplatePreview() {
        const template = emailTemplateSelect.value;
        const preview = document.getElementById('templatePreview');
        const descriptions = {
            'default': '<strong>Email General:</strong> Contenido adaptado a cada contacto con tono profesional.',
            'promotional': '<strong>Email Promocional:</strong> Incluye ofertas y llamadas a la acción basadas en intereses.',
            'informational': '<strong>Email Informativo:</strong> Comparte conocimiento valioso sobre la categoría de interés.',
            'welcome': '<strong>Email de Bienvenida:</strong> Saludo cálido y orientación para nuevos contactos.'
        };
        preview.innerHTML = descriptions[template] || descriptions['default'];
    }

    // Guardar configuración
    function saveConfiguration() {
        activityData.emailTemplate = emailTemplateSelect.value;
        activityData.subject = customSubjectInput.value || null;

        // Construir el payload para SFMC
        payload.arguments.execute.inArguments = [{
            "ContactKey": "{{Contact.Key}}",
            "Mail": "{{InteractionDefaults.Email}}",
            "FirstName": "{{Contact.Attribute.TestCustomActivity.FirstName}}",
            "City": "{{Contact.Attribute.TestCustomActivity.City}}",
            "InterestCategory": "{{Contact.Attribute.TestCustomActivity.InterestCategory}}",
            "emailTemplate": activityData.emailTemplate,
            "subject": activityData.subject
        }];
        payload.metaData.isConfigured = true;

        console.log('Saving configuration:', JSON.stringify(payload, null, 2));
        connection.trigger('updateActivity', payload);
    }

    // Cargar datos guardados
    function initializeActivity(data) {
        if (data) {
            payload = data;
        }

        const args = payload.arguments.execute.inArguments[0] || {};
        emailTemplateSelect.value = args.emailTemplate || 'default';
        customSubjectInput.value = args.subject || '';
        
        updateTemplatePreview();
        showStep(1); // Siempre empezar en el primer paso
    }

    // --- Event Listeners de Postmonger ---
    connection.on('initActivity', initializeActivity);
    connection.on('clickedNext', () => showStep(2));
    connection.on('clickedBack', () => showStep(1));
    connection.on('gotoStep', (step) => showStep(step.key === 'step2' ? 2 : 1));

    // --- Event Listeners del DOM (SIN ONCLICK) ---
    nextBtn.addEventListener('click', () => showStep(2));
    prevBtn.addEventListener('click', () => showStep(1));
    saveBtn.addEventListener('click', saveConfiguration);
    emailTemplateSelect.addEventListener('change', updateTemplatePreview);

    // Indicar a SFMC que la UI está lista
    connection.trigger('ready');
    updateTemplatePreview();
});