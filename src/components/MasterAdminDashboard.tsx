import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Lock,
  ChevronDown
} from 'lucide-react';
import { UserProfile, UserApprovalStatus, UserRole } from '../types';
import { subscribeToUsers, updateUserStatusAndRole } from '../lib/firebase';
import { PRIMARY_MASTER_ADMIN_EMAIL } from '../lib/auth-policy';

interface MasterAdminDashboardProps {
  currentUser: User | null;
  onRefresh?: () => void;
}

type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'SUSPENDED_OR_REJECTED';

export const MasterAdminDashboard: React.FC<MasterAdminDashboardProps> = ({
  currentUser,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Confirmation modal state
  const [actionConfirm, setActionConfirm] = useState<{
    targetUser: UserProfile;
    action: 'REJECT' | 'SUSPEND' | 'DEMOTE';
    assignedRole?: UserRole;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Subscribe to real users from Firestore
  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);

    const unsubscribe = subscribeToUsers(
      (loadedUsers) => {
        setUsers(loadedUsers);
        setIsLoading(false);
      },
      (err: any) => {
        setIsLoading(false);
        const errMsg = err?.message || String(err);
        if (errMsg.includes('Missing or insufficient permissions') || errMsg.includes('permission-denied')) {
          setErrorMessage(
            'Firestore Security Rules currently restrict listing the users collection. Listing will become fully active once firestore.rules are updated in Step 4. Direct profile and status updates remain operational.'
          );
        } else {
          setErrorMessage(`Unable to load user directory: ${errMsg}`);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // Compute directory metrics
  const metrics = useMemo(() => {
    let pendingCount = 0;
    let recruiterCount = 0;
    let suspendedCount = 0;

    users.forEach((u) => {
      if (u.status === 'PENDING') pendingCount++;
      if (u.status === 'APPROVED' && u.role === 'RECRUITER') recruiterCount++;
      if (u.status === 'SUSPENDED' || u.status === 'REJECTED') suspendedCount++;
    });

    return {
      total: users.length,
      pending: pendingCount,
      recruiters: recruiterCount,
      suspended: suspendedCount,
    };
  }, [users]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search query filter
      const matchesSearch =
        !searchQuery.trim() ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (u.displayName && u.displayName.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
        (u.companyName && u.companyName.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      if (!matchesSearch) return false;

      // Status filter
      if (filterStatus === 'PENDING') {
        return u.status === 'PENDING';
      }
      if (filterStatus === 'APPROVED') {
        return u.status === 'APPROVED';
      }
      if (filterStatus === 'SUSPENDED_OR_REJECTED') {
        return u.status === 'SUSPENDED' || u.status === 'REJECTED';
      }

      return true;
    });
  }, [users, searchQuery, filterStatus]);

  // Quick Action: Approve user directly with specified role
  const handleApprove = async (targetUser: UserProfile, role: UserRole) => {
    if (!currentUser?.email) return;
    setIsProcessingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateUserStatusAndRole(targetUser.userId, {
        status: 'APPROVED',
        role,
        adminEmail: currentUser.email,
      });

      setSuccessMessage(
        `Successfully approved ${targetUser.displayName || targetUser.email} as ${
          role === 'RECRUITER' ? 'Recruiter' : 'Public User'
        }.`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(`Failed to approve user: ${err?.message || 'Operation rejected'}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Reactivate a suspended or rejected user
  const handleReactivate = async (targetUser: UserProfile) => {
    if (!currentUser?.email) return;
    setIsProcessingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateUserStatusAndRole(targetUser.userId, {
        status: 'APPROVED',
        role: targetUser.role || 'RECRUITER',
        adminEmail: currentUser.email,
      });

      setSuccessMessage(`Reactivated account for ${targetUser.displayName || targetUser.email}.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(`Failed to reactivate user: ${err?.message || 'Operation rejected'}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Confirm and execute destructive/restrictive actions (Suspend, Reject)
  const handleExecuteConfirmedAction = async () => {
    if (!actionConfirm || !currentUser?.email) return;
    setIsProcessingAction(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { targetUser, action } = actionConfirm;

    try {
      if (action === 'SUSPEND') {
        await updateUserStatusAndRole(targetUser.userId, {
          status: 'SUSPENDED',
          suspensionReason: actionReason.trim() || 'Suspended by Master Admin',
          adminEmail: currentUser.email,
        });
        setSuccessMessage(`Suspended account for ${targetUser.displayName || targetUser.email}.`);
      } else if (action === 'REJECT') {
        await updateUserStatusAndRole(targetUser.userId, {
          status: 'REJECTED',
          suspensionReason: actionReason.trim() || 'Access request rejected by Master Admin',
          adminEmail: currentUser.email,
        });
        setSuccessMessage(`Rejected access request from ${targetUser.displayName || targetUser.email}.`);
      }

      setActionConfirm(null);
      setActionReason('');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(`Failed to complete action: ${err?.message || 'Operation rejected'}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Banner / Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 uppercase tracking-wider">
              <Shield className="w-3 h-3 text-purple-600" />
              <span>Master Admin Governance</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">·</span>
            <span className="text-xs text-slate-500 font-mono">Mihora Tech Talent Ops</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Access Approval & User Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Review pending Google sign-in access requests, assign recruiter roles, and manage account authorization status.
          </p>
        </div>

        {/* Primary Admin Badge */}
        <div className="flex items-center gap-2 p-2.5 bg-white border border-slate-200/90 rounded-lg shadow-2xs shrink-0">
          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
            MA
          </div>
          <div className="min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 truncate">Primary Admin</span>
              <span title="Immutable Primary Admin" className="inline-flex">
                <Lock className="w-3 h-3 text-purple-600 shrink-0" />
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono truncate max-w-[180px]">
              {PRIMARY_MASTER_ADMIN_EMAIL}
            </div>
          </div>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Pending Requests</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.pending}</div>
          <div className="text-[11px] text-slate-500">Awaiting role approval</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Active Recruiters</span>
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.recruiters}</div>
          <div className="text-[11px] text-slate-500">Approved for recruitment data</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Suspended / Rejected</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.suspended}</div>
          <div className="text-[11px] text-slate-500">Access strictly revoked</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Accounts</span>
            <Users className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.total}</div>
          <div className="text-[11px] text-slate-500">Registered Google users</div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">Notification:</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-medium">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              filterStatus === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            All Accounts ({users.length})
          </button>
          <button
            onClick={() => setFilterStatus('PENDING')}
            className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'PENDING'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span>Pending</span>
            <span className="w-4 h-4 rounded-full bg-amber-700/20 text-[10px] font-bold flex items-center justify-center">
              {metrics.pending}
            </span>
          </button>
          <button
            onClick={() => setFilterStatus('APPROVED')}
            className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              filterStatus === 'APPROVED'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setFilterStatus('SUSPENDED_OR_REJECTED')}
            className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              filterStatus === 'SUSPENDED_OR_REJECTED'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
          >
            Suspended / Rejected
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search email, name..."
            className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* User Directory Table / List */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Connecting to Firestore user registry...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No matching accounts found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No accounts match "${searchQuery}". Try clearing search filters.`
                : filterStatus === 'PENDING'
                ? 'There are currently no access requests pending review.'
                : 'No registered accounts in this category yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">User Identity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Requested</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4 text-right">Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const isPrimaryAdmin = user.email.toLowerCase().trim() === PRIMARY_MASTER_ADMIN_EMAIL;
                  const isPending = user.status === 'PENDING';
                  const isSuspended = user.status === 'SUSPENDED';
                  const isRejected = user.status === 'REJECTED';
                  const isApproved = user.status === 'APPROVED';

                  return (
                    <tr
                      key={user.userId}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isPending ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Column 1: Identity */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                              isPrimaryAdmin
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : isPending
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {(user.displayName || user.email || 'U')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 truncate">
                                {user.displayName || 'Unnamed User'}
                              </span>
                              {isPrimaryAdmin && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>Primary Admin</span>
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 truncate">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending Review</span>
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Approved</span>
                          </span>
                        ) : isSuspended ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Suspended</span>
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            <span>Rejected</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Unspecified</span>
                        )}
                      </td>

                      {/* Column 3: Current Role */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isPrimaryAdmin ? (
                          <span className="font-bold text-purple-700">Master Admin</span>
                        ) : user.role === 'RECRUITER' ? (
                          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                            Recruiter
                          </span>
                        ) : (
                          <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                            Public User
                          </span>
                        )}
                      </td>

                      {/* Column 4: Requested Role / Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        {user.requestedRole ? (
                          <span className="font-medium text-slate-700">
                            {user.requestedRole === 'RECRUITER' ? 'Recruiter' : 'Public'}
                          </span>
                        ) : (
                          <span>-</span>
                        )}
                      </td>

                      {/* Column 5: Created / Active At */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        {user.lastActiveAt
                          ? new Date(user.lastActiveAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : '-'}
                      </td>

                      {/* Column 6: Action Buttons */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isPrimaryAdmin ? (
                          <span className="text-[11px] text-slate-400 font-medium italic">
                            Protected Account
                          </span>
                        ) : isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(user, 'RECRUITER')}
                              disabled={isProcessingAction}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                              title="Approve with Recruiter Workspace access"
                            >
                              Approve Recruiter
                            </button>
                            <button
                              onClick={() => handleApprove(user, 'PUBLIC_USER')}
                              disabled={isProcessingAction}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded transition-colors cursor-pointer disabled:opacity-50"
                              title="Approve for Personal Screening only"
                            >
                              Approve Public
                            </button>
                            <button
                              onClick={() => setActionConfirm({ targetUser: user, action: 'REJECT' })}
                              disabled={isProcessingAction}
                              className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer text-xs disabled:opacity-50"
                              title="Reject access request"
                            >
                              Reject
                            </button>
                          </div>
                        ) : isApproved ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {user.role === 'RECRUITER' ? (
                              <button
                                onClick={() => handleApprove(user, 'PUBLIC_USER')}
                                disabled={isProcessingAction}
                                className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer text-[11px] disabled:opacity-50"
                                title="Demote to Public User (revokes recruiter tools)"
                              >
                                Set to Public
                              </button>
                            ) : (
                              <button
                                onClick={() => handleApprove(user, 'RECRUITER')}
                                disabled={isProcessingAction}
                                className="px-2 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors cursor-pointer text-[11px] disabled:opacity-50"
                                title="Promote to Recruiter"
                              >
                                Promote to Recruiter
                              </button>
                            )}
                            <button
                              onClick={() => setActionConfirm({ targetUser: user, action: 'SUSPEND' })}
                              disabled={isProcessingAction}
                              className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer text-[11px] font-medium disabled:opacity-50"
                              title="Suspend account access immediately"
                            >
                              Suspend
                            </button>
                          </div>
                        ) : isSuspended || isRejected ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleReactivate(user)}
                              disabled={isProcessingAction}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                              title="Reactivate account and restore access"
                            >
                              Reactivate
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Destructive Actions (Suspend, Reject) */}
      {actionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white rounded-xl border border-slate-200/90 shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-full ${
                  actionConfirm.action === 'SUSPEND'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {actionConfirm.action === 'SUSPEND' ? 'Suspend User Access?' : 'Reject Access Request?'}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {actionConfirm.targetUser.email}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {actionConfirm.action === 'SUSPEND'
                ? 'This user will be immediately blocked from accessing recruitment jobs, candidate records, screening evaluations, and the resume analysis API.'
                : 'This user access request will be marked as rejected. They will not receive recruiter permissions.'}
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Administrative Reason (Optional)
              </label>
              <input
                type="text"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={
                  actionConfirm.action === 'SUSPEND'
                    ? 'e.g. Talent contract ended, security audit, etc.'
                    : 'e.g. Unverified external applicant'
                }
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setActionConfirm(null);
                  setActionReason('');
                }}
                disabled={isProcessingAction}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedAction}
                disabled={isProcessingAction}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                  actionConfirm.action === 'SUSPEND'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {isProcessingAction && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Confirm {actionConfirm.action === 'SUSPEND' ? 'Suspension' : 'Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
