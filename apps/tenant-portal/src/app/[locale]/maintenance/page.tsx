'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle,
  ChevronLeft,
  LayoutDashboard,
  Plus,
  Send,
  Wrench,
  X,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Ticket = {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  created_at: string;
  updated_at: string;
  property_id: string;
  unit_id: string;
};

type Comment = {
  id: string;
  ticket_id: string;
  author_user_id: string;
  comment: string;
  created_at: string;
};

type Lease = {
  property_id: string;
  unit_id: string;
  unit_code: string | null;
  property_name: string | null;
};

type TicketWithComments = Ticket & { comments?: Comment[] | null };

const priorities: Ticket['priority'][] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const formatTimestamp = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const priorityClasses: Record<Ticket['priority'], string> = {
  LOW: 'bg-stone-100 text-stone-600',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

const statusClasses: Record<Ticket['status'], string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-stone-100 text-stone-500',
};

export default function MaintenancePage() {
  const supabase = useMemo(() => createClient(), []);
  const [lease, setLease] = useState<Lease | null>(null);
  const [leaseError, setLeaseError] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsError, setTicketsError] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Ticket['priority']>('MEDIUM');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketWithComments | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      try {
        const [leaseResponse, ticketsResponse] = await Promise.all([
          apiClient.get('/api/leases/mine').catch((error: Error) => ({ error })),
          apiClient.get('/api/maintenance').catch((error: Error) => ({ error })),
        ]);

        if (!isMounted) return;

        if ('error' in leaseResponse) {
          setLeaseError(true);
        } else {
          const leaseData = leaseResponse?.data ?? leaseResponse;
          setLease(Array.isArray(leaseData) ? leaseData[0] ?? null : leaseData ?? null);
        }

        if ('error' in ticketsResponse) {
          setTicketsError(true);
        } else {
          const ticketData = (ticketsResponse?.data ?? ticketsResponse) as Ticket[] | null;
          setTickets(ticketData ?? []);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void Promise.all([supabase.auth.getSession(), loadData()]);

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;
    const loadTicketDetail = async () => {
      if (!selectedTicketId) {
        setSelectedTicket(null);
        return;
      }
      setCommentsLoading(true);
      try {
        const response = await apiClient.get(`/api/maintenance/${selectedTicketId}`);
        if (!isMounted) return;

        const ticketData = response?.data ?? response;
        const comments =
          ticketData?.comments ??
          ticketData?.maintenance_comments ??
          ticketData?.data?.comments ??
          ticketData?.data?.maintenance_comments ??
          response?.comments ??
          response?.maintenance_comments ??
          [];

        setSelectedTicket({
          ...ticketData,
          comments,
        });
      } catch {
        if (!isMounted) return;
        setSelectedTicket(null);
      } finally {
        if (isMounted) {
          setCommentsLoading(false);
        }
      }
    };

    void loadTicketDetail();
    return () => {
      isMounted = false;
    };
  }, [selectedTicketId]);

  const sortedTickets = [...tickets].sort((a, b) => {
    const group = (status: Ticket['status']) =>
      status === 'OPEN' || status === 'IN_PROGRESS' ? 0 : 1;
    const groupDiff = group(a.status) - group(b.status);
    if (groupDiff !== 0) return groupDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleSubmit = async () => {
    if (!lease) return;
    if (!title.trim() || !description.trim()) {
      setSubmitError('Please provide a title and description.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await apiClient.post('/api/maintenance', {
        property_id: lease.property_id,
        unit_id: lease.unit_id,
        title: title.trim(),
        description: description.trim(),
        priority,
      });

      const created = response?.data ?? response;
      setTickets((prev) => [created as Ticket, ...prev]);
      setShowForm(false);
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setSuccessMessage(true);
      setTimeout(() => setSuccessMessage(false), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit request.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setSubmitError(null);
  };

  const handleCommentSubmit = async () => {
    if (!selectedTicketId || !commentInput.trim()) return;
    setCommentSubmitting(true);
    try {
      const response = await apiClient.post(`/api/maintenance/${selectedTicketId}/comments`, {
        comment: commentInput.trim(),
      });
      const newComment = response?.data ?? response;
      setSelectedTicket((prev) => {
        if (!prev) return prev;
        const existing = prev.comments ?? [];
        return { ...prev, comments: [...existing, newComment as Comment] };
      });
      setCommentInput('');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const leaseSubtitle = lease
    ? `${lease.property_name ?? 'Property'} — Unit ${lease.unit_code ?? '—'}`
    : '—';

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <LayoutDashboard size={16} className="text-amber-700" />
          <p className="text-amber-700 font-black text-xs uppercase tracking-widest">
            Maintenance
          </p>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-stone-900">
          Maintenance Requests
        </h1>
        <p className="text-stone-400 font-medium text-sm mt-1">
          Submit and track requests for your unit
        </p>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          className="bg-stone-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-sm active:scale-95 inline-flex items-center gap-2"
          onClick={() => setShowForm(true)}
          disabled={leaseError}
        >
          <Plus className="h-4 w-4" />
          New Request
        </button>
      </section>
      <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
        {leaseSubtitle}
      </p>

      {leaseError ? (
        <div className="rounded-[32px] bg-white p-6 border-2 border-amber-200 text-sm font-medium text-amber-700">
          Unable to load your lease details. Cannot submit new requests.
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex items-center gap-2 rounded-[32px] bg-white p-6 border-2 border-green-200 text-sm font-black text-green-700 shadow-sm">
          <CheckCircle className="h-4 w-4" />
          Your request has been submitted
        </div>
      ) : null}

      {showForm ? (
        <section className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-stone-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-stone-900">New Request</h2>
            <button
              type="button"
              className="text-stone-500 hover:text-stone-700"
              onClick={handleCancel}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">
                What is the issue?
              </label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Leaking faucet in kitchen"
                className="mt-2 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">
                Describe the issue
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Please describe the problem in detail including location in the unit"
                className="mt-2 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">
                Priority
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {priorities.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPriority(level)}
                    className={cn(
                      'rounded-2xl border px-3 py-2 transition font-black text-[10px] uppercase tracking-widest',
                      priority === level
                        ? level === 'URGENT'
                          ? 'bg-red-600 text-white'
                          : level === 'HIGH'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-700 text-white'
                        : 'border-2 border-stone-200 text-stone-600'
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {submitError ? (
            <p className="mt-4 text-sm text-red-600">{submitError}</p>
          ) : null}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={handleCancel}
              className="bg-white border-2 border-stone-200 text-stone-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-stone-900 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-stone-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-sm active:scale-95 inline-flex items-center gap-2"
            >
              {submitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              Submit Request
            </button>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`ticket-skeleton-${index}`}
                className="h-28 rounded-[32px] bg-stone-100 animate-pulse"
              />
            ))}
          </div>
        ) : ticketsError ? (
          <div className="rounded-[32px] bg-white p-8 border-2 border-stone-200 text-sm font-medium text-stone-400">
            Unable to load maintenance requests.
          </div>
        ) : sortedTickets.length === 0 && !showForm ? (
          <div className="rounded-[32px] bg-white p-16 border-2 border-dashed border-stone-200 text-center">
            <Wrench className="mx-auto h-8 w-8 text-amber-400" />
            <p className="mt-4 text-base font-black text-stone-900">
              No maintenance requests yet
            </p>
            <p className="mt-2 text-xs font-medium text-stone-400">
              Submit a request if something needs attention in your unit.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="rounded-[32px] bg-white p-6 shadow-sm border-2 border-transparent hover:border-stone-900 transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-base font-black text-stone-900">{ticket.title}</p>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        priorityClasses[ticket.priority]
                      )}
                    >
                      {ticket.priority}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        statusClasses[ticket.status]
                      )}
                    >
                      {ticket.status}
                    </span>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 overflow-hidden text-sm text-stone-500">
                  {ticket.description}
                </p>
                <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-stone-400">
                  <span>Submitted {formatTimestamp(ticket.created_at)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedTicketId((prev) => (prev === ticket.id ? null : ticket.id))
                    }
                    className="text-[10px] font-black uppercase tracking-widest text-amber-700 hover:text-amber-900 inline-flex items-center gap-1"
                  >
                    View details
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedTicketId ? (
        <section className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-stone-200">
          <button
            type="button"
            onClick={() => setSelectedTicketId(null)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-700 hover:text-amber-900"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to all requests
          </button>

          {commentsLoading || !selectedTicket ? (
            <div className="mt-6 h-32 rounded-xl bg-stone-100 animate-pulse" />
          ) : (
            <div className="mt-6 space-y-6">
              <div>
                <h2 className="text-2xl font-black text-stone-900">{selectedTicket.title}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      priorityClasses[selectedTicket.priority]
                    )}
                  >
                    {selectedTicket.priority}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      statusClasses[selectedTicket.status]
                    )}
                  >
                    {selectedTicket.status}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Submitted</p>
                  <p className="text-sm text-stone-900">
                    {formatTimestamp(selectedTicket.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Last updated</p>
                  <p className="text-sm text-stone-900">
                    {formatTimestamp(selectedTicket.updated_at)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Description</p>
                <p className="mt-2 text-sm text-stone-700">{selectedTicket.description}</p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
                  Updates
                </p>
                <h3 className="text-xl font-black text-stone-900 mb-4">Updates</h3>
                {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                  <div className="mt-3 divide-y divide-stone-100">
                    {selectedTicket.comments.map((comment) => (
                      <div key={comment.id} className="py-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-amber-400" />
                          <div>
                            <p className="text-sm text-stone-700">{comment.comment}</p>
                            <p className="mt-1 text-xs text-stone-400">
                              {formatTimestamp(comment.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-stone-400">No updates yet</p>
                )}
              </div>

              <div className="rounded-2xl border-2 border-stone-200 p-4">
                <textarea
                  rows={2}
                  value={commentInput}
                  onChange={(event) => setCommentInput(event.target.value)}
                  placeholder="Add an update..."
                  className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleCommentSubmit}
                    disabled={commentSubmitting}
                    className="bg-stone-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all active:scale-95 inline-flex items-center gap-2"
                  >
                    {commentSubmitting ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
