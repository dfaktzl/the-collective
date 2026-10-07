const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*' })); // Allow cross-origin from GitHub Pages

// Mock Database
const db = {
    users: [],
    leads: [],
    messages: [
        // Mock initial message thread for the demo client
        { id: 1, userId: 'client_001', sender: 'investigator', text: 'Welcome to your secure portal. We have received your initial request. How can we assist you today?', timestamp: new Date(Date.now() - 86400000).toISOString() }
    ],
    tokens: {} // Token -> userId mapping
};

// 1. INTAKE
app.post('/api/intake', (req, res) => {
    // ... handles contact form ...
    res.status(201).json({ message: "Request received securely." });
});

// 2. LOGIN (Using Tokens to avoid 3rd-party cookie blocking)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = db.users.find(u => u.email === email);
    
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (match) {
        const token = crypto.randomBytes(32).toString('hex');
        db.tokens[token] = user.id;
        return res.status(200).json({ message: "Authentication successful.", token });
    } else {
        return res.status(401).json({ error: "Invalid credentials." });
    }
});

// Auth Middleware
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided." });
    const token = authHeader.split(' ')[1];
    const userId = db.tokens[token];
    if (!userId) return res.status(401).json({ error: "Invalid or expired token." });
    req.userId = userId;
    next();
}

// 3. GET MESSAGES
app.get('/api/messages', requireAuth, (req, res) => {
    const userMsgs = db.messages.filter(m => m.userId === req.userId);
    res.json(userMsgs);
});

// 4. POST MESSAGE
app.post('/api/messages', requireAuth, (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Message cannot be empty." });
    
    const newMsg = {
        id: Date.now(),
        userId: req.userId,
        sender: 'client',
        text,
        timestamp: new Date().toISOString()
    };
    db.messages.push(newMsg);
    res.status(201).json(newMsg);
});

app.listen(PORT, () => console.log([SECURE] Backend running on port \));

// Setup Mock Client
async function setupMockData() {
    const hash = await bcrypt.hash("client_secure_password", 10);
    db.users.push({ id: "client_001", email: "client@example.com", passwordHash: hash });
}
setupMockData();
