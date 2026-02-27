import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import multer from "multer";
import fs from "fs";
import { fileURLToPath } from 'url';
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

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

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use("/uploads", express.static(uploadsDir));
  const PORT = 3000;

  // --- API Routes ---

  // Letters
  app.get("/api/letters", async (req, res) => {
    const { data, error } = await supabase
      .from('letters')
      .select('*')
      .order('id', { ascending: false });
    
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.post("/api/letters", upload.single("file"), async (req, res) => {
    const { 
      receipt_date, security_date, completion_date, origin, 
      letter_date, letter_number, attachment, activity_time, activity_location, summary 
    } = req.body;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;
    
    const { data, error } = await supabase
      .from('letters')
      .insert([
        { 
          receipt_date, security_date, completion_date, origin, 
          letter_date, letter_number, attachment, activity_time, activity_location, summary, file_path 
        }
      ])
      .select();
    
    if (error) return res.status(500).json(error);
    res.json({ id: data[0].id });
  });

  // Dispositions
  app.get("/api/dispositions", async (req, res) => {
    const { data, error } = await supabase
      .from('dispositions')
      .select(`
        *,
        letters (
          origin,
          activity_time,
          activity_location,
          summary
        )
      `)
      .order('id', { ascending: false });
    
    if (error) return res.status(500).json(error);

    // Flatten the response to match previous SQLite structure
    const flattened = data.map((d: any) => {
      const letter = Array.isArray(d.letters) ? d.letters[0] : d.letters;
      return {
        ...d,
        origin: letter?.origin,
        activity_time: letter?.activity_time,
        activity_location: letter?.activity_location,
        summary: letter?.summary
      };
    });

    res.json(flattened);
  });

  app.post("/api/dispositions", upload.single("file"), async (req, res) => {
    const { letter_id, forwarded_to, disposition_types, notes } = req.body;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;
    
    const { data, error } = await supabase
      .from('dispositions')
      .insert([
        { letter_id, forwarded_to, disposition_types, notes, file_path }
      ])
      .select();

    if (error) return res.status(500).json(error);
    res.json({ id: data[0].id });
  });

  // Agendas
  app.get("/api/agendas", async (req, res) => {
    const { data, error } = await supabase
      .from('agendas')
      .select('*')
      .order('id', { ascending: false });
    
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.post("/api/agendas", upload.single("file"), async (req, res) => {
    const { letter_id, origin, activity_time, activity_location, summary } = req.body;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;
    
    const { data, error } = await supabase
      .from('agendas')
      .insert([
        { letter_id: letter_id || null, origin, activity_time, activity_location, summary, file_path }
      ])
      .select();

    if (error) return res.status(500).json(error);
    res.json({ id: data[0].id });
  });

  // Dashboard Summary
  app.get("/api/summary", async (req, res) => {
    try {
      const [lettersCount, dispoCount, agendaCount, recentLetters] = await Promise.all([
        supabase.from('letters').select('*', { count: 'exact', head: true }),
        supabase.from('dispositions').select('*', { count: 'exact', head: true }),
        supabase.from('agendas').select('*', { count: 'exact', head: true }),
        supabase.from('letters').select('*').order('id', { ascending: false }).limit(5)
      ]);

      // Agenda OPD (Combined from Dispositions and Agendas)
      const { data: dispoAgendas } = await supabase
        .from('dispositions')
        .select(`
          forwarded_to,
          letters (
            activity_time,
            activity_location
          )
        `)
        .order('id', { ascending: false })
        .limit(10);

      const { data: kabanAgendas } = await supabase
        .from('agendas')
        .select('activity_time, activity_location')
        .order('id', { ascending: false })
        .limit(10);

      const opdAgendasFromDispo = (dispoAgendas || []).map((item: any) => {
        let attended = [];
        try {
          attended = item.forwarded_to ? JSON.parse(item.forwarded_to) : [];
        } catch (e) {
          attended = [];
        }
        
        // Supabase might return letters as an object or an array depending on schema
        const letter = Array.isArray(item.letters) ? item.letters[0] : item.letters;

        return {
          activity_time: letter?.activity_time,
          activity_location: letter?.activity_location,
          attended_by: Array.isArray(attended) ? attended : [],
          source: 'disposition'
        };
      });

      const opdAgendasFromKaban = (kabanAgendas || []).map(item => ({
        activity_time: item.activity_time,
        activity_location: item.activity_location,
        attended_by: ["Kaban"],
        source: 'agenda'
      }));

      const agendaOPD = [...opdAgendasFromDispo, ...opdAgendasFromKaban]
        .sort((a, b) => {
          const timeA = a.activity_time ? new Date(a.activity_time).getTime() : 0;
          const timeB = b.activity_time ? new Date(b.activity_time).getTime() : 0;
          return timeB - timeA;
        })
        .slice(0, 10);
      
      res.json({
        totalLetters: lettersCount.count || 0,
        totalDispositions: dispoCount.count || 0,
        totalAgendas: agendaCount.count || 0,
        recentLetters: recentLetters.data || [],
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
