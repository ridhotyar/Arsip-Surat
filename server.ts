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
  try {
    if (supabaseClient) return supabaseClient;
    
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    
    if (!url || !key) {
      console.error("Missing SUPABASE_URL or SUPABASE_KEY");
      return null;
    }
    
    supabaseClient = createClient(url, key);
    return supabaseClient;
  } catch (err) {
    console.error("Failed to initialize Supabase:", err);
    return null;
  }
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

  // Login
  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: "Supabase not initialized" });

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (error || !data) {
        return res.status(401).json({ error: "Email atau Password salah!" });
      }

      res.json({ success: true, user: { email: data.email } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Letters
  app.get("/api/letters", async (req, res) => {
    try {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: "Database connection not initialized" });
      
      const { data, error } = await supabase
        .from('letters')
        .select('*')
        .order('id', { ascending: false });
      
      if (error) return res.status(500).json(error);
      res.json(data || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/letters", upload.array("files"), async (req, res) => {
    try {
      const supabase = getSupabase();
      const { 
        receipt_date, security_date, completion_date, origin, 
        letter_date, letter_number, attachment, activity_time, activity_location, summary 
      } = req.body;
      
      let file_paths = [];
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const path = await uploadToSupabase(file);
          file_paths.push(path);
        }
      }
      
      const file_path = file_paths.length > 0 ? JSON.stringify(file_paths) : null;
      
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

  app.put("/api/letters/:id", upload.array("files"), async (req, res) => {
    try {
      const supabase = getSupabase();
      const { id } = req.params;
      const { 
        receipt_date, security_date, completion_date, origin, 
        letter_date, letter_number, attachment, activity_time, activity_location, summary, existing_files 
      } = req.body;
      
      let file_paths = [];
      try {
        if (existing_files) {
          const parsed = JSON.parse(existing_files);
          if (Array.isArray(parsed)) {
            file_paths = parsed;
          }
        }
      } catch (e) {
        console.error("Error parsing existing_files:", e);
      }

      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const path = await uploadToSupabase(file);
          file_paths.push(path);
        }
      }
      
      const file_path = file_paths.length > 0 ? JSON.stringify(file_paths) : null;
      
      const { data, error } = await supabase
        .from('letters')
        .update({ 
          receipt_date, security_date, completion_date, origin, 
          letter_date, letter_number, attachment, activity_time, activity_location, summary, file_path 
        })
        .eq('id', Number(id))
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Data surat tidak ditemukan" });
      }

      // Sync linked agendas if any
      await supabase
        .from('agendas')
        .update({ origin, activity_time, activity_location, summary, file_path })
        .eq('letter_id', Number(id));

      // Sync linked dispositions if any
      await supabase
        .from('dispositions')
        .update({ file_path })
        .eq('letter_id', Number(id));

      res.json(data[0]);
    } catch (err: any) {
      console.error("API Error PUT /api/letters:", err);
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
          letters (*)
        `)
        .order('id', { ascending: false });
      
      if (error) return res.status(500).json(error);

      // Flatten the response to match previous SQLite structure
      const flattened = (data || []).map((d: any) => {
        const letter = Array.isArray(d.letters) ? d.letters[0] : d.letters;
        return {
          ...d,
          origin: letter?.origin || d.origin,
          activity_time: letter?.activity_time || d.activity_time,
          activity_location: letter?.activity_location || d.activity_location,
          summary: letter?.summary || d.summary,
          file_path: d.file_path
        };
      });

      res.json(flattened);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/dispositions", upload.array("files"), async (req, res) => {
    try {
      const supabase = getSupabase();
      const { letter_id, forwarded_to, disposition_types, notes } = req.body;

      // Validation: Check if letter already has disposition or is in agenda
      const { data: existingDispo } = await supabase
        .from('dispositions')
        .select('id')
        .eq('letter_id', letter_id)
        .maybeSingle();
      
      const { data: existingAgenda } = await supabase
        .from('agendas')
        .select('id')
        .eq('letter_id', letter_id)
        .maybeSingle();

      if (existingDispo) {
        return res.status(400).json({ error: "Surat ini sudah didisposisi." });
      }
      if (existingAgenda) {
        return res.status(400).json({ error: "Surat ini sudah menjadi agenda kaban." });
      }
      
      let file_paths = [];
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const path = await uploadToSupabase(file);
          file_paths.push(path);
        }
      }
      
      const file_path = file_paths.length > 0 ? JSON.stringify(file_paths) : null;
      
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
        .select(`
          *,
          letters (*)
        `)
        .order('id', { ascending: false });
      
      if (error) return res.status(500).json(error);
      
      // Flatten for easier use in frontend
      const flattened = (data || []).map((item: any) => {
        const letter = Array.isArray(item.letters) ? item.letters[0] : item.letters;
        if (letter) {
          return {
            ...item,
            origin: letter.origin,
            activity_time: letter.activity_time,
            activity_location: letter.activity_location,
            summary: letter.summary,
            file_path: item.file_path
          };
        }
        return item;
      });

      res.json(flattened);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/agendas", upload.array("files"), async (req, res) => {
    try {
      const supabase = getSupabase();
      const { letter_id, origin, activity_time, activity_location, summary } = req.body;

      // Validation: If letter_id is provided, check if it already has disposition or is in agenda
      if (letter_id) {
        const { data: existingDispo } = await supabase
          .from('dispositions')
          .select('id')
          .eq('letter_id', letter_id)
          .maybeSingle();
        
        const { data: existingAgenda } = await supabase
          .from('agendas')
          .select('id')
          .eq('letter_id', letter_id)
          .maybeSingle();

        if (existingDispo) {
          return res.status(400).json({ error: "Surat ini sudah didisposisi." });
        }
        if (existingAgenda) {
          return res.status(400).json({ error: "Surat ini sudah ada di agenda kaban." });
        }
      }
      
      let file_paths = [];
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const path = await uploadToSupabase(file);
          file_paths.push(path);
        }
      }
      
      const file_path = file_paths.length > 0 ? JSON.stringify(file_paths) : null;
      
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

  app.put("/api/dispositions/:id", upload.array("files"), async (req, res) => {
    try {
      const supabase = getSupabase();
      const { id } = req.params;
      const { forwarded_to, disposition_types, notes, existing_files } = req.body;
      
      let file_paths = [];
      try {
        if (existing_files) {
          const parsed = JSON.parse(existing_files);
          if (Array.isArray(parsed)) {
            file_paths = parsed;
          }
        }
      } catch (e) {
        console.error("Error parsing existing_files:", e);
      }

      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const path = await uploadToSupabase(file);
          file_paths.push(path);
        }
      }
      
      const file_path = file_paths.length > 0 ? JSON.stringify(file_paths) : null;
      
      const { data, error } = await supabase
        .from('dispositions')
        .update({ forwarded_to, disposition_types, notes, file_path })
        .eq('id', Number(id))
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Data disposisi tidak ditemukan" });
      }
      res.json(data[0]);
    } catch (err: any) {
      console.error("API Error PUT /api/dispositions:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/agendas/:id", upload.array("files"), async (req, res) => {
    try {
      const supabase = getSupabase();
      const { id } = req.params;
      const { origin, activity_time, activity_location, summary, existing_files } = req.body;
      
      let file_paths = [];
      try {
        if (existing_files) {
          const parsed = JSON.parse(existing_files);
          if (Array.isArray(parsed)) {
            file_paths = parsed;
          }
        }
      } catch (e) {
        console.error("Error parsing existing_files:", e);
      }

      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const path = await uploadToSupabase(file);
          file_paths.push(path);
        }
      }
      
      const file_path = file_paths.length > 0 ? JSON.stringify(file_paths) : null;
      
      const { data, error } = await supabase
        .from('agendas')
        .update({ origin, activity_time, activity_location, summary, file_path })
        .eq('id', Number(id))
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Data agenda tidak ditemukan" });
      }
      res.json(data[0]);
    } catch (err: any) {
      console.error("API Error PUT /api/agendas:", err);
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
          *,
          letters (*)
        `)
        .order('id', { ascending: false })
        .limit(10);

      const { data: kabanAgendas } = await supabaseInstance
        .from('agendas')
        .select(`
          *,
          letters (*)
        `)
        .order('id', { ascending: false })
        .limit(10);

      const opdAgendasFromDispo = (dispoAgendas || []).map((item: any) => {
        let attended = [];
        try {
          attended = item.forwarded_to ? JSON.parse(item.forwarded_to) : [];
        } catch (e) {
          attended = [];
        }
        
        const letter = Array.isArray(item.letters) ? item.letters[0] : item.letters;

        return {
          activity_time: letter?.activity_time,
          activity_location: letter?.activity_location,
          attended_by: Array.isArray(attended) ? attended : [],
          source: 'disposition',
          full_data: item
        };
      });

      const opdAgendasFromKaban = (kabanAgendas || []).map((item: any) => {
        const letter = Array.isArray(item.letters) ? item.letters[0] : item.letters;
        return {
          activity_time: item.activity_time || letter?.activity_time,
          activity_location: item.activity_location || letter?.activity_location,
          attended_by: ["Kaban"],
          source: 'agenda',
          full_data: item
        };
      });

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
  console.log("Starting server process...");
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log("Initializing Vite dev server...");
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware attached.");
    } else {
      console.log("Serving static files from dist...");
      app.use(express.static(path.join(__dirname, "dist")));
      app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "dist", "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'Configured' : 'MISSING'}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
  }
}

// Handle unhandled rejections and exceptions to prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

startServer();
