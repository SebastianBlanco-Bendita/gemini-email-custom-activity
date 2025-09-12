document.addEventListener('DOMContentLoaded', function () {
    const connection = new Postmonger.Session();
    let payload = {};
    const steps = document.querySelectorAll('.step-content');
    const indicators = document.querySelectorAll('.step');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const saveBtn = document.getElementById('saveBtn');
    const emailTemplateSelect = document.getElementById('emailTemplate');
    const customSubjectInput = document.getElementById('customSubject');

    function showStep(stepIndex) {
        steps.forEach((step, index) => step.classList.toggle('active', index === stepIndex - 1));
        indicators.forEach((indicator, index) => indicator.classList.toggle('active', index === stepIndex - 1));
        prevBtn.classList.toggle('hidden', stepIndex === 1);
        nextBtn.classList.toggle('hidden', stepIndex === steps.length);
        saveBtn.classList.toggle('hidden', stepIndex !== steps.length);
    }

    function updateTemplatePreview() {
        const descriptions = {
            'default': '<strong>Email General:</strong> Contenido adaptado a cada contacto.',
            'promotional': '<strong>Email Promocional:</strong> Incluye ofertas y llamadas a la acción.',
            'informational': '<strong>Email Informativo:</strong> Comparte conocimiento de valor.',
            'welcome': '<strong>Email de Bienvenida:</strong> Saludo cálido para nuevos contactos.'
        };
        document.getElementById('templatePreview').innerHTML = descriptions[emailTemplateSelect.value] || '';
    }

    function saveConfiguration() {
        const emailTemplate = emailTemplateSelect.value;
        const subject = customSubjectInput.value || null;

        // **CORRECCIÓN**: Asegura que la estructura del payload exista
        if (!payload.arguments) payload.arguments = {};
        if (!payload.arguments.execute) payload.arguments.execute = {};

        payload.arguments.execute.inArguments = [{
            "ContactKey": "{{Contact.Key}}",
            "Mail": "{{InteractionDefaults.Email}}",
            "FirstName": "{{Contact.Attribute.TestCustomActivity.FirstName}}",
            "City": "{{Contact.Attribute.TestCustomActivity.City}}",
            "InterestCategory": "{{Contact.Attribute.TestCustomActivity.InterestCategory}}",
            "emailTemplate": emailTemplate,
            "subject": subject
        }];
        
        payload.metaData = payload.metaData || {};
        payload.metaData.isConfigured = true;

        console.log('Guardando configuración:', JSON.stringify(payload, null, 2));
        connection.trigger('updateActivity', payload);
    }

    function initializeActivity(data) {
        if (data) payload = data;
        const args = payload.arguments?.execute?.inArguments[0] || {};
        emailTemplateSelect.value = args.emailTemplate || 'default';
        customSubjectInput.value = args.subject || '';
        updateTemplatePreview();
        showStep(1);
    }

    connection.on('initActivity', initializeActivity);
    connection.on('clickedNext', () => showStep(2));
    connection.on('clickedBack', () => showStep(1));
    nextBtn.addEventListener('click', () => showStep(2));
    prevBtn.addEventListener('click', () => showStep(1));
    saveBtn.addEventListener('click', saveConfiguration);
    emailTemplateSelect.addEventListener('change', updateTemplatePreview);

    connection.trigger('ready');
    updateTemplatePreview();
});