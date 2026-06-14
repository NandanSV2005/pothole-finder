import React, { useState } from 'react';
import { AxiosError } from 'axios';
import { useAuth } from '../context/auth-context';
import { Shield, KeyRound, UserPlus, LogIn, AlertCircle } from 'lucide-react';

interface AuthErrorResponse {
  detail?: string;
}

const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'citizen'>('citizen');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password, role);
        setSuccess('Account created successfully! Please log in now.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<AuthErrorResponse>;
      setError(axiosError.response?.data?.detail || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto my-12 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
      <div className="p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-brand-950 border border-brand-800 text-brand-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-brand-950/50">
            {isLogin ? <KeyRound className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{isLogin ? 'Sign In to Portal' : 'Register Account'}</h2>
          <p className="text-xs text-slate-400">Manage reported damages and review statistics</p>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-3 flex gap-2.5 text-xs text-red-200">
            <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-3 flex gap-2.5 text-xs text-emerald-200">
            <Shield className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Username</label>
            <input
              type="text"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Password</label>
            <input
              type="password"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Account Role</label>
              <select
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'citizen')}
              >
                <option value="citizen">Citizen (Standard Access)</option>
                <option value="admin">Administrator (Delete/Verify Privileges)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-500 text-white rounded-lg py-2.5 font-semibold text-sm transition mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? <LogIn className="w-4.5 h-4.5" /> : <UserPlus className="w-4.5 h-4.5" />}
                {isLogin ? 'Sign In' : 'Create Account'}
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(null); setSuccess(null); }}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium transition"
          >
            {isLogin ? "Don't have an account? Register here" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
