import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import multer from "multer";
import fs from "fs";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("sisa.db");

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file gambar (jpeg, jpg, png) atau PDF yang diperbolehkan!"));
    }
  }
});

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_date TEXT,
    security_date TEXT,
    completion_date TEXT,
    origin TEXT,
    letter_date TEXT,
    letter_number TEXT,
    attachment TEXT,
    activity_time TEXT,
    activity_location TEXT,
    summary TEXT,
    file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS dispositions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    letter_id INTEGER,
    forwarded_to TEXT, -- JSON array
    disposition_types TEXT, -- JSON array
    notes TEXT,
    file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (letter_id) REFERENCES letters(id)
  );

  CREATE TABLE IF NOT EXISTS agendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    letter_id INTEGER NULL,
    origin TEXT,
    activity_time TEXT,
    activity_location TEXT,
    summary TEXT,
    file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (letter_id) REFERENCES letters(id)
  );
`);

// Migration: Add columns if they don't exist (for existing databases)
try { db.exec("ALTER TABLE letters ADD COLUMN file_path TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE letters ADD COLUMN activity_location TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE dispositions ADD COLUMN file_path TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE agendas ADD COLUMN file_path TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE agendas ADD COLUMN activity_location TEXT"); } catch (e) {}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use("/uploads", express.static(uploadsDir));
  const PORT = 3000;

  // --- API Routes ---

  // Letters
  app.get("/api/letters", (req, res) => {
    const letters = db.prepare("SELECT * FROM letters ORDER BY id DESC").all();
    res.json(letters);
  });

  app.post("/api/letters", upload.single("file"), (req, res) => {
    const { 
      receipt_date, security_date, completion_date, origin, 
      letter_date, letter_number, attachment, activity_time, activity_location, summary 
    } = req.body;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;
    
    const info = db.prepare(`
      INSERT INTO letters (
        receipt_date, security_date, completion_date, origin, 
        letter_date, letter_number, attachment, activity_time, activity_location, summary, file_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      receipt_date, security_date, completion_date, origin, 
      letter_date, letter_number, attachment, activity_time, activity_location, summary, file_path
    );
    
    res.json({ id: info.lastInsertRowid });
  });

  // Dispositions
  app.get("/api/dispositions", (req, res) => {
    const dispositions = db.prepare(`
      SELECT d.*, l.origin, l.activity_time, l.activity_location, l.summary 
      FROM dispositions d
      JOIN letters l ON d.letter_id = l.id
      ORDER BY d.id DESC
    `).all();
    res.json(dispositions);
  });

  app.post("/api/dispositions", upload.single("file"), (req, res) => {
    const { letter_id, forwarded_to, disposition_types, notes } = req.body;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;
    
    const info = db.prepare(`
      INSERT INTO dispositions (letter_id, forwarded_to, disposition_types, notes, file_path)
      VALUES (?, ?, ?, ?, ?)
    `).run(letter_id, forwarded_to, disposition_types, notes, file_path);
    res.json({ id: info.lastInsertRowid });
  });

  // Agendas
  app.get("/api/agendas", (req, res) => {
    const agendas = db.prepare("SELECT * FROM agendas ORDER BY id DESC").all();
    res.json(agendas);
  });

  app.post("/api/agendas", upload.single("file"), (req, res) => {
    const { letter_id, origin, activity_time, activity_location, summary } = req.body;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;
    
    const info = db.prepare(`
      INSERT INTO agendas (letter_id, origin, activity_time, activity_location, summary, file_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(letter_id || null, origin, activity_time, activity_location, summary, file_path);
    res.json({ id: info.lastInsertRowid });
  });

  // Dashboard Summary
  app.get("/api/summary", (req, res) => {
    try {
      const totalLetters = db.prepare("SELECT COUNT(*) as count FROM letters").get().count;
      const totalDispositions = db.prepare("SELECT COUNT(*) as count FROM dispositions").get().count;
      const totalAgendas = db.prepare("SELECT COUNT(*) as count FROM agendas").get().count;
      
      // Recent letters
      const recentLetters = db.prepare("SELECT * FROM letters ORDER BY id DESC LIMIT 5").all();

      // Agenda OPD (Combined from Dispositions and Agendas)
      const opdAgendasFromDispo = db.prepare(`
        SELECT 
          l.activity_time, 
          l.activity_location, 
          d.forwarded_to as attended_by,
          'disposition' as source
        FROM dispositions d
        JOIN letters l ON d.letter_id = l.id
        ORDER BY l.activity_time DESC
        LIMIT 10
      `).all().map(item => {
        let attended = [];
        try {
          attended = item.attended_by ? JSON.parse(item.attended_by) : [];
        } catch (e) {
          attended = [];
        }
        return {
          ...item,
          attended_by: Array.isArray(attended) ? attended : []
        };
      });

      const opdAgendasFromKaban = db.prepare(`
        SELECT 
          activity_time, 
          activity_location, 
          '["Kaban"]' as attended_by,
          'agenda' as source
        FROM agendas
        ORDER BY activity_time DESC
        LIMIT 10
      `).all().map(item => ({
        ...item,
        attended_by: JSON.parse(item.attended_by)
      }));

      const agendaOPD = [...opdAgendasFromDispo, ...opdAgendasFromKaban]
        .sort((a, b) => {
          const timeA = a.activity_time ? new Date(a.activity_time).getTime() : 0;
          const timeB = b.activity_time ? new Date(b.activity_time).getTime() : 0;
          return timeB - timeA;
        })
        .slice(0, 10);
      
      res.json({
        totalLetters,
        totalDispositions,
        totalAgendas,
        recentLetters,
        agendaOPD
      });
    } catch (error) {
      console.error("Error in /api/summary:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Server Error:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
