import React, { useState } from 'react';
import { FileText, Download, Calendar, ArrowRight, Mail } from 'lucide-react';
import { API_BASE_URL } from '../api';

const ReportPage: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleDownload = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Construct query parameters
    let url = `${API_BASE_URL}/api/report`;
    const params: string[] = [];
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    
    // Trigger file download in new tab
    window.open(url, '_blank');
  };

  const handleMailto = (e: React.MouseEvent) => {
    e.preventDefault();
    const recipient = "municipal-reports@bbmp.gov.in";
    const subject = `Road Damage Civic Assessment Report - Bengaluru (${startDate || 'Start'} to ${endDate || 'Present'})`;
    const body = `Dear BBMP Municipal Commissioner,\n\nPlease find attached the compiled Road Quality and Damage Assessment Report for Bengaluru, generated via the RoadSense civic platform on ${new Date().toLocaleDateString()}.\n\nScope of assessment: ${startDate || 'Earliest Logs'} to ${endDate || 'Present'}\n\nPlease address these reported potholes, collapses, and waterlogged segments as a matter of priority.\n\nSincerely,\nRoadSense Citizen Network`;
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Compile Damage Reports</h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Generate structured, printable PDF summaries of reported road anomalies, complete with maps and tabular lists.
        </p>
      </div>

      {/* Main card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl space-y-6">
        <div className="flex gap-4 items-start border-b border-slate-850 pb-6">
          <div className="w-12 h-12 bg-blue-950 text-blue-400 rounded-xl flex items-center justify-center border border-blue-900/40 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Civic Assessment PDF Report</h3>
            <p className="text-xs text-slate-400 mt-1 leading-normal">
              Reports compile an Executive Summary statistics panel, a custom vector coordinates plot of Bangalore, and a detailed incident log table.
            </p>
          </div>
        </div>

        <form onSubmit={handleDownload} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Start Date (Optional)
              </label>
              <input
                type="date"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> End Date (Optional)
              </label>
              <input
                type="date"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-850 text-xs text-slate-400 space-y-2">
            <h4 className="font-semibold text-slate-300 flex items-center gap-1">Tip for Municipal Submission</h4>
            <p className="leading-relaxed">
              If no start and end dates are specified, the generator compile all database entries logged to date.
            </p>
            <p className="leading-relaxed flex items-center gap-1 text-slate-500">
              Output formats: <span className="text-slate-400 font-medium">Standard Letter size PDF</span>
              <ArrowRight className="w-3 h-3" />
              <span className="text-slate-400 font-medium">Ready for Print</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              className="flex-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg py-3 font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-brand-950/20"
            >
              <Download className="w-4.5 h-4.5" />
              Download Compiled PDF
            </button>
            <button
              type="button"
              onClick={handleMailto}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg py-3 font-semibold text-sm transition flex items-center justify-center gap-2 border border-slate-700 shadow-md"
            >
              <Mail className="w-4.5 h-4.5 text-brand-400" />
              Email BBMP Office
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportPage;
