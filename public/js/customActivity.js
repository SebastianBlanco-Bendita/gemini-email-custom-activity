'use strict';

// Inicializa la conexión con Journey Builder
const connection = new Postmonger.Session();
let payload = {};
let initialInArguments = {};

// Espera a que la UI de Journey Builder esté lista
$(window).ready(onRender);

// Define los eventos de Journey Builder a los que vamos a responder
connection.on('initActivity', initialize);
connection.on('clickedNext', save);

function onRender() {
    // Notifica a Journey Builder que la aplicación está lista
    connection.trigger('ready');
}

/**
 * Se ejecuta cuando la actividad se carga en el Journey.
 * @param {object} data - La configuración previamente guardada.
 */
function initialize(data) {
    if (data) {
        payload = data;
    }

    const inArguments = payload['arguments']?.execute?.inArguments?.[0] || {};
    
    // Convertimos el array de argumentos de SFMC a un objeto simple para manejarlo más fácil
    const args = {};
    for (const key in inArguments) {
        args[key] = inArguments[key];
    }
    
    // Guardamos los argumentos que vienen del Journey por separado de la configuración de la UI
    initialInArguments = {
        ContactKey: args.ContactKey,
        Mail: args.Mail,
        FirstName: args.FirstName,
        City: args.City,
        InterestCategory: args.InterestCategory
    };

    // Populamos los campos del formulario con los valores guardados
    $('#emailTemplate').val(args.emailTemplate || 'default');
    $('#customSubject').val(args.subject || '');

    updateTemplatePreview();
}

/**
 * Se ejecuta cuando el usuario hace clic en "Siguiente" o "Hecho".
 * Construye el payload final y lo envía a Journey Builder.
 */
function save() {
    const emailTemplateValue = $('#emailTemplate').val();
    const customSubjectValue = $('#customSubject').val().trim();

    // Empezamos con los argumentos del Journey
    const finalInArguments = { ...initialInArguments };

    // Añadimos los valores configurados en la UI
    finalInArguments.emailTemplate = emailTemplateValue;
    if (customSubjectValue) {
        finalInArguments.subject = customSubjectValue;
    }
    
    // Actualizamos el payload
    payload['arguments'].execute.inArguments = [finalInArguments];
    payload['metaData'].isConfigured = true;

    console.log('Payload guardado:', JSON.stringify(payload, null, 2));

    // Envía el payload actualizado a Journey Builder
    connection.trigger('updateActivity', payload);
}

// Función para la vista previa
function updateTemplatePreview() {
    const descriptions = {
        default: '<strong>Email General:</strong> Contenido adaptado a cada contacto.',
        promotional: '<strong>Email Promocional:</strong> Incluye ofertas y llamadas a la acción.',
        informational: '<strong>Email Informativo:</strong> Comparte conocimiento de valor.',
        welcome: '<strong>Email de Bienvenida:</strong> Saludo cálido para nuevos contactos.'
    };
    const selectedValue = $('#emailTemplate').val();
    $('#templatePreview').html(descriptions[selectedValue] || '');
}

// Evento para actualizar la vista previa cuando cambia el select
$('#emailTemplate').on('change', updateTemplatePreview);
