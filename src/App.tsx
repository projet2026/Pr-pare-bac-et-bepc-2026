/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { 
  BookOpen, 
  GraduationCap, 
  FileText, 
  CheckCircle, 
  Search, 
  Sparkles,
  ChevronRight,
  ArrowRight,
  Download,
  ClipboardCheck,
  BrainCircuit,
  Clock,
  LayoutDashboard,
  DollarSign,
  Upload,
  FileCheck,
  Loader2,
  ShieldCheck,
  AlertCircle,
  X,
  RefreshCw
} from 'lucide-react';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type ExamType = 'BAC' | 'BEPC';
type AppView = 'landing' | 'dashboard' | 'auth';
type ContentType = 'Sujet' | 'Corrigé' | 'Méthodologie';

interface User {
  id: string;
  name: string;
  email: string;
}

interface GeneratedExam {
  subject: string;
  correction: string;
  tips: string;
}

interface PaymentInfo {
  type: 'subject' | 'pack';
  name: string;
  price: number;
  id: string; 
}

interface PendingPayment {
  id: string;
  userId: string;
  itemId: string;
  itemName: string;
  price: number;
  screenshot: string;
  status: 'pending' | 'validated' | 'rejected';
}

export default function App() {
  const [view, setView] = useState<AppView | 'admin'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('bac_bepc_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [examType, setExamType] = useState<ExamType>('BAC');
  const [subject, setSubject] = useState('Mathématiques');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedExam | null>(null);
  const [activeTab, setActiveTab] = useState<ContentType>('Sujet');
  const [showPayment, setShowPayment] = useState<PaymentInfo | null>(null);
  const [unlockedItems, setUnlockedItems] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PendingPayment[]>([]);

  // Auth form state
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [authError, setAuthError] = useState('');

  // Admin state
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('admin_token'));
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const userId = currentUser?.id || 'guest';

  const handleUserAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = authMode === 'login' ? { email: userEmail, password: userPassword } : { name: userName, email: userEmail, password: userPassword };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        localStorage.setItem('bac_bepc_user', JSON.stringify(data.user));
        setView('dashboard');
      } else {
        setAuthError(data.error || 'Erreur d\'authentification');
      }
    } catch (err) {
      setAuthError('Erreur de connexion au serveur');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleUserLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('bac_bepc_user');
    setView('landing');
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setAdminToken(data.token);
        localStorage.setItem('admin_token', data.token);
      } else {
        setLoginError(data.error || 'Connexion échouée');
      }
    } catch (err) {
      setLoginError('Une erreur est survenue');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    localStorage.removeItem('admin_token');
  };

  const fetchHistory = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/user/${currentUser.id}/history`);
      const data = await res.json();
      setPaymentHistory(data);
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  }, [currentUser]);

  const fetchUnlocked = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/user/${currentUser.id}/unlocked`);
      const data = await res.json();
      setUnlockedItems(data);
    } catch (e) {
      console.error("Failed to fetch unlocked items", e);
    }
  }, [currentUser]);

  const fetchAdminPayments = useCallback(async () => {
    if (view !== 'admin' || !adminToken) return;
    try {
      const res = await fetch('/api/admin/payments', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (res.status === 403) {
        handleAdminLogout();
        return;
      }
      setPendingPayments(data);
    } catch (e) {
      console.error("Failed to fetch admin payments", e);
    }
  }, [view, adminToken]);

  useEffect(() => {
    if (currentUser) {
      fetchUnlocked();
      fetchHistory();
      const interval = setInterval(() => {
        fetchUnlocked();
        fetchHistory();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchUnlocked, fetchHistory, currentUser]);

  useEffect(() => {
    if (view === 'admin') {
      fetchAdminPayments();
      const interval = setInterval(fetchAdminPayments, 5000);
      return () => clearInterval(interval);
    }
  }, [view, fetchAdminPayments]);

  const subjects = [
    'Mathématiques',
    'Physique-Chimie',
    'SVT',
    'Français',
    'Histoire-Géographie',
    'Philosophie',
    'Anglais',
    'Espagnol',
    'Allemand'
  ];

  const getPrice = (name: string, type: ExamType) => {
    const isMajor = ['Mathématiques', 'Physique-Chimie', 'SVT'].includes(name);
    if (type === 'BEPC') {
      return isMajor ? 3000 : 2500;
    } else {
      return isMajor ? 5000 : 2500;
    }
  };

  const packPrice = examType === 'BAC' ? 20000 : 15000;

  const currentItemId = `${subject}-${examType}`;

  const handleUnlock = async () => {
    if (!selectedFile || !showPayment) return;
    
    setIsUploading(true);
    
    try {
      // For demo, we just send a mock screenshot string
      // In real app, convert File to Base64 or use FormData
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        await fetch('/api/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            itemId: showPayment.id,
            itemName: showPayment.name,
            price: showPayment.price,
            screenshot: base64
          })
        });

        setIsUploading(false);
        setShowPayment(null);
        setSelectedFile(null);
        alert("Paiement envoyé ! Veuillez attendre la validation par l'administrateur.");
      };
    } catch (e) {
      console.error("Upload failed", e);
      setIsUploading(false);
    }
  };

  const validatePayment = async (paymentId: string) => {
    try {
      await fetch('/api/admin/validate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ paymentId })
      });
      fetchAdminPayments();
    } catch (e) {
      console.error("Validation failed", e);
    }
  };

  const generateExam = async () => {
    setIsGenerating(true);
    setResults(null);
    // ... rest of the function (no change needed to the core logic for now)

    try {
      const prompt = `
        Tu es un professeur expert préparant des élèves pour le ${examType}.
        Matière : ${subject}
        Thème spécifique (optionnel) : ${topic}

        Génère un sujet d'examen type et sa correction détaillée en français.
        Le sujet doit être réaliste, conforme au niveau du ${examType} et inclure plusieurs exercices ou questions.

        Formatte ta réponse avec ces délimiteurs exacts :
        ---SUJET---
        [Contenu du sujet d'examen ici, avec barème de points]
        ---CORRIGE---
        [Correction détaillée étape par étape]
        ---CONSEILS---
        [Conseils méthodologiques pour réussir cette épreuve spécifique]
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const text = response.text || '';
      
      const parsed: GeneratedExam = {
        subject: text.split('---SUJET---')[1]?.split('---CORRIGE---')[0] || 'Erreur lors de la génération du sujet.',
        correction: text.split('---CORRIGE---')[1]?.split('---CONSEILS---')[0] || 'Erreur lors de la génération du corrigé.',
        tips: text.split('---CONSEILS---')[1] || 'Erreur lors de la génération des conseils.',
      };

      setResults(parsed);
      setActiveTab('Sujet');
    } catch (error) {
      console.error("Exam generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-slate-200">
              <GraduationCap size={32} />
            </div>
            <h1 className="text-2xl font-black italic uppercase tracking-tight">
              {authMode === 'login' ? 'Connexion' : 'Inscription'}
            </h1>
            <p className="text-slate-500 text-[10px] font-black mt-1 uppercase tracking-widest leading-none">
              {authMode === 'login' ? 'Espace Élève' : 'Rejoins la communauté'}
            </p>
          </div>

          <form onSubmit={handleUserAuth} className="space-y-6">
            {authMode === 'register' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Nom et Prénoms</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Jean Dupont"
                    required
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl px-6 py-4 outline-none transition-all font-bold"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Email</label>
              <div className="relative">
                <input 
                  type="email" 
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="exemple@email.com"
                  required
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl px-6 py-4 outline-none transition-all font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Mot de passe</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl px-6 py-4 outline-none transition-all font-bold"
                />
              </div>
            </div>

            {authError && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-100 shadow-sm animate-pulse">
                <AlertCircle size={16} /> {authError}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isLoggingIn ? <Loader2 className="animate-spin" size={18} /> : authMode === 'login' ? 'Se Connecter' : 'S\'inscrire'}
            </button>

            <div className="text-center pt-2">
              <button 
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:underline"
              >
                {authMode === 'login' ? 'Pas de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
              </button>
            </div>

            <button 
              type="button"
              onClick={() => setView('landing')}
              className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest pt-2 hover:text-slate-600 transition-colors"
            >
              Retour à l'accueil
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (view === 'admin') {
    if (!adminToken) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100"
          >
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-indigo-200">
                <ShieldCheck size={32} />
              </div>
              <h1 className="text-2xl font-black italic uppercase tracking-tight">Admin Login</h1>
              <p className="text-slate-500 text-xs font-bold mt-2 uppercase tracking-widest">Zone Réservée</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Email de l'administrateur</label>
                <div className="relative">
                  <input 
                    type="email" 
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="exemple@email.com"
                    required
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl px-6 py-4 outline-none transition-all font-bold placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Mot de passe</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl px-6 py-4 outline-none transition-all font-bold placeholder:text-slate-300"
                  />
                </div>
              </div>

              {loginError && (
                <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} /> {loginError}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoggingIn}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isLoggingIn ? <Loader2 className="animate-spin" size={18} /> : 'Se Connecter'}
              </button>

              <button 
                type="button"
                onClick={() => setView('landing')}
                className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest pt-4"
              >
                Retour au site
              </button>
            </form>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg">
                <ShieldCheck size={28} />
              </div>
              <h1 className="text-3xl font-black italic tracking-tight uppercase">Admin Panel</h1>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleAdminLogout}
                className="text-slate-400 hover:text-rose-600 text-[10px] font-black uppercase tracking-widest"
              >
                Déconnexion
              </button>
              <button 
                onClick={() => setView('landing')}
                className="bg-white border border-slate-200 px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
              >
                <X size={18} /> Quitter
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  Paiements en attente 
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
                    {pendingPayments.filter(p => p.status === 'pending').length}
                  </span>
                </h2>
                <button 
                  onClick={fetchAdminPayments}
                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  <RefreshCw size={20} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 pb-4">
                      <th className="pb-4 font-bold text-xs uppercase tracking-widest text-slate-400">Élève</th>
                      <th className="pb-4 font-bold text-xs uppercase tracking-widest text-slate-400">Objet</th>
                      <th className="pb-4 font-bold text-xs uppercase tracking-widest text-slate-400">Prix</th>
                      <th className="pb-4 font-bold text-xs uppercase tracking-widest text-slate-400">Capture</th>
                      <th className="pb-4 font-bold text-xs uppercase tracking-widest text-slate-400">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pendingPayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center text-slate-400 italic">
                          Aucun paiement en attente pour le moment.
                        </td>
                      </tr>
                    ) : (
                      pendingPayments.map(p => (
                        <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-4">
                            <div className="font-bold text-sm truncate max-w-[120px]">{p.userId}</div>
                          </td>
                          <td className="py-4">
                            <span className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-1 rounded-lg font-bold">
                              {p.itemName}
                            </span>
                          </td>
                          <td className="py-4 font-bold text-sm">{p.price} FCFA</td>
                          <td className="py-4">
                            <div className="relative group/img">
                              <img src={p.screenshot} className="w-12 h-12 object-cover rounded-lg border border-slate-200 cursor-zoom-in" alt="Paiement" />
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                <Search size={14} className="text-white" />
                              </div>
                            </div>
                          </td>
                          <td className="py-4">
                            {p.status === 'pending' ? (
                              <button 
                                onClick={() => validatePayment(p.id)}
                                className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-emerald-600 transition-all flex items-center gap-2"
                              >
                                <CheckCircle size={14} /> Valider
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                                <CheckCircle size={14} /> Déjà Validé
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-sm mb-4 uppercase tracking-widest text-slate-400">Total Validé</h3>
                <p className="text-4xl font-black italic tracking-tighter text-emerald-600">
                  {pendingPayments.filter(p => p.status === 'validated').reduce((acc, curr) => acc + curr.price, 0)} FCFA
                </p>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-sm mb-4 uppercase tracking-widest text-slate-400">Taux de conversion</h3>
                <p className="text-4xl font-black italic tracking-tighter text-indigo-600">
                  {pendingPayments.length > 0 ? Math.round((pendingPayments.filter(p => p.status === 'validated').length / pendingPayments.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-stone-50 font-sans text-slate-900">
        {/* Nav */}
        <nav className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <GraduationCap size={28} />
            </div>
            <span className="font-display text-2xl font-black tracking-tight text-slate-900 italic uppercase">PRÉPARE BAC & BEPC 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView((prev) => prev === 'admin' ? 'landing' : 'admin')}
              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
              title="Accès Admin"
            >
              <ShieldCheck size={20} />
            </button>
            {currentUser ? (
              <button 
                onClick={() => setView('dashboard')}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-full font-bold hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-lg"
              >
                Mon Espace <ChevronRight size={18} />
              </button>
            ) : (
              <button 
                onClick={() => { setView('auth'); setAuthMode('login'); }}
                className="bg-white border border-slate-200 text-slate-900 px-6 py-2.5 rounded-full font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                Connexion
              </button>
            )}
          </div>
        </nav>

        {/* Hero */}
        <main className="max-w-7xl mx-auto px-6 pt-20 pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-bold mb-8">
                <Sparkles size={16} /> Propulsé par Intelligence Artificielle
              </div>
              <h1 className="font-display text-7xl md:text-8xl font-black leading-[0.9] tracking-tighter mb-8 lowercase italic">
                Décroche ton <span className="text-indigo-600">bac</span> <br />
                & ton <span className="text-indigo-600">bepc</span>.
              </h1>
              <p className="text-xl text-slate-600 mb-10 max-w-lg leading-relaxed">
                Garantis ta réussite avec des sujets types et des corrigés détaillés personnalisés. Ne révise plus au hasard, vise l'excellence.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => currentUser ? setView('dashboard') : setView('auth')}
                  className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-all shadow-xl"
                >
                  Générer un sujet <FileText size={20} />
                </button>
                <div className="flex items-center gap-3 px-6 text-slate-400 font-medium">
                  <div className="flex -space-x-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200" />
                    ))}
                  </div>
                  <span className="text-sm">+5k élèves</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-white p-8 rounded-3xl border-2 border-slate-900 shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="space-y-4">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-4 bg-slate-100 rounded w-full" />
                  <div className="h-4 bg-slate-100 rounded w-5/6" />
                  <div className="pt-6">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Score moyen de réussite</div>
                        <div className="text-2xl font-black text-emerald-950 tracking-tight">16.5 / 20</div>
                      </div>
                      <CheckCircle className="text-emerald-500" size={32} />
                    </div>
                  </div>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-indigo-100/50 rounded-full blur-3xl -z-10" />
              <motion.div 
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -top-8 -right-8 bg-indigo-600 text-white p-4 rounded-2xl shadow-xl flex items-center gap-3"
              >
                <BrainCircuit size={24} />
                <span className="font-bold text-sm">Méthodologie Active</span>
              </motion.div>
            </motion.div>
          </div>
        </main>

        {/* Stats */}
        <section className="bg-slate-900 text-white py-24">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-16">
            <div>
              <div className="text-5xl font-black text-indigo-400 mb-4 tracking-tighter italic">100%</div>
              <h3 className="text-xl font-bold mb-2">Conforme aux programmes</h3>
              <p className="text-slate-400 leading-relaxed">Tous nos sujets suivent scrupuleusement les référentiels officiels de l'éducation nationale.</p>
            </div>
            <div>
              <div className="text-5xl font-black text-indigo-400 mb-4 tracking-tighter italic">24h/7</div>
              <h3 className="text-xl font-bold mb-2">Révisions illimitées</h3>
              <p className="text-slate-400 leading-relaxed">Génère autant de sujets que tu le souhaites pour t'entraîner sur chaque chapitre difficile.</p>
            </div>
            <div>
              <div className="text-5xl font-black text-indigo-400 mb-4 tracking-tighter italic">0 Sec</div>
              <h3 className="text-xl font-bold mb-2">Résultats instantanés</h3>
              <p className="text-slate-400 leading-relaxed">Pas besoin d'attendre. Obtiens ton corrigé complet dès que tu as fini de t'exercer.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col md:flex-row font-sans text-slate-900">
      {/* History Modal Overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-2xl font-black italic uppercase tracking-tight flex items-center gap-2">
                  <Clock size={24} className="text-indigo-600" /> Mes Achats
                </h3>
                <button onClick={() => setShowHistory(false)} className="bg-slate-50 p-2 rounded-full hover:bg-slate-100">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {paymentHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 italic">
                    Aucun achat enregistré.
                  </div>
                ) : (
                  paymentHistory.map(p => (
                    <div key={p.id} className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                      <div>
                        <div className="font-bold text-sm">{p.itemName}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                          {p.price} FCFA — {new Date().toLocaleDateString()}
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        p.status === 'validated' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {p.status === 'validated' ? 'Confirmé' : 'En attente'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Controls */}
      <aside className="w-full md:w-80 bg-white border-r border-slate-200 p-6 shrink-0 h-auto md:h-screen overflow-y-auto flex flex-col">
        <div className="flex items-center gap-2 mb-10 cursor-pointer" onClick={() => setView('landing')}>
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
            <GraduationCap size={20} />
          </div>
          <span className="font-display font-black text-lg tracking-tight italic uppercase">PRÉPARE BAC & BEPC</span>
        </div>

        {/* User Identity */}
        <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black">
              {currentUser?.name?.[0].toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{currentUser?.name}</div>
              <button 
                onClick={() => setShowHistory(true)}
                className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
              >
                Mes Achats
              </button>
            </div>
            <button 
              onClick={handleUserLogout}
              className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
              title="Déconnexion"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-8 flex-1">
          {/* Exam Type Toggle */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Type d'examen</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              {(['BAC', 'BEPC'] as ExamType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setExamType(type)}
                  className={`py-2 rounded-lg font-bold text-sm transition-all ${
                    examType === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Subject Select */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Matière & Prix</label>
            <div className="space-y-1">
              {subjects.map(s => {
                const price = getPrice(s, examType);
                return (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                      subject === s ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-2">
                        <span>{s}</span>
                        {unlockedItems.includes(`${s}-${examType}`) && <CheckCircle size={12} className="text-emerald-500" />}
                      </div>
                      <span className="text-[10px] opacity-70 group-hover:opacity-100">{price} FCFA / sujet</span>
                    </div>
                    {subject === s && <ChevronRight size={14} className="text-indigo-300" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pack Button */}
          <div className="pt-4 border-t border-slate-100">
             {unlockedItems.includes(`${subjects[0]}-${examType}`) && unlockedItems.includes(`${subjects[subjects.length-1]}-${examType}`) ? (
               <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700">
                 <CheckCircle size={20} />
                 <span className="text-xs font-bold uppercase tracking-tight">Pack {examType} Débloqué</span>
               </div>
             ) : (
               <button
                 onClick={() => setShowPayment({ 
                   type: 'pack', 
                   name: `Abonnement Complet ${examType}`, 
                   price: packPrice,
                   id: `pack-${examType}`
                 })}
                 className="w-full bg-indigo-50 text-indigo-600 border border-indigo-100 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
               >
                  Acheter Pack {examType} ({packPrice} FCFA)
               </button>
             )}
          </div>

          {/* Topic Detail */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Chapitre spécifique (Optionnel)</label>
            <input 
              type="text" 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: Probabilités, Second Degré..."
              className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
            />
          </div>

          <button
            onClick={() => {
              if (unlockedItems.includes(currentItemId)) {
                generateExam();
              } else {
                setShowPayment({ 
                  type: 'subject', 
                  name: `${subject} — ${examType}`, 
                  price: getPrice(subject, examType),
                  id: currentItemId
                });
              }
            }}
            disabled={isGenerating}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 disabled:opacity-50 transition-all shadow-lg"
          >
            {isGenerating ? 'Génération...' : unlockedItems.includes(currentItemId) ? (results ? 'Générer à nouveau' : 'Générer mon sujet') : `Débloquer pour ${getPrice(subject, examType)} FCFA`}
            {!isGenerating && <ArrowRight size={18} />}
          </button>
        </div>
      </aside>

      {/* Content Canvas */}
      <main className="flex-1 overflow-y-auto h-screen p-6 md:p-12">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {results ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Results Header */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                      <BookOpen size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black tracking-tight">{subject} — {examType}</h2>
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Clock size={10} /> 3-4 Heures estimées</span>
                        <span className="flex items-center gap-1"><CheckCircle size={10} /> Corrigé disponible</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                    {(['Sujet', 'Corrigé', 'Méthodologie'] as ContentType[]).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          activeTab === tab ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Panel */}
                <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-slate-200 min-h-[600px] relative">
                  <div className="absolute top-10 right-10 flex gap-2">
                    <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors" title="Télécharger">
                      <Download size={20} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors" title="Copier">
                      <ClipboardCheck size={20} />
                    </button>
                  </div>

                  <div className="markdown-body prose prose-slate max-w-none prose-h1:font-display prose-h1:text-4xl prose-h1:italic prose-h1:font-black prose-h1:tracking-tight prose-h2:font-bold prose-p:text-slate-600 prose-li:text-slate-600 leading-relaxed">
                    <ReactMarkdown>
                      {activeTab === 'Sujet' ? results.subject : activeTab === 'Corrigé' ? results.correction : results.tips}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Sticky CTA for Next Step */}
                {activeTab === 'Sujet' && (
                  <div className="bg-slate-900 text-white p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                    <div>
                      <h3 className="text-xl font-bold mb-1">Prêt pour l'étape suivante ?</h3>
                      <p className="opacity-60 text-sm">Une fois que tu as fini ton brouillon, consulte la correction détaillée.</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('Corrigé')}
                      className="bg-indigo-500 hover:bg-indigo-400 text-white px-8 py-3 rounded-xl font-bold transition-all whitespace-nowrap"
                    >
                      Voir le corrigé
                    </button>
                  </div>
                )}
              </motion.div>
            ) : isGenerating ? (
              <div className="h-[600px] flex flex-col items-center justify-center text-center">
                <div className="relative mb-8">
                  <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                  <GraduationCap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={32} />
                </div>
                <h2 className="text-3xl font-display italic font-black mb-3">L'IA prépare ton examen...</h2>
                <p className="max-w-md text-slate-500 font-medium leading-relaxed">
                  Notre intelligence analyse les sujets officiels des 10 dernières années pour te proposer l'entraînement le plus efficace possible.
                </p>
                
                {/* Dummy loader steps */}
                <div className="mt-12 space-y-4 w-64">
                   <div className="flex items-center gap-3 text-emerald-600 font-bold text-xs uppercase tracking-widest">
                     <CheckCircle size={14} /> Analyse du programme
                   </div>
                   <div className="flex items-center gap-3 text-indigo-600 font-bold text-xs uppercase tracking-widest animate-pulse">
                     <div className="w-3 h-3 bg-indigo-600 rounded-full animate-ping" /> Rédaction des problèmes
                   </div>
                   <div className="flex items-center gap-3 text-slate-300 font-bold text-xs uppercase tracking-widest">
                     <div className="w-3 h-3 bg-slate-200 rounded-full" /> Création du corrigé
                   </div>
                </div>
              </div>
            ) : (
              <div className="h-[600px] flex flex-col items-center justify-center text-center px-6">
                <div className="w-32 h-32 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-200 mb-8 border-2 border-indigo-100/50">
                  <LayoutDashboard size={64} />
                </div>
                <h3 className="text-4xl font-display italic font-black mb-4 lowercase tracking-tight">Bonjour, futur diplômé !</h3>
                <p className="max-w-sm text-slate-500 font-medium leading-relaxed mb-8"> Sélectionnez une matière sur la gauche pour commencer votre entraînement personnalisé.</p>
                <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                   <div className="bg-white p-4 rounded-2xl border border-slate-200 text-left shadow-sm">
                     <Search className="text-indigo-600 mb-2" size={20} />
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Étape 1</p>
                     <p className="text-sm font-bold">Choisis ton examen</p>
                   </div>
                   <div className="bg-white p-4 rounded-2xl border border-slate-200 text-left shadow-sm">
                     <FileText className="text-indigo-600 mb-2" size={20} />
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Étape 2</p>
                     <p className="text-sm font-bold">Sélectionne une matière</p>
                   </div>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPayment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative my-8"
            >
              <button 
                onClick={() => setShowPayment(null)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors"
              >
                <ChevronRight className="rotate-90" />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-4">
                  <DollarSign size={32} />
                </div>
                <h3 className="text-2xl font-black italic tracking-tight">{showPayment.name}</h3>
                <p className="text-slate-500 font-bold text-lg mt-1">{showPayment.price} FCFA</p>
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center mb-2">Instructions de paiement</p>
                
                <div className="space-y-4">
                  {/* MTN Section */}
                  <div className="p-5 rounded-3xl border-2 border-yellow-100 bg-yellow-50/30">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center font-black text-white text-xs italic">MTN</div>
                      <span className="font-bold">MTN Mobile Money</span>
                    </div>
                    <ol className="text-xs space-y-2 text-slate-600 font-medium list-decimal pl-4">
                      <li>Taper <span className="font-bold text-slate-900">*133#</span> sur votre téléphone</li>
                      <li>Choisir l'option <span className="font-bold text-slate-900">3</span> puis <span className="font-bold text-slate-900">1</span></li>
                      <li>Entrer le numéro : <span className="font-bold text-slate-900 italic">05 75 25 68 12</span></li>
                      <li>Saisir le montant : <span className="font-bold text-slate-900">{showPayment.price} FCFA</span></li>
                      <li>Confirmer la transaction</li>
                    </ol>
                  </div>

                  {/* Wave Section */}
                  <div className="p-5 rounded-3xl border-2 border-sky-100 bg-sky-50/30">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-sky-400 rounded-xl flex items-center justify-center font-black text-white text-xs italic">Wv</div>
                      <span className="font-bold">Wave</span>
                    </div>
                    <ul className="text-xs space-y-2 text-slate-600 font-medium">
                      <li className="flex items-start gap-2">
                        <span className="bg-sky-200 text-sky-700 w-4 h-4 rounded-full flex items-center justify-center shrink-0">1</span>
                        <span>Ouvrir l'application <span className="font-bold text-slate-900">Wave</span></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-sky-200 text-sky-700 w-4 h-4 rounded-full flex items-center justify-center shrink-0">2</span>
                        <span>Transférer au numéro : <span className="font-bold text-slate-900 italic">05 75 25 68 12</span></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-sky-200 text-sky-700 w-4 h-4 rounded-full flex items-center justify-center shrink-0">3</span>
                        <span>Montant : <span className="font-bold text-slate-900">{showPayment.price} FCFA</span></span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-indigo-600 rounded-3xl text-white shadow-lg text-center">
                  <p className="text-sm font-bold mb-4 flex items-center justify-center gap-2">
                    <Upload size={18} /> Envoyez votre capture ici
                  </p>
                  
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`p-6 border-2 border-dashed rounded-2xl transition-all ${selectedFile ? 'bg-white text-indigo-600 border-white' : 'border-white/30 bg-white/5 group-hover:bg-white/10'}`}>
                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-2 font-bold text-xs truncate">
                          <FileCheck size={16} /> {selectedFile.name}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-bold">Cliquez ou déposez la capture</span>
                          <span className="text-[8px] opacity-60 uppercase">Format JPG, PNG</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedFile && (
                    <button 
                      onClick={handleUnlock}
                      disabled={isUploading}
                      className="w-full mt-4 bg-white text-indigo-600 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-xl"
                    >
                      {isUploading ? <Loader2 className="animate-spin" size={16} /> : 'Valider mon paiement'}
                    </button>
                  )}

                  {!selectedFile && (
                    <p className="mt-4 text-[9px] opacity-70 leading-relaxed font-medium italic">
                      L'administrateur vérifiera manuellement votre capture. Le sujet sera débloqué dès validation.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

