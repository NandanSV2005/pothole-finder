import React, { useEffect, useState, useCallback } from 'react';
import api, { API_BASE_URL } from '../api';
import { type Detection } from '../types';
import { useAuth } from '../context/auth-context';
import { Trash2, Check, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

const HistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [detections, setDetections] = useState<Detection[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [damageClass, setDamageClass] = useState('');
  const [area, setArea] = useState('');
  const [minConfidence, setMinConfidence] = useState(0.4);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const limit = 10;

  const fetchDetections = useCallback(async () => {
    try {
      let url = `/api/detections?page=${page}&limit=${limit}&min_confidence=${minConfidence}`;
      if (damageClass) url += `&damage_class=${damageClass}`;
      if (area) url += `&area=${area}`;
      if (startDate) url += `&start_date=${startDate}T00:00:00`;
      if (endDate) url += `&end_date=${endDate}T23:59:59`;

      const response = await api.get(url);
      setDetections(response.data.items);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Failed to load detections history:', error);
    }
  }, [page, damageClass, area, minConfidence, startDate, endDate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchDetections();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchDetections]);

  const handleVerify = async (id: number) => {
    try {
      await api.post(`/api/detections/${id}/verify`);
      setDetections(prev => prev.map(d => d.id === id ? { ...d, is_verified: true } : d));
    } catch {
      alert('Verification failed. Verify admin privileges.');
    }
  };

  const handleFlag = async (id: number) => {
    if (!window.confirm('Flag this detection as incorrect? This helps refine the ML model.')) return;
    try {
      await api.post(`/api/detections/${id}/flag`);
      setDetections(prev => prev.map(d => d.id === id ? { ...d, is_incorrect: true } : d));
    } catch {
      alert('Failed to flag detection.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    try {
      await api.delete(`/api/detections/${id}`);
      fetchDetections();
    } catch {
      alert('Deletion failed. Verify admin privileges.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">Class</label>
          <select className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white" value={damageClass} onChange={(e) => { setDamageClass(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            <option value="pothole">Pothole</option>
            <option value="crack">Crack</option>
            <option value="waterlogging">Waterlogging</option>
            <option value="road_collapse">Road Collapse</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">Area Search</label>
          <input type="text" placeholder="e.g. Indiranagar" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white" value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">Min Conf ({(minConfidence * 100).toFixed(0)}%)</label>
          <input type="range" min="0.4" max="1.0" step="0.05" className="w-full h-2 rounded bg-slate-850 cursor-pointer" value={minConfidence} onChange={(e) => { setMinConfidence(parseFloat(e.target.value)); setPage(1); }} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">Start Date</label>
          <input type="date" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">End Date</label>
          <input type="date" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Table view */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                <th className="p-4">Image</th>
                <th className="p-4">Class</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Confidence</th>
                <th className="p-4">Area / Address</th>
                <th className="p-4">Date Reported</th>
                <th className="p-4">Verification</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {detections.map((det) => (
                <tr key={det.id} className={`hover:bg-slate-800/20 transition text-slate-300 ${det.is_incorrect ? 'opacity-40 line-through select-none' : ''}`}>
                  <td className="p-4">
                    <img src={`${API_BASE_URL}${det.image_path}`} alt="Anom" className="w-12 h-9 rounded object-cover border border-slate-800 shadow" />
                  </td>
                  <td className="p-4 capitalize font-semibold text-white">{det.damage_class.replace('_', ' ')}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      det.severity === 'critical' ? 'bg-red-950 text-red-400 border border-red-900/30' : 
                      det.severity === 'moderate' ? 'bg-orange-950 text-orange-400 border border-orange-900/30' : 
                      'bg-green-950 text-green-400 border border-green-900/30'
                    }`}>
                      {det.severity}
                    </span>
                  </td>
                  <td className="p-4 font-mono">{(det.confidence * 100).toFixed(0)}%</td>
                  <td className="p-4 max-w-[180px] truncate">{det.address || 'location unknown'}</td>
                  <td className="p-4">{new Date(det.timestamp).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      det.is_incorrect ? 'bg-red-950 text-red-400' :
                      det.is_verified ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                    }`}>
                      {det.is_incorrect ? 'Flagged FP' : det.is_verified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td className="p-4 text-center flex items-center justify-center gap-2 mt-2">
                    {!det.is_incorrect && (
                      <button 
                        onClick={() => handleFlag(det.id)} 
                        className="p-1 hover:bg-amber-900/40 border border-slate-800 rounded text-amber-500 transition"
                        title="Flag as False Positive / Incorrect"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {user?.role === 'admin' && (
                      <>
                        {!det.is_verified && !det.is_incorrect && (
                          <button onClick={() => handleVerify(det.id)} className="p-1 hover:bg-emerald-900/40 border border-slate-800 rounded text-emerald-400 transition" title="Verify Report"><Check className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => handleDelete(det.id)} className="p-1 hover:bg-red-900/40 border border-slate-800 rounded text-red-400 transition" title="Delete Report"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>Showing {detections.length} of {total} records</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="p-1.5 border border-slate-800 rounded bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 text-white"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={page * limit >= total} onClick={() => setPage(page + 1)} className="p-1.5 border border-slate-800 rounded bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 text-white"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
