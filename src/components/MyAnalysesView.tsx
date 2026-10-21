import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Sparkles, 
  Search, 
  Trash2, 
  Calendar, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  Briefcase, 
  Clock, 
  AlertCircle,
  Plus
} from 'lucide-react';
import { AnalysisResult } from '../types';

interface MyAnalysesViewProps {
  analyses: AnalysisResult[];
  onSelectAnalysis: (analysis: AnalysisResult) => void;
  onStartNewAnalysis: () => void;
  onDeleteAnalysis?: (analysisId: string) => Promise<void>;
  isLoading?: boolean;
}

export const MyAnalysesView: React.FC<MyAnalysesViewProps> = ({
  analyses,
  onSelectAnalysis,
  onStartNewAnalysis,
  onDeleteAnalysis,
  isLoading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [analysisToDelete, setAnalysisToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter analyses
  const filteredAnalyses = useMemo(() => {
    if (!searchQuery.trim()) return analyses;
    const q = searchQuery.toLowerCase().trim();
    return analyses.filter((a) => {
      const fileName = (a.fileName || '').toLowerCase();
      const jobTitle = (a.roleSummary?.jobTitle || '').toLowerCase();
      const detectedName = (a.candidateOverview?.detectedName || '').toLowerCase();
      const alignment = (a.overallRoleAlignment?.level || '').toLowerCase();
      return (
        fileName.includes(q) ||
        jobTitle.includes(q) ||
        detectedName.includes(q) ||
        alignment.includes(q)
      );
    });
  }, [analyses, searchQuery]);

  const strongMatchesCount = useMemo(() => {
    return analyses.filter(
      (a) => a.overallRoleAlignment?.level === 'Strong alignment'
    ).length;
  }, [analyses]);

  const confirmDelete = async () => {
    if (!analysisToDelete || !onDeleteAnalysis) return;
    setIsDeleting(true);
    try {
      await onDeleteAnalysis(analysisToDelete);
      setAnalysisToDelete(null);
    } catch (err) {
      console.error('Failed to delete analysis:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const getAlignmentBadge = (level: string) => {
    switch (level) {
      case 'Strong alignment':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Good alignment':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Moderate alignment':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Limited evidence':
      case 'Insufficient evidence':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 sm:p-6 shadow-2xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Personal Resume Intelligence</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              My Saved Analyses
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              Review, compare, and export your personal resume screening reports.
            </p>
          </div>

          <button
            onClick={onStartNewAnalysis}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Analyze Resume</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5 pt-5 border-t border-slate-100">
          <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200/70">
            <div className="text-xs text-slate-500 font-medium">Total Evaluations</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{analyses.length}</div>
            <div className="text-[11px] text-slate-400">Securely stored under your personal account</div>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200/70">
            <div className="text-xs text-slate-500 font-medium">Strong Alignment Matches</div>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">{strongMatchesCount}</div>
            <div className="text-[11px] text-slate-400">High qualification match rate</div>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200/70">
            <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
              <span>Privacy & Isolation</span>
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-sm font-semibold text-slate-800 mt-1">Strictly Private</div>
            <div className="text-[11px] text-slate-400">Inaccessible to recruiters or external users</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {analyses.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by role, file name, or qualification..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            />
          </div>
          <span className="text-xs text-slate-500 self-center">
            Showing {filteredAnalyses.length} of {analyses.length} evaluation{analyses.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* Analysis Cards List */}
      {isLoading ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl space-y-3">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Loading your personal evaluations...</p>
        </div>
      ) : filteredAnalyses.length === 0 ? (
        <div className="p-10 sm:p-14 text-center bg-white border border-slate-200 rounded-xl space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              {analyses.length === 0 ? 'No evaluations yet' : 'No matching evaluations'}
            </h3>
            <p className="text-xs text-slate-500">
              {analyses.length === 0
                ? 'Upload your resume (PDF or DOCX) to get an evidence-based breakdown of your qualifications, role alignment, and areas for interview preparation.'
                : 'Try adjusting your search terms to find specific evaluations.'}
            </p>
          </div>
          {analyses.length === 0 ? (
            <button
              onClick={onStartNewAnalysis}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start Your First Analysis</span>
            </button>
          ) : (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-blue-700 hover:text-blue-900 font-semibold cursor-pointer"
            >
              Clear Search Query
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAnalyses.map((analysis) => {
            const alignmentLevel = analysis.overallRoleAlignment?.level || 'Moderate alignment';
            const strengthsCount = analysis.strengths?.length || 0;
            const gapsCount = analysis.potentialGaps?.length || 0;
            const detectedName = analysis.candidateOverview?.detectedName || null;

            return (
              <div
                key={analysis.id}
                className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  {/* Top line: file name & alignment */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded bg-blue-50 text-blue-700 shrink-0">
                          <FileText className="w-4 h-4" />
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {analysis.roleSummary?.jobTitle || 'Resume Evaluation'}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1.5 pl-6">
                        <span>{analysis.fileName}</span>
                        {detectedName && (
                          <>
                            <span>•</span>
                            <span className="text-slate-700 font-medium">{detectedName}</span>
                          </>
                        )}
                      </p>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${getAlignmentBadge(
                        alignmentLevel
                      )}`}
                    >
                      {alignmentLevel}
                    </span>
                  </div>

                  {/* Summary Snippet */}
                  {analysis.overallRoleAlignment?.summary && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/70 p-2.5 rounded border border-slate-100">
                      {analysis.overallRoleAlignment.summary}
                    </p>
                  )}

                  {/* Badges / Metrics */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{analysis.analyzedAt}</span>
                    </span>

                    {strengthsCount > 0 && (
                      <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded font-medium">
                        {strengthsCount} strength{strengthsCount === 1 ? '' : 's'}
                      </span>
                    )}

                    {gapsCount > 0 && (
                      <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded font-medium">
                        {gapsCount} area{gapsCount === 1 ? '' : 's'} to clarify
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  {onDeleteAnalysis && (
                    <button
                      onClick={() => setAnalysisToDelete(analysis.id)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded transition-colors text-xs inline-flex items-center gap-1 cursor-pointer"
                      title="Delete evaluation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  )}

                  <button
                    onClick={() => onSelectAnalysis(analysis)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 group-hover:translate-x-0.5 transition-all ml-auto cursor-pointer"
                  >
                    <span>View Analysis Report</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {analysisToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-rose-50 text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">Delete Analysis Report?</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  This will permanently delete this resume evaluation from your personal history. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setAnalysisToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
