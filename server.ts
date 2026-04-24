import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

// Interface for payment requests
interface PendingPayment {
  id: string; // userId + itemId
  userId: string;
  itemId: string;
  itemName: string;
  price: number;
  screenshot: string; // In a real app, this would be a URL to a storage bucket
  status: 'pending' | 'validated' | 'rejected';
}

const app = express();
const PORT = 3000;

// In-memory store for demo (will reset on restart)
interface User {
  id: string;
  name: string;
  email: string;
  password: string; // Plain text for demo only!
}

let payments: PendingPayment[] = [];
let users: User[] = [];

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- USER AUTH ---
app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Champs manquants" });
  
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: "Email déjà utilisé" });
  }

  const newUser: User = {
    id: 'user_' + Math.random().toString(36).substr(2, 9),
    name,
    email,
    password
  };
  users.push(newUser);
  res.json({ status: "ok", user: { id: newUser.id, name: newUser.name, email: newUser.email } });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    res.json({ status: "ok", user: { id: user.id, name: user.name, email: user.email } });
  } else {
    res.status(401).json({ error: "Identifiants invalides" });
  }
});

// --- ADMIN API ---
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (email === adminEmail && password === adminPassword) {
    res.json({ status: "ok", token: "secret_admin_token" });
  } else {
    res.status(401).json({ error: "Identifiants invalides" });
  }
});

const adminAuth = (req: any, res: any, next: any) => {
  const token = req.headers['authorization'];
  if (token === 'Bearer secret_admin_token') {
    next();
  } else {
    res.status(403).json({ error: "Accès refusé" });
  }
};

app.get("/api/admin/payments", adminAuth, (req, res) => {
  res.json(payments);
});

app.post("/api/pay", (req, res) => {
  const { userId, itemId, itemName, price, screenshot } = req.body;
  
  if (!userId || !itemId) {
    return res.status(400).json({ error: "Missing info" });
  }

  const newPayment: PendingPayment = {
    id: `${userId}_${itemId}`,
    userId,
    itemId,
    itemName,
    price,
    screenshot,
    status: 'pending'
  };

  payments.push(newPayment);
  res.json({ status: "ok", message: "Paiement en attente de validation par l'admin" });
});

app.post("/api/admin/validate", adminAuth, (req, res) => {
  const { paymentId } = req.body;
  const payment = payments.find(p => p.id === paymentId);
  
  if (payment) {
    payment.status = 'validated';
    res.json({ status: "ok" });
  } else {
    res.status(404).json({ error: "Payment not found" });
  }
});

// Get user's unlocked items (only validated)
app.get("/api/user/:userId/unlocked", (req, res) => {
  const { userId } = req.params;
  const unlocked = payments
    .filter(p => p.userId === userId && p.status === 'validated')
    .map(p => p.itemId);
  res.json(unlocked);
});

// Get user's full payment history
app.get("/api/user/:userId/history", (req, res) => {
  const { userId } = req.params;
  const history = payments.filter(p => p.userId === userId);
  res.json(history);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
