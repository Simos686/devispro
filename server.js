const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ====================
// MIDDLEWARE (DOIT ÊTRE EN PREMIER)
// ====================
app.use(cors());
app.use(express.json()); // ⭐ TRÈS IMPORTANT pour POST
app.use(express.static(__dirname));

// ====================
// ROUTES API (DOIVENT ÊTRE APRÈS MIDDLEWARE)
// ====================

// 1. TEST
app.get('/api/test', (req, res) => {
    console.log('📡 GET /api/test');
    res.json({
        success: true,
        message: 'API fonctionne',
        timestamp: new Date().toISOString()
    });
});

// 2. LOGIN (version ultra simple)
app.post('/api/login', (req, res) => {
    console.log('📨 POST /api/login - Body:', req.body);
    
    // Toujours répondre quelque chose
    res.json({
        success: true,
        token: 'test_token',
        user: { email: req.body.email || 'test@test.com' }
    });
});

// 3. REGISTER
app.post('/api/register', (req, res) => {
    console.log('📨 POST /api/register');
    res.json({ success: true, message: 'Register OK' });
});
// Après votre route POST /api/login, ajoutez :

// Route GET pour le login (pour debug)
app.get('/api/login', (req, res) => {
    console.log('⚠️ GET /api/login appelé (devrait être POST)');
    res.json({
        success: false,
        error: 'Utilisez POST /api/login avec email et password',
        example: {
            method: 'POST',
            url: '/api/login',
            body: {
                email: 'test@test.com',
                password: 'test123'
            }
        }
    });
});
// ====================
// ROUTES HTML (APRÈS API)
// ====================

app.get('/', (req, res) => {
    console.log('📄 GET /');
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login.html', (req, res) => {
    console.log('📄 GET /login.html');
    res.sendFile(path.join(__dirname, 'login.html'));
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

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

// ====================
// ROUTE 404 (TOUJOURS EN DERNIER)
// ====================

app.use((req, res) => {
    console.log(`❌ Route non trouvée: ${req.method} ${req.url}`);
    res.status(404).json({
        error: `Route ${req.method} ${req.url} non trouvée`,
        availableRoutes: ['GET /api/test', 'POST /api/login', 'POST /api/register']
    });
});

// ====================
// DÉMARRAGE
// ====================

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║        🚀 SERVEUR DÉMARRÉ            ║
╠══════════════════════════════════════╣
║ Port: ${PORT}                           
║ Test: curl http://localhost:${PORT}/api/test
║ Login: curl -X POST http://localhost:${PORT}/api/login
╚══════════════════════════════════════╝
    `);
});

