require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ====================
// CONNEXION BASE DE DONNÉES
// ====================

let db;

async function connectDB() {
    try {
        // Sur Render, pas de MySQL, utilisez SQLite
        if (process.env.NODE_ENV === 'production' || !process.env.DB_HOST) {
            console.log('🌐 Environnement Render - Utilisation de SQLite');
            
            const sqlite3 = require('sqlite3').verbose();
            const { open } = require('sqlite');
            
            // Créer le dossier data
            if (!fs.existsSync('./data')) {
                fs.mkdirSync('./data');
            }
            
            // Ouvrir SQLite
            db = await open({
                filename: './data/devispro.db',
                driver: sqlite3.Database
            });
            
            console.log('✅ SQLite connecté');
            
            // Créer les tables SQLite
            await createSQLiteTables();
            
        } else {
            // Mode développement avec MySQL
            db = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                port: process.env.DB_PORT || 3306
            });
            console.log('✅ MySQL connecté avec succès');
            await createTables();
        }
        
    } catch (error) {
        console.error('❌ Erreur connexion base de données:', error.message);
        console.log('🔄 Mode fichiers JSON activé');
        db = null;
    }
}

async function createTables() {
    try {
        // Table users (MySQL)
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
        
        // Table quotes (MySQL)
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
        
        // Table stripe_payments (MySQL)
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

// ⚠️ AJOUTEZ CETTE FONCTION MANQUANTE ⚠️
async function createSQLiteTables() {
    try {
        // Table users (SQLite)
        await db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                first_name TEXT,
                last_name TEXT,
                company_name TEXT,
                phone TEXT,
                address TEXT,
                siret TEXT,
                credits INTEGER DEFAULT 3,
                subscription TEXT DEFAULT 'free',
                stripe_customer_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Table quotes (SQLite)
        await db.run(`
            CREATE TABLE IF NOT EXISTS quotes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                quote_number TEXT UNIQUE NOT NULL,
                client_name TEXT NOT NULL,
                client_email TEXT,
                client_address TEXT,
                total_ht REAL DEFAULT 0,
                total_tva REAL DEFAULT 0,
                total_ttc REAL DEFAULT 0,
                status TEXT DEFAULT 'draft',
                services TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        
        // Table stripe_payments (SQLite)
        await db.run(`
            CREATE TABLE IF NOT EXISTS stripe_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                stripe_payment_id TEXT UNIQUE,
                amount REAL,
                currency TEXT DEFAULT 'eur',
                status TEXT,
                subscription_type TEXT,
                credits_added INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        
        // Créer des indexes
        await db.run('CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_quotes_number ON quotes(quote_number)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_payments_user ON stripe_payments(user_id)');
        
        console.log('✅ Tables SQLite créées');
        
    } catch (error) {
        console.error('❌ Erreur création tables SQLite:', error.message);
    }
}

// ====================
// FONCTIONS UTILITAIRES
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
// ROUTES API
// ====================

// 1. TEST ROUTES
app.get('/api/test', (req, res) => {
    console.log('✅ Test API appelée');
    res.json({
        success: true,
        message: '🚀 DevisPro API fonctionnelle',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        database: db ? 'connecté' : 'non connecté',
        stripe: process.env.STRIPE_SECRET_KEY ? 'configuré' : 'non configuré'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'devispro',
        uptime: process.uptime(),
        database: db ? 'connected' : 'disconnected'
    });
});

// 2. LOGIN (version simplifiée pour Render)
app.post('/api/login', async (req, res) => {
    try {
        console.log('🔐 Tentative de connexion');
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email et mot de passe requis' 
            });
        }
        
        // Mode simulation pour Render
        if (email.includes('@') && password.length >= 3) {
            const tokenData = {
                id: Date.now(),
                email: email,
                exp: Date.now() + 30 * 24 * 60 * 60 * 1000
            };
            const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
            
            return res.json({
                success: true,
                token: token,
                user: {
                    id: 1,
                    email: email,
                    firstName: 'Utilisateur',
                    lastName: 'Test',
                    credits: 3,
                    subscription: 'free'
                },
                message: 'Mode test - Connecté avec succès'
            });
        }
        
        res.status(401).json({ 
            success: false, 
            error: 'Email ou mot de passe incorrect' 
        });
        
    } catch (error) {
        console.error('❌ Erreur login:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur serveur' 
        });
    }
});

// 3. REGISTER (version simplifiée)
app.post('/api/register', async (req, res) => {
    try {
        console.log('📝 Tentative d\'inscription');
        const { email, password, firstName, lastName } = req.body;
        
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tous les champs sont requis' 
            });
        }
        
        if (!email.includes('@')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email invalide' 
            });
        }
        
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
            message: 'Compte créé (mode test)'
        });
        
    } catch (error) {
        console.error('❌ Erreur register:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur création compte' 
        });
    }
});

// 4. CREATE CHECKOUT SESSION (version test)
app.post('/api/create-checkout-session', (req, res) => {
    try {
        console.log('💳 Création session Stripe');
        
        // Vérification token simplifiée
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Non autorisé' });
        }
        
        const { priceId } = req.body;
        
        res.json({
            success: true,
            url: `https://checkout.stripe.com/test?session=test_${Date.now()}`,
            sessionId: `test_${Date.now()}`,
            message: 'Mode test - Configurez Stripe pour la production',
            priceId: priceId || 'non spécifié'
        });
        
    } catch (error) {
        console.error('❌ Erreur checkout:', error);
        res.status(500).json({ error: error.message });
    }
});

// 5. GET USER INFO
app.get('/api/user', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Non autorisé' });
        }
        
        // Décoder token
        let userData;
        try {
            userData = JSON.parse(Buffer.from(token, 'base64').toString());
        } catch {
            return res.status(401).json({ error: 'Token invalide' });
        }
        
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
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 6. SAVE QUOTE
app.post('/api/quotes', (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Non autorisé' });
        }
        
        const { client_name, total_ttc } = req.body;
        if (!client_name) {
            return res.status(400).json({ error: 'Nom client requis' });
        }
        
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
            message: 'Devis sauvegardé (mode test)'
        });
        
    } catch (error) {
        console.error('❌ Erreur sauvegarde devis:', error);
        res.status(500).json({ error: 'Erreur sauvegarde' });
    }
});

// 7. STRIPE WEBHOOK (simulation)
app.post('/api/stripe-webhook', (req, res) => {
    console.log('📨 Webhook Stripe (simulation)');
    res.json({ 
        received: true,
        message: 'Webhook traité en mode test'
    });
});

// ====================
// ROUTES FICHIERS HTML
// ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/create.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'create.html'));
});

app.get('/pricing.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pricing.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

// ====================
// ROUTE 404
// ====================

app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ 
            error: 'Route API non trouvée',
            path: req.path 
        });
    }
    res.status(404).send('Page non trouvée');
});

// ====================
// DÉMARRAGE SERVEUR
// ====================

async function startServer() {
    await connectDB();
    
    app.listen(PORT, () => {
        console.log('='.repeat(50));
        console.log('🚀 DEVISPRO - Render Ready');
        console.log('='.repeat(50));
        console.log(`📡 Port: ${PORT}`);
        console.log(`🗄️  Database: ${db ? 'connectée' : 'non connectée'}`);
        console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'ok' : 'non configuré'}`);
        console.log(`🌐 Test: http://localhost:${PORT}/api/test`);
        console.log('='.repeat(50));
    });
}

startServer().catch(console.error);
