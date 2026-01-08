require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialisation de Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_4eC39HqLyjWDarjtT1zdp7dc');

// ====================
// MIDDLEWARE
// ====================
app.use(cors({
    origin: ['https://votre-app.onrender.com', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

// ====================
// ROUTES API
// ====================

// 1. TEST ROUTE
app.get('/api/test', (req, res) => {
    console.log('✅ GET /api/test');
    res.json({
        success: true,
        message: '🚀 DevisPro API avec Stripe',
        stripe: process.env.STRIPE_SECRET_KEY ? '✅ Configuré' : '❌ Non configuré'
    });
});

// 2. HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// 3. LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email et mot de passe requis' 
            });
        }
        
        // Création du token
        const tokenData = {
            id: Date.now(),
            email: email,
            firstName: 'Test',
            lastName: 'User',
            exp: Date.now() + 30 * 24 * 60 * 60 * 1000
        };
        
        const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
        
        res.json({
            success: true,
            token: token,
            user: {
                id: tokenData.id,
                email: email,
                firstName: 'Test',
                lastName: 'User',
                credits: 3,
                subscription: 'free'
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur' 
        });
    }
});

// 4. GET PRICING INFO
app.get('/api/pricing', async (req, res) => {
    try {
        // Prix en mode test Stripe
        const pricing = {
            basic: {
                name: 'Basique',
                price: 9.99,
                priceId: 'price_1PJ1jZKs4lFmh6LgHqDeyp4B', // Remplacez par votre vrai price_id
                credits: 10,
                features: ['10 devis/mois', 'Support email', 'Export PDF']
            },
            pro: {
                name: 'Professionnel',
                price: 29.99,
                priceId: 'price_1PJ1k8Ks4lFmh6LgnM4xM8Jd', // Remplacez par votre vrai price_id
                credits: 50,
                features: ['50 devis/mois', 'Support prioritaire', 'Modèles personnalisés']
            },
            premium: {
                name: 'Premium',
                price: 99.99,
                priceId: 'price_1PJ1kZ4lFmh6LgKs4lFmh6Lg', // Remplacez par votre vrai price_id
                credits: 'Illimités',
                features: ['Devis illimités', 'Support 24/7', 'API intégration']
            }
        };
        
        res.json({
            success: true,
            pricing: pricing,
            stripePublicKey: process.env.STRIPE_PUBLIC_KEY || 'pk_test_TYooMQauvdEDq54NiTphI7jx'
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 5. CREATE CHECKOUT SESSION (VRAI STRIPE) ⭐
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        console.log('💳 Création de session Stripe');
        
        const { priceId, plan, customerEmail } = req.body;
        
        if (!priceId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Price ID manquant' 
            });
        }
        
        // Créer la session Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL || 'https://votre-app.onrender.com'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'https://votre-app.onrender.com'}/pricing.html`,
            customer_email: customerEmail,
            metadata: {
                plan: plan || 'basic',
                userId: req.body.userId || 'anonymous'
            }
        });
        
        console.log('✅ Session Stripe créée:', session.id);
        
        res.json({
            success: true,
            sessionId: session.id,
            url: session.url, // URL de redirection vers Stripe
            publicKey: process.env.STRIPE_PUBLIC_KEY
        });
        
    } catch (error) {
        console.error('❌ Erreur Stripe:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            code: error.code
        });
    }
});

// 6. STRIPE WEBHOOK (pour les événements)
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    
    try {
        // Vérifier la signature du webhook
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test'
        );
    } catch (err) {
        console.error('❌ Signature webhook invalide:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    console.log('📨 Événement Stripe reçu:', event.type);
    
    // Gérer différents types d'événements
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('✅ Paiement réussi pour la session:', session.id);
            console.log('Client email:', session.customer_email);
            console.log('Plan:', session.metadata.plan);
            
            // ICI: Mettre à jour votre base de données
            // - Activer l'abonnement pour l'utilisateur
            // - Ajouter les crédits
            // - Envoyer un email de confirmation
            
            break;
            
        case 'customer.subscription.created':
            const subscription = event.data.object;
            console.log('📅 Nouvel abonnement créé:', subscription.id);
            break;
            
        case 'invoice.payment_succeeded':
            const invoice = event.data.object;
            console.log('💰 Facture payée:', invoice.id);
            break;
            
        case 'customer.subscription.deleted':
            console.log('❌ Abonnement annulé');
            break;
    }
    
    res.json({ received: true });
});

// 7. CHECK SESSION STATUS
app.get('/api/check-session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        res.json({
            success: true,
            session: {
                id: session.id,
                status: session.status,
                payment_status: session.payment_status,
                customer_email: session.customer_email,
                amount_total: session.amount_total ? session.amount_total / 100 : 0,
                currency: session.currency,
                metadata: session.metadata
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur vérification session:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 8. GET USER INFO
app.get('/api/user', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({ 
                success: false,
                error: 'Token manquant' 
            });
        }
        
        res.json({
            success: true,
            user: {
                id: 1,
                email: 'test@test.com',
                firstName: 'Test',
                lastName: 'User',
                credits: 3,
                subscription: 'free'
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur' 
        });
    }
});

// 9. SAVE QUOTE
app.post('/api/quotes', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            return res.status(401).json({ 
                success: false,
                error: 'Non autorisé' 
            });
        }
        
        const { client_name, total_ttc } = req.body;
        
        if (!client_name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nom du client requis' 
            });
        }
        
        const quoteNumber = `DEV-${Date.now()}`;
        
        res.json({
            success: true,
            quote: {
                id: Date.now(),
                quote_number: quoteNumber,
                client_name: client_name,
                total_ttc: total_ttc || 0,
                created_at: new Date().toISOString()
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Erreur sauvegarde' 
        });
    }
});

// Routes fichiers HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/create.html', (req, res) => res.sendFile(path.join(__dirname, 'create.html')));
app.get('/pricing.html', (req, res) => res.sendFile(path.join(__dirname, 'pricing.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/success.html', (req, res) => res.sendFile(path.join(__dirname, 'success.html')));

// Route 404
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: 'Route non trouvée' });
});

// Démarrage serveur
app.listen(PORT, () => {
    console.log(`
🚀 DevisPro avec Stripe démarré sur le port ${PORT}
🌐 URL: http://localhost:${PORT}
💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅ Configuré' : '⚠️ Mode test'}
🔗 Frontend: ${process.env.FRONTEND_URL || 'https://votre-app.onrender.com'}
    `);
});
