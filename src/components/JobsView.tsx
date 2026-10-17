import React, { useState, useMemo } from 'react';
import { Job, CandidateRecord, JobStatus, getNormalizedStage } from '../types';
import { 
  Briefcase, 
  Plus, 
  Search, 
  MapPin, 
  Calendar, 
  Users, 
  Edit3, 
  Trash2, 
  AlertTriangle,
  Building2,
  FileText,
  Clock,
  ArrowRight,
  Sparkles,
  UserCheck,
  User,
  Filter,
  Target,
  Award,
  CheckCircle2,
  XCircle,
  ExternalLink
} from 'lucide-react';

interface JobsViewProps {
  jobs: Job[];
  candidates: CandidateRecord[];
  onCreateJob: (jobData: Omit<Job, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateJob: (jobId: string, updates: Partial<Job>) => Promise<void>;
  onDeleteJob: (jobId: string, deleteAssociatedCandidates: boolean) => Promise<void>;
  onStartAnalysisForJob: (job: Job) => void;
  onViewCandidateAnalysis: (analysisId: string) => void;
  onViewJobCandidates?: (jobId: string) => void;
}

interface JobHiringMetrics {
  total: number;
  shortlisted: number;
  interviews: number;
  hired: number;
  targetOpenings: number;
  fillPercentage: number;
  isFilled: boolean;
}

export const JobsView: React.FC<JobsViewProps> = ({
  jobs,
  candidates,
  onCreateJob,
  onUpdateJob,
  onDeleteJob,
  onStartAnalysisForJob,
  onViewCandidateAnalysis,
  onViewJobCandidates,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | JobStatus>('All');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
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
  const [formStatus, setFormStatus] = useState<JobStatus>('Open');
  const [formHiringManager, setFormHiringManager] = useState('');
  const [formRecruiter, setFormRecruiter] = useState('');
  const [formOpeningsCount, setFormOpeningsCount] = useState<number>(1);
  const [formOpeningDate, setFormOpeningDate] = useState<string>('');
  const [formTargetCloseDate, setFormTargetCloseDate] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Extract unique departments for filtering
  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.department?.trim()) {
        set.add(j.department.trim());
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [jobs]);

  // Status counts for filter pills
  const statusCounts = useMemo(() => {
    return {
      All: jobs.length,
      Open: jobs.filter((j) => j.status === 'Open').length,
      'On Hold': jobs.filter((j) => j.status === 'On Hold').length,
      Draft: jobs.filter((j) => j.status === 'Draft').length,
      Closed: jobs.filter((j) => j.status === 'Closed').length,
    };
  }, [jobs]);

  // Status badge styling helper
  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'Open':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          label: 'Open Requisition',
        };
      case 'On Hold':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          label: 'On Hold',
        };
      case 'Draft':
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          dot: 'bg-slate-400',
          label: 'Draft Requisition',
        };
      case 'Closed':
        return {
          bg: 'bg-slate-100 text-slate-500 border-slate-200',
          dot: 'bg-slate-400',
          label: 'Closed Requisition',
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          label: status,
        };
    }
  };

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
    setFormHiringManager('');
    setFormRecruiter('');
    setFormOpeningsCount(1);
    setFormOpeningDate(new Date().toISOString().split('T')[0]);
    setFormTargetCloseDate('');
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
    setFormStatus(job.status || 'Open');
    setFormHiringManager(job.hiringManager || '');
    setFormRecruiter(job.recruiter || '');
    setFormOpeningsCount(typeof job.openingsCount === 'number' && job.openingsCount > 0 ? job.openingsCount : 1);
    setFormOpeningDate(
      job.openingDate ||
      (job.createdAt ? job.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])
    );
    setFormTargetCloseDate(job.targetCloseDate || '');
    setFormError(null);
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();

    // Field validation
    if (!formTitle.trim()) {
      setFormError('Job Title is required.');
      return;
    }
    if (formTitle.trim().length > 200) {
      setFormError('Job Title must be 200 characters or fewer.');
      return;
    }
    if (!formDepartment.trim()) {
      setFormError('Department / Team is required.');
      return;
    }
    if (formDepartment.trim().length > 100) {
      setFormError('Department must be 100 characters or fewer.');
      return;
    }
    if (!formDescription.trim()) {
      setFormError('Job Description is required.');
      return;
    }

    // Number of openings validation
    const openingsNum = Math.floor(Number(formOpeningsCount));
    if (isNaN(openingsNum) || openingsNum < 1) {
      setFormError('Number of openings must be at least 1.');
      return;
    }

    // Date validation
    if (formOpeningDate) {
      const openDateParsed = new Date(formOpeningDate);
      if (isNaN(openDateParsed.getTime())) {
        setFormError('Please enter a valid Opening Date.');
        return;
      }
    }

    if (formTargetCloseDate) {
      const closeDateParsed = new Date(formTargetCloseDate);
      if (isNaN(closeDateParsed.getTime())) {
        setFormError('Please enter a valid Target Close Date.');
        return;
      }
      if (formOpeningDate) {
        const openTime = new Date(formOpeningDate).getTime();
        const closeTime = closeDateParsed.getTime();
        if (closeTime < openTime) {
          setFormError('Target close date cannot be earlier than opening date.');
          return;
        }
      }
    }

    setIsSubmitting(true);
    setFormError(null);

    const jobPayload = {
      title: formTitle.trim(),
      department: formDepartment.trim(),
      description: formDescription.trim(),
      responsibilities: formResponsibilities.trim(),
      requirements: formRequirements.trim(),
      employmentType: formEmploymentType,
      location: formLocation.trim(),
      workplaceType: formWorkplaceType,
      status: formStatus,
      hiringManager: formHiringManager.trim() || undefined,
      recruiter: formRecruiter.trim() || undefined,
      openingsCount: openingsNum,
      openingDate: formOpeningDate || new Date().toISOString().split('T')[0],
      targetCloseDate: formTargetCloseDate || undefined,
    };

    try {
      if (editingJob) {
        await onUpdateJob(editingJob.id, jobPayload);

        // Update selected job if viewing it
        if (selectedJob && selectedJob.id === editingJob.id) {
          setSelectedJob({
            ...selectedJob,
            ...jobPayload,
            updatedAt: new Date().toISOString(),
          });
        }
        setEditingJob(null);
      } else {
        await onCreateJob(jobPayload);
        setIsCreateModalOpen(false);
      }
    } catch (err: any) {
      console.error('Save job error:', err);
      setFormError('Unable to save job requisition. Please verify your connection.');
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

  // Filter jobs based on search term, status filter, and department filter
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        job.title.toLowerCase().includes(term) ||
        job.department.toLowerCase().includes(term) ||
        (job.location && job.location.toLowerCase().includes(term)) ||
        (job.hiringManager && job.hiringManager.toLowerCase().includes(term)) ||
        (job.recruiter && job.recruiter.toLowerCase().includes(term));

      const matchesStatus = statusFilter === 'All' || job.status === statusFilter;
      const matchesDepartment = departmentFilter === 'All' || job.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [jobs, searchTerm, statusFilter, departmentFilter]);

  // Compute hiring metrics for any requisition based strictly on stored candidate data
  const getJobHiringMetrics = (job: Job): JobHiringMetrics => {
    const jobCandidates = candidates.filter((c) => c.jobId === job.id);
    const total = jobCandidates.length;
    const shortlisted = jobCandidates.filter((c) => getNormalizedStage(c.status) === 'Shortlisted').length;
    const interviews = jobCandidates.filter(
      (c) => getNormalizedStage(c.status) === 'Interview' || (c.interviews && c.interviews.length > 0)
    ).length;
    const hired = jobCandidates.filter((c) => getNormalizedStage(c.status) === 'Hired').length;
    const targetOpenings = typeof job.openingsCount === 'number' && job.openingsCount > 0 ? job.openingsCount : 1;
    const fillPercentage = Math.min(100, Math.round((hired / targetOpenings) * 100));
    const isFilled = hired >= targetOpenings;

    return { total, shortlisted, interviews, hired, targetOpenings, fillPercentage, isFilled };
  };

  const getJobCandidates = (jobId: string) => {
    return candidates.filter((c) => c.jobId === jobId);
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 pb-16">
      {/* View Header with Key Statistics */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 sm:p-7 shadow-2xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-500" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wider">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Phase 5 · Requisition Management</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Job Requisitions & Hiring Funnels
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
              Create, configure, and track open headcount positions. Monitor candidate progression from screening to hire against target openings.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Requisition</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-100">
          <div
            onClick={() => setStatusFilter('Open')}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              statusFilter === 'Open'
                ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-300'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70'
            }`}
          >
            <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
              Open Positions
            </div>
            <div className="text-2xl font-extrabold text-emerald-900 mt-1 font-mono">
              {statusCounts.Open}
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Actively hiring</div>
          </div>

          <div
            onClick={() => setStatusFilter('On Hold')}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              statusFilter === 'On Hold'
                ? 'bg-amber-50/90 border-amber-300 ring-1 ring-amber-300'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70'
            }`}
          >
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
              On Hold
            </div>
            <div className="text-2xl font-extrabold text-amber-900 mt-1 font-mono">
              {statusCounts['On Hold']}
            </div>
            <div className="text-[11px] text-amber-600 mt-0.5">Temporarily paused</div>
          </div>

          <div
            onClick={() => setStatusFilter('Draft')}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              statusFilter === 'Draft'
                ? 'bg-slate-200/80 border-slate-300 ring-1 ring-slate-400'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
              Drafts
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
              {statusCounts.Draft}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Under preparation</div>
          </div>

          <div
            onClick={() => setStatusFilter('Closed')}
            className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
              statusFilter === 'Closed'
                ? 'bg-slate-200/80 border-slate-300 ring-1 ring-slate-400'
                : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70'
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              Closed
            </div>
            <div className="text-2xl font-extrabold text-slate-800 mt-1 font-mono">
              {statusCounts.Closed}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Filled or archived</div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Status:</span>
            </span>

            {(['All', 'Open', 'On Hold', 'Draft', 'Closed'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setStatusFilter(status);
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  statusFilter === status
                    ? 'bg-blue-100 text-blue-900 border border-blue-200 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <span>{status}</span>
                <span className="ml-1 text-[11px] opacity-75 font-mono">({statusCounts[status]})</span>
              </button>
            ))}
          </div>

          {/* Department Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Department:</span>
            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-md bg-white text-slate-700 focus:outline-hidden focus:border-blue-600 shadow-2xs"
            >
              <option value="All">All Departments ({jobs.length})</option>
              {uniqueDepartments.filter((d) => d !== 'All').map((dept) => {
                const count = jobs.filter((j) => j.department === dept).length;
                return (
                  <option key={dept} value={dept}>
                    {dept} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by role title, department, location, hiring manager, or recruiter..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-600 focus:bg-white transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Jobs Grid or Empty State */}
      {filteredJobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto border border-blue-100">
            <Briefcase className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              {jobs.length === 0 ? 'No job requisitions created yet' : 'No matching requisitions found'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              {jobs.length === 0
                ? 'Create your first job requisition to establish role requirements, track target openings, and evaluate candidates.'
                : 'Try adjusting your search criteria, department selection, or status filter above.'}
            </p>
          </div>
          {jobs.length === 0 ? (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs sm:text-sm rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Requisition</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
                setDepartmentFilter('All');
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-800">{Math.min(visibleCount, filteredJobs.length)}</strong> of <strong className="text-slate-800">{filteredJobs.length}</strong> {filteredJobs.length === 1 ? 'requisition' : 'requisitions'}
            </span>
            {filteredJobs.length > visibleCount && (
              <span className="text-blue-600 font-medium">
                Page 1 of {Math.ceil(filteredJobs.length / PAGE_SIZE)} ({PAGE_SIZE} per page)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.slice(0, visibleCount).map((job) => {
              const metrics = getJobHiringMetrics(job);
              const badge = getStatusBadge(job.status);

              return (
                <div
                  key={job.id}
                  className="bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 space-y-3.5">
                    {/* Header Row: Department Tag & Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wider truncate inline-block max-w-[200px]">
                          {job.department}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors pt-1 truncate">
                          {job.title}
                        </h3>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full shrink-0 border ${badge.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        <span>{job.status}</span>
                      </span>
                    </div>

                    {/* Metadata chips: Location, Workplace, Employment */}
                    <div className="flex flex-wrap items-center gap-y-1.5 gap-x-2 text-[11px] text-slate-500">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[150px]">{job.location}</span>
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

                    {/* Hiring Team & Dates Info */}
                    <div className="space-y-1 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Opened: {formatDateDisplay(job.openingDate || job.createdAt)}</span>
                        </span>
                        {job.hiringManager && (
                          <span className="flex items-center gap-1 text-slate-700 font-medium truncate max-w-[140px]" title={`Hiring Manager: ${job.hiringManager}`}>
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{job.hiringManager}</span>
                          </span>
                        )}
                      </div>
                      {job.recruiter && (
                        <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                          <UserCheck className="w-3 h-3 text-slate-400" />
                          <span>Recruiter: <strong className="text-slate-700 font-medium">{job.recruiter}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Description snippet */}
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>

                    {/* Hiring Progress Card (Requirement 3) */}
                    <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200/70 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1 text-slate-700 font-semibold">
                          <Target className="w-3.5 h-3.5 text-blue-600" />
                          <span>
                            Target: {metrics.targetOpenings} {metrics.targetOpenings === 1 ? 'opening' : 'openings'}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-slate-700">
                          {metrics.hired} / {metrics.targetOpenings} hired ({metrics.fillPercentage}%)
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            metrics.isFilled ? 'bg-emerald-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${metrics.fillPercentage}%` }}
                        />
                      </div>

                      {/* 4 Mini Stage Metric Pills */}
                      <div className="grid grid-cols-4 gap-1 pt-1 text-center">
                        <div className="bg-white p-1 rounded border border-slate-200">
                          <div className="text-[9px] text-slate-400 font-semibold uppercase">Screened</div>
                          <div className="text-xs font-bold text-slate-800 font-mono">{metrics.total}</div>
                        </div>
                        <div className="bg-white p-1 rounded border border-slate-200">
                          <div className="text-[9px] text-amber-600 font-semibold uppercase">Shortlist</div>
                          <div className="text-xs font-bold text-amber-700 font-mono">{metrics.shortlisted}</div>
                        </div>
                        <div className="bg-white p-1 rounded border border-slate-200">
                          <div className="text-[9px] text-purple-600 font-semibold uppercase">Interview</div>
                          <div className="text-xs font-bold text-purple-700 font-mono">{metrics.interviews}</div>
                        </div>
                        <div className="bg-white p-1 rounded border border-slate-200">
                          <div className="text-[9px] text-emerald-600 font-semibold uppercase">Hired</div>
                          <div className="text-xs font-bold text-emerald-700 font-mono">{metrics.hired}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                    {onViewJobCandidates ? (
                      <button
                        onClick={() => onViewJobCandidates(job.id)}
                        className="inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-semibold hover:underline cursor-pointer"
                        title="View and manage candidates for this job in pipeline"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Candidates ({metrics.total})</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>{metrics.total} {metrics.total === 1 ? 'candidate' : 'candidates'}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                        title="View complete requisition details"
                      >
                        Details
                      </button>

                      <button
                        onClick={() => onStartAnalysisForJob(job)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-2xs cursor-pointer"
                        title="Screen candidate resume against this role"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Screen</span>
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
                <span>Load More Requisitions ({Math.min(PAGE_SIZE, filteredJobs.length - visibleCount)} remaining)</span>
              </button>
              <span className="text-[11px] text-slate-400">
                Displaying {visibleCount} of {filteredJobs.length} total requisitions
              </span>
            </div>
          )}
        </div>
      )}

      {/* Requisition Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 uppercase">
                    {selectedJob.department}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                      getStatusBadge(selectedJob.status).bg
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusBadge(selectedJob.status).dot}`} />
                    <span>{selectedJob.status}</span>
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
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                  {selectedJob.title}
                </h2>
                {selectedJob.location && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedJob.location}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleOpenEditModal(selectedJob)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                  title="Edit Requisition"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletingJob(selectedJob)}
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                  title="Delete Requisition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded text-sm font-semibold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs sm:text-sm">
              {/* Requisition Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Hiring Target</div>
                  <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                    {selectedJob.openingsCount || 1} {selectedJob.openingsCount === 1 ? 'opening' : 'openings'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Date Opened</div>
                  <div className="text-xs font-semibold text-slate-800 mt-1">
                    {formatDateDisplay(selectedJob.openingDate || selectedJob.createdAt)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Hiring Manager</div>
                  <div className="text-xs font-semibold text-slate-800 mt-1 truncate">
                    {selectedJob.hiringManager || <span className="text-slate-400 italic font-normal">Unassigned</span>}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Recruiter Lead</div>
                  <div className="text-xs font-semibold text-slate-800 mt-1 truncate">
                    {selectedJob.recruiter || <span className="text-slate-400 italic font-normal">Unassigned</span>}
                  </div>
                </div>
              </div>

              {/* Hiring Progress & Funnel Card */}
              {(() => {
                const metrics = getJobHiringMetrics(selectedJob);
                return (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-blue-700" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Hiring Progress & Funnel Breakdown
                        </h4>
                      </div>
                      <span className="text-xs font-bold text-slate-700 font-mono">
                        {metrics.hired} of {metrics.targetOpenings} Headcount Filled ({metrics.fillPercentage}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                      <div
                        className={`h-full transition-all duration-300 ${
                          metrics.isFilled ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${metrics.fillPercentage}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                      <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg">
                        <div className="text-[10px] text-blue-700 font-semibold uppercase">Total Screened</div>
                        <div className="text-lg font-bold text-blue-950 font-mono">{metrics.total}</div>
                      </div>
                      <div className="p-2.5 bg-amber-50/60 border border-amber-100 rounded-lg">
                        <div className="text-[10px] text-amber-700 font-semibold uppercase">Shortlisted</div>
                        <div className="text-lg font-bold text-amber-950 font-mono">{metrics.shortlisted}</div>
                      </div>
                      <div className="p-2.5 bg-purple-50/60 border border-purple-100 rounded-lg">
                        <div className="text-[10px] text-purple-700 font-semibold uppercase">Interview Rounds</div>
                        <div className="text-lg font-bold text-purple-950 font-mono">{metrics.interviews}</div>
                      </div>
                      <div className="p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                        <div className="text-[10px] text-emerald-700 font-semibold uppercase">Hired</div>
                        <div className="text-lg font-bold text-emerald-950 font-mono">{metrics.hired}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Primary Action Buttons Banner */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-blue-900">
                    Candidate Management for this Requisition
                  </div>
                  <div className="text-xs text-blue-700">
                    Screen new resumes against this requisition or manage candidate progression in pipeline view.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onViewJobCandidates && (
                    <button
                      onClick={() => {
                        const targetId = selectedJob.id;
                        setSelectedJob(null);
                        onViewJobCandidates(targetId);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>Pipeline View ({getJobCandidates(selectedJob.id).length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const targetJob = selectedJob;
                      setSelectedJob(null);
                      onStartAnalysisForJob(targetJob);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Screen Resume</span>
                  </button>
                </div>
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
                      Associated Candidates ({getJobCandidates(selectedJob.id).length})
                    </h4>
                    <p className="text-xs text-slate-500">
                      Candidates screened against this job requisition. Comparison is strictly preserved within this requisition.
                    </p>
                  </div>
                </div>

                {getJobCandidates(selectedJob.id).length === 0 ? (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
                    No candidates have been screened for this position yet. Click "Screen Resume" above to evaluate a candidate.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                    {getJobCandidates(selectedJob.id).map((cand) => (
                      <div
                        key={cand.id}
                        className="p-3.5 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
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

                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
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
                          className="px-3 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors shrink-0 cursor-pointer"
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
                Requisition ID: <span className="font-mono">{selectedJob.id}</span> · Created {new Date(selectedJob.createdAt).toLocaleDateString()}
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg shadow-2xs cursor-pointer"
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
                    ? 'Update role details, headcount target, and hiring team assignments.'
                    : 'Establish a new position requisition to evaluate candidates against.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingJob(null);
                }}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveJob} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title & Department */}
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
                    maxLength={200}
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
                    maxLength={100}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Status, Openings Target, Opening Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">
                    Requisition Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as JobStatus)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden text-xs sm:text-sm font-medium"
                  >
                    <option value="Open">Open (Active Headcount)</option>
                    <option value="On Hold">On Hold (Paused)</option>
                    <option value="Draft">Draft (Internal)</option>
                    <option value="Closed">Closed (Archived)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">
                    Target Openings <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={formOpeningsCount}
                    onChange={(e) => setFormOpeningsCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">
                    Opening Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formOpeningDate}
                    onChange={(e) => setFormOpeningDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Hiring Manager & Recruiter */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">
                    Hiring Manager (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Chen (VP Engineering)"
                    value={formHiringManager}
                    onChange={(e) => setFormHiringManager(e.target.value)}
                    maxLength={100}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">
                    Recruiter Lead / Assignee (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alex Rivera"
                    value={formRecruiter}
                    onChange={(e) => setFormRecruiter(e.target.value)}
                    maxLength={100}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Employment Type, Workplace Type, Location */}
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
                  <label className="font-semibold text-slate-700">Target Close Date (Optional)</label>
                  <input
                    type="date"
                    value={formTargetCloseDate}
                    onChange={(e) => setFormTargetCloseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                  />
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
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-md shadow-2xs transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingJob ? 'Update Requisition' : 'Create Requisition'}
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
                Delete this requisition?
              </h3>
            </div>

            <div className="text-xs sm:text-sm text-slate-600 space-y-2">
              <p>
                Are you sure you want to delete <strong className="text-slate-800">{deletingJob.title}</strong>?
              </p>
              <p className="text-slate-500">
                This action cannot be undone.
              </p>
              {getJobCandidates(deletingJob.id).length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs leading-relaxed">
                  <strong>Warning:</strong> This job has{' '}
                  <strong>{getJobCandidates(deletingJob.id).length} associated candidate records</strong>.
                  Deleting this job will also permanently clean up the associated recruitment records.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingJob(null)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
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
