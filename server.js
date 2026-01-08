require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ====================
// CONNEXION MYSQL
// ====================

let db;

async function connectDB() {
    try {
        db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        console.log('✅ MySQL connecté avec succès');
        
        // Créer les tables si elles n'existent pas
        await createTables();
        
    } catch (error) {
        console.error('❌ Erreur connexion MySQL:', error.message);
        // Fallback sur les fichiers JSON en cas d'erreur
        console.log('🔄 Utilisation du mode fichier (fallback)');
    }
}

async function createTables() {
    try {
        // Table users
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                company_name VARCHAR(255),
                phone VARCHAR(20),
                address TEXT,
                siret VARCHAR(14),
                credits INT DEFAULT 3,
                subscription ENUM('free', 'basic', 'pro') DEFAULT 'free',
                stripe_customer_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Table quotes
        await db.execute(`
            CREATE TABLE IF NOT EXISTS quotes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                quote_number VARCHAR(50) UNIQUE NOT NULL,
                client_name VARCHAR(255) NOT NULL,
                client_email VARCHAR(255),
                client_address TEXT,
                total_ht DECIMAL(10,2) DEFAULT 0,
                total_tva DECIMAL(10,2) DEFAULT 0,
                total_ttc DECIMAL(10,2) DEFAULT 0,
                status ENUM('draft', 'sent', 'paid', 'cancelled') DEFAULT 'draft',
                services JSON,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_quote_number (quote_number)
            )
        `);
        
        // Table paiements Stripe
        // Table stripe_payments (NOUVELLE)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS stripe_payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                stripe_payment_id VARCHAR(255) UNIQUE,
                amount DECIMAL(10,2),
                currency VARCHAR(3) DEFAULT 'eur',
                status VARCHAR(50),
                subscription_type VARCHAR(50),
                credits_added INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_stripe_payment_id (stripe_payment_id)
            )
        `);
        
        
        console.log('✅ Tables MySQL créées avec succès');
    } catch (error) {
        console.error('❌ Erreur création tables:', error.message);
    }
}

// ====================
// FONCTIONS UTILITAIRES (compatibles avec votre code existant)
// ====================

function verifyToken(token) {
    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        if (decoded.exp && Date.now() > decoded.exp) return null;
        return decoded;
    } catch (error) {
        return null;
    }
}

function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
    }
    
    const userData = verifyToken(token);
    if (!userData) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
    
    req.user = userData;
    next();
}

// ====================
// ROUTES API - MYSQL
// ====================

// 1. CONNEXION (avec MySQL)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email et mot de passe requis' 
            });
        }
        
        if (db) {
            // Version MySQL
            const [rows] = await db.execute(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );
            
            if (rows.length === 0) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Email ou mot de passe incorrect' 
                });
            }
            
            const user = rows[0];
            const validPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!validPassword) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Email ou mot de passe incorrect' 
                });
            }
            
            // Générer token
            const tokenData = {
                id: user.id,
                email: user.email,
                exp: Date.now() + 30 * 24 * 60 * 60 * 1000
            };
            const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
            
            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    company_name: user.company_name,
                    phone: user.phone,
                    address: user.address,
                    siret: user.siret,
                    credits: user.credits,
                    subscription: user.subscription
                }
            });
            
        } else {
            // Fallback: version fichier (votre code existant)
            const fs = require('fs').promises;
            const users = JSON.parse(await fs.readFile('./data/users.json', 'utf8'));
            const user = users.find(u => u.email === email && u.password === password);
            
            if (!user) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Email ou mot de passe incorrect' 
                });
            }
            
            // Générer token
            const tokenData = {
                id: user.id,
                email: user.email,
                exp: Date.now() + 30 * 24 * 60 * 60 * 1000
            };
            const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
            
            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    company_name: user.company_name,
                    phone: user.phone,
                    address: user.address,
                    siret: user.siret,
                    credits: user.credits,
                    subscription: user.subscription
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Erreur connexion:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur' 
        });
    }
});

// 2. INSCRIPTION (avec MySQL)
app.post('/api/register', async (req, res) => {
    try {
        const { 
            email, 
            password, 
            firstName, 
            lastName, 
            company_name, 
            phone,
            address,
            siret 
        } = req.body;
        
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tous les champs obligatoires doivent être remplis' 
            });
        }
        
        if (db) {
            // Version MySQL
            // Vérifier si email existe
            const [existing] = await db.execute(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );
            
            if (existing.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Cet email est déjà utilisé' 
                });
            }
            
            // Hacher le mot de passe
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Insérer l'utilisateur
            const [result] = await db.execute(
                `INSERT INTO users (email, password_hash, first_name, last_name, company_name, phone, address, siret, credits, subscription) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 3, 'free')`,
                [email, hashedPassword, firstName, lastName, company_name || '', phone || '', address || '', siret || '']
            );
            
            // Créer un client Stripe
            let stripeCustomerId = null;
            try {
                const customer = await stripe.customers.create({
                    email: email,
                    name: `${firstName} ${lastName}`,
                    metadata: {
                        user_id: result.insertId
                    }
                });
                stripeCustomerId = customer.id;
                
                // Mettre à jour l'utilisateur avec l'ID Stripe
                await db.execute(
                    'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
                    [stripeCustomerId, result.insertId]
                );
            } catch (stripeError) {
                console.error('⚠️ Erreur création client Stripe:', stripeError.message);
            }
            
            // Générer token
            const tokenData = {
                id: result.insertId,
                email: email,
                exp: Date.now() + 30 * 24 * 60 * 60 * 1000
            };
            const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
            
            res.json({
                success: true,
                token,
                user: {
                    id: result.insertId,
                    email: email,
                    firstName: firstName,
                    lastName: lastName,
                    company_name: company_name || '',
                    phone: phone || '',
                    address: address || '',
                    siret: siret || '',
                    credits: 3,
                    subscription: 'free',
                    stripe_customer_id: stripeCustomerId
                }
            });
            
        } else {
            // Fallback: version fichier
            // (garder votre code existant ici)
        }
        
    } catch (error) {
        console.error('❌ Erreur inscription:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la création du compte' 
        });
    }
});

// 3. SAUVEGARDER UN DEVIS (avec MySQL)
app.post('/api/quotes', authenticate, async (req, res) => {
    try {
        const { 
            quote_number, 
            client_name, 
            client_email, 
            client_address,
            company_info,
            services,
            total_ht,
            total_tva,
            total_ttc,
            notes
        } = req.body;
        
        const userId = req.user.id;
        
        if (db) {
            // Version MySQL
            
            // Vérifier crédits
            const [userRows] = await db.execute(
                'SELECT credits, subscription FROM users WHERE id = ?',
                [userId]
            );
            
            if (userRows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Utilisateur non trouvé' 
                });
            }
            
            const user = userRows[0];
            
            // Vérifier crédits pour les utilisateurs free
            if (user.subscription === 'free' && user.credits <= 0) {
                return res.status(402).json({ 
                    success: false, 
                    error: 'Crédits insuffisants',
                    message: 'Vous avez utilisé vos 3 devis gratuits. Passez à un abonnement pour continuer.'
                });
            }
            
            // Décrémenter crédits pour free
            if (user.subscription === 'free') {
                await db.execute(
                    'UPDATE users SET credits = credits - 1 WHERE id = ?',
                    [userId]
                );
            }
            
            // Sauvegarder le devis
            const [result] = await db.execute(
                `INSERT INTO quotes (user_id, quote_number, client_name, client_email, client_address, total_ht, total_tva, total_ttc, services, notes, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
                [
                    userId,
                    quote_number || `DEV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    client_name,
                    client_email || '',
                    client_address || '',
                    parseFloat(total_ht) || 0,
                    parseFloat(total_tva) || 0,
                    parseFloat(total_ttc) || 0,
                    JSON.stringify(services || []),
                    notes || ''
                ]
            );
            
            // Récupérer les crédits mis à jour
            const [updatedUser] = await db.execute(
                'SELECT credits FROM users WHERE id = ?',
                [userId]
            );
            
            res.json({
                success: true,
                quote: {
                    id: result.insertId,
                    quote_number: quote_number,
                    client_name: client_name,
                    total_ttc: total_ttc || 0,
                    created_at: new Date().toISOString()
                },
                credits_remaining: updatedUser[0]?.credits || 0
            });
            
        } else {
            // Fallback: version fichier
            // (garder votre code existant ici)
        }
        
    } catch (error) {
        console.error('❌ Erreur sauvegarde devis:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la sauvegarde du devis' 
        });
    }
});

// ====================
// STRIPE - PAIEMENTS
// ====================



// 2. Webhook Stripe (pour les événements)
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    let event;
    
    try {
        event = stripe.webhooks.constructEvent(
            req.body, 
            sig, 
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('❌ Erreur webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Gérer les événements
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            await handleCheckoutCompleted(session);
            break;
            
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
            const subscription = event.data.object;
            await handleSubscriptionChange(subscription, event.type);
            break;
            
        case 'invoice.payment_succeeded':
            const invoice = event.data.object;
            await handlePaymentSucceeded(invoice);
            break;
    }
    
    res.json({received: true});
});

async function handleCheckoutCompleted(session) {
    try {
        const userId = session.metadata?.user_id;
        const subscriptionId = session.subscription;
        
        if (userId && subscriptionId) {
            // Récupérer l'abonnement
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const planId = subscription.items.data[0].price.id;
            
            // Déterminer le type d'abonnement
            let subscriptionType = 'free';
            if (planId.includes('basic')) subscriptionType = 'basic';
            else if (planId.includes('pro')) subscriptionType = 'pro';
            
            // Mettre à jour l'utilisateur
            await db.execute(
                `UPDATE users 
                 SET subscription = ?, 
                     credits = CASE 
                         WHEN ? = 'basic' THEN 50 
                         WHEN ? = 'pro' THEN 9999 
                         ELSE credits 
                     END
                 WHERE id = ?`,
                [subscriptionType, subscriptionType, subscriptionType, userId]
            );
            
            // Enregistrer le paiement
            await db.execute(
                `INSERT INTO stripe_payments (user_id, stripe_payment_id, amount, currency, status, subscription_type) 
                 VALUES (?, ?, ?, 'eur', 'succeeded', ?)`,
                [userId, session.id, session.amount_total / 100, subscriptionType]
            );
            
            console.log(`✅ Utilisateur ${userId} mis à jour vers ${subscriptionType}`);
        }
    } catch (error) {
        console.error('❌ Erreur traitement checkout:', error);
    }
}
// ====================
// STRIPE - CRÉATION SESSION DE PAIEMENT
// ====================

app.post('/api/create-checkout-session', authenticate, async (req, res) => {
    try {
        console.log('📨 Création session Stripe pour user:', req.user.id);
        
        const { priceId, successUrl, cancelUrl, metadata } = req.body;
        
        if (!priceId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Price ID manquant' 
            });
        }
        
        // Vérifier si l'utilisateur existe
        const [userRows] = await db.execute(
            'SELECT id, email, first_name, last_name, stripe_customer_id FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (userRows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur non trouvé' 
            });
        }
        
        const user = userRows[0];
        let customerId = user.stripe_customer_id;
        
        // Créer un client Stripe s'il n'existe pas
        if (!customerId) {
            console.log('👤 Création client Stripe pour:', user.email);
            
            try {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                    metadata: {
                        user_id: user.id.toString(),
                        source: 'devispro'
                    }
                });
                
                customerId = customer.id;
                
                // Sauvegarder l'ID Stripe en base
                await db.execute(
                    'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
                    [customerId, user.id]
                );
                
                console.log('✅ Client Stripe créé:', customerId);
            } catch (stripeError) {
                console.error('❌ Erreur création client Stripe:', stripeError.message);
                return res.status(500).json({
                    success: false,
                    error: 'Erreur lors de la création du client de paiement'
                });
            }
        }
        
        // Récupérer les infos du prix depuis Stripe
        let priceInfo;
        try {
            priceInfo = await stripe.prices.retrieve(priceId);
            console.log('💰 Prix récupéré:', priceInfo.id, '- Type:', priceInfo.type);
        } catch (priceError) {
            console.error('❌ Erreur récupération prix:', priceError.message);
            return res.status(400).json({
                success: false,
                error: 'Price ID invalide. Vérifiez votre configuration Stripe.'
            });
        }
        
        // Déterminer le mode (abonnement ou paiement unique)
        const isSubscription = priceInfo.type === 'recurring';
        const mode = isSubscription ? 'subscription' : 'payment';
        
        // URLs de retour par défaut
        const defaultSuccessUrl = `${process.env.FRONTEND_URL || req.headers.origin}/dashboard.html?session_id={CHECKOUT_SESSION_ID}&success=true`;
        const defaultCancelUrl = `${process.env.FRONTEND_URL || req.headers.origin}/pricing.html?cancelled=true`;
        
        // Préparer les paramètres de la session
        const sessionParams = {
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: mode,
            success_url: successUrl || defaultSuccessUrl,
            cancel_url: cancelUrl || defaultCancelUrl,
            client_reference_id: `user_${user.id}`,
            metadata: {
                user_id: user.id.toString(),
                user_email: user.email,
                ...(metadata || {})
            },
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            shipping_address_collection: {
                allowed_countries: ['FR', 'BE', 'CH', 'LU', 'MC']
            }
        };
        
        // Ajouter des paramètres spécifiques aux abonnements
        if (isSubscription) {
            sessionParams.subscription_data = {
                metadata: {
                    user_id: user.id.toString(),
                    price_id: priceId,
                    plan_type: priceInfo.product || 'pro'
                },
                trial_period_days: 0 // Pas de période d'essai
            };
        } else {
            // Pour les paiements uniques (crédits)
            sessionParams.payment_intent_data = {
                metadata: {
                    user_id: user.id.toString(),
                    price_id: priceId,
                    type: 'credits_purchase',
                    credits: metadata?.credits || '0'
                }
            };
        }
        
        // Créer la session Stripe
        console.log('🛒 Création session Stripe avec params:', JSON.stringify(sessionParams, null, 2));
        
        const session = await stripe.checkout.sessions.create(sessionParams);
        
        console.log('✅ Session créée:', session.id, '- URL:', session.url);
        
        res.json({
            success: true,
            sessionId: session.id,
            url: session.url,
            mode: mode
        });
        
    } catch (error) {
        console.error('❌ Erreur création session Stripe:', error);
        
        res.status(500).json({
            success: false,
            error: error.message || 'Erreur lors de la création de la session de paiement',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ====================
// WEBHOOK STRIPE
// ====================

app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET non configuré');
        }
        
        event = stripe.webhooks.constructEvent(
            req.body, 
            sig, 
            webhookSecret
        );
        
        console.log('📨 Webhook reçu:', event.type, '- ID:', event.id);
        
    } catch (err) {
        console.error('❌ Erreur webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Gérer les événements
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event.data.object);
                break;
                
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object, event.type);
                break;
                
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;
                
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;
                
            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;
                
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;
        }
        
        res.json({received: true});
        
    } catch (error) {
        console.error('❌ Erreur traitement webhook:', error);
        res.status(500).json({error: error.message});
    }
});

// ====================
// FONCTIONS WEBHOOK
// ====================

async function handleCheckoutSessionCompleted(session) {
    try {
        console.log('✅ Checkout complété:', session.id);
        
        const userId = session.metadata?.user_id;
        const isSubscription = session.mode === 'subscription';
        const subscriptionId = session.subscription;
        
        if (!userId) {
            console.warn('⚠️ User ID manquant dans les métadonnées');
            return;
        }
        
        // Pour les abonnements
        if (isSubscription && subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const priceId = subscription.items.data[0].price.id;
            
            // Déterminer le type d'abonnement
            let subscriptionType = 'pro';
            if (priceId.includes('basic')) subscriptionType = 'basic';
            if (priceId.includes('pro')) subscriptionType = 'pro';
            
            // Mettre à jour l'utilisateur
            await db.execute(
                `UPDATE users 
                 SET subscription = ?, 
                     credits = CASE 
                         WHEN ? = 'basic' THEN 50 
                         WHEN ? = 'pro' THEN 9999 
                         ELSE credits 
                     END,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [subscriptionType, subscriptionType, subscriptionType, userId]
            );
            
            console.log(`📝 Utilisateur ${userId} mis à jour vers ${subscriptionType}`);
            
        } else if (session.mode === 'payment') {
            // Pour l'achat de crédits
            const credits = parseInt(session.metadata?.credits) || 0;
            
            if (credits > 0) {
                await db.execute(
                    'UPDATE users SET credits = credits + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [credits, userId]
                );
                
                console.log(`💰 ${credits} crédits ajoutés à l'utilisateur ${userId}`);
            }
        }
        
        // Enregistrer le paiement
        await db.execute(
            `INSERT INTO stripe_payments (user_id, stripe_payment_id, amount, currency, status, subscription_type, credits_added, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                userId,
                session.id,
                session.amount_total / 100,
                session.currency,
                'succeeded',
                isSubscription ? 'subscription' : 'credits',
                session.metadata?.credits || 0
            ]
        );
        
    } catch (error) {
        console.error('❌ Erreur traitement checkout:', error);
    }
}

async function handlePaymentIntentSucceeded(paymentIntent) {
    try {
        console.log('💳 Paiement réussi:', paymentIntent.id);
        
        const userId = paymentIntent.metadata?.user_id;
        const credits = parseInt(paymentIntent.metadata?.credits) || 0;
        
        if (userId && credits > 0) {
            await db.execute(
                'UPDATE users SET credits = credits + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [credits, userId]
            );
            
            console.log(`💰 ${credits} crédits ajoutés via payment_intent à l'utilisateur ${userId}`);
        }
    } catch (error) {
        console.error('❌ Erreur traitement payment_intent:', error);
    }
}

async function handleSubscriptionUpdated(subscription, eventType) {
    try {
        const userId = subscription.metadata?.user_id;
        
        if (!userId) {
            console.warn('⚠️ User ID manquant dans les métadonnées de l\'abonnement');
            return;
        }
        
        if (eventType === 'customer.subscription.deleted' || subscription.status === 'canceled') {
            // Abonnement annulé
            await db.execute(
                'UPDATE users SET subscription = "free", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [userId]
            );
            console.log(`❌ Abonnement annulé pour l'utilisateur ${userId}`);
        } else {
            // Abonnement mis à jour
            const priceId = subscription.items.data[0].price.id;
            let subscriptionType = 'pro';
            if (priceId.includes('basic')) subscriptionType = 'basic';
            
            await db.execute(
                'UPDATE users SET subscription = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [subscriptionType, userId]
            );
            console.log(`🔄 Abonnement mis à jour pour l'utilisateur ${userId}: ${subscriptionType}`);
        }
    } catch (error) {
        console.error('❌ Erreur mise à jour abonnement:', error);
    }
}

// ====================
// ROUTE POUR RÉCUPÉRER LES INFOS UTILISATEUR
// ====================

app.get('/api/user', authenticate, async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, email, first_name, last_name, company_name, phone, address, siret, credits, subscription, stripe_customer_id FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Utilisateur non trouvé' 
            });
        }
        
        const user = rows[0];
        
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                company_name: user.company_name,
                phone: user.phone,
                address: user.address,
                siret: user.siret,
                credits: user.credits,
                subscription: user.subscription,
                stripe_customer_id: user.stripe_customer_id
            }
        });
        
    } catch (error) {
        console.error('❌ Erreur récupération utilisateur:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur' 
        });
    }
});
// ====================
// PAGES HTML (garder votre code existant)
// ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/create.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'create.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// ... autres routes HTML


// ====================
// DÉMARRAGE SERVEUR
// ====================

async function startServer() {
    // Connecter à MySQL
    await connectDB();
    
    app.listen(PORT, () => {
        console.log('='.repeat(60));
        console.log('🚀 DEVISPRO - Version Production');
        console.log('='.repeat(60));
        console.log(`📡 Serveur: http://localhost:${PORT}`);
        console.log(`🗄️  Base de données: ${db ? 'MySQL connecté' : 'Mode fichier (fallback)'}`);
        console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Activé' : 'Désactivé'}`);
        console.log('='.repeat(60));
    });
}


startServer().catch(console.error);
