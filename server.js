require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Variables globales
let db = null;

// ====================
// ROUTES API - OBLIGATOIRES
// ====================

// 1. TEST ROUTE (obligatoire)
app.get('/api/test', (req, res) => {
    console.log('✅ Test API appelée');
    res.json({
        success: true,
        message: '🚀 DevisPro API fonctionnelle sur Render',
        timestamp: new Date().toISOString(),
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        routes: [
            '/api/test',
            '/api/health',
            '/api/login',
            '/api/register',
            '/api/user',
            '/api/create-checkout-session',
            '/api/quotes',
            '/api/stripe-webhook'
        ]
    });
});

// 2. HEALTH CHECK (pour Render)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'devispro',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// 3. LOGIN (version simplifiée)
app.post('/api/login', async (req, res) => {
    try {
        console.log('🔐 Tentative de connexion reçue');
        const { email, password } = req.body;
        
        console.log('Données reçues:', { email, password: password ? '***' : 'manquant' });
        
        if (!email || !password) {
            console.log('❌ Email ou mot de passe manquant');
            return res.status(400).json({ 
                success: false, 
                error: 'Email et mot de passe requis' 
            });
        }
        
        // Simulation de connexion réussie
        console.log('✅ Connexion simulée pour:', email);
        
        // Créer un token simple
        const tokenData = {
            id: Date.now(),
            email: email,
            exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 jours
        };
        
        const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
        
        const response = {
            success: true,
            token: token,
            user: {
                id: 1,
                email: email,
                firstName: 'Test',
                lastName: 'User',
                credits: 3,
                subscription: 'free'
            },
            message: 'Connexion réussie (mode test)'
        };
        
        console.log('✅ Réponse login:', JSON.stringify(response, null, 2));
        res.json(response);
        
    } catch (error) {
        console.error('❌ Erreur login:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur: ' + error.message 
        });
    }
});

// 4. REGISTER (inscription)
app.post('/api/register', async (req, res) => {
    try {
        console.log('📝 Tentative d\'inscription');
        const { email, password, firstName, lastName } = req.body;
        
        console.log('Données inscription:', { email, firstName, lastName });
        
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tous les champs sont requis' 
            });
        }
        
        // Validation email basique
        if (!email.includes('@')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Format email invalide' 
            });
        }
        
        // Créer token
        const tokenData = {
            id: Date.now(),
            email: email,
            exp: Date.now() + 30 * 24 * 60 * 60 * 1000
        };
        const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
        
        res.json({
            success: true,
            token: token,
            user: {
                id: Date.now(),
                email: email,
                firstName: firstName,
                lastName: lastName,
                credits: 3,
                subscription: 'free'
            },
            message: 'Compte créé avec succès (mode test)'
        });
        
    } catch (error) {
        console.error('❌ Erreur register:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la création du compte' 
        });
    }
});

// 5. GET USER INFO
app.get('/api/user', async (req, res) => {
    try {
        console.log('👤 Récupération infos utilisateur');
        
        // Vérifier le token
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({ error: 'Token manquant' });
        }
        
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token manquant' });
        }
        
        // Décoder le token
        let userData;
        try {
            const decoded = Buffer.from(token, 'base64').toString();
            userData = JSON.parse(decoded);
            console.log('Token décodé:', userData);
        } catch (error) {
            console.error('❌ Erreur décodage token:', error);
            return res.status(401).json({ error: 'Token invalide' });
        }
        
        // Vérifier expiration
        if (userData.exp && Date.now() > userData.exp) {
            return res.status(401).json({ error: 'Token expiré' });
        }
        
        // Retourner les infos utilisateur
        res.json({
            success: true,
            user: {
                id: userData.id || 1,
                email: userData.email || 'test@test.com',
                firstName: 'Utilisateur',
                lastName: 'Test',
                credits: 3,
                subscription: 'free'
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

// 6. CREATE CHECKOUT SESSION (Stripe)
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        console.log('💳 Création session de paiement');
        
        // Vérifier l'authentification
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({ error: 'Non autorisé' });
        }
        
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token manquant' });
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
            message: 'Mode test - Redirigé vers Stripe',
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

// 7. SAVE QUOTE
app.post('/api/quotes', async (req, res) => {
    try {
        console.log('📄 Sauvegarde devis');
        
        // Vérifier l'authentification
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({ error: 'Non autorisé' });
        }
        
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token manquant' });
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

// 8. STRIPE WEBHOOK
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), (req, res) => {
    console.log('📨 Webhook Stripe reçu (simulation)');
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
    console.log('📄 Servir index.html');
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/create.html', (req, res) => {
    console.log('📄 Servir create.html');
    res.sendFile(path.join(__dirname, 'create.html'));
});

app.get('/pricing.html', (req, res) => {
    console.log('📄 Servir pricing.html');
    res.sendFile(path.join(__dirname, 'pricing.html'));
});

app.get('/dashboard.html', (req, res) => {
    console.log('📄 Servir dashboard.html');
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/login.html', (req, res) => {
    console.log('📄 Servir login.html');
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register.html', (req, res) => {
    console.log('📄 Servir register.html');
    res.sendFile(path.join(__dirname, 'register.html'));
});

// ====================
// ROUTE 404 POUR API
// ====================

app.use('/api/*', (req, res) => {
    console.log(`❌ Route API non trouvée: ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: `Route API non trouvée: ${req.path}`,
        availableRoutes: [
            'GET /api/test',
            'GET /api/health', 
            'POST /api/login',
            'POST /api/register',
            'GET /api/user',
            'POST /api/create-checkout-session',
            'POST /api/quotes',
            'POST /api/stripe-webhook'
        ]
    });
});

// ====================
// DÉMARRAGE SERVEUR
// ====================

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║         🚀 DEVISPRO SUR RENDER           ║
╠══════════════════════════════════════════╣
║ 📡 Port: ${PORT}                              
║ 🌐 Environnement: ${process.env.NODE_ENV || 'development'}
║ 🔗 Test API: /api/test                    
║ 📊 Routes disponibles: 8                  
╚══════════════════════════════════════════╝
    `);
    
    // Log supplémentaire
    console.log('✅ Serveur démarré avec succès');
    console.log('📋 Routes configurées:');
    console.log('  - GET  /api/test');
    console.log('  - GET  /api/health');
    console.log('  - POST /api/login');
    console.log('  - POST /api/register');
    console.log('  - GET  /api/user');
    console.log('  - POST /api/create-checkout-session');
    console.log('  - POST /api/quotes');
    console.log('  - POST /api/stripe-webhook');
});
