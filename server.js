require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ====================
// MIDDLEWARE (OBLIGATOIRE dans cet ordre)
// ====================
app.use(cors());
app.use(express.json()); // ⭐ ESSENTIEL pour parser les requêtes POST
app.use(express.static('.')); // Pour servir les fichiers statiques

// Variables globales (gardées pour compatibilité)
let db = null;

// ====================
// ROUTES API
// ====================

// 1. TEST ROUTE (GET)
app.get('/api/test', (req, res) => {
    console.log('✅ GET /api/test');
    res.json({
        success: true,
        message: '🚀 DevisPro API fonctionnelle sur Render',
        timestamp: new Date().toISOString(),
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        routes: [
            'GET    /api/test',
            'GET    /api/health',
            'POST   /api/login',
            'GET    /api/login (debug)',
            'POST   /api/register',
            'GET    /api/user',
            'POST   /api/create-checkout-session',
            'POST   /api/quotes',
            'POST   /api/stripe-webhook'
        ]
    });
});

// 2. HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'devispro',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// 3. LOGIN (POST - version production)
app.post('/api/login', async (req, res) => {
    try {
        console.log('🔐 POST /api/login');
        const { email, password } = req.body;
        
        console.log('Données reçues:', { email, password: password ? '***' : 'manquant' });
        
        if (!email || !password) {
            console.log('❌ Email ou mot de passe manquant');
            return res.status(400).json({ 
                success: false, 
                error: 'Email et mot de passe requis' 
            });
        }
        
        if (!email.includes('@')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Format email invalide' 
            });
        }
        
        // Création du token (simple Base64)
        const tokenData = {
            id: Date.now(),
            email: email,
            firstName: 'Test',
            lastName: 'User',
            exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 jours
        };
        
        const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
        
        // Réponse réussie
        res.json({
            success: true,
            token: token,
            user: {
                id: tokenData.id,
                email: email,
                firstName: 'Test',
                lastName: 'User',
                credits: 3,
                subscription: 'free',
                company_name: '',
                phone: '',
                address: '',
                siret: ''
            },
            message: 'Connexion réussie'
        });
        
    } catch (error) {
        console.error('❌ Erreur login:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur: ' + error.message 
        });
    }
});

// 4. LOGIN (GET - pour debug seulement) - ⭐ AJOUTÉ ⭐
app.get('/api/login', (req, res) => {
    console.log('📡 GET /api/login (route de debug)');
    res.json({
        success: false,
        error: 'Cette route nécessite une requête POST',
        instructions: 'Utilisez POST avec email et password',
        example: {
            method: 'POST',
            url: '/api/login',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                email: 'test@test.com',
                password: 'test123'
            }
        }
    });
});

// 5. REGISTER (POST)
app.post('/api/register', async (req, res) => {
    try {
        console.log('📝 POST /api/register');
        const { email, password, firstName, lastName } = req.body;
        
        console.log('Données inscription:', { email, firstName, lastName });
        
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tous les champs sont requis' 
            });
        }
        
        if (!email.includes('@')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Format email invalide' 
            });
        }
        
        // Création du token
        const tokenData = {
            id: Date.now(),
            email: email,
            firstName: firstName,
            lastName: lastName,
            exp: Date.now() + 30 * 24 * 60 * 60 * 1000
        };
        
        const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
        
        res.json({
            success: true,
            token: token,
            user: {
                id: tokenData.id,
                email: email,
                firstName: firstName,
                lastName: lastName,
                credits: 3,
                subscription: 'free',
                company_name: '',
                phone: '',
                address: '',
                siret: ''
            },
            message: 'Compte créé avec succès'
        });
        
    } catch (error) {
        console.error('❌ Erreur register:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la création du compte' 
        });
    }
});

// 6. GET USER INFO
app.get('/api/user', async (req, res) => {
    try {
        console.log('👤 GET /api/user');
        
        // Vérifier le token
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({ 
                success: false,
                error: 'Token manquant. Utilisez: Authorization: Bearer <token>' 
            });
        }
        
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Token mal formaté' 
            });
        }
        
        // Décoder le token
        let userData;
        try {
            const decoded = Buffer.from(token, 'base64').toString();
            userData = JSON.parse(decoded);
            console.log('✅ Token décodé:', userData);
        } catch (error) {
            console.error('❌ Erreur décodage token:', error);
            return res.status(401).json({ 
                success: false,
                error: 'Token invalide' 
            });
        }
        
        // Vérifier expiration
        if (userData.exp && Date.now() > userData.exp) {
            return res.status(401).json({ 
                success: false,
                error: 'Token expiré' 
            });
        }
        
        // Retourner les infos utilisateur
        res.json({
            success: true,
            user: {
                id: userData.id,
                email: userData.email,
                firstName: userData.firstName || 'Utilisateur',
                lastName: userData.lastName || 'Test',
                credits: 3,
                subscription: 'free',
                company_name: '',
                phone: '',
                address: '',
                siret: ''
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur user info:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur' 
        });
    }
});

// 7. CREATE CHECKOUT SESSION (Stripe)
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        console.log('💳 POST /api/create-checkout-session');
        
        // Vérifier l'authentification
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({ 
                success: false,
                error: 'Non autorisé' 
            });
        }
        
        const { priceId } = req.body;
        console.log('Price ID reçu:', priceId);
        
        if (!priceId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Price ID manquant' 
            });
        }
        
        // Simulation de session Stripe
        res.json({
            success: true,
            url: `https://checkout.stripe.com/test?session=test_${Date.now()}`,
            sessionId: `test_session_${Date.now()}`,
            message: 'Mode test - Configurez Stripe pour la production',
            priceId: priceId
        });
        
    } catch (error) {
        console.error('❌ Erreur checkout:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 8. SAVE QUOTE
app.post('/api/quotes', async (req, res) => {
    try {
        console.log('📄 POST /api/quotes');
        
        // Vérifier l'authentification
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({ 
                success: false,
                error: 'Non autorisé' 
            });
        }
        
        const { client_name, total_ttc } = req.body;
        console.log('Devis à sauvegarder:', { client_name, total_ttc });
        
        if (!client_name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nom du client requis' 
            });
        }
        
        // Simulation de sauvegarde
        const quoteNumber = `DEV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        res.json({
            success: true,
            quote: {
                id: Date.now(),
                quote_number: quoteNumber,
                client_name: client_name,
                total_ttc: total_ttc || 0,
                created_at: new Date().toISOString()
            },
            credits_remaining: 2,
            message: 'Devis sauvegardé avec succès (mode test)'
        });
        
    } catch (error) {
        console.error('❌ Erreur sauvegarde devis:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la sauvegarde' 
        });
    }
});

// 9. STRIPE WEBHOOK
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), (req, res) => {
    console.log('📨 POST /api/stripe-webhook');
    res.json({ 
        received: true,
        message: 'Webhook traité en mode test',
        timestamp: new Date().toISOString()
    });
});

// ====================
// ROUTES FICHIERS HTML
// ====================

app.get('/', (req, res) => {
    console.log('📄 GET / (index.html)');
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login.html', (req, res) => {
    console.log('📄 GET /login.html');
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register.html', (req, res) => {
    console.log('📄 GET /register.html');
    res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/create.html', (req, res) => {
    console.log('📄 GET /create.html');
    res.sendFile(path.join(__dirname, 'create.html'));
});

app.get('/pricing.html', (req, res) => {
    console.log('📄 GET /pricing.html');
    res.sendFile(path.join(__dirname, 'pricing.html'));
});

app.get('/dashboard.html', (req, res) => {
    console.log('📄 GET /dashboard.html');
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ====================
// ROUTE 404 POUR API (AMÉLIORÉE)
// ====================

app.use('/api/*', (req, res) => {
    console.log(`❌ Route API non trouvée: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.originalUrl} non trouvée`,
        availableRoutes: [
            'GET    /api/test',
            'GET    /api/health',
            'POST   /api/login',
            'GET    /api/login (debug)',
            'POST   /api/register',
            'GET    /api/user',
            'POST   /api/create-checkout-session',
            'POST   /api/quotes',
            'POST   /api/stripe-webhook'
        ]
    });
});

// ====================
// ROUTE CATCH-ALL POUR SPA
// ====================

app.get('*', (req, res) => {
    console.log(`🌐 Route catch-all: ${req.url}`);
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ====================
// DÉMARRAGE SERVEUR
// ====================

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║               🚀 DEVISPRO - RENDER               ║
╠══════════════════════════════════════════════════╣
║ 📡 Port: ${PORT}                                      
║ 🌐 Environnement: ${process.env.NODE_ENV || 'development'}          
║ 🔗 URL API: https://votre-app.onrender.com/api/test  
║ 📊 Routes configurées: 9                          
║ ⚡ Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅' : '❌'}                
╚══════════════════════════════════════════════════╝
    `);
    
    console.log('\n📋 Routes disponibles:');
    console.log('  GET    /api/test');
    console.log('  GET    /api/health');
    console.log('  POST   /api/login');
    console.log('  GET    /api/login (debug)');
    console.log('  POST   /api/register');
    console.log('  GET    /api/user');
    console.log('  POST   /api/create-checkout-session');
    console.log('  POST   /api/quotes');
    console.log('  POST   /api/stripe-webhook');
    console.log('\n📄 Pages HTML:');
    console.log('  /, /login.html, /register.html, /create.html, /pricing.html, /dashboard.html');
});
