const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Gemini API key is required');
        }
        
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ 
            model: "gemini-pro",
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        });
    }

    async generatePersonalizedEmail(customerData, template = 'default') {
        try {
            const { firstName, city, interestCategory, subject } = customerData;
            
            let prompt;
            
            switch (template) {
                case 'promotional':
                    prompt = `Crea un email promocional personalizado en español para:
                    - Nombre: ${firstName}
                    - Ciudad: ${city}
                    - Categoría de interés: ${interestCategory}
                    
                    El email debe:
                    - Ser amigable y profesional
                    - Mencionar su ciudad de manera natural
                    - Incluir una oferta relevante a su categoría de interés
                    - Tener un llamado a la acción claro
                    - Ser de máximo 200 palabras
                    - Solo devolver el cuerpo del email, sin asunto`;
                    break;
                    
                case 'informational':
                    prompt = `Crea un email informativo personalizado en español para:
                    - Nombre: ${firstName}
                    - Ciudad: ${city}
                    - Categoría de interés: ${interestCategory}
                    
                    El email debe:
                    - Compartir información valiosa sobre su categoría de interés
                    - Ser educativo y útil
                    - Mencionar su ubicación de manera contextual
                    - Mantener un tono profesional pero cercano
                    - Ser de máximo 200 palabras
                    - Solo devolver el cuerpo del email, sin asunto`;
                    break;
                    
                case 'welcome':
                    prompt = `Crea un email de bienvenida personalizado en español para:
                    - Nombre: ${firstName}
                    - Ciudad: ${city}
                    - Categoría de interés: ${interestCategory}
                    
                    El email debe:
                    - Dar la bienvenida de manera cálida
                    - Agradecer su interés
                    - Mencionar qué pueden esperar basado en su categoría de interés
                    - Incluir información relevante para su ciudad
                    - Ser acogedor y profesional
                    - Ser de máximo 200 palabras
                    - Solo devolver el cuerpo del email, sin asunto`;
                    break;
                    
                default:
                    prompt = `Crea un email personalizado en español para:
                    - Nombre: ${firstName}
                    - Ciudad: ${city}  
                    - Categoría de interés: ${interestCategory}
                    
                    El email debe:
                    - Ser personalizado y relevante
                    - Mantener un tono profesional pero amigable
                    - Mencionar de manera natural su ciudad y categoría de interés
                    - Incluir valor para el cliente
                    - Ser de máximo 200 palabras
                    - Solo devolver el cuerpo del email, sin asunto`;
            }

            console.log('Generating email with prompt:', prompt);
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const emailContent = response.text();
            
            console.log('Generated email content:', emailContent);
            
            if (!emailContent || emailContent.trim().length === 0) {
                throw new Error('Gemini returned empty content');
            }
            
            return {
                content: emailContent.trim(),
                generated: true,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Gemini generation error:', error);
            
            // Fallback email content
            const fallbackContent = `Hola ${firstName},

Esperamos que te encuentres muy bien en ${city}.

Nos complace contactarte porque sabemos de tu interés en ${interestCategory}. Queremos ofrecerte contenido y ofertas especiales que realmente te interesen.

En los próximos días recibirás más información personalizada que esperamos sea de tu agrado.

¡Gracias por confiar en nosotros!

Saludos cordiales,
El equipo`;

            return {
                content: fallbackContent,
                generated: false,
                fallback: true,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async generateSubject(customerData, template = 'default') {
        try {
            const { firstName, city, interestCategory } = customerData;
            
            let prompt;
            
            switch (template) {
                case 'promotional':
                    prompt = `Crea un asunto de email promocional atractivo en español para:
                    - Nombre: ${firstName}
                    - Ciudad: ${city}
                    - Categoría de interés: ${interestCategory}
                    
                    El asunto debe ser llamativo, personalizado y de máximo 50 caracteres. Solo devuelve el asunto, nada más.`;
                    break;
                    
                case 'informational':
                    prompt = `Crea un asunto de email informativo en español para:
                    - Nombre: ${firstName} 
                    - Categoría de interés: ${interestCategory}
                    
                    El asunto debe ser claro, profesional y de máximo 50 caracteres. Solo devuelve el asunto, nada más.`;
                    break;
                    
                default:
                    prompt = `Crea un asunto de email personalizado en español para:
                    - Nombre: ${firstName}
                    - Categoría de interés: ${interestCategory}
                    
                    El asunto debe ser atractivo, personalizado y de máximo 50 caracteres. Solo devuelve el asunto, nada más.`;
            }
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const subject = response.text().trim();
            
            // Limpiar el asunto de comillas o caracteres extraños
            const cleanSubject = subject.replace(/["""]/g, '').trim();
            
            return cleanSubject.length > 50 ? cleanSubject.substring(0, 47) + '...' : cleanSubject;
            
        } catch (error) {
            console.error('Subject generation error:', error);
            return `${firstName}, tenemos algo especial para ti`;
        }
    }
}

module.exports = GeminiService;
