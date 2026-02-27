import express from "express";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import multer from "multer";
import { fileURLToPath } from 'url';
import dotenv from "dotenv";

if (!process.env.VERCEL) {
  dotenv.config();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Client Lazy Init
let supabaseClient: any = null;
function getSupabase() {
  if (supabaseClient) return supabaseClient;
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  
  if (!url || !key) {
    throw new Error("SUPABASE_URL or SUPABASE_KEY is missing");
  }
  
  supabaseClient = createClient(url, key);
  return supabaseClient;
}

// Configure Multer for Memory Storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file gambar (jpeg, jpg, png) atau PDF yang diperbolehkan!") as any, false);
    }
  }
});

// Helper function to upload to Supabase Storage
async function uploadToSupabase(file: Express.Multer.File) {
  const supabase = getSupabase();
  const fileExt = path.extname(file.originalname);
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { data, error } = await supabase.storage
    .from('sisa-uploads')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    console.error("Supabase Storage Error:", error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('sisa-uploads')
    .getPublicUrl(filePath);

  return publicUrl;
}

export const app = express();
app.use(express.json());

// Health check route for diagnosis
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    env: {
      hasUrl: !!process.env.SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_KEY
    }
  });
});

const PORT = 3000;

// --- API Routes ---

  // Letters
  app.get("/api/letters", async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('letters')
        .select('*')
        .order('id', { ascending: false });
      
      if (error) return res.status(500).json(error);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/letters", upload.single("file"), async (req, res) => {
    try {
      const supabase = getSupabase();
      const { 
        receipt_date, security_date, completion_date, origin, 
        letter_date, letter_number, attachment, activity_time, activity_location, summary 
      } = req.body;
      
      let file_path = null;
      if (req.file) {
        file_path = await uploadToSupabase(req.file);
      }
      
      const { data, error } = await supabase
        .from('letters')
        .insert([
          { 
            receipt_date, security_date, completion_date, origin, 
            letter_date, letter_number, attachment, activity_time, activity_location, summary, file_path 
          }
        ])
        .select();
      
      if (error) throw error;
      res.json({ id: data[0].id });
    } catch (err: any) {
      console.error("API Error /api/letters:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Dispositions
  app.get("/api/dispositions", async (req, res) => {
    try {
      const supabase = getSupabase();
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/dispositions", upload.single("file"), async (req, res) => {
    try {
      const supabase = getSupabase();
      const { letter_id, forwarded_to, disposition_types, notes } = req.body;
      
      let file_path = null;
      if (req.file) {
        file_path = await uploadToSupabase(req.file);
      }
      
      const { data, error } = await supabase
        .from('dispositions')
        .insert([
          { letter_id, forwarded_to, disposition_types, notes, file_path }
        ])
        .select();

      if (error) throw error;
      res.json({ id: data[0].id });
    } catch (err: any) {
      console.error("API Error /api/dispositions:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Agendas
  app.get("/api/agendas", async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('agendas')
        .select('*')
        .order('id', { ascending: false });
      
      if (error) return res.status(500).json(error);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/agendas", upload.single("file"), async (req, res) => {
    try {
      const supabase = getSupabase();
      const { letter_id, origin, activity_time, activity_location, summary } = req.body;
      
      let file_path = null;
      if (req.file) {
        file_path = await uploadToSupabase(req.file);
      }
      
      const { data, error } = await supabase
        .from('agendas')
        .insert([
          { letter_id: letter_id || null, origin, activity_time, activity_location, summary, file_path }
        ])
        .select();

      if (error) throw error;
      res.json({ id: data[0].id });
    } catch (err: any) {
      console.error("API Error /api/agendas:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Dashboard Summary
  app.get("/api/summary", async (req, res) => {
    try {
      const supabase = getSupabase();
      const [lettersCount, dispoCount, agendaCount, recentLetters] = await Promise.all([
        supabase.from('letters').select('*', { count: 'exact', head: true }),
        supabase.from('dispositions').select('*', { count: 'exact', head: true }),
        supabase.from('agendas').select('*', { count: 'exact', head: true }),
        supabase.from('letters').select('*').order('id', { ascending: false }).limit(5)
      ]);

      // Agenda OPD (Combined from Dispositions and Agendas)
      const supabaseInstance = getSupabase();
      const { data: dispoAgendas } = await supabaseInstance
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

      const { data: kabanAgendas } = await supabaseInstance
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

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Server Error:", err);
    res.status(err.status || 500).json({ 
      error: "Internal Server Error", 
      message: err.message
    });
  });

async function startServer() {
  // ONLY run Vite or Static serving if NOT on Vercel
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
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

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
