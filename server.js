/**
 * The Collective - Backend Server Logic
 * Stack: Node.js, Express, Bcrypt, Express-Session
 * 
 * Note: For a production environment, ensure this runs behind a reverse proxy (like Nginx) 
 * with HTTPS (TLS/SSL) forced to protect all data in transit. 
 */

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Secure Session Configuration
app.use(session({
    secret: 'CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_IN_PRODUCTION',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Requires HTTPS
        httpOnly: true,
        maxAge: 3600000 // 1 hour
    }
}));

// Mock Database (In a real app, use PostgreSQL or MongoDB)
const db = {
    users: [], // Will hold { id, email, passwordHash, role }
    leads: [], // Will hold intake form submissions
    newsletterSubs: [] // Email capture list
};

/**
 * INTAKE & LEAD GENERATION ENDPOINT
 * Receives the secure contact form data.
 */
app.post('/api/intake', (req, res) => {
    const { alias, email, details, subscribeNewsletter } = req.body;

    if (!alias || !email || !details) {
        return res.status(400).json({ error: "Alias, email, and details are required." });
    }

    // Save lead to database
    const newLead = {
        id: Date.now().toString(),
        alias,
        email,
        details, // In production, consider encrypting this field at rest
        timestamp: new Date()
    };
    db.leads.push(newLead);

    // Email Capture Logic
    if (subscribeNewsletter) {
        if (!db.newsletterSubs.includes(email)) {
            db.newsletterSubs.push(email);
        }
    }

    // In a real scenario, this is where you'd trigger an internal notification 
    // to the Collective intake team (e.g., via SendGrid or AWS SES).
    
    res.status(201).json({ message: "Request received securely. We will contact you shortly." });
});

/**
 * CLIENT PORTAL AUTHENTICATION
 * Handles secure logins using hashed passwords.
 */
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password required." });
    }

    const user = db.users.find(u => u.email === email);
    
    // Use generic error messages to prevent email enumeration
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    
    if (match) {
        // Generate session
        req.session.userId = user.id;
        req.session.role = user.role;
        return res.status(200).json({ message: "Authentication successful." });
    } else {
        return res.status(401).json({ error: "Invalid credentials." });
    }
});

/**
 * CLIENT PORTAL LOGOUT
 */
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: "Could not log out securely." });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ message: "Logged out securely." });
    });
});

/**
 * PROTECTED ROUTE EXAMPLE (Get Case Updates)
 * Only accessible to authenticated clients.
 */
app.get('/api/case-status', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Unauthorized access." });
    }

    // Fetch case data based on req.session.userId...
    res.status(200).json({
        status: "Investigation Active",
        latestUpdate: "OSINT gathering completed. Awaiting digital footprint analysis phase."
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`[SECURE] Collective backend running on port ${PORT}`);
});

/**
 * UTILITY: Create a mock user (For demonstration purposes)
 */
async function setupMockData() {
    const mockPassword = "client_secure_password";
    const saltRounds = 12;
    const hash = await bcrypt.hash(mockPassword, saltRounds);
    
    db.users.push({
        id: "client_001",
        email: "client@example.com",
        passwordHash: hash,
        role: "client"
    });
}
setupMockData();
