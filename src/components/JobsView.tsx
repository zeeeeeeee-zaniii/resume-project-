import React, { useState } from 'react';
import { Job, CandidateRecord, getNormalizedStage } from '../types';
import { 
  Briefcase, 
  Plus, 
  Search, 
  MapPin, 
  Calendar, 
  Users, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Building2,
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface JobsViewProps {
  jobs: Job[];
  candidates: CandidateRecord[];
  onCreateJob: (jobData: Omit<Job, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateJob: (jobId: string, updates: Partial<Job>) => Promise<void>;
  onDeleteJob: (jobId: string, deleteAssociatedCandidates: boolean) => Promise<void>;
  onStartAnalysisForJob: (job: Job) => void;
  onViewCandidateAnalysis: (analysisId: string) => void;
}

export const JobsView: React.FC<JobsViewProps> = ({
  jobs,
  candidates,
  onCreateJob,
  onUpdateJob,
  onDeleteJob,
  onStartAnalysisForJob,
  onViewCandidateAnalysis,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Closed'>('All');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Pagination / Load More state (50 records per page)
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [deletingJob, setDeletingJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Create/Edit
  const [formTitle, setFormTitle] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formResponsibilities, setFormResponsibilities] = useState('');
  const [formRequirements, setFormRequirements] = useState('');
  const [formEmploymentType, setFormEmploymentType] = useState<Job['employmentType']>('Full-time');
  const [formLocation, setFormLocation] = useState('');
  const [formWorkplaceType, setFormWorkplaceType] = useState<Job['workplaceType']>('Hybrid');
  const [formStatus, setFormStatus] = useState<'Open' | 'Closed'>('Open');
  const [formError, setFormError] = useState<string | null>(null);

  // Helper to open create modal
  const handleOpenCreateModal = () => {
    setFormTitle('');
    setFormDepartment('');
    setFormDescription('');
    setFormResponsibilities('');
    setFormRequirements('');
    setFormEmploymentType('Full-time');
    setFormLocation('');
    setFormWorkplaceType('Hybrid');
    setFormStatus('Open');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Helper to open edit modal
  const handleOpenEditModal = (job: Job) => {
    setEditingJob(job);
    setFormTitle(job.title);
    setFormDepartment(job.department);
    setFormDescription(job.description);
    setFormResponsibilities(job.responsibilities || '');
    setFormRequirements(job.requirements || '');
    setFormEmploymentType(job.employmentType || 'Full-time');
    setFormLocation(job.location || '');
    setFormWorkplaceType(job.workplaceType || 'Hybrid');
    setFormStatus(job.status);
    setFormError(null);
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Job Title is required.');
      return;
    }
    if (!formDepartment.trim()) {
      setFormError('Department / Team is required.');
      return;
    }
    if (!formDescription.trim()) {
      setFormError('Job Description is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingJob) {
        await onUpdateJob(editingJob.id, {
          title: formTitle.trim(),
          department: formDepartment.trim(),
          description: formDescription.trim(),
          responsibilities: formResponsibilities.trim(),
          requirements: formRequirements.trim(),
          employmentType: formEmploymentType,
          location: formLocation.trim(),
          workplaceType: formWorkplaceType,
          status: formStatus,
        });

        // Update selected job if viewing it
        if (selectedJob && selectedJob.id === editingJob.id) {
          setSelectedJob({
            ...selectedJob,
            title: formTitle.trim(),
            department: formDepartment.trim(),
            description: formDescription.trim(),
            responsibilities: formResponsibilities.trim(),
            requirements: formRequirements.trim(),
            employmentType: formEmploymentType,
            location: formLocation.trim(),
            workplaceType: formWorkplaceType,
            status: formStatus,
            updatedAt: new Date().toISOString(),
          });
        }
        setEditingJob(null);
      } else {
        await onCreateJob({
          title: formTitle.trim(),
          department: formDepartment.trim(),
          description: formDescription.trim(),
          responsibilities: formResponsibilities.trim(),
          requirements: formRequirements.trim(),
          employmentType: formEmploymentType,
          location: formLocation.trim(),
          workplaceType: formWorkplaceType,
          status: formStatus,
        });
        setIsCreateModalOpen(false);
      }
    } catch (err: any) {
      console.error('Save job error:', err);
      setFormError('Unable to save job requisition. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingJob) return;
    setIsSubmitting(true);
    try {
      await onDeleteJob(deletingJob.id, true);
      if (selectedJob && selectedJob.id === deletingJob.id) {
        setSelectedJob(null);
      }
      setDeletingJob(null);
    } catch (err) {
      console.error('Delete job error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.location && job.location.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate candidate count for a job
  const getJobCandidateCount = (jobId: string) => {
    return candidates.filter((c) => c.jobId === jobId).length;
  };

  const getJobCandidates = (jobId: string) => {
    return candidates.filter((c) => c.jobId === jobId);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Jobs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage position requisitions and screen candidates against specific role requirements.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs sm:text-sm rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Job</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by job title, department, or location..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-600 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          {(['All', 'Open', 'Closed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setVisibleCount(PAGE_SIZE);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === status
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs Grid or Empty State */}
      {filteredJobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <Briefcase className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-slate-900">
              {jobs.length === 0 ? 'No job requisitions created yet' : 'No matching jobs found'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              {jobs.length === 0
                ? 'Create your first job requisition to establish role criteria, responsibilities, and analyze candidate resumes.'
                : 'Try adjusting your search criteria or status filter.'}
            </p>
          </div>
          {jobs.length === 0 && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs rounded-md shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Job</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-800">{Math.min(visibleCount, filteredJobs.length)}</strong> of <strong className="text-slate-800">{filteredJobs.length}</strong> {filteredJobs.length === 1 ? 'job requisition' : 'job requisitions'}
            </span>
            {filteredJobs.length > visibleCount && (
              <span className="text-blue-600 font-medium">
                Page 1 of {Math.ceil(filteredJobs.length / PAGE_SIZE)} ({PAGE_SIZE} per page)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.slice(0, visibleCount).map((job) => {
              const candidateCount = getJobCandidateCount(job.id);
              return (
                <div
                  key={job.id}
                  className="bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 space-y-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
                          {job.department}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors pt-1">
                          {job.title}
                        </h3>
                      </div>

                      <span
                        className={`px-2 py-0.5 text-[11px] font-medium rounded-full shrink-0 border ${
                          job.status === 'Open'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{job.location}</span>
                        </span>
                      )}
                      {job.workplaceType && (
                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">
                          {job.workplaceType}
                        </span>
                      )}
                      {job.employmentType && (
                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">
                          {job.employmentType}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        {candidateCount} {candidateCount === 1 ? 'candidate' : 'candidates'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors"
                        title="View job details and screened candidates"
                      >
                        View Job
                      </button>

                      <button
                        onClick={() => onStartAnalysisForJob(job)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-2xs"
                        title="Analyze candidate resume for this job"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Analyze</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Pagination Button */}
          {filteredJobs.length > visibleCount && (
            <div className="pt-3 pb-2 flex flex-col items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-all cursor-pointer"
              >
                <span>Load More Jobs ({Math.min(PAGE_SIZE, filteredJobs.length - visibleCount)} remaining)</span>
              </button>
              <span className="text-[11px] text-slate-400">
                Displaying {visibleCount} of {filteredJobs.length} total requisitions
              </span>
            </div>
          )}
        </div>
      )}

      {/* Job Details Modal / Drawer */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 uppercase">
                    {selectedJob.department}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                      selectedJob.status === 'Open'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {selectedJob.status}
                  </span>
                  {selectedJob.workplaceType && (
                    <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {selectedJob.workplaceType}
                    </span>
                  )}
                  {selectedJob.employmentType && (
                    <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {selectedJob.employmentType}
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {selectedJob.title}
                </h2>
                {selectedJob.location && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedJob.location}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditModal(selectedJob)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                  title="Edit Job Requisition"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletingJob(selectedJob)}
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                  title="Delete Job"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded text-sm font-semibold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs sm:text-sm">
              {/* Primary Action Banner */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-blue-900">
                    Evaluate Candidates for this Job
                  </div>
                  <div className="text-xs text-blue-700">
                    Upload a candidate resume to evaluate evidence directly against this job's criteria.
                  </div>
                </div>
                <button
                  onClick={() => {
                    const targetJob = selectedJob;
                    setSelectedJob(null);
                    onStartAnalysisForJob(targetJob);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded-md shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze Candidate</span>
                </button>
              </div>

              {/* Job Description */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Job Description
                </h4>
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {selectedJob.description}
                </div>
              </div>

              {/* Responsibilities if provided */}
              {selectedJob.responsibilities && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Core Responsibilities
                  </h4>
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedJob.responsibilities}
                  </div>
                </div>
              )}

              {/* Requirements if provided */}
              {selectedJob.requirements && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Specific Qualifications & Requirements
                  </h4>
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedJob.requirements}
                  </div>
                </div>
              )}

              {/* Screened Candidates Section */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Screened Candidates ({getJobCandidateCount(selectedJob.id)})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Candidates screened against this job requisition.
                    </p>
                  </div>
                </div>

                {getJobCandidateCount(selectedJob.id) === 0 ? (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
                    No candidates have been screened for this position yet. Click "Analyze Candidate" above to upload a resume.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                    {getJobCandidates(selectedJob.id).map((cand) => (
                      <div
                        key={cand.id}
                        className="p-3.5 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 truncate">
                              {cand.name}
                            </span>
                            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {cand.alignmentLevel}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Stage: {getNormalizedStage(cand.status)}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            {cand.location ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span>{cand.location}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Location not detected</span>
                            )}
                            {cand.currentRole && (
                              <span>· {cand.currentRole}</span>
                            )}
                            <span>· Screened {cand.analyzedAt}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedJob(null);
                            onViewCandidateAnalysis(cand.analysisId);
                          }}
                          className="px-3 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors shrink-0"
                        >
                          View Analysis
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <div>
                Created {new Date(selectedJob.createdAt).toLocaleDateString()}
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Job Modal */}
      {(isCreateModalOpen || editingJob) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingJob ? 'Edit Job Requisition' : 'Create Job Requisition'}
                </h2>
                <p className="text-xs text-slate-500">
                  {editingJob
                    ? 'Update job details and requirements.'
                    : 'Establish a new role to analyze candidates against.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingJob(null);
                }}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveJob} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Frontend Engineer"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">
                    Department / Team <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Core Product Engineering"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Employment Type</label>
                  <select
                    value={formEmploymentType}
                    onChange={(e) => setFormEmploymentType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden text-xs sm:text-sm"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Workplace Type</label>
                  <select
                    value={formWorkplaceType}
                    onChange={(e) => setFormWorkplaceType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden text-xs sm:text-sm"
                  >
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                    <option value="On-site">On-site</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden text-xs sm:text-sm"
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Job Location (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. London, UK or San Francisco, CA"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  Job Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Paste or write the complete job description..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden leading-relaxed"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  Responsibilities (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Key responsibilities or deliverables..."
                  value={formResponsibilities}
                  onChange={(e) => setFormResponsibilities(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden leading-relaxed"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  Requirements & Qualifications (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Required technical skills, years of experience, credentials..."
                  value={formRequirements}
                  onChange={(e) => setFormRequirements(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden leading-relaxed"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingJob(null);
                  }}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-md shadow-2xs transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingJob ? 'Update Job' : 'Create Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-full bg-rose-50 border border-rose-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Delete this record?
              </h3>
            </div>

            <div className="text-xs sm:text-sm text-slate-600 space-y-2">
              <p>
                Are you sure you want to delete <strong className="text-slate-800">{deletingJob.title}</strong>?
              </p>
              <p className="text-slate-500">
                This action cannot be undone.
              </p>
              {getJobCandidateCount(deletingJob.id) > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                  <strong>Warning:</strong> This job has{' '}
                  <strong>{getJobCandidateCount(deletingJob.id)} associated candidate analyses</strong>.
                  Deleting this job will also permanently delete the associated recruitment data and analysis records.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingJob(null)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-2xs transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
