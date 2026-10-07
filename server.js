const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const crypto = require('crypto');
const { Resend } = require('resend');
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
if (!resend) console.warn("WARNING: RESEND_API_KEY is missing! Emails will be skipped.");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: '*' }));

const db = {
    users: [],
    leads: [],
    messages: [
        { id: 1, userId: 'client_001', sender: 'investigator', text: 'Welcome to your secure portal. We have received your initial request. How can we assist you today?', timestamp: new Date(Date.now() - 86400000).toISOString() }
    ],
    tokens: {} 
};

app.post('/api/intake', async (req, res) => {
    const { alias, email, details, subscribeNewsletter } = req.body;
    if (!alias || !email || !details) return res.status(400).json({ error: "Alias, email, and details are required." });

    const newLead = { id: Date.now().toString(), alias, email, details, timestamp: new Date() };
    db.leads.push(newLead);

    try {
        if (resend) await resend.emails.send({
            from: 'The Collective <intake@perthconsulting.agency>',
            to: [email],
            subject: 'Secure Request Received - The Collective',
            html: `
                <div style="font-family: sans-serif; color: #333;">
                    <h2>Secure Request Received</h2>
                    <p>Hello ${alias},</p>
                    <p>This is an automated confirmation that your secure intake request has been received by The Collective.</p>
                    <p>A lead investigator will review your situation details safely and reach out to you shortly via this email address.</p>
                    <br/>
                    <p><em>Note: If you feel your email is monitored, please delete this message and empty your trash folder.</em></p>
                </div>
            `
        });
    } catch (emailError) {
        console.error("Resend Error:", emailError);
    }
    res.status(201).json({ message: "Request received securely." });
});

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

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided." });
    const token = authHeader.split(' ')[1];
    const userId = db.tokens[token];
    if (!userId) return res.status(401).json({ error: "Invalid or expired token." });
    req.userId = userId;
    next();
}

app.get('/api/messages', requireAuth, (req, res) => {
    const userMsgs = db.messages.filter(m => m.userId === req.userId);
    res.json(userMsgs);
});

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

app.listen(PORT, () => console.log(`[SECURE] Backend running on port ${PORT}`));

async function setupMockData() {
    const hash = await bcrypt.hash("client_secure_password", 10);
    db.users.push({ id: "client_001", email: "client@example.com", passwordHash: hash });
}
setupMockData();

