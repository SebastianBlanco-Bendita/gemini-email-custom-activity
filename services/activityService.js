class ActivityService {
    constructor(geminiService, salesforceService) {
        this.geminiService = geminiService;
        this.salesforceService = salesforceService;
    }

    async executeEmailSend(data) {
        try {
            const {
                contactKey,
                firstName,
                city,
                interestCategory,
                email,
                emailTemplate = 'default',
                subject: customSubject
            } = data;

            console.log(`Executing email send for contact: ${contactKey}`);
            
            // 1. Preparar datos del cliente para Gemini
            const customerData = {
                firstName: firstName || 'Estimado Cliente',
                city: city || 'su ciudad',
                interestCategory: interestCategory || 'nuestros productos'
            };

            // 2. Generar contenido personalizado con Gemini
            console.log('Generating personalized content...');
            
            const [emailResult, subjectResult] = await Promise.all([
                this.geminiService.generatePersonalizedEmail(customerData, emailTemplate),
                customSubject ? 
                    Promise.resolve(customSubject) : 
                    this.geminiService.generateSubject(customerData, emailTemplate)
            ]);

            // 3. Crear HTML del email
            const htmlContent = this.createEmailHTML({
                subject: typeof subjectResult === 'string' ? subjectResult : subjectResult.subject,
                content: emailResult.content,
                firstName: customerData.firstName,
                footerText: 'Gracias por confiar en nosotros'
            });

            // 4. Enviar email a través de Salesforce Marketing Cloud
            console.log('Sending email through Salesforce Marketing Cloud...');
            
            const sendResult = await this.salesforceService.sendTransactionalMessage({
                contactKey,
                email,
                subject: typeof subjectResult === 'string' ? subjectResult : subjectResult.subject,
                htmlContent,
                firstName: customerData.firstName
            });

            // 5. Registrar la actividad (opcional)
            try {
                await this.logActivity({
                    contactKey,
                    email,
                    subject: typeof subjectResult === 'string' ? subjectResult : subjectResult.subject,
                    template: emailTemplate,
                    success: sendResult.success,
                    messageId: sendResult.messageId,
                    geminiGenerated: emailResult.generated,
                    timestamp: new Date().toISOString()
                });
            } catch (logError) {
                console.warn('Failed to log activity:', logError.message);
            }

            return {
                success: true,
                messageId: sendResult.messageId,
                contactKey,
                email,
                subject: typeof subjectResult === 'string' ? subjectResult : subjectResult.subject,
                contentGenerated: emailResult.generated,
                simulated: sendResult.simulated || false,
                timestamp: new Date().toISOString(),
                details: {
                    geminiResponse: emailResult,
                    salesforceResponse: sendResult
                }
            };

        } catch (error) {
            console.error('Email execution failed:', error);
            
            return {
                success: false,
                error: error.message,
                contactKey: data.contactKey,
                email: data.email,
                timestamp: new Date().toISOString()
            };
        }
    }

    createEmailHTML({ subject, content, firstName, footerText }) {
        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .email-container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .content {
            margin-bottom: 30px;
            white-space: pre-line;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #eee;
            padding-top: 20px;
            margin-top: 30px;
        }
        .cta-button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 12px 25px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .logo {
            max-width: 200px;
            height: auto;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Tu Empresa</h1>
        </div>
        
        <div class="content">
            ${content}
        </div>
        
        <div class="footer">
            <p>${footerText}</p>
            <p><small>Este email fue generado automáticamente con IA personalizada.</small></p>
        </div>
    </div>
</body>
</html>`;
    }

    async logActivity(activityData) {
        try {
            // Intentar actualizar la data extension con información de la actividad
            const logData = {
                LastEmailSent: new Date().toISOString(),
                LastSubject: activityData.subject,
                EmailsSent: 1, // Incrementar si existe
                LastTemplate: activityData.template,
                LastSuccess: activityData.success ? 'true' : 'false'
            };

            await this.salesforceService.updateContactData(
                activityData.contactKey, 
                logData
            );

            console.log('Activity logged successfully for:', activityData.contactKey);
            
        } catch (error) {
            console.warn('Failed to log activity:', error.message);
            // No fallar la ejecución principal por un error de logging
        }
    }

    async validateConfiguration(config) {
        const errors = [];

        if (!config.contactKey) {
            errors.push('ContactKey is required');
        }

        if (!config.email) {
            errors.push('Email address is required');
        }

        if (config.email && !this.isValidEmail(config.email)) {
            errors.push('Invalid email format');
        }

        if (config.emailTemplate && !['default', 'promotional', 'informational', 'welcome'].includes(config.emailTemplate)) {
            errors.push('Invalid email template type');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async testConnection() {
        try {
            // Probar conexión con Gemini
            const geminiTest = await this.geminiService.generatePersonalizedEmail({
                firstName: 'Test',
                city: 'Test City',
                interestCategory: 'test'
            }, 'default');

            // Probar conexión con Salesforce
            await this.salesforceService.authenticate();

            return {
                success: true,
                geminiConnected: geminiTest.generated || geminiTest.fallback,
                salesforceConnected: true,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = ActivityService;
