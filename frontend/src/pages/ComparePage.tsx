import React, { useState, useRef } from 'react';
import { AxiosError } from 'axios';
import { Upload, GitCompare, Eye, AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import api from '../api';

interface ApiErrorResponse {
  detail?: {
    error?: string;
    suggestion?: string;
  };
}

interface CompareResult {
  success: boolean;
  ssim: number;
  status: string;
  detections_before: number;
  detections_after: number;
  comparison_image_base64: string;
}

const ComparePage: React.FC = () => {
  const [fileBefore, setFileBefore] = useState<File | null>(null);
  const [fileAfter, setFileAfter] = useState<File | null>(null);
  const [previewBefore, setPreviewBefore] = useState<string | null>(null);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<{ error: string; suggestion: string } | null>(null);

  const fileInputBeforeRef = useRef<HTMLInputElement>(null);
  const fileInputAfterRef = useRef<HTMLInputElement>(null);

  const selectBefore = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setFileBefore(file);
    setPreviewBefore(URL.createObjectURL(file));
    setResult(null);
    setErrorMsg(null);
  };

  const selectAfter = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setFileAfter(file);
    setPreviewAfter(URL.createObjectURL(file));
    setResult(null);
    setErrorMsg(null);
  };

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileBefore || !fileAfter) return;

    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    const formData = new FormData();
    formData.append('image_before', fileBefore);
    formData.append('image_after', fileAfter);

    try {
      const response = await api.post('/api/detections/compare', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        setResult(response.data);
      }
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const errDetail = axiosError.response?.data?.detail;
      setErrorMsg({
        error: errDetail?.error || 'Comparison failed.',
        suggestion: errDetail?.suggestion || 'Please make sure both files are valid JPEG/PNG formats.'
      });
    } finally {
      setLoading(false);
    }
  };

  const statusColors = (statusStr: string) => {
    const s = statusStr.toLowerCase();
    if (s.includes('repaired')) return 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40 shadow-emerald-950/20';
    if (s.includes('worsened')) return 'bg-red-950/40 text-red-400 border-red-900/40 shadow-red-950/20';
    return 'bg-amber-950/40 text-amber-400 border-amber-900/40 shadow-amber-950/20';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
          <GitCompare className="w-8 h-8 text-brand-500" /> Before/After Change Detection
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Assess road repairs and deterioration over time by comparing two images of the same location.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <form onSubmit={handleCompare} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Before Upload Zone */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">1. Before Image (Earlier timestamp)</label>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[180px] ${
                  previewBefore ? 'border-brand-900 bg-slate-950/30' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) selectBefore(e.dataTransfer.files[0]); }}
                onClick={() => fileInputBeforeRef.current?.click()}
              >
                <input ref={fileInputBeforeRef} type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) selectBefore(e.target.files[0]); }} />
                {previewBefore ? (
                  <div className="space-y-2">
                    <img src={previewBefore} alt="Before" className="max-h-[140px] rounded border border-slate-800 object-contain mx-auto" />
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-[200px]">{fileBefore?.name}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs font-semibold text-white">Upload Before Image</p>
                    <p className="text-[10px] text-slate-500">Drag & Drop image here</p>
                  </div>
                )}
              </div>
            </div>

            {/* After Upload Zone */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">2. After Image (Later timestamp)</label>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[180px] ${
                  previewAfter ? 'border-brand-900 bg-slate-950/30' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) selectAfter(e.dataTransfer.files[0]); }}
                onClick={() => fileInputAfterRef.current?.click()}
              >
                <input ref={fileInputAfterRef} type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) selectAfter(e.target.files[0]); }} />
                {previewAfter ? (
                  <div className="space-y-2">
                    <img src={previewAfter} alt="After" className="max-h-[140px] rounded border border-slate-800 object-contain mx-auto" />
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-[200px]">{fileAfter?.name}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs font-semibold text-white">Upload After Image</p>
                    <p className="text-[10px] text-slate-500">Drag & Drop image here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={!fileBefore || !fileAfter || loading}
              className="px-8 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-brand-950/20"
            >
              {loading ? "Comparing Images..." : "Analyze Quality Changes"}
            </button>
          </div>
        </form>

        {errorMsg && (
          <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-4 flex gap-3 text-red-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
            <div>
              <h4 className="font-bold text-sm">Comparison Error</h4>
              <p className="text-xs text-red-300 mt-0.5">{errorMsg.error}</p>
              <p className="text-xs text-slate-400 mt-1 font-mono font-medium">Tip: {errorMsg.suggestion}</p>
            </div>
          </div>
        )}

        {/* Comparison Result Display */}
        {result && (
          <div className="space-y-6 pt-4 border-t border-slate-800 animate-fadeIn">
            {/* Status card */}
            <div className={`border rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 ${statusColors(result.status)}`}>
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 animate-pulse shrink-0" />
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wider">Change Status</h3>
                  <p className="text-base font-extrabold mt-0.5">{result.status}</p>
                </div>
              </div>
              
              <div className="flex gap-4 border-t border-slate-800/20 md:border-t-0 md:border-l pl-0 md:pl-6 pt-3 md:pt-0 w-full md:w-auto items-center">
                <div className="text-center px-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">SSIM Index</span>
                  <span className="block font-mono text-lg font-bold text-white mt-0.5">{result.ssim.toFixed(4)}</span>
                </div>
                <div className="text-center px-4 border-l border-slate-800/20">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Detections</span>
                  <span className="block font-mono text-sm font-semibold text-slate-200 mt-0.5 flex items-center gap-1 justify-center">
                    {result.detections_before} <ArrowRight className="w-3.5 h-3.5 text-slate-500" /> {result.detections_after}
                  </span>
                </div>
              </div>
            </div>

            {/* Concatenated Image Render */}
            <div className="space-y-3">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <Eye className="w-4 h-4 text-emerald-400" /> Side-by-Side Verification Frame
              </h4>
              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-2 shadow-2xl">
                <img
                  src={result.comparison_image_base64}
                  alt="Side by side comparison result"
                  className="w-full h-auto object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparePage;
