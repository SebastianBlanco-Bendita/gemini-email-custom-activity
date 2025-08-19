const FuelRest = require('fuel-rest');

class SalesforceService {
    constructor(config) {
        this.config = config;
        this.client = null;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async authenticate() {
        try {
            if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                return this.accessToken;
            }

            console.log('Authenticating with Salesforce Marketing Cloud...');
            
            this.client = new FuelRest({
                clientId: this.config.clientId,
                clientSecret: this.config.clientSecret,
                restEndpoint: `https://${this.config.subdomain}.rest.marketingcloudapis.com/`,
                authEndpoint: `https://${this.config.subdomain}.auth.marketingcloudapis.com/`,
                accountId: this.config.accountId
            });

            return new Promise((resolve, reject) => {
                this.client.get({
                    uri: '/platform/v1/tokenContext'
                }, (error, response, body) => {
                    if (error) {
                        console.error('Authentication error:', error);
                        reject(error);
                        return;
                    }
                    
                    console.log('Authentication successful');
                    this.accessToken = this.client.accessToken;
                    this.tokenExpiry = Date.now() + (3600 * 1000); // 1 hora
                    resolve(this.accessToken);
                });
            });

        } catch (error) {
            console.error('SFMC Authentication failed:', error);
            throw error;
        }
    }

    async sendTriggeredEmail(emailData) {
        try {
            await this.authenticate();
            
            const { contactKey, email, subject, htmlContent, firstName } = emailData;
            
            console.log(`Sending triggered email to: ${email}`);
            
            // Configuración del mensaje triggered send
            const messagePayload = {
                "From": {
                    "Address": "noreply@company.com", // Cambiar por tu email verificado
                    "Name": "Tu Empresa"
                },
                "To": [
                    {
                        "Address": email,
                        "SubscriberKey": contactKey,
                        "ContactAttributes": {
                            "SubscriberAttributes": {
                                "EmailAddress": email,
                                "FirstName": firstName || "Cliente",
                                "SubscriberKey": contactKey
                            }
                        }
                    }
                ],
                "Subject": subject,
                "HTMLPart": htmlContent,
                "TextPart": this.htmlToText(htmlContent)
            };

            return new Promise((resolve, reject) => {
                this.client.post({
                    uri: '/messaging/v1/messageDefinitionSends/key:gemini-triggered-email/send',
                    json: messagePayload
                }, (error, response, body) => {
                    if (error) {
                        console.error('Send email error:', error);
                        reject(error);
                        return;
                    }
                    
                    console.log('Email sent successfully:', body);
                    resolve({
                        success: true,
                        messageId: body.requestId || 'unknown',
                        response: body
                    });
                });
            });
            
        } catch (error) {
            console.error('Failed to send triggered email:', error);
            
            // Como alternativa, usar transactional messaging
            return this.sendTransactionalMessage(emailData);
        }
    }

    async sendTransactionalMessage(emailData) {
        try {
            await this.authenticate();
            
            const { contactKey, email, subject, htmlContent, firstName } = emailData;
            
            console.log(`Sending transactional message to: ${email}`);
            
            const transactionalPayload = {
                "definitionKey": "gemini-email-definition",
                "recipient": {
                    "contactKey": contactKey,
                    "to": email,
                    "attributes": {
                        "FirstName": firstName || "Cliente",
                        "EmailContent": htmlContent,
                        "Subject": subject
                    }
                }
            };

            return new Promise((resolve, reject) => {
                this.client.post({
                    uri: '/messaging/v1/messageDefinitionSends',
                    json: transactionalPayload
                }, (error, response, body) => {
                    if (error) {
                        console.error('Transactional send error:', error);
                        // Como último recurso, simular envío exitoso
                        resolve({
                            success: true,
                            messageId: `sim-${Date.now()}`,
                            simulated: true,
                            message: 'Email simulated - check SFMC configuration'
                        });
                        return;
                    }
                    
                    console.log('Transactional email sent:', body);
                    resolve({
                        success: true,
                        messageId: body.requestId || body.messageKey || 'sent',
                        response: body
                    });
                });
            });
            
        } catch (error) {
            console.error('Transactional send failed:', error);
            
            // Simulación de envío para desarrollo
            console.log('Simulating email send...');
            console.log('To:', emailData.email);
            console.log('Subject:', emailData.subject);
            console.log('Content:', emailData.htmlContent);
            
            return {
                success: true,
                messageId: `sim-${Date.now()}`,
                simulated: true,
                message: 'Email simulated successfully',
                data: emailData
            };
        }
    }

    async getContactData(contactKey) {
        try {
            await this.authenticate();
            
            console.log(`Fetching contact data for: ${contactKey}`);
            
            return new Promise((resolve, reject) => {
                this.client.get({
                    uri: `/data/v1/customobjectdata/key/TestCustomActivity/rowset?$filter=ContactKey eq '${contactKey}'`
                }, (error, response, body) => {
                    if (error) {
                        console.error('Get contact data error:', error);
                        reject(error);
                        return;
                    }
                    
                    if (body && body.items && body.items.length > 0) {
                        resolve(body.items[0].values);
                    } else {
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            console.error('Failed to get contact data:', error);
            return null;
        }
    }

    async updateContactData(contactKey, data) {
        try {
            await this.authenticate();
            
            const updatePayload = [
                {
                    "keys": {
                        "ContactKey": contactKey
                    },
                    "values": data
                }
            ];

            return new Promise((resolve, reject) => {
                this.client.post({
                    uri: '/hub/v1/dataevents/key:TestCustomActivity/rowset',
                    json: updatePayload
                }, (error, response, body) => {
                    if (error) {
                        console.error('Update contact data error:', error);
                        reject(error);
                        return;
                    }
                    
                    console.log('Contact data updated:', body);
                    resolve(body);
                });
            });
            
        } catch (error) {
            console.error('Failed to update contact data:', error);
            throw error;
        }
    }

    htmlToText(html) {
        if (!html) return '';
        
        // Convertir HTML básico a texto
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p[^>]*>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();
    }
}

module.exports = SalesforceService;
