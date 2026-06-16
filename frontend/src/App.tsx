import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/auth-context';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import VideoUploadPage from './pages/VideoUploadPage';
import ComparePage from './pages/ComparePage';
import HistoryPage from './pages/HistoryPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ReportPage from './pages/ReportPage';
import LoginPage from './pages/LoginPage';
import Landing from './pages/Landing';
import { Shield, Eye, Upload, Clock, FileDown, LogOut, User, Film, GitCompare, Cpu } from 'lucide-react';

const AppContent: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'upload' | 'video' | 'compare' | 'history' | 'analytics' | 'report' | 'login'>('dashboard');

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard': return <DashboardPage />;
      case 'upload': return <UploadPage />;
      case 'video': return <VideoUploadPage />;
      case 'compare': return <ComparePage onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'history': return <HistoryPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'report': return <ReportPage />;
      case 'login': return <LoginPage />;
      default: return <DashboardPage />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Eye },
    { id: 'upload', label: 'Report Damage', icon: Upload },
    { id: 'video', label: 'Video Batch', icon: Film },
    { id: 'compare', label: 'Compare Time', icon: GitCompare },
    { id: 'history', label: 'History Logs', icon: Clock },
    { id: 'analytics', label: 'Analytics', icon: Cpu },
    { id: 'report', label: 'PDF Report', icon: FileDown },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-[#080b11]">
      {/* Premium Header */}
      <header className="border-b border-slate-900 bg-[#0c1017] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('/')}>
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center border border-brand-500 shadow-md">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-white tracking-wide leading-tight">ROADSENSE</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Civic Portal</p>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="hidden md:flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                    active ? 'bg-brand-950/50 border border-brand-800/60 text-brand-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-850 px-3 py-1.5 rounded-xl">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-white leading-none">{user.username}</span>
                  <span className="text-[9px] font-bold text-brand-400 uppercase tracking-widest mt-0.5">{user.role}</span>
                </div>
                <button
                  onClick={() => { logout(); setCurrentTab('dashboard'); }}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCurrentTab('login')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition border ${
                  currentTab === 'login'
                    ? 'bg-brand-950/50 border-brand-800/60 text-brand-400'
                    : 'bg-brand-600 border-brand-500 hover:bg-brand-500 text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Portal Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main page content container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#090c12] py-4 text-center text-[10px] text-slate-500 font-medium tracking-wider">
        © {new Date().getFullYear()} ROADSENSE CIVIC ROAD MONITORING SYSTEM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
};

const AppContentWrapper: React.FC = () => {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  };

  if (path === '/') {
    return <Landing onNavigate={navigateTo} />;
  }

  return <AppContent onNavigate={navigateTo} />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContentWrapper />
    </AuthProvider>
  );
};

export default App;
