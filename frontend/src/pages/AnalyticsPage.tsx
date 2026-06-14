import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { BarChart3, TrendingUp, RefreshCw, HelpCircle, ShieldAlert, Cpu } from 'lucide-react';

interface ClassConfidence {
  damage_class: string;
  avg_confidence: number;
}

interface PrecisionTrendPoint {
  date: string;
  precision: number;
}

interface AnalyticsData {
  average_confidence: ClassConfidence[];
  false_positive_rate: number;
  precision_trend: PrecisionTrendPoint[];
}

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await api.get('/api/stats/analytics');
      setData(response.data);
    } catch (error) {
      console.error('Failed to load analytics telemetry:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchAnalytics();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchAnalytics]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading) {
    return (
      <div className="flex h-[500px] justify-center items-center">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Precision percentage
  const currentPrecision = data ? (1.0 - data.false_positive_rate) * 100 : 92.5;
  const falsePositiveRate = data ? data.false_positive_rate * 100 : 7.5;

  // Render Line Chart SVG Points helper
  const getLineChartPoints = () => {
    if (!data || data.precision_trend.length === 0) return '';
    const trend = data.precision_trend;
    const maxVal = 100;
    const minVal = 50; // clamp min display to 50% for visibility of changes
    const w = 550;
    const h = 180;
    
    return trend.map((point, index) => {
      const x = (index / (trend.length - 1)) * (w - 60) + 40;
      const precisionPercent = point.precision * 100;
      const y = h - 20 - ((precisionPercent - minVal) / (maxVal - minVal)) * (h - 40);
      return `${x},${y}`;
    }).join(' ');
  };

  // Render Line Chart Area Fill points helper
  const getAreaFillPoints = (pointsString: string) => {
    if (!pointsString) return '';
    const w = 550;
    const h = 180;
    const lastX = (w - 60) + 40;
    return `40,${h - 20} ${pointsString} ${lastX},${h - 20}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-8 h-8 text-brand-500" /> Model Confidence & Feedback Loops
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Monitor model telemetry and human-in-the-loop correction data. Detections flagged on logs automatically calculate precision thresholds.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 border border-slate-800 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core Accuracy Card */}
        <div className="bg-gradient-to-br from-indigo-950/20 to-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Model Precision</span>
            <TrendingUp className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-4xl font-extrabold text-white">{currentPrecision.toFixed(1)}%</p>
          <p className="text-xs text-slate-400 leading-normal">
            Overall reliability score calculated from correct vs. flagged road incident reports.
          </p>
        </div>

        {/* False Positive Rate Card */}
        <div className="bg-gradient-to-br from-red-950/20 to-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">False Positive Rate</span>
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-4xl font-extrabold text-white">{falsePositiveRate.toFixed(1)}%</p>
          <p className="text-xs text-slate-400 leading-normal">
            Percentage of total detections flagged as incorrect by dashboard administrators.
          </p>
        </div>

        {/* Dynamic Telemetry Loop Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
            <HelpCircle className="w-4 h-4 text-brand-400" /> Human-in-the-Loop Loop
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            By flagging incorrect YOLO predictions on the **History Logs** page, citizen networks generate active validation datasets, tracking model bias and decay over time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Precision Trend Line Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-brand-400" /> Precision Trend Timeline (30 Days)
          </h3>

          <div className="relative w-full h-[220px] bg-slate-950/50 border border-slate-950 rounded-lg p-2 flex items-center justify-center">
            {data && data.precision_trend.length > 0 ? (
              <svg className="w-full h-full" viewBox="0 0 550 180">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                <line x1="40" y1="20" x2="530" y2="20" stroke="#1e293b" strokeDasharray="3" />
                <line x1="40" y1="60" x2="530" y2="60" stroke="#1e293b" strokeDasharray="3" />
                <line x1="40" y1="100" x2="530" y2="100" stroke="#1e293b" strokeDasharray="3" />
                <line x1="40" y1="140" x2="530" y2="140" stroke="#1e293b" strokeDasharray="3" />
                <line x1="40" y1="160" x2="530" y2="160" stroke="#334155" />

                {/* Y-Axis Labels */}
                <text x="12" y="24" fill="#64748b" fontSize="8.5" fontFamily="monospace">100%</text>
                <text x="12" y="64" fill="#64748b" fontSize="8.5" fontFamily="monospace">80%</text>
                <text x="12" y="104" fill="#64748b" fontSize="8.5" fontFamily="monospace">70%</text>
                <text x="12" y="144" fill="#64748b" fontSize="8.5" fontFamily="monospace">60%</text>

                {/* Line Path */}
                <polygon points={getAreaFillPoints(getLineChartPoints())} fill="url(#areaGradient)" />
                <polyline
                  fill="none"
                  stroke="url(#lineGradient)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={getLineChartPoints()}
                />

                {/* X-Axis Labels (First and last) */}
                <text x="40" y="176" fill="#64748b" fontSize="9" fontFamily="sans-serif">
                  {data.precision_trend[0]?.date}
                </text>
                <text x="490" y="176" fill="#64748b" fontSize="9" fontFamily="sans-serif">
                  {data.precision_trend[data.precision_trend.length - 1]?.date}
                </text>
              </svg>
            ) : (
              <span className="text-xs text-slate-500">No trend coordinates compiled.</span>
            )}
          </div>
        </div>

        {/* Confidence by Class Bar Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-brand-400" /> Avg Model Confidence by Damage type
          </h3>

          <div className="relative w-full h-[220px] bg-slate-950/50 border border-slate-950 rounded-lg p-4 flex flex-col justify-around">
            {data && data.average_confidence.map((cls) => {
              const percent = cls.avg_confidence * 100;
              const colorMap: Record<string, string> = {
                pothole: 'bg-red-500 shadow-red-950/20',
                crack: 'bg-orange-500 shadow-orange-950/20',
                waterlogging: 'bg-yellow-500 shadow-yellow-950/20',
                road_collapse: 'bg-purple-500 shadow-purple-950/20'
              };
              const bg = colorMap[cls.damage_class] || 'bg-brand-500';
              
              return (
                <div key={cls.damage_class} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="capitalize font-semibold text-slate-300">
                      {cls.damage_class.replace('_', ' ')}
                    </span>
                    <span className="font-mono font-bold text-white">{percent.toFixed(1)}%</span>
                  </div>
                  
                  <div className="w-full bg-slate-900 h-3.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${bg}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
