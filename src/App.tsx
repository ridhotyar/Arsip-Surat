import React, { useState, useEffect, useMemo } from 'react';
import imageCompression from 'browser-image-compression';
import { 
  LayoutDashboard, 
  FileText, 
  Send, 
  Calendar, 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreVertical,
  Filter,
  Menu,
  Loader2,
  Camera,
  Image as ImageIcon,
  ExternalLink,
  Eye,
  Download,
  User,
  MapPin,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface Letter {
  id: number;
  receipt_date: string;
  security_date: string;
  completion_date: string;
  origin: string;
  letter_date: string;
  letter_number: string;
  attachment: string;
  activity_time: string;
  activity_location: string;
  summary: string;
  file_path: string | null;
  created_at: string;
}

interface Disposition {
  id: number;
  letter_id: number;
  forwarded_to: string; // JSON string
  disposition_types: string; // JSON string
  notes: string;
  file_path: string | null;
  origin: string;
  activity_time: string;
  activity_location: string;
  summary: string;
  created_at: string;
}

interface Agenda {
  id: number;
  letter_id: number | null;
  origin: string;
  activity_time: string;
  activity_location: string;
  summary: string;
  file_path: string | null;
  created_at: string;
}

interface DashboardSummary {
  totalLetters: number;
  totalDispositions: number;
  totalAgendas: number;
  recentLetters: Letter[];
  agendaOPD: {
    activity_time: string;
    activity_location: string;
    attended_by: string[];
    source: 'disposition' | 'agenda';
  }[];
}

// --- Constants ---

const FORWARD_OPTIONS = [
  'Sekretaris',
  'Kabid. IWASBANG dan EKOSUSBUD',
  'Kabid. POLDAGRI dan ORMAS',
  'Kabid. WASNAS'
];

const DISPOSITION_OPTIONS = [
  'Pedomani',
  'Tanggapan dan sasaran',
  'Proses lebih lanjut',
  'Koordinasi/dikonfirmasi',
  'Maklum',
  'Hadiri',
  'Tugaskan staf'
];

// --- Components ---

const SearchableSelect = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "-- Pilih --",
  name
}: { 
  options: { id: number, label: string, sublabel: string }[], 
  value: string, 
  onChange: (val: string) => void,
  placeholder?: string,
  name: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) || 
    opt.sublabel.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => String(opt.id) === value);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer flex justify-between items-center"
      >
        <span className={selectedOption ? "text-slate-900 truncate pr-4" : "text-slate-400"}>
          {selectedOption ? `${selectedOption.label} - ${selectedOption.sublabel}` : placeholder}
        </span>
        <Search size={16} className="text-slate-400 flex-shrink-0" />
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-[70] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
            >
              <div className="p-2 border-b border-slate-100">
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Cari nomor surat atau asal..."
                  className="w-full px-3 py-1.5 text-sm bg-slate-50 border-none rounded-lg focus:ring-0 outline-none"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filtered.length > 0 ? (
                  filtered.map(opt => (
                    <div 
                      key={opt.id}
                      onClick={() => {
                        onChange(String(opt.id));
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className="px-4 py-2 hover:bg-indigo-50 cursor-pointer transition-colors"
                    >
                      <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.sublabel}</p>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-400 italic text-center">Tidak ditemukan</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const DetailModal = ({ 
  item, 
  onClose, 
  formatDateTime,
  allDispositions = [],
  allAgendas = []
}: { 
  item: { type: 'letter' | 'disposition' | 'agenda', data: any }, 
  onClose: () => void, 
  formatDateTime: (d: string) => string,
  allDispositions?: Disposition[],
  allAgendas?: Agenda[]
}) => {
  const { type, data } = item;

  const relatedDisposition = useMemo(() => {
    if (type === 'letter') {
      return allDispositions.find(d => Number(d.letter_id) === Number(data.id));
    }
    return null;
  }, [type, data.id, allDispositions]);

  const relatedAgenda = useMemo(() => {
    if (type === 'letter') {
      return allAgendas.find(a => Number(a.letter_id) === Number(data.id));
    }
    return null;
  }, [type, data.id, allAgendas]);

  // Flatten data for display if it's a disposition/agenda with nested letter
  const displayData = useMemo(() => {
    if ((type === 'disposition' || type === 'agenda') && data.letters) {
      const letter = Array.isArray(data.letters) ? data.letters[0] : data.letters;
      return {
        ...data,
        origin: letter.origin || data.origin,
        activity_time: letter.activity_time || data.activity_time,
        activity_location: letter.activity_location || data.activity_location,
        summary: letter.summary || data.summary,
        letter_data: letter // Keep original letter data
      };
    }
    return data;
  }, [type, data]);
  
  const renderFiles = (filePath: string | null) => {
    if (!filePath) return <p className="text-slate-400 italic text-sm">Tidak ada lampiran</p>;
    try {
      const paths = JSON.parse(filePath);
      if (Array.isArray(paths)) {
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
            {paths.map((p, i) => (
              <div key={i} className="group relative aspect-square rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                <img src={p} alt={`Attachment ${i+1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a href={p} target="_blank" rel="noreferrer" className="p-2 bg-white rounded-full text-slate-900 hover:scale-110 transition-transform">
                    <ExternalLink size={18} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        );
      }
    } catch (e) {
      return (
        <a href={filePath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium">
          <FileText size={18} /> Lihat Dokumen
        </a>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1 block">
              Detail {type === 'letter' ? 'Surat Masuk' : type === 'disposition' ? 'Disposisi' : 'Agenda Kaban'}
            </span>
            <h3 className="text-xl font-bold text-slate-900">
              {type === 'letter' ? displayData.letter_number : type === 'disposition' ? `Disposisi #${displayData.id}` : displayData.origin}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto space-y-8">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <section>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Informasi Utama</label>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-indigo-500"><User size={16} /></div>
                    <div>
                      <p className="text-xs text-slate-500">Asal / Sumber</p>
                      <p className="text-sm font-semibold text-slate-800">{displayData.origin}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-indigo-500"><Calendar size={16} /></div>
                    <div>
                      <p className="text-xs text-slate-500">Waktu Kegiatan</p>
                      <p className="text-sm font-semibold text-slate-800">{formatDateTime(displayData.activity_time)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 text-indigo-500"><MapPin size={16} /></div>
                    <div>
                      <p className="text-xs text-slate-500">Lokasi</p>
                      <p className="text-sm font-semibold text-slate-800">{displayData.activity_location || '-'}</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Status & Tanggal</label>
                <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                  {type === 'letter' && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Tgl Penerimaan:</span>
                        <span className="font-medium text-slate-700">{displayData.receipt_date}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Tgl Surat:</span>
                        <span className="font-medium text-slate-700">{displayData.letter_date}</span>
                      </div>
                      {displayData.security_date && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Keamanan:</span>
                          <span className="font-medium text-slate-700">{displayData.security_date}</span>
                        </div>
                      )}
                      {displayData.completion_date && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Tgl Penyelesaian:</span>
                          <span className="font-medium text-slate-700">{displayData.completion_date}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Dibuat Pada:</span>
                    <span className="font-medium text-slate-700">{new Date(displayData.created_at).toLocaleDateString('id-ID')}</span>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* Content */}
          <section className="bg-indigo-50/30 rounded-2xl p-6 border border-indigo-100/50">
            <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-3">Ringkasan / Catatan</label>
            <p className="text-slate-700 leading-relaxed italic">
              "{type === 'disposition' ? displayData.notes : displayData.summary}"
            </p>
            
            {type === 'disposition' && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Diteruskan Ke</p>
                  <div className="flex flex-wrap gap-1">
                    {JSON.parse(displayData.forwarded_to || '[]').map((f: string) => (
                      <span key={f} className="px-2 py-1 bg-white border border-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg">{f}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Instruksi Disposisi</p>
                  <div className="flex flex-wrap gap-1">
                    {JSON.parse(displayData.disposition_types || '[]').map((t: string) => (
                      <span key={t} className="px-2 py-1 bg-white border border-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Attachments */}
          <section>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-4">Lampiran Dokumen</label>
            {renderFiles(displayData.file_path)}
          </section>

          {/* Linked Information for Letters */}
          {type === 'letter' && (relatedDisposition || relatedAgenda) && (
            <section className="space-y-4 pt-4 border-t border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Informasi Terkait (Arsip)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedDisposition && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="flex items-center gap-2 mb-2 text-emerald-700">
                      <Send size={16} />
                      <span className="text-xs font-bold uppercase">Sudah Disposisi</span>
                    </div>
                    <p className="text-[10px] text-emerald-600 mb-1">Diteruskan Ke:</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {JSON.parse(relatedDisposition.forwarded_to || '[]').map((f: string) => (
                        <span key={f} className="px-1.5 py-0.5 bg-white text-emerald-700 text-[9px] font-bold rounded border border-emerald-200">{f}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-emerald-600 mb-1">Catatan:</p>
                    <p className="text-xs text-emerald-800 line-clamp-2 italic mb-3">"{relatedDisposition.notes}"</p>
                    <div className="mt-2 pt-2 border-t border-emerald-200/50">
                      <p className="text-[9px] font-bold text-emerald-600 uppercase mb-2">Lampiran Disposisi:</p>
                      {renderFiles(relatedDisposition.file_path)}
                    </div>
                  </div>
                )}
                {relatedAgenda && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <div className="flex items-center gap-2 mb-2 text-amber-700">
                      <Calendar size={16} />
                      <span className="text-xs font-bold uppercase">Agenda Kaban</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-amber-500" />
                        <span className="text-xs font-medium text-amber-800">{formatDateTime(relatedAgenda.activity_time)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-amber-500" />
                        <span className="text-xs font-medium text-amber-800 truncate">{relatedAgenda.activity_location}</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-amber-200/50">
                        <span className="text-[9px] font-bold text-amber-600 uppercase">Status: Dihadiri Kaban</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-amber-200/50">
                        <p className="text-[9px] font-bold text-amber-600 uppercase mb-2">Lampiran Agenda:</p>
                        {renderFiles(relatedAgenda.file_path)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Related Letter Info for Dispositions/Agendas */}
          {(type === 'disposition' || type === 'agenda') && displayData.letter_data && (
            <section className="space-y-4 pt-4 border-t border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Informasi Surat Terkait</label>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 mb-3 text-slate-700">
                  <FileText size={16} />
                  <span className="text-xs font-bold uppercase">Surat Masuk: {displayData.letter_data.letter_number}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Asal Surat</p>
                    <p className="text-sm font-semibold text-slate-800">{displayData.letter_data.origin}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Tanggal Surat</p>
                    <p className="text-sm font-semibold text-slate-800">{displayData.letter_data.letter_date}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Lampiran Surat Asli:</p>
                  {renderFiles(displayData.letter_data.file_path)}
                </div>
              </div>
            </section>
          )}
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">
            Tutup
          </button>
          <button className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2">
            <Printer size={18} /> Cetak Detail
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const FilePicker = ({ files, setFiles, isMobile }: { files: File[], setFiles: React.Dispatch<React.SetStateAction<File[]>>, isMobile: boolean }) => {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const newPreviews = files.map(file => {
      if (file.type.startsWith('image/')) {
        return URL.createObjectURL(file);
      }
      return ''; // For PDFs or other files
    });
    setPreviews(newPreviews);
    return () => newPreviews.forEach(url => url && URL.revokeObjectURL(url));
  }, [files]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {files.map((file, idx) => (
          <div key={idx} className="relative aspect-square rounded-xl border border-slate-200 overflow-hidden bg-slate-50 group">
            {file.type.startsWith('image/') ? (
              <img src={previews[idx]} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                <FileText size={24} className="text-indigo-500 mb-1" />
                <span className="text-[10px] font-medium text-slate-600 truncate w-full">{file.name}</span>
              </div>
            )}
            <button 
              type="button"
              onClick={() => removeFile(idx)}
              className="absolute top-1 right-1 bg-rose-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        
        <label className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-all text-slate-400 hover:text-indigo-500">
          <Plus size={24} />
          <span className="text-[10px] font-bold mt-1 uppercase">Tambah</span>
          <input 
            type="file" 
            multiple 
            accept="image/*,application/pdf" 
            capture={isMobile ? "environment" : undefined}
            onChange={handleFileChange}
            className="hidden" 
          />
        </label>
      </div>
      {files.length > 0 && (
        <p className="text-[10px] text-slate-400 italic">Total: {files.length} file baru terpilih</p>
      )}
    </div>
  );
};

const ExistingFilesManager = ({ existingFiles, setExistingFiles }: { existingFiles: string[], setExistingFiles: React.Dispatch<React.SetStateAction<string[]>> }) => {
  const removeExistingFile = (index: number) => {
    setExistingFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (existingFiles.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dokumen Terupload</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {existingFiles.map((url, idx) => (
          <div key={idx} className="relative aspect-square rounded-xl border border-slate-200 overflow-hidden bg-slate-50 group">
            {url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) || url.includes('supabase') ? (
              <img src={url} alt="existing" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                <FileText size={24} className="text-indigo-500 mb-1" />
                <span className="text-[10px] font-medium text-slate-600 truncate w-full">Dokumen {idx + 1}</span>
              </div>
            )}
            <button 
              type="button"
              onClick={() => removeExistingFile(idx)}
              className="absolute top-1 right-1 bg-rose-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              title="Hapus Dokumen"
            >
              <X size={12} />
            </button>
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <ExternalLink size={16} className="text-white" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
        : 'text-slate-600 hover:bg-slate-100'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const LoadingOverlay = () => (
  <div className="flex flex-col items-center justify-center p-12 w-full h-full min-h-[400px]">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs animate-pulse">
          S
        </div>
      </div>
    </div>
    <p className="mt-6 text-slate-500 font-medium animate-pulse">Memuat data...</p>
    <div className="mt-2 flex gap-1">
      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
    </div>
  </div>
);

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'letters' | 'dispositions' | 'agenda'>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    setSelectedLetterIds([]);
  }, [activeTab]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  
  // Modals
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [showDispositionModal, setShowDispositionModal] = useState(false);
  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ type: 'letter' | 'disposition' | 'agenda', data: any } | null>(null);

  // File States for Modals
  const [letterFiles, setLetterFiles] = useState<File[]>([]);
  const [dispoFiles, setDispoFiles] = useState<File[]>([]);
  const [agendaFiles, setAgendaFiles] = useState<File[]>([]);

  const [selectedLetterId, setSelectedLetterId] = useState('');
  const [selectedAgendaLetterId, setSelectedAgendaLetterId] = useState('');

  const [editingLetter, setEditingLetter] = useState<Letter | null>(null);
  const [editingDisposition, setEditingDisposition] = useState<Disposition | null>(null);
  const [editingAgenda, setEditingAgenda] = useState<Agenda | null>(null);
  const [existingFiles, setExistingFiles] = useState<string[]>([]);
  const [selectedLetterIds, setSelectedLetterIds] = useState<number[]>([]);

  // Reset files when modals close
  useEffect(() => { 
    if (!showLetterModal) {
      setLetterFiles([]);
      setEditingLetter(null);
      setExistingFiles([]);
    }
  }, [showLetterModal]);
  useEffect(() => { 
    if (!showDispositionModal) {
      setDispoFiles([]);
      setSelectedLetterId('');
      setEditingDisposition(null);
      setExistingFiles([]);
    }
  }, [showDispositionModal]);
  useEffect(() => { 
    if (!showAgendaModal) {
      setAgendaFiles([]);
      setSelectedAgendaLetterId('');
      setEditingAgenda(null);
      setExistingFiles([]);
    }
  }, [showAgendaModal]);

  // Pagination & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr; // Return original if not a valid date
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Makassar'
      }).format(date) + ' WITA';
    } catch (e) {
      return dateStr;
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Health check first
      const healthRes = await fetch('/api/health').catch(e => ({ ok: false, error: e }));
      console.log('API Health Check:', healthRes);

      const [lettersRes, dispositionsRes, agendasRes, summaryRes] = await Promise.all([
        fetch('/api/letters'),
        fetch('/api/dispositions'),
        fetch('/api/agendas'),
        fetch('/api/summary')
      ]);
      
      if (!lettersRes.ok || !dispositionsRes.ok || !agendasRes.ok || !summaryRes.ok) {
        throw new Error(`One or more API calls failed: ${lettersRes.status} ${dispositionsRes.status} ${agendasRes.status} ${summaryRes.status}`);
      }
      
      setLetters(await lettersRes.json());
      setDispositions(await dispositionsRes.json());
      setAgendas(await agendasRes.json());
      setSummary(await summaryRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePrintHTML = (lettersToPrint: Letter[]) => {
    const securityMap: Record<string, string> = {
      'SR': 'Sangat Rahasia',
      'R': 'Rahasia',
      'T': 'Terbatas',
      'B': 'Biasa'
    };

    let htmlContent = '';
    
    lettersToPrint.forEach((letter, index) => {
      htmlContent += `
        <div class="main-border ${index > 0 ? 'page-break' : ''}">
          <div class="header">
            <img src="https://cfimepbbeivzcdemjgip.supabase.co/storage/v1/object/public/sisa-uploads/img/Thumb_ntb.png" class="logo" alt="Logo NTB" referrerPolicy="no-referrer">
            <div class="header-text">
              <h1>PEMERINTAH PROVINSI NUSA TENGGARA BARAT</h1>
              <h2>BADAN KESATUAN BANGSA DAN POLITIK DALAM NEGERI</h2>
              <p>Jalan Pendidikan Nomor 2, Kelurahan Dasan Agung, Kecamatan Selaparang, Kota Mataram,<br>
                 Nusa Tenggara Barat 83125, Telepon (0370) 631215, Faksimile (0370) 631714,<br>
                 Laman: https://bakesbangpoldagri.ntbprov.go.id/, Pos-el: bakesbangpoldagri@ntbprov.go.id</p>
            </div>
          </div>
          
          <div class="title-bar">LEMBAR DISPOSISI</div>
          
          <div class="info-grid">
            <div class="info-cell">
              <div class="info-label">Nomor Agenda/Registrasi : <strong>#${letter.id.toString().padStart(4, '0')}</strong></div>
            </div>
            <div class="info-cell">
              <div class="info-label">Tanggal Keamanan : <strong>${securityMap[letter.security_date] || letter.security_date || '-'}</strong></div>
            </div>
          </div>
          
          <div class="info-grid">
            <div class="info-cell">
              <div class="info-label">Tanggal Penerimaan : <strong>${letter.receipt_date || '-'}</strong></div>
            </div>
            <div class="info-cell">
              <div class="info-label">Tanggal Penyelesaian : <strong>${letter.completion_date || '-'}</strong></div>
            </div>
          </div>
          
          <div class="detail-section">
            <div class="detail-row">
              <div class="detail-label">Asal Surat</div>
              <div class="detail-separator">:</div>
              <div class="detail-value">${letter.origin || '-'}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Tanggal Surat</div>
              <div class="detail-separator">:</div>
              <div class="detail-value">${letter.letter_date || '-'}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Nomor Surat</div>
              <div class="detail-separator">:</div>
              <div class="detail-value">${letter.letter_number || '-'}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Lampiran</div>
              <div class="detail-separator">:</div>
              <div class="detail-value">${letter.attachment || '-'}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Perihal</div>
              <div class="detail-separator">:</div>
              <div class="detail-value">${letter.summary || '-'}</div>
            </div>
          </div>

          <div class="checkbox-section">
            <div class="checkbox-col">
              <div class="checkbox-title">DITERUSKAN KEPADA:</div>
              ${FORWARD_OPTIONS.map(opt => `
                <div class="checkbox-item">
                  <div class="box"></div>
                  <span>${opt}</span>
                </div>
              `).join('')}
            </div>
            <div class="checkbox-col">
              <div class="checkbox-title">DISPOSISI:</div>
              ${DISPOSITION_OPTIONS.map(opt => `
                <div class="checkbox-item">
                  <div class="box"></div>
                  <span>${opt}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="footer-section">
            <div class="footer-col">
              <div class="footer-title">CATATAN:</div>
            </div>
            <div class="footer-col">
              <div class="footer-title">Paraf/Tanggal</div>
              <div class="signature-area">
                <div class="signature-title">Plh. KEPALA BAKESBANGPOLDAGRI PROVINSI NTB,</div>
                <div style="height: 90px;"></div>
                <div class="signature-line"></div>
                <div class="nip-line">NIP. __________________</div>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    return `
      <html>
        <head>
          <title>${lettersToPrint.length === 1 ? `Lembar Disposisi - #${lettersToPrint[0].id.toString().padStart(4, '0')}` : 'Bulk Print Lembar Disposisi'}</title>
          <style>
            @page { 
              size: 164mm 216mm; 
              margin: 0; 
            }
            body { 
              font-family: Arial, sans-serif; 
              padding: 0; 
              color: #000; 
              line-height: 1.1; 
              font-size: 10px; 
              width: 164mm;
              margin: 0;
            }
            .page-break {
              page-break-before: always;
            }
            .main-border { 
              border: 1.5px solid #000; 
              margin: 5mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
            }
            
            .header { display: flex; align-items: center; border-bottom: 1.5px solid #000; padding: 5px; }
            .logo { width: 50px; height: auto; margin-right: 10px; }
            .header-text { text-align: center; flex-grow: 1; }
            .header-text h1 { margin: 0; font-size: 11px; text-transform: uppercase; font-weight: bold; }
            .header-text h2 { margin: 1px 0; font-size: 12px; text-transform: uppercase; font-weight: bold; }
            .header-text p { margin: 0; font-size: 8px; line-height: 1.2; }
            
            .title-bar { text-align: center; font-weight: bold; font-size: 18px; border-bottom: 1px solid #000; padding: 3px 0; background: #eee; }
            
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000; }
            .info-cell { padding: 3px 8px; border-right: 1px solid #000; }
            .info-cell:last-child { border-right: none; }
            .info-label { font-size: 14px; margin-bottom: 1px; }
            .info-value { font-weight: bold; font-size: 10px; }
            
            .detail-section { padding: 5px 8px; border-bottom: 1px solid #000; }
            .detail-row { display: flex; margin-bottom: 2px; }
            .detail-label { width: 90px; flex-shrink: 0; font-size: 14px; }
            .detail-separator { width: 10px; }
            .detail-value { flex-grow: 1; font-weight: bold; font-size: 14px; }
            
            .checkbox-section { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #000; }
            .checkbox-col { padding: 5px; border-right: 1px solid #000; }
            .checkbox-col:last-child { border-right: none; }
            .checkbox-title { font-weight: bold; text-align: center; border-bottom: 1px solid #000; margin: -5px -5px 5px -5px; padding: 3px; background: #f5f5f5; font-size: 14px; }
            
            .checkbox-item { display: flex; align-items: flex-start; gap: 5px; margin-bottom: 2px; font-size: 18px; }
            .box { width: 18px; height: 18px; border: 1px solid #000; flex-shrink: 0; margin-top: 1px; }
            
            .footer-section { display: grid; grid-template-columns: 1fr 1fr;}
            .footer-col { padding: 5px; border-right: 1px solid #000; }
            .footer-col:last-child { border-right: none; }
            .footer-title { font-weight: bold; text-align: center; border-bottom: 1px solid #000; margin: -5px -5px 5px -5px; padding: 3px; background: #f5f5f5; font-size: 14px; }
            
            .signature-area { text-align: center; margin-top: 3px; }
            .signature-title { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
            .signature-line { border-bottom: 1px solid #000; width: 85%; margin: 0 auto 3px auto; }
            .nip-line { font-size: 12px; }

            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${htmlContent}
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => {
                window.onafterprint = () => window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;
  };

  const handlePrintLetter = (letter: Letter) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(generatePrintHTML([letter]));
    printWindow.document.close();
  };

  const handleBulkPrint = () => {
    const selectedLetters = letters.filter(l => selectedLetterIds.includes(l.id));
    if (selectedLetters.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(generatePrintHTML(selectedLetters));
    printWindow.document.close();
  };

  // --- Handlers ---

  const handleAddLetter = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);

      if (letterFiles.length > 0) {
        for (const file of letterFiles) {
          if (file.type.startsWith('image/')) {
            const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true };
            try {
              const compressedFile = await imageCompression(file, options);
              formData.append('files', compressedFile, file.name);
            } catch (error) {
              formData.append('files', file);
            }
          } else {
            formData.append('files', file);
          }
        }
      }
      
      if (editingLetter) {
        formData.append('existing_files', JSON.stringify(existingFiles));
        const response = await fetch(`/api/letters/${editingLetter.id}`, {
          method: 'PUT',
          body: formData,
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Gagal memperbarui surat");
        }
        setToast({ message: "Surat berhasil diperbarui!", type: 'success' });
      } else {
        const response = await fetch('/api/letters', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Gagal mengunggah surat");
        }
        setToast({ message: "Surat berhasil diregistrasi!", type: 'success' });
      }
      
      setShowLetterModal(false);
      fetchData();
    } catch (err: any) {
      setToast({ message: err.message || "Terjadi kesalahan", type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddDisposition = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const letter_id = formData.get('letter_id');
      const notes = formData.get('notes');
      
      const forwarded_to = FORWARD_OPTIONS.filter(opt => formData.get(`forward_${opt}`));
      const disposition_types = DISPOSITION_OPTIONS.filter(opt => formData.get(`dispo_${opt}`));

      const submitData = new FormData();
      submitData.append('letter_id', letter_id as string);
      submitData.append('notes', notes as string);
      submitData.append('forwarded_to', JSON.stringify(forwarded_to));
      submitData.append('disposition_types', JSON.stringify(disposition_types));
      
      if (dispoFiles.length > 0) {
        for (const file of dispoFiles) {
          if (file.type.startsWith('image/')) {
            const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true };
            try {
              const compressedFile = await imageCompression(file, options);
              submitData.append('files', compressedFile, file.name);
            } catch (error) {
              submitData.append('files', file);
            }
          } else {
            submitData.append('files', file);
          }
        }
      }

      if (editingDisposition) {
        submitData.append('existing_files', JSON.stringify(existingFiles));
        const response = await fetch(`/api/dispositions/${editingDisposition.id}`, {
          method: 'PUT',
          body: submitData,
        });
        if (!response.ok) throw new Error("Gagal memperbarui disposisi");
        setToast({ message: "Disposisi berhasil diperbarui!", type: 'success' });
      } else {
        const response = await fetch('/api/dispositions', {
          method: 'POST',
          body: submitData,
        });
        if (!response.ok) throw new Error("Gagal menyimpan disposisi");
        setToast({ message: "Disposisi berhasil disimpan!", type: 'success' });
      }
      
      setShowDispositionModal(false);
      fetchData();
    } catch (err: any) {
      setToast({ message: err.message || "Terjadi kesalahan", type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAgenda = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);

      if (agendaFiles.length > 0) {
        for (const file of agendaFiles) {
          if (file.type.startsWith('image/')) {
            const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true };
            try {
              const compressedFile = await imageCompression(file, options);
              formData.append('files', compressedFile, file.name);
            } catch (error) {
              formData.append('files', file);
            }
          } else {
            formData.append('files', file);
          }
        }
      }
      
      if (editingAgenda) {
        formData.append('existing_files', JSON.stringify(existingFiles));
        const response = await fetch(`/api/agendas/${editingAgenda.id}`, {
          method: 'PUT',
          body: formData,
        });
        if (!response.ok) throw new Error("Gagal memperbarui agenda");
        setToast({ message: "Agenda berhasil diperbarui!", type: 'success' });
      } else {
        const response = await fetch('/api/agendas', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error("Gagal menyimpan agenda");
        setToast({ message: "Agenda berhasil disimpan!", type: 'success' });
      }
      
      setShowAgendaModal(false);
      fetchData();
    } catch (err: any) {
      setToast({ message: err.message || "Terjadi kesalahan", type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setIsLoggedIn(true);
        localStorage.setItem('isLoggedIn', 'true');
        setShowLoginModal(false);
        setToast({ message: "Login Berhasil!", type: 'success' });
      } else {
        setToast({ message: result.error || "Email atau Password salah!", type: 'error' });
      }
    } catch (error) {
      console.error("Login error:", error);
      setToast({ message: "Terjadi kesalahan koneksi!", type: 'error' });
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    setActiveTab('dashboard');
    setToast({ message: "Berhasil Logout!", type: 'success' });
  };

  // --- Render Helpers ---

  const filteredLetters = useMemo(() => {
    return letters.filter(l => 
      l.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.letter_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.summary.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [letters, searchQuery]);

  const paginatedLetters = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLetters.slice(start, start + pageSize);
  }, [filteredLetters, currentPage, pageSize]);

  const filteredDispositions = useMemo(() => {
    return dispositions.filter(d => 
      d.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.summary.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [dispositions, searchQuery]);

  const paginatedDispositions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDispositions.slice(start, start + pageSize);
  }, [filteredDispositions, currentPage, pageSize]);

  const filteredAgendas = useMemo(() => {
    return agendas.filter(a => 
      a.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.summary.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [agendas, searchQuery]);

  const paginatedAgendas = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAgendas.slice(start, start + pageSize);
  }, [filteredAgendas, currentPage, pageSize]);

  // Check if a letter is already disposed
  const isLetterDisposed = (letterId: number) => {
    return dispositions.some(d => d.letter_id === letterId);
  };

  const isLetterInAgenda = (letterId: number) => {
    return agendas.some(a => a.letter_id === letterId);
  };

  const PaginationUI = ({ totalItems, currentItemsCount }: { totalItems: number, currentItemsCount: number }) => (
    <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500">Tampilkan</span>
        <select 
          className="bg-white border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
        >
          {[5, 10, 25, 50, 100].map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">
          {Math.min(totalItems, (currentPage - 1) * pageSize + 1)} - {Math.min(totalItems, currentPage * pageSize)} dari {totalItems}
        </span>
      </div>
      
      <div className="flex gap-2">
        <button 
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(prev => prev - 1)}
          className="p-2 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={18} />
        </button>
        <button 
          disabled={currentPage * pageSize >= totalItems}
          onClick={() => setCurrentPage(prev => prev + 1)}
          className="p-2 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Public Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                S
              </div>
              <h1 className="font-bold text-xl tracking-tight text-slate-800">SISA</h1>
            </div>
            <button 
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <User size={18} />
              <span>Login Admin</span>
            </button>
          </div>
        </header>

        {/* Public Content */}
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          <div className="mb-8 text-center sm:text-left">
            <h2 className="text-3xl font-bold text-slate-900">Informasi Agenda & Surat</h2>
            <p className="text-slate-500 mt-2">Selamat datang di Sistem Informasi Surat & Agenda (SISA)</p>
          </div>

          <AnimatePresence mode="wait">
            {isLoading ? (
              <LoadingOverlay />
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {/* Agenda OPD Section */}
                <div className="card overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <h3 className="font-bold text-slate-800">Agenda OPD</h3>
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded uppercase">Disposisi</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded uppercase">Kaban</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Waktu Kegiatan</th>
                          <th className="px-6 py-3 font-semibold">Lokasi</th>
                          <th className="px-6 py-3 font-semibold">Dihadiri Oleh</th>
                          <th className="px-6 py-3 font-semibold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {summary?.agendaOPD.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-600">{formatDateTime(item.activity_time)}</td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-800">{item.activity_location || '-'}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {item.attended_by.map(person => (
                                  <span key={person} className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                                    item.source === 'agenda' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                                  }`}>
                                    {person}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => setSelectedItem({ type: item.source as any, data: item.full_data })}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 rounded-lg"
                                title="Lihat Detail"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!summary || summary.agendaOPD.length === 0) && (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Tidak ada agenda hari ini.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Letters Section */}
                <div className="card overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <h3 className="font-bold text-slate-800">Surat Masuk Terbaru</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Tanggal</th>
                          <th className="px-6 py-3 font-semibold">Asal Surat</th>
                          <th className="px-6 py-3 font-semibold">Nomor Surat</th>
                          <th className="px-6 py-3 font-semibold">Ringkasan</th>
                          <th className="px-6 py-3 font-semibold text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {summary?.recentLetters.map((letter) => (
                          <tr key={letter.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-600">{new Date(letter.receipt_date).toLocaleDateString('id-ID')}</td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">{letter.origin}</td>
                            <td className="px-6 py-4 text-sm text-indigo-600 font-mono">{letter.letter_number}</td>
                            <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-xs">{letter.summary}</td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => setSelectedItem({ type: 'letter', data: letter })}
                                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                title="Lihat Detail"
                              >
                                <Eye size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!summary || summary.recentLetters.length === 0) && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Belum ada surat masuk.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
            &copy; 2024 BAKESBANGPOLDAGRI PROVINSI NTB. All rights reserved.
          </div>
        </footer>

        {/* Modals for Public View */}
        <AnimatePresence>
          {selectedItem && (
            <DetailModal 
              item={selectedItem} 
              onClose={() => setSelectedItem(null)} 
              formatDateTime={formatDateTime}
              allDispositions={dispositions}
              allAgendas={agendas}
            />
          )}
        </AnimatePresence>

        {/* Login Modal */}
        <AnimatePresence>
          {showLoginModal && (
            <div 
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setShowLoginModal(false)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6 shadow-lg shadow-indigo-200">
                    S
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">Login Admin</h3>
                  <p className="text-slate-500 mt-2">Silakan masuk untuk mengelola data</p>
                </div>
                <form onSubmit={handleLogin} className="p-8 pt-0 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                    <input 
                      name="email" 
                      type="email" 
                      required 
                      defaultValue="kesbangpolntb@ps.com"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                    <input 
                      name="password" 
                      type="password" 
                      required 
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                      placeholder="••••••••"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 mt-4 active:scale-[0.98]"
                  >
                    Masuk Sekarang
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-6 right-6 z-[110] px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 ${
                toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <span className="font-medium">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col p-4 transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between px-2 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              S
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800">SISA</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 space-y-1">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dasbor" 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setSearchQuery(''); setIsSidebarOpen(false); }}
          />
          <SidebarItem 
            icon={FileText} 
            label="Registrasi Surat" 
            active={activeTab === 'letters'} 
            onClick={() => { setActiveTab('letters'); setSearchQuery(''); setCurrentPage(1); setIsSidebarOpen(false); }}
          />
          <SidebarItem 
            icon={Send} 
            label="Disposisi Surat" 
            active={activeTab === 'dispositions'} 
            onClick={() => { setActiveTab('dispositions'); setSearchQuery(''); setCurrentPage(1); setIsSidebarOpen(false); }}
          />
          <SidebarItem 
            icon={Calendar} 
            label="Agenda Kaban" 
            active={activeTab === 'agenda'} 
            onClick={() => { setActiveTab('agenda'); setSearchQuery(''); setCurrentPage(1); setIsSidebarOpen(false); }}
          />
        </nav>

        <div className="mt-auto p-4 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">User</p>
          <p className="text-sm font-semibold text-slate-800 truncate">ridhoimanz@gmail.com</p>
          <button 
            onClick={handleLogout}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors"
          >
            <X size={14} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                {activeTab === 'dashboard' && 'Dasbor'}
                {activeTab === 'letters' && 'Registrasi Surat Masuk'}
                {activeTab === 'dispositions' && 'Disposisi Surat'}
                {activeTab === 'agenda' && 'Agenda Kepala Badan'}
              </h2>
              <p className="text-sm text-slate-500 hidden sm:block">
                {activeTab === 'dashboard' && 'Rangkuman aktivitas surat masuk'}
                {activeTab === 'letters' && 'Kelola daftar surat masuk yang diterima'}
                {activeTab === 'dispositions' && 'Kelola instruksi dan penerusan surat'}
                {activeTab === 'agenda' && 'Jadwal kegiatan kepala badan'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {(activeTab === 'letters' || activeTab === 'dispositions' || activeTab === 'agenda') && (
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari..." 
                  className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
            
            {activeTab === 'letters' && (
              <div className="flex items-center gap-2">
                {selectedLetterIds.length > 0 && (
                  <button 
                    onClick={handleBulkPrint}
                    className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <Printer size={20} />
                    <span className="hidden sm:inline">Cetak Bulk ({selectedLetterIds.length})</span>
                    <span className="sm:hidden">({selectedLetterIds.length})</span>
                  </button>
                )}
                <button 
                  onClick={() => setShowLetterModal(true)}
                  className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Plus size={20} />
                  <span>Tambah Surat</span>
                </button>
              </div>
            )}

            {activeTab === 'dispositions' && (
              <button 
                onClick={() => setShowDispositionModal(true)}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus size={20} />
                <span>Tambah Disposisi</span>
              </button>
            )}

            {activeTab === 'agenda' && (
              <button 
                onClick={() => setShowAgendaModal(true)}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus size={20} />
                <span>Tambah Agenda</span>
              </button>
            )}
          </div>
        </header>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LoadingOverlay />
            </motion.div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
              <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                <div className="card p-3 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4 text-center sm:text-left">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-100 text-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
                    <FileText size={16} className="sm:hidden" />
                    <FileText size={24} className="hidden sm:block" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-sm text-slate-500 font-medium truncate">Total Surat</p>
                    <p className="text-sm sm:text-2xl font-bold text-slate-900">{summary?.totalLetters || 0}</p>
                  </div>
                </div>
                <div className="card p-3 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4 text-center sm:text-left">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 bg-emerald-100 text-emerald-600 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
                    <Send size={16} className="sm:hidden" />
                    <Send size={24} className="hidden sm:block" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-sm text-slate-500 font-medium truncate">Disposisi</p>
                    <p className="text-sm sm:text-2xl font-bold text-slate-900">{summary?.totalDispositions || 0}</p>
                  </div>
                </div>
                <div className="card p-3 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4 text-center sm:text-left">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 bg-amber-100 text-amber-600 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
                    <Calendar size={16} className="sm:hidden" />
                    <Calendar size={24} className="hidden sm:block" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-sm text-slate-500 font-medium truncate">Agenda</p>
                    <p className="text-sm sm:text-2xl font-bold text-slate-900">{summary?.totalAgendas || 0}</p>
                  </div>
                </div>
              </div>

            <div className="space-y-8">
              <div className="card overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Agenda OPD</h3>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded uppercase">Disposisi</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded uppercase">Kaban</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Waktu Kegiatan</th>
                        <th className="px-6 py-3 font-semibold">Lokasi</th>
                        <th className="px-6 py-3 font-semibold">Dihadiri Oleh</th>
                        <th className="px-6 py-3 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary?.agendaOPD.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-600">{formatDateTime(item.activity_time)}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-800">{item.activity_location || '-'}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {item.attended_by.map(person => (
                                <span key={person} className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                                  item.source === 'agenda' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                                }`}>
                                  {person}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => setSelectedItem({ type: item.source as any, data: item.full_data })}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 rounded-lg"
                              title="Lihat Detail"
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!summary?.agendaOPD || summary.agendaOPD.length === 0) && (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">Belum ada agenda OPD.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Surat Masuk Terbaru</h3>
                  <button onClick={() => setActiveTab('letters')} className="text-xs font-bold text-indigo-600 hover:underline">Lihat Semua</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-semibold">No. Agenda</th>
                        <th className="px-6 py-3 font-semibold">Asal Surat</th>
                        <th className="px-6 py-3 font-semibold">No. Surat</th>
                        <th className="px-6 py-3 font-semibold">Ringkasan</th>
                        <th className="px-6 py-3 font-semibold text-right">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary?.recentLetters.map((letter) => (
                        <tr key={letter.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-mono text-sm text-indigo-600">#{letter.id.toString().padStart(4, '0')}</div>
                            <div className="flex gap-1 mt-1">
                              {dispositions.some(d => Number(d.letter_id) === Number(letter.id)) && (
                                <div className="w-2 h-2 bg-emerald-500 rounded-full" title="Sudah Disposisi"></div>
                              )}
                              {agendas.some(a => Number(a.letter_id) === Number(letter.id)) && (
                                <div className="w-2 h-2 bg-amber-500 rounded-full" title="Agenda Kaban"></div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-800">{letter.origin}</td>
                          <td className="px-6 py-4 text-slate-600">{letter.letter_number}</td>
                          <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{letter.summary}</td>
                          <td className="px-6 py-4 text-slate-500 text-right text-sm">{letter.receipt_date}</td>
                        </tr>
                      ))}
                      {(!summary?.recentLetters || summary.recentLetters.length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Belum ada data surat masuk.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            </motion.div>
          )}

          {activeTab === 'letters' && (
            <motion.div 
              key="letters"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="card">
                <div className="p-4 border-b border-slate-100 flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Keterangan:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span>Sudah Disposisi</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span>Agenda Kaban</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-semibold w-10">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                            checked={paginatedLetters.length > 0 && paginatedLetters.every(l => selectedLetterIds.includes(l.id))}
                            onChange={() => {
                              if (paginatedLetters.every(l => selectedLetterIds.includes(l.id))) {
                                setSelectedLetterIds(prev => prev.filter(id => !paginatedLetters.some(l => l.id === id)));
                              } else {
                                const newIds = paginatedLetters.map(l => l.id).filter(id => !selectedLetterIds.includes(id));
                                setSelectedLetterIds(prev => [...prev, ...newIds]);
                              }
                            }}
                          />
                        </th>
                        <th className="px-6 py-3 font-semibold">No. Agenda</th>
                        <th className="px-6 py-3 font-semibold">Asal Surat</th>
                        <th className="px-6 py-3 font-semibold">No. Surat</th>
                        <th className="px-6 py-3 font-semibold">Ringkasan Isi</th>
                        <th className="px-6 py-3 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedLetters.map((letter) => (
                        <tr key={letter.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                              checked={selectedLetterIds.includes(letter.id)}
                              onChange={() => {
                                setSelectedLetterIds(prev => 
                                  prev.includes(letter.id) ? prev.filter(id => id !== letter.id) : [...prev, letter.id]
                                );
                              }}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-mono text-sm text-indigo-600">#{letter.id.toString().padStart(4, '0')}</div>
                            <div className="flex gap-1.5 mt-1">
                              {dispositions.some(d => Number(d.letter_id) === Number(letter.id)) && (
                                <div className="flex items-center gap-0.5 px-1 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[8px] font-bold uppercase border border-emerald-100" title="Sudah Disposisi">
                                  <Send size={8} /> Dispo
                                </div>
                              )}
                              {agendas.some(a => Number(a.letter_id) === Number(letter.id)) && (
                                <div className="flex items-center gap-0.5 px-1 py-0.5 bg-amber-50 text-amber-600 rounded text-[8px] font-bold uppercase border border-amber-100" title="Agenda Kaban">
                                  <Calendar size={8} /> Agenda
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-800">{letter.origin}</td>
                          <td className="px-6 py-4 text-slate-600">{letter.letter_number}</td>
                          <td className="px-6 py-4 text-slate-600">{letter.summary}</td>
                          <td className="px-6 py-4 text-right flex justify-end gap-2">
                            <button 
                              onClick={() => setSelectedItem({ type: 'letter', data: letter })}
                              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Lihat Detail"
                            >
                              <Eye size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingLetter(letter);
                                try {
                                  setExistingFiles(letter.file_path ? JSON.parse(letter.file_path) : []);
                                } catch (e) {
                                  setExistingFiles(letter.file_path ? [letter.file_path] : []);
                                }
                                setShowLetterModal(true);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Edit Surat"
                            >
                              <Pencil size={18} />
                            </button>
                            <button 
                              onClick={() => handlePrintLetter(letter)}
                              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Cetak Lembar Disposisi"
                            >
                              <Printer size={18} />
                            </button>
                            <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                              <MoreVertical size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {paginatedLetters.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Tidak ada surat ditemukan.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                <PaginationUI totalItems={filteredLetters.length} currentItemsCount={paginatedLetters.length} />
              </div>
            </motion.div>
          )}

          {activeTab === 'dispositions' && (
            <motion.div 
              key="dispositions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-semibold">No. Dispo</th>
                        <th className="px-6 py-3 font-semibold">Asal Surat</th>
                        <th className="px-6 py-3 font-semibold">Waktu Kegiatan</th>
                        <th className="px-6 py-3 font-semibold">Ringkasan</th>
                        <th className="px-6 py-3 font-semibold">Diteruskan</th>
                        <th className="px-6 py-3 font-semibold">Disposisi</th>
                        <th className="px-6 py-3 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedDispositions.map((dispo) => {
                        const forwarded = JSON.parse(dispo.forwarded_to) as string[];
                        const types = JSON.parse(dispo.disposition_types) as string[];
                        return (
                          <tr key={dispo.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-indigo-600">#{dispo.id.toString().padStart(4, '0')}</td>
                            <td className="px-6 py-4 font-medium text-slate-800">{dispo.origin}</td>
                            <td className="px-6 py-4 text-slate-600">{formatDateTime(dispo.activity_time)}</td>
                            <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{dispo.summary}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {forwarded.map(f => (
                                  <span key={f} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase">{f}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {types.map(t => (
                                  <span key={t} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded uppercase">{t}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                              <button 
                                onClick={() => setSelectedItem({ type: 'disposition', data: dispo })}
                                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                title="Lihat Detail"
                              >
                                <Eye size={18} />
                              </button>
                              <button 
                                onClick={() => {
                                setEditingDisposition(dispo);
                                setSelectedLetterId(String(dispo.letter_id));
                                try {
                                  setExistingFiles(dispo.file_path ? JSON.parse(dispo.file_path) : []);
                                } catch (e) {
                                  setExistingFiles(dispo.file_path ? [dispo.file_path] : []);
                                }
                                setShowDispositionModal(true);
                              }}
                                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                title="Edit Disposisi"
                              >
                                <Pencil size={18} />
                              </button>
                              <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                <MoreVertical size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {paginatedDispositions.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">Tidak ada disposisi ditemukan.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationUI totalItems={filteredDispositions.length} currentItemsCount={paginatedDispositions.length} />
              </div>
            </motion.div>
          )}

          {activeTab === 'agenda' && (
            <motion.div 
              key="agenda"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-semibold">No. Agenda</th>
                        <th className="px-6 py-3 font-semibold">Asal Surat / Sumber</th>
                        <th className="px-6 py-3 font-semibold">Waktu Kegiatan</th>
                        <th className="px-6 py-3 font-semibold">Ringkasan Isi</th>
                        <th className="px-6 py-3 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedAgendas.map((agenda) => (
                        <tr key={agenda.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-mono text-sm text-indigo-600">#{agenda.id.toString().padStart(4, '0')}</td>
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {agenda.origin}
                            {agenda.letter_id && <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded">DARI SURAT</span>}
                          </td>
                          <td className="px-6 py-4 text-slate-600">{formatDateTime(agenda.activity_time)}</td>
                          <td className="px-6 py-4 text-slate-600">{agenda.summary}</td>
                          <td className="px-6 py-4 text-right flex justify-end gap-2">
                            <button 
                              onClick={() => setSelectedItem({ type: 'agenda', data: agenda })}
                              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Lihat Detail"
                            >
                              <Eye size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingAgenda(agenda);
                                setSelectedAgendaLetterId(agenda.letter_id ? String(agenda.letter_id) : '');
                                try {
                                  setExistingFiles(agenda.file_path ? JSON.parse(agenda.file_path) : []);
                                } catch (e) {
                                  setExistingFiles(agenda.file_path ? [agenda.file_path] : []);
                                }
                                setShowAgendaModal(true);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Edit Agenda"
                            >
                              <Pencil size={18} />
                            </button>
                            <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                              <MoreVertical size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {paginatedAgendas.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Tidak ada agenda ditemukan.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationUI totalItems={filteredAgendas.length} currentItemsCount={paginatedAgendas.length} />
              </div>
            </motion.div>
          )}
            </>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      
      <AnimatePresence>
        {selectedItem && (
          <DetailModal 
            item={selectedItem} 
            onClose={() => setSelectedItem(null)} 
            formatDateTime={formatDateTime}
            allDispositions={dispositions}
            allAgendas={agendas}
          />
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 ${
              toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Letter Modal */}
      <AnimatePresence>
        {showLetterModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setShowLetterModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">{editingLetter ? 'Edit Registrasi Surat' : 'Registrasi Surat Masuk'}</h3>
                <button onClick={() => setShowLetterModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddLetter} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tanggal Penerimaan</label>
                    <input name="receipt_date" type="date" required defaultValue={editingLetter?.receipt_date} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Keamanan</label>
                    <select 
                      name="security_date" 
                      defaultValue={editingLetter?.security_date || ""} 
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="">-- Pilih Keamanan --</option>
                      <option value="SR">SR (Sangat Rahasia)</option>
                      <option value="R">R (Rahasia)</option>
                      <option value="T">T (Terbatas)</option>
                      <option value="B">B (Biasa)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tanggal Surat</label>
                    <input name="letter_date" type="date" required defaultValue={editingLetter?.letter_date} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tanggal Penyelesaian</label>
                    <input name="completion_date" type="date" defaultValue={editingLetter?.completion_date} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Nomor Surat</label>
                    <input name="letter_number" type="text" required defaultValue={editingLetter?.letter_number} placeholder="XXX/YYY/ZZZ" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Lampiran</label>
                    <input name="attachment" type="text" defaultValue={editingLetter?.attachment} placeholder="Contoh: 1 Berkas" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Asal Surat</label>
                  <input name="origin" type="text" required defaultValue={editingLetter?.origin} placeholder="Contoh: Sekretariat Daerah" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Waktu Kegiatan</label>
                  <input name="activity_time" type="datetime-local" defaultValue={editingLetter?.activity_time} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Lokasi Kegiatan</label>
                  <input name="activity_location" type="text" defaultValue={editingLetter?.activity_location} placeholder="Contoh: Ruang Rapat Lantai 2" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Ringkasan Isi</label>
                  <textarea name="summary" required rows={3} defaultValue={editingLetter?.summary} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"></textarea>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    Upload Surat (Gambar/PDF)
                  </label>
                  <ExistingFilesManager existingFiles={existingFiles} setExistingFiles={setExistingFiles} />
                  <FilePicker files={letterFiles} setFiles={setLetterFiles} isMobile={isMobile} />
                </div>
                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Sedang Menyimpan...
                      </>
                    ) : (
                      editingLetter ? 'Update Surat' : 'Simpan Surat'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Disposition Modal */}
      <AnimatePresence>
        {showDispositionModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setShowDispositionModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">{editingDisposition ? 'Edit Disposisi Surat' : 'Buat Disposisi Surat'}</h3>
                <button onClick={() => setShowDispositionModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddDisposition} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Pilih Surat</label>
                  <SearchableSelect 
                    name="letter_id"
                    placeholder="-- Cari & Pilih Surat --"
                    value={selectedLetterId}
                    onChange={setSelectedLetterId}
                    options={letters
                      .filter(l => {
                        if (editingDisposition && l.id === editingDisposition.letter_id) return true;
                        return !isLetterDisposed(l.id) && !isLetterInAgenda(l.id);
                      })
                      .map(l => ({
                        id: l.id,
                        label: l.letter_number,
                        sublabel: l.origin
                      }))
                    }
                  />
                  <p className="text-[10px] text-slate-400 italic mt-1">* Surat yang sudah didisposisi atau menjadi agenda tidak muncul di sini.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase">Diteruskan Kepada</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {FORWARD_OPTIONS.map(opt => {
                      const isChecked = editingDisposition ? JSON.parse(editingDisposition.forwarded_to).includes(opt) : false;
                      return (
                        <label key={opt} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input type="checkbox" name={`forward_${opt}`} defaultChecked={isChecked} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm text-slate-700">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase">Disposisi</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DISPOSITION_OPTIONS.map(opt => {
                      const isChecked = editingDisposition ? JSON.parse(editingDisposition.disposition_types).includes(opt) : false;
                      return (
                        <label key={opt} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input type="checkbox" name={`dispo_${opt}`} defaultChecked={isChecked} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm text-slate-700">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Catatan</label>
                  <textarea name="notes" rows={2} defaultValue={editingDisposition?.notes} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"></textarea>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    Upload Lampiran Disposisi (Gambar/PDF)
                  </label>
                  <ExistingFilesManager existingFiles={existingFiles} setExistingFiles={setExistingFiles} />
                  <FilePicker files={dispoFiles} setFiles={setDispoFiles} isMobile={isMobile} />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Sedang Menyimpan...
                      </>
                    ) : (
                      editingDisposition ? 'Update Disposisi' : 'Simpan Disposisi'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Agenda Modal */}
      <AnimatePresence>
        {showAgendaModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setShowAgendaModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">{editingAgenda ? 'Edit Agenda Kaban' : 'Tambah Agenda Kaban'}</h3>
                <button onClick={() => setShowAgendaModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              <form id="agenda-form" onSubmit={handleAddAgenda} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Pilih dari Surat (Opsional)</label>
                  <SearchableSelect 
                    name="letter_id"
                    placeholder="-- Agenda Baru (Luar Surat) --"
                    value={selectedAgendaLetterId}
                    onChange={(val) => {
                      setSelectedAgendaLetterId(val);
                      const id = Number(val);
                      const letter = letters.find(l => l.id === id);
                      if (letter) {
                        const form = document.querySelector('form[id="agenda-form"]') as HTMLFormElement;
                        if (form) {
                          (form.elements.namedItem('origin') as HTMLInputElement).value = letter.origin;
                          (form.elements.namedItem('activity_time') as HTMLInputElement).value = letter.activity_time;
                          (form.elements.namedItem('activity_location') as HTMLInputElement).value = letter.activity_location;
                          (form.elements.namedItem('summary') as HTMLTextAreaElement).value = letter.summary;
                        }
                      }
                    }}
                    options={letters
                      .filter(l => {
                        if (editingAgenda && l.id === editingAgenda.letter_id) return true;
                        return !isLetterDisposed(l.id) && !isLetterInAgenda(l.id);
                      })
                      .map(l => ({
                        id: l.id,
                        label: l.letter_number,
                        sublabel: l.origin
                      }))
                    }
                  />
                  <p className="text-[10px] text-slate-400 italic mt-1">* Surat yang sudah didisposisi atau sudah ada di agenda tidak muncul di sini.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Asal / Sumber Agenda</label>
                  <input name="origin" type="text" required defaultValue={editingAgenda?.origin} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Waktu Kegiatan</label>
                  <input name="activity_time" type="datetime-local" defaultValue={editingAgenda?.activity_time} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Lokasi Kegiatan</label>
                  <input name="activity_location" type="text" defaultValue={editingAgenda?.activity_location} placeholder="Contoh: Aula Kantor" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Ringkasan Isi</label>
                  <textarea name="summary" required rows={3} defaultValue={editingAgenda?.summary} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"></textarea>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    Upload Lampiran Agenda (Gambar/PDF)
                  </label>
                  <ExistingFilesManager existingFiles={existingFiles} setExistingFiles={setExistingFiles} />
                  <FilePicker files={agendaFiles} setFiles={setAgendaFiles} isMobile={isMobile} />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Sedang Menyimpan...
                      </>
                    ) : (
                      editingAgenda ? 'Update Agenda' : 'Simpan Agenda'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
