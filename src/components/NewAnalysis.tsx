import React, { useState, useRef, ChangeEvent, DragEvent, useEffect } from 'react';
import { 
  Upload, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Trash2,
  FileText,
  Briefcase,
  ChevronDown,
  Plus,
  CheckCircle2,
  MapPin,
  Building2,
  Info
} from 'lucide-react';
import { ResumeFile, AnalysisResult, Job } from '../types';
import { auth } from '../lib/firebase';

interface NewAnalysisProps {
  jobs: Job[];
  selectedJobId?: string;
  onSelectJob?: (job: Job) => void;
  onCreateJobClick?: () => void;
  onAnalysisCompleted: (
    result: AnalysisResult,
    resumeFile: ResumeFile | null,
    description: string,
    job: Job
  ) => void;
  onCancel: () => void;
  initialResumeFile?: ResumeFile | null;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

export const NewAnalysis: React.FC<NewAnalysisProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
  onCreateJobClick,
  onAnalysisCompleted,
  onCancel,
  initialResumeFile = null,
}) => {
  // Selected Job State
  const [activeJobId, setActiveJobId] = useState<string>(() => {
    if (selectedJobId) return selectedJobId;
    // Default to first open job if available
    const openJob = jobs.find((j) => j.status === 'Open');
    return openJob ? openJob.id : jobs[0]?.id || '';
  });

  const currentJob = jobs.find((j) => j.id === activeJobId) || null;

  // Sync if selectedJobId changes
  useEffect(() => {
    if (selectedJobId) {
      setActiveJobId(selectedJobId);
    }
  }, [selectedJobId]);

  // Resume File State
  const [resumeFile, setResumeFile] = useState<ResumeFile | null>(initialResumeFile);
  const [fileBase64, setFileBase64] = useState<string | null>(initialResumeFile?.base64 || null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing & Loading State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('Reading resume...');
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Convert File to base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  // Validate and read file
  const validateAndProcessFile = async (file: File) => {
    setFileError(null);
    setProcessingError(null);

    const fileNameLower = file.name.toLowerCase();
    const isPdf = fileNameLower.endsWith('.pdf');
    const isDocx = fileNameLower.endsWith('.docx');

    if (!isPdf && !isDocx) {
      setFileError('Please upload a PDF or DOCX resume.');
      return;
    }

    if (file.size === 0) {
      setFileError("We couldn't read this document. Please try another copy of the resume.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError('This file exceeds the 10 MB limit. Please select a smaller document.');
      return;
    }

    try {
      const base64 = await readFileAsBase64(file);
      const newResume: ResumeFile = {
        file,
        name: file.name,
        size: file.size,
        type: isPdf ? 'PDF' : 'DOCX',
        formattedSize: formatFileSize(file.size),
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        base64,
      };

      setResumeFile(newResume);
      setFileBase64(base64);
    } catch {
      setFileError('Unable to process this file. Please check file permissions or format.');
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      validateAndProcessFile(droppedFiles[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      validateAndProcessFile(selectedFiles[0]);
    }
  };

  const handleRemoveFile = () => {
    setResumeFile(null);
    setFileBase64(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTriggerReplace = () => {
    fileInputRef.current?.click();
  };

  // Readiness validation
  const hasValidJob = currentJob !== null;
  const hasValidResume = resumeFile !== null && fileBase64 !== null && !fileError;
  const canAnalyze = hasValidJob && hasValidResume && !isProcessing;

  // Real AI Analysis Execution
  const handleAnalyzeResume = async () => {
    if (!currentJob) {
      setProcessingError('Please select or create a job requisition first.');
      return;
    }

    if (!resumeFile || !fileBase64) {
      setFileError('Please upload a PDF or DOCX resume.');
      return;
    }

    setFileError(null);
    setProcessingError(null);
    setIsProcessing(true);

    // Staged professional status messaging
    setProcessingStage('Reading resume...');

    const timer1 = setTimeout(() => {
      setProcessingStage('Reviewing role requirements...');
    }, 1500);

    const timer2 = setTimeout(() => {
      setProcessingStage('Comparing resume evidence...');
    }, 3200);

    const timer3 = setTimeout(() => {
      setProcessingStage('Preparing analysis...');
    }, 5200);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setProcessingError('You must be signed in to submit resume analyses.');
        setIsProcessing(false);
        return;
      }

      // Obtain cryptographically signed Firebase ID token for request authentication
      let idToken = '';
      try {
        idToken = await currentUser.getIdToken();
      } catch (tokenErr) {
        console.error('Failed to obtain ID token:', tokenErr);
        setProcessingError('Unable to retrieve authentication credentials. Please sign in again.');
        setIsProcessing(false);
        return;
      }

      if (!idToken) {
        setProcessingError('Authentication token missing. Please sign in again.');
        setIsProcessing(false);
        return;
      }

      const response = await fetch('/api/analyze-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          fileBase64,
          fileName: resumeFile.name,
          fileType: resumeFile.type,
          jobId: currentJob.id,
          jobTitle: currentJob.title.trim(),
          department: currentJob.department.trim(),
          jobDescription: currentJob.description.trim(),
          responsibilities: currentJob.responsibilities || '',
          requirements: currentJob.requirements || '',
        }),
      });

      clearTimeout(timeoutId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = errorData.error;
        if (!errorMessage) {
          if (response.status === 401) {
            errorMessage = 'Authentication failed or session expired. Please sign in again.';
          } else if (response.status === 403) {
            errorMessage = 'Access denied: your account is not authorized for Mihora Resume Intelligence operations.';
          } else if (response.status === 413) {
            errorMessage = 'The resume file exceeds the maximum allowed upload size (25MB). Please upload a smaller document.';
          } else if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            errorMessage = retryAfter
              ? `High traffic or rate limit reached. Please wait ${retryAfter} seconds before retrying.`
              : 'The screening service is currently busy. Please wait a few moments and try again.';
          } else {
            errorMessage = 'Unable to complete resume analysis. Please try again.';
          }
        }
        setProcessingError(errorMessage);
        setIsProcessing(false);
        return;
      }

      const result: AnalysisResult = await response.json();
      result.jobId = currentJob.id;
      result.resumeBase64 = fileBase64;
      setIsProcessing(false);
      onAnalysisCompleted(result, resumeFile, currentJob.description, currentJob);
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (fetchErr?.name === 'AbortError') {
        setProcessingError('Analysis timed out while evaluating document evidence. Please try again.');
      } else {
        setProcessingError('Temporary processing failure. Please try again.');
      }
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Analyze Candidate Resume
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Evaluate candidate credentials against position specifications using evidence-based screening.
          </p>
        </div>

        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded transition-colors self-start sm:self-auto cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {/* Global Processing Error */}
      {processingError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs sm:text-sm text-red-800 flex-1">
            <span className="font-semibold">Analysis Interrupted</span>
            <p>{processingError}</p>
          </div>
          <button
            onClick={() => setProcessingError(null)}
            className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Two Column Layout: Left = Job Requisition Selector & Criteria, Right = Resume Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Job Selection & Pre-loaded Specifications */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-blue-700" />
                <span>Job Requisition</span>
              </label>

              {onCreateJobClick && (
                <button
                  type="button"
                  onClick={onCreateJobClick}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Job</span>
                </button>
              )}
            </div>

            {jobs.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-2">
                <p className="font-semibold">No jobs found in your recruitment workspace.</p>
                <p>Please create a job requisition first so the candidate can be evaluated against verified role requirements.</p>
                {onCreateJobClick && (
                  <button
                    onClick={onCreateJobClick}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded text-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Job Now</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <select
                    value={activeJobId}
                    onChange={(e) => {
                      setActiveJobId(e.target.value);
                      const j = jobs.find((x) => x.id === e.target.value);
                      if (j && onSelectJob) onSelectJob(j);
                    }}
                    className="w-full pl-3 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:bg-white focus:border-blue-600 focus:outline-hidden appearance-none cursor-pointer"
                  >
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} ({job.department}) {job.status === 'Closed' ? '[Closed]' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {currentJob && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">
                        {currentJob.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          currentJob.status === 'Open'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {currentJob.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-slate-500 text-[11px]">
                      <span className="font-medium text-slate-700">{currentJob.department}</span>
                      {currentJob.location && (
                        <span>· {currentJob.location}</span>
                      )}
                      {currentJob.employmentType && (
                        <span>· {currentJob.employmentType}</span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Job Description Preview
                      </span>
                      <p className="text-slate-600 line-clamp-4 leading-relaxed font-sans">
                        {currentJob.description}
                      </p>
                    </div>

                    {(currentJob.responsibilities || currentJob.requirements) && (
                      <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Includes custom responsibilities & qualification criteria</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Resume Upload & Execution */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Upload Candidate Resume
              </h3>
              <p className="text-xs text-slate-500">
                Upload a candidate document in PDF or DOCX format. Text and structure will be extracted directly.
              </p>
            </div>

            {/* Hidden native input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {!resumeFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="p-3 bg-white rounded-full border border-slate-200 shadow-2xs text-blue-600">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm font-semibold text-slate-800">
                    <span className="text-blue-700 hover:underline">Click to upload</span> or drag and drop
                  </div>
                  <div className="text-xs text-slate-500">
                    PDF or DOCX documents up to 10 MB
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-blue-100/70 text-blue-700 rounded-lg shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {resumeFile.name}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span className="font-semibold text-blue-700 bg-blue-50 px-1 rounded border border-blue-200/50">
                        {resumeFile.type}
                      </span>
                      <span>{resumeFile.formattedSize}</span>
                      <span>·</span>
                      <span>Ready for analysis</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleTriggerReplace}
                    disabled={isProcessing}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded transition-colors"
                    title="Replace file"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={isProcessing}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {fileError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Analysis Action Box */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Evidence-based matching strictly against selected job requirements</span>
              </div>

              <button
                type="button"
                onClick={handleAnalyzeResume}
                disabled={!canAnalyze}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-2xs transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{processingStage}</span>
                  </>
                ) : (
                  <span>Analyze Resume</span>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
