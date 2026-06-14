import React, { useEffect, useState } from 'react';
import api from '../api';
import { type Stats, type Detection } from '../types';
import MapDashboard from '../components/MapDashboard';
import { MapPin, TrendingUp, AlertTriangle } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, detectionsRes] = await Promise.all([
          api.get('/api/stats'),
          api.get('/api/detections?limit=100'),
        ]);
        setStats(statsRes.data);
        setDetections(detectionsRes.data.items);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[500px] justify-center items-center">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  const classColors: Record<string, string> = {
    pothole: 'bg-red-500',
    crack: 'bg-orange-500',
    waterlogging: 'bg-yellow-500',
    road_collapse: 'bg-purple-500',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar statistics (Left) */}
      <div className="lg:col-span-1 space-y-6">
        {/* Total Today card */}
        <div className="bg-gradient-to-br from-brand-900/50 to-slate-900 border border-brand-800/40 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-2 right-2 opacity-10"><TrendingUp className="w-20 h-20 text-brand-400" /></div>
          <p className="text-slate-400 text-xs font-semibold tracking-wider uppercase">Detections Today</p>
          <p className="text-4xl font-extrabold text-white mt-1.5">{stats?.total_detections_today || 0}</p>
          <div className="flex items-center gap-2 mt-4 text-xs text-brand-300">
            <span className="bg-brand-950 px-2 py-0.5 rounded font-mono font-bold">Total: {stats?.total_detections_all_time || 0}</span>
            <span>lifetime entries</span>
          </div>
        </div>

        {/* Damage type list */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Damage Breakdown</h3>
          <div className="space-y-2.5">
            {stats?.by_type.map((t) => (
              <div key={t.damage_class} className="flex justify-between items-center text-xs">
                <span className="capitalize font-semibold text-slate-300 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${classColors[t.damage_class] || 'bg-emerald-500'}`} />
                  {t.damage_class.replace('_', ' ')}
                </span>
                <span className="font-bold text-slate-100 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{t.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hotspots Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-400" /> Hotspot Areas</h3>
          <div className="space-y-2.5">
            {stats?.hotspots && stats.hotspots.length > 0 ? (
              stats.hotspots.map((h, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="truncate max-w-[130px] font-medium text-slate-300">{h.area}</span>
                  <span className="font-bold text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/30">{h.count} cases</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No hotspot coordinates logged.</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Interactive Map (Right) */}
      <div className="lg:col-span-3 h-[600px] flex flex-col">
        <MapDashboard detections={detections} />
      </div>
    </div>
  );
};

export default DashboardPage;
