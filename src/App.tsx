import React, { useState, useEffect, useMemo } from 'react';
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
  Menu
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'letters' | 'dispositions' | 'agenda'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  
  // Modals
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [showDispositionModal, setShowDispositionModal] = useState(false);
  const [showAgendaModal, setShowAgendaModal] = useState(false);

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
        hour12: false
      }).format(date) + ' WIB';
    } catch (e) {
      return dateStr;
    }
  };

  const fetchData = async () => {
    try {
      const [lettersRes, dispositionsRes, agendasRes, summaryRes] = await Promise.all([
        fetch('/api/letters'),
        fetch('/api/dispositions'),
        fetch('/api/agendas'),
        fetch('/api/summary')
      ]);
      
      setLetters(await lettersRes.json());
      setDispositions(await dispositionsRes.json());
      setAgendas(await agendasRes.json());
      setSummary(await summaryRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // --- Handlers ---

  const handleAddLetter = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await fetch('/api/letters', {
      method: 'POST',
      body: formData,
    });
    
    setShowLetterModal(false);
    fetchData();
  };

  const handleAddDisposition = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const letter_id = formData.get('letter_id');
    const notes = formData.get('notes');
    const file = formData.get('file');
    
    const forwarded_to = FORWARD_OPTIONS.filter(opt => formData.get(`forward_${opt}`));
    const disposition_types = DISPOSITION_OPTIONS.filter(opt => formData.get(`dispo_${opt}`));

    const submitData = new FormData();
    submitData.append('letter_id', letter_id as string);
    submitData.append('notes', notes as string);
    submitData.append('forwarded_to', JSON.stringify(forwarded_to));
    submitData.append('disposition_types', JSON.stringify(disposition_types));
    if (file) submitData.append('file', file);

    await fetch('/api/dispositions', {
      method: 'POST',
      body: submitData,
    });
    
    setShowDispositionModal(false);
    fetchData();
  };

  const handleAddAgenda = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await fetch('/api/agendas', {
      method: 'POST',
      body: formData,
    });
    
    setShowAgendaModal(false);
    fetchData();
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
              <button 
                onClick={() => setShowLetterModal(true)}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus size={20} />
                <span>Tambah Surat</span>
              </button>
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
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="card p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Total Surat</p>
                    <p className="text-2xl font-bold text-slate-900">{summary?.totalLetters || 0}</p>
                  </div>
                </div>
                <div className="card p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Send size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Total Disposisi</p>
                    <p className="text-2xl font-bold text-slate-900">{summary?.totalDispositions || 0}</p>
                  </div>
                </div>
                <div className="card p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Agenda Kaban</p>
                    <p className="text-2xl font-bold text-slate-900">{summary?.totalAgendas || 0}</p>
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
                          <td className="px-6 py-4 font-mono text-sm text-indigo-600">#{letter.id.toString().padStart(4, '0')}</td>
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
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-semibold">No. Agenda</th>
                        <th className="px-6 py-3 font-semibold">Asal Surat</th>
                        <th className="px-6 py-3 font-semibold">No. Surat</th>
                        <th className="px-6 py-3 font-semibold">Ringkasan Isi</th>
                        <th className="px-6 py-3 font-semibold">File</th>
                        <th className="px-6 py-3 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedLetters.map((letter) => (
                        <tr key={letter.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4 font-mono text-sm text-indigo-600">#{letter.id.toString().padStart(4, '0')}</td>
                          <td className="px-6 py-4 font-medium text-slate-800">{letter.origin}</td>
                          <td className="px-6 py-4 text-slate-600">{letter.letter_number}</td>
                          <td className="px-6 py-4 text-slate-600">{letter.summary}</td>
                          <td className="px-6 py-4">
                            {letter.file_path ? (
                              <a href={letter.file_path} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 text-xs">
                                <FileText size={14} /> Lihat
                              </a>
                            ) : <span className="text-slate-400 text-xs">-</span>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                              <MoreVertical size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {paginatedLetters.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Tidak ada surat ditemukan.</td>
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
                        <th className="px-6 py-3 font-semibold w-10">
                          <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        </th>
                        <th className="px-6 py-3 font-semibold">No. Dispo</th>
                        <th className="px-6 py-3 font-semibold">Asal Surat</th>
                        <th className="px-6 py-3 font-semibold">Waktu Kegiatan</th>
                        <th className="px-6 py-3 font-semibold">Ringkasan</th>
                        <th className="px-6 py-3 font-semibold">Diteruskan</th>
                        <th className="px-6 py-3 font-semibold">Disposisi</th>
                        <th className="px-6 py-3 font-semibold">File</th>
                        <th className="px-6 py-3 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedDispositions.map((dispo) => {
                        const forwarded = JSON.parse(dispo.forwarded_to) as string[];
                        const types = JSON.parse(dispo.disposition_types) as string[];
                        return (
                          <tr key={dispo.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            </td>
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
                            <td className="px-6 py-4">
                              {dispo.file_path ? (
                                <a href={dispo.file_path} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 text-xs">
                                  <FileText size={14} /> Lihat
                                </a>
                              ) : <span className="text-slate-400 text-xs">-</span>}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                <Printer size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {paginatedDispositions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">Tidak ada disposisi ditemukan.</td>
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
                        <th className="px-6 py-3 font-semibold">File</th>
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
                          <td className="px-6 py-4">
                            {agenda.file_path ? (
                              <a href={agenda.file_path} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 text-xs">
                                <FileText size={14} /> Lihat
                              </a>
                            ) : <span className="text-slate-400 text-xs">-</span>}
                          </td>
                          <td className="px-6 py-4 text-right">
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
        </AnimatePresence>
      </main>

      {/* Modals */}
      
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
                <h3 className="text-xl font-bold text-slate-900">Registrasi Surat Masuk</h3>
                <button onClick={() => setShowLetterModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddLetter} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tanggal Penerimaan</label>
                    <input name="receipt_date" type="date" required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tanggal Keamanan</label>
                    <input name="security_date" type="date" required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tanggal Penyelesaian</label>
                    <input name="completion_date" type="date" required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tanggal Surat</label>
                    <input name="letter_date" type="date" required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Asal Surat</label>
                  <input name="origin" type="text" required placeholder="Contoh: Sekretariat Daerah" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Nomor Surat</label>
                    <input name="letter_number" type="text" required placeholder="XXX/YYY/ZZZ" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Lampiran</label>
                    <input name="attachment" type="text" placeholder="Contoh: 1 Berkas" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Waktu Kegiatan</label>
                  <input name="activity_time" type="datetime-local" required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Lokasi Kegiatan</label>
                  <input name="activity_location" type="text" required placeholder="Contoh: Ruang Rapat Lantai 2" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Ringkasan Isi</label>
                  <textarea name="summary" required rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"></textarea>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Upload Surat (Gambar/PDF)</label>
                  <input name="file" type="file" accept=".jpeg,.jpg,.png,.pdf" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="pt-4">
                  <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Simpan Surat</button>
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
                <h3 className="text-xl font-bold text-slate-900">Buat Disposisi Surat</h3>
                <button onClick={() => setShowDispositionModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddDisposition} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Pilih Surat</label>
                  <select name="letter_id" required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">-- Pilih Surat --</option>
                    {letters.map(l => (
                      <option key={l.id} value={l.id}>{l.origin} - {l.letter_number}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase">Diteruskan Kepada</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {FORWARD_OPTIONS.map(opt => (
                      <label key={opt} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" name={`forward_${opt}`} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-slate-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase">Disposisi</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DISPOSITION_OPTIONS.map(opt => (
                      <label key={opt} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" name={`dispo_${opt}`} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-sm text-slate-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Catatan</label>
                  <textarea name="notes" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"></textarea>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Upload Lampiran Disposisi (Gambar/PDF)</label>
                  <input name="file" type="file" accept=".jpeg,.jpg,.png,.pdf" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Simpan Disposisi</button>
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
                <h3 className="text-xl font-bold text-slate-900">Tambah Agenda Kaban</h3>
                <button onClick={() => setShowAgendaModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddAgenda} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Pilih dari Surat (Opsional)</label>
                  <select 
                    name="letter_id" 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const letter = letters.find(l => l.id === id);
                      if (letter) {
                        const form = e.target.form!;
                        (form.elements.namedItem('origin') as HTMLInputElement).value = letter.origin;
                        (form.elements.namedItem('activity_time') as HTMLInputElement).value = letter.activity_time;
                        (form.elements.namedItem('summary') as HTMLTextAreaElement).value = letter.summary;
                      }
                    }}
                  >
                    <option value="">-- Agenda Baru (Luar Surat) --</option>
                    {letters
                      .filter(l => !isLetterDisposed(l.id))
                      .map(l => (
                        <option key={l.id} value={l.id}>{l.origin} - {l.letter_number}</option>
                      ))
                    }
                  </select>
                  <p className="text-[10px] text-slate-400 italic mt-1">* Surat yang sudah didisposisi tidak muncul di sini.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Asal / Sumber Agenda</label>
                  <input name="origin" type="text" required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Waktu Kegiatan</label>
                  <input name="activity_time" type="datetime-local" required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Lokasi Kegiatan</label>
                  <input name="activity_location" type="text" required placeholder="Contoh: Aula Kantor" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Ringkasan Isi</label>
                  <textarea name="summary" required rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"></textarea>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Upload Lampiran Agenda (Gambar/PDF)</label>
                  <input name="file" type="file" accept=".jpeg,.jpg,.png,.pdf" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Simpan Agenda</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
