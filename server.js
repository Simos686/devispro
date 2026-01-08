require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialisation de Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51S5wIk8W7xqYoZIBtlQnkJcWTAXeqVlDo4s3LWc8OpqLTSEaPu67wuyYC7goZgtRUnFZphaa7IUtHjHScH9eIkC300wh4oeTuQ');

// ====================
// MIDDLEWARE
// ====================
app.use(cors({
    origin: '*',
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
        // Prix en mode test Stripe - IMPORTANT: Utilisez vos VRAIS Price IDs
        const pricing = {
            basic_monthly: {
                name: 'Pro Mensuel',
                price: 19.99,
                priceId: 'price_1PqA6i8W7xqYoZIBKlsopkYJ', // ← REMPLACEZ par votre VRAI Price ID
                credits: 'illimités',
                features: ['Devis illimités', 'PDF pro', 'Support prioritaire']
            },
            basic_yearly: {
                name: 'Pro Annuel',
                price: 190.00,
                priceId: 'price_1PqA7J8W7xqYoZIBkflOPQr', // ← REMPLACEZ par votre VRAI Price ID
                credits: 'illimités',
                features: ['2 mois offerts', 'Tout inclus', 'Support 24/7']
            },
            credits_10: {
                name: '10 crédits',
                price: 15.00,
                priceId: 'price_1PqA8c8W7xqYoZIBvEfLmNpX', // ← REMPLACEZ par votre VRAI Price ID
                credits: 10,
                features: ['1,50€ / devis', 'Pas d\'engagement']
            },
            credits_25: {
                name: '25 crédits',
                price: 30.00,
                priceId: 'price_1PqA9h8W7xqYoZIBzGtKwYlM', // ← REMPLACEZ par votre VRAI Price ID
                credits: 25,
                features: ['1,20€ / devis', 'Économique']
            },
            credits_50: {
                name: '50 crédits',
                price: 50.00,
                priceId: 'price_1PqAAb8W7xqYoZIBtHjKxZyQ', // ← REMPLACEZ par votre VRAI Price ID
                credits: 50,
                features: ['1,00€ / devis', 'Meilleur rapport']
            },
            credits_100: {
                name: '100 crédits',
                price: 80.00,
                priceId: 'price_1PqABU8W7xqYoZIBcDfLmNpX', // ← REMPLACEZ par votre VRAI Price ID
                credits: 100,
                features: ['0,80€ / devis', 'Idéal professionnel']
            }
        };
        
        res.json({
            success: true,
            pricing: pricing,
            stripePublicKey: process.env.STRIPE_PUBLIC_KEY || 'pk_test_51S5wIk8W7xqYoZIBtlQnkJcWTAXeqVlDo4s3LWc8OpqLTSEaPu67wuyYC7goZgtRUnFZphaa7IUtHjHScH9eIkC300wh4oeTuQ'
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 5. CREATE CHECKOUT SESSION (VRAI STRIPE) ⭐ CORRIGÉ ⭐
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        console.log('💳 Création de session Stripe');
        console.log('📦 Body reçu:', req.body);
        
        const { priceId, plan, customerEmail, success_url, cancel_url } = req.body;
        
        if (!priceId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Price ID manquant' 
            });
        }
        
        // Vérifier que c'est bien un Price ID (commence par price_)
        if (!priceId.startsWith('price_')) {
            console.error('❌ Ce n\'est pas un Price ID valide:', priceId);
            return res.status(400).json({ 
                success: false, 
                error: 'Format Price ID invalide. Doit commencer par "price_"' 
            });
        }
        
        // Créer la session Stripe
        const sessionParams = {
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: priceId.includes('monthly') || priceId.includes('yearly') ? 'subscription' : 'payment',
            success_url: success_url || `${process.env.FRONTEND_URL || 'https://devispro.onrender.com'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancel_url || `${process.env.FRONTEND_URL || 'https://devispro.onrender.com'}/pricing.html`,
            metadata: {
                plan: plan || 'basic',
                type: priceId.includes('monthly') || priceId.includes('yearly') ? 'subscription' : 'credits'
            }
        };
        
        // Ajouter l'email client si fourni
        if (customerEmail) {
            sessionParams.customer_email = customerEmail;
        }
        
        const session = await stripe.checkout.sessions.create(sessionParams);
        
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
            code: error.code,
            type: error.type
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
            console.log('Métadonnées:', session.metadata);
            
            // ICI: Mettre à jour votre base de données
            // - Activer l'abonnement pour l'utilisateur
            // - Ajouter les crédits
            // - Envoyer un email de confirmation
            
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
🔗 Frontend: ${process.env.FRONTEND_URL || 'https://devispro.onrender.com'}
📊 Test API: /api/test
💰 Pricing API: /api/pricing
    `);
});
