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
import { useLocale, useTranslations } from 'next-intl';
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

const formatTimestamp = (value?: string | null, locale: string = 'en') => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'am' ? 'en-GB' : 'en-US', {
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
  const locale = useLocale();
  const t = useTranslations('Maintenance');

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
        if (isMounted) setLoading(false);
      }
    };
    void loadData();
    return () => { isMounted = false; };
  }, []);

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
        const comments = ticketData?.comments ?? ticketData?.maintenance_comments ?? [];
        setSelectedTicket({ ...ticketData, comments });
      } catch {
        if (isMounted) setSelectedTicket(null);
      } finally {
        if (isMounted) setCommentsLoading(false);
      }
    };
    void loadTicketDetail();
    return () => { isMounted = false; };
  }, [selectedTicketId]);

  const handleSubmit = async () => {
    if (!lease) return;
    if (!title.trim() || !description.trim()) {
      setSubmitError(t('fillTitleAndDescription'));
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
    } catch {
      setSubmitError(t('unableToSubmit'));
    } finally {
      setSubmitting(false);
    }
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

  const getPriorityText = (p: Ticket['priority']) => t(p.toLowerCase());
  const getStatusText = (s: Ticket['status']) => t(s.toLowerCase().replace('_', ''));

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <LayoutDashboard size={16} className="text-amber-700" />
          <p className="text-amber-700 font-black text-xs uppercase tracking-widest">{t('pageLabel')}</p>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-stone-900">{t('pageTitle')}</h1>
        <p className="text-stone-400 font-medium text-sm mt-1">{t('pageSubtitle')}</p>
      </div>

      {!selectedTicketId && (
        <section className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            className="bg-stone-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-sm active:scale-95 inline-flex items-center gap-2"
            onClick={() => setShowForm(true)}
            disabled={leaseError}
          >
            <Plus className="h-4 w-4" />
            {t('newRequest')}
          </button>
        </section>
      )}

      {leaseError && (
        <div className="rounded-[32px] bg-white p-6 border-2 border-amber-200 text-sm font-medium text-amber-700">
          {t('leaseError')}
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-[32px] bg-white p-6 border-2 border-green-200 text-sm font-black text-green-700 shadow-sm">
          <CheckCircle className="h-4 w-4" />
          {t('submitted')}
        </div>
      )}

      {showForm ? (
        <section className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-stone-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-stone-900">{t('newRequestTitle')}</h2>
            <button type="button" className="text-stone-500 hover:text-stone-700" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">{t('whatIsTheIssue')}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('issuePlaceholder')}
                className="mt-2 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">{t('describeIssue')}</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('describePlaceholder')}
                className="mt-2 w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">{t('priority')}</label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {priorities.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPriority(level)}
                    className={cn(
                      'rounded-2xl border px-3 py-2 transition font-black text-[10px] uppercase tracking-widest',
                      priority === level ? 'bg-amber-700 text-white' : 'border-2 border-stone-200 text-stone-600'
                    )}
                  >
                    {getPriorityText(level)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {submitError && <p className="mt-4 text-sm text-red-600">{submitError}</p>}
          <div className="mt-6 flex items-center justify-between">
            <button type="button" onClick={() => setShowForm(false)} className="text-stone-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest">{t('cancel')}</button>
            <button type="button" onClick={handleSubmit} disabled={submitting} className="bg-stone-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">
              {submitting ? '...' : t('submitRequest')}
            </button>
          </div>
        </section>
      ) : null}

      {!selectedTicketId ? (
        <section className="space-y-4">
          {loading ? (
            <div className="h-32 rounded-[32px] bg-stone-100 animate-pulse" />
          ) : (
            tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-[32px] bg-white p-6 shadow-sm border-2 border-transparent hover:border-stone-900 transition-all duration-300">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-base font-black text-stone-900">{ticket.title}</p>
                  <div className="flex gap-2">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', priorityClasses[ticket.priority])}>{getPriorityText(ticket.priority)}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', statusClasses[ticket.status])}>{getStatusText(ticket.status)}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-stone-400">
                  <span>{t('submittedLabel')} {formatTimestamp(ticket.created_at, locale)}</span>
                  <button onClick={() => setSelectedTicketId(ticket.id)} className="text-amber-700 inline-flex items-center gap-1">
                    {t('viewDetails')} <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      ) : (
        <section className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-stone-200">
          <button onClick={() => setSelectedTicketId(null)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-700">
            <ChevronLeft className="h-4 w-4" /> {t('backToAll')}
          </button>
          {selectedTicket && (
            <div className="mt-6 space-y-6">
              <h2 className="text-2xl font-black text-stone-900">{selectedTicket.title}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{t('submittedLabel')}</p>
                  <p className="text-sm text-stone-900">{formatTimestamp(selectedTicket.created_at, locale)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{t('lastUpdated')}</p>
                  <p className="text-sm text-stone-900">{formatTimestamp(selectedTicket.updated_at, locale)}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{t('description')}</p>
                <p className="mt-2 text-sm text-stone-700">{selectedTicket.description}</p>
              </div>
              <div>
                <h3 className="text-xl font-black text-stone-900 mb-4">{t('updates')}</h3>
                {selectedTicket.comments?.map((comment) => (
                  <div key={comment.id} className="py-3 border-b border-stone-100 last:border-0">
                    <p className="text-sm text-stone-700">{comment.comment}</p>
                    <p className="mt-1 text-xs text-stone-400">{formatTimestamp(comment.created_at, locale)}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border-2 border-stone-200 p-4">
                <textarea
                  rows={2}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={t('addUpdate')}
                  className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
                <div className="mt-3 flex justify-end">
                  <button onClick={handleCommentSubmit} disabled={commentSubmitting} className="bg-stone-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    {commentSubmitting ? '...' : t('send')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}