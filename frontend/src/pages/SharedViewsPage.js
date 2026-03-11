/**
 * Full-page "Views shared with you" for all eligible users.
 * - Direct shared and "Reshared charts" sections
 * - Reshare with description; creator vs reshared by
 * - Feedback thread per viz; recipients can post, creator/resharer can reply
 */
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { usePersistentToast } from '../context/PersistentToastContext';
import { usePersistedState } from '../hooks/usePersistedState';
import { Loader2, Share2, Search, User, MessageSquare, Send, Share } from 'lucide-react';
import { VizCard } from '../components/AssignedViewsSection';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/modal';

const CHART_HEIGHT = 280;
const FALLBACK_ROLES = ['Student', 'Staff', 'HOD', 'Dean', 'Senate', 'Finance', 'HR', 'Analyst', 'Sysadmin'];

export default function SharedViewsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTitle, setSearchTitle] = usePersistedState('shared_views_searchTitle', '');
  const [filterSharedBy, setFilterSharedBy] = usePersistedState('shared_views_filterSharedBy', '');
  const [reshareModal, setReshareModal] = useState(null);
  const [reshareDesc, setReshareDesc] = usePersistedState('shared_views_reshareDesc', '');
  const [reshareTargetType, setReshareTargetType] = usePersistedState('shared_views_reshareTargetType', 'role');
  const [reshareTargetValue, setReshareTargetValue] = usePersistedState('shared_views_reshareTargetValue', '');
  const [reshareSubmitting, setReshareSubmitting] = useState(false);
  const [reshareError, setReshareError] = useState('');
  const [reshareSuccess, setReshareSuccess] = useState('');
  const [targetOptions, setTargetOptions] = useState({ roles: [], users: [] });
  const [feedbackByViz, setFeedbackByViz] = useState({});
  const [feedbackOpenViz, setFeedbackOpenViz] = usePersistedState('shared_views_feedbackOpenViz', null);
  const [newFeedbackMsg, setNewFeedbackMsg] = usePersistedState('shared_views_newFeedbackMsg', {});
  const [newReplyMsg, setNewReplyMsg] = usePersistedState('shared_views_newReplyMsg', {});
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const { user } = useAuth();
  const { addToast } = usePersistentToast();
  const currentUsername = (user?.username || '').toString().toLowerCase();

  const token = () => (typeof window !== 'undefined' ? sessionStorage.getItem('ucu_session_token') : null);
  const auth = () => ({ headers: { Authorization: `Bearer ${token()}` } });

  useEffect(() => {
    axios
      .get('/api/query/assigned-visualizations/for-me', auth())
      .then((res) => setList(res.data?.visualizations || []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (feedbackOpenViz && list.some((v) => v.id === feedbackOpenViz)) loadFeedback(feedbackOpenViz);
  }, [feedbackOpenViz, list]);

  useEffect(() => {
    if (!reshareModal) return;
    setReshareError('');
    axios.get('/api/query/assigned-visualizations/target-options', auth())
      .then((r) => setTargetOptions({ roles: r.data?.roles || [], users: r.data?.users || [] }))
      .catch(() => setTargetOptions({ roles: [], users: [] }));
  }, [reshareModal]);

  const directList = useMemo(() => list.filter((v) => !v.isReshared), [list]);
  const resharedList = useMemo(() => list.filter((v) => v.isReshared), [list]);

  const sharedByOptions = useMemo(() => {
    const names = new Set(list.map((v) => v.resharedByUsername || v.createdByUsername).filter(Boolean));
    return ['', ...Array.from(names).sort()];
  }, [list]);

  const filterList = (arr) => {
    let out = arr;
    const titleTerm = (searchTitle || '').trim().toLowerCase();
    if (titleTerm) out = out.filter((v) => (v.title || '').toLowerCase().includes(titleTerm));
    if (filterSharedBy) out = out.filter((v) => (v.resharedByUsername || v.createdByUsername || '') === filterSharedBy);
    return out;
  };

  const loadFeedback = (vizId) => {
    axios.get(`/api/query/assigned-visualizations/${vizId}/feedback`, auth())
      .then((r) => setFeedbackByViz((prev) => ({ ...prev, [vizId]: r.data?.feedback || [] })))
      .catch(() => setFeedbackByViz((prev) => ({ ...prev, [vizId]: [] })));
  };

  const handleReshare = async () => {
    const desc = (reshareDesc || '').trim();
    if (!desc) {
      setReshareError('Please provide a clear description for the reshare.');
      return;
    }
    if (!reshareTargetValue) {
      setReshareError('Please select a role or user to share with.');
      return;
    }
    setReshareSubmitting(true);
    setReshareError('');
    setReshareSuccess('');
    try {
      await axios.post('/api/query/assigned-visualizations/reshare', {
        vizId: reshareModal.id,
        description: desc,
        targetType: reshareTargetType,
        targetValue: reshareTargetValue,
      }, auth());
      setReshareModal(null);
      setReshareDesc('');
      setReshareTargetType('role');
      setReshareTargetValue('');
      const res = await axios.get('/api/query/assigned-visualizations/for-me', auth());
      setList(res.data?.visualizations || []);
      const targetLabel = reshareTargetType === 'role' ? `role "${reshareTargetValue}"` : `user "${reshareTargetValue}"`;
      const successMsg = `Chart shared successfully with ${targetLabel}. They will see it under "Views shared with you".`;
      setReshareSuccess(successMsg);
      addToast(successMsg, 'success');
      setTimeout(() => setReshareSuccess(''), 6000);
    } catch (e) {
      setReshareError(e.response?.data?.error || 'Failed to reshare.');
    } finally {
      setReshareSubmitting(false);
    }
  };

  const submitFeedback = async (vizId) => {
    const msg = (newFeedbackMsg[vizId] || '').trim();
    if (!msg) return;
    setFeedbackSubmitting(true);
    try {
      await axios.post(`/api/query/assigned-visualizations/${vizId}/feedback`, { message: msg }, auth());
      setNewFeedbackMsg((prev) => ({ ...prev, [vizId]: '' }));
      loadFeedback(vizId);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const submitReply = async (vizId, feedbackId) => {
    const msg = (newReplyMsg[feedbackId] || '').trim();
    if (!msg) return;
    setFeedbackSubmitting(true);
    try {
      await axios.post(`/api/query/assigned-visualizations/feedback/${feedbackId}/reply`, { message: msg }, auth());
      setNewReplyMsg((prev) => ({ ...prev, [feedbackId]: '' }));
      loadFeedback(vizId);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const rolesForSelect = (targetOptions.roles?.length > 0) ? targetOptions.roles : FALLBACK_ROLES;

  const renderVizBlock = (viz) => (
    <div key={viz.id} className="space-y-2">
      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="p-2 border-b bg-muted/30 text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">Creator: {viz.originalCreatorUsername || viz.createdByUsername}</span>
          {viz.isReshared && (
            <>
              <span className="text-muted-foreground">·</span>
              <span>Reshared by: {viz.resharedByUsername}</span>
              {viz.reshareDescription && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="italic">{viz.reshareDescription}</span>
                </>
              )}
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setReshareModal(viz)}
            >
              <Share className="h-3 w-3" />
              Reshare
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => {
                setFeedbackOpenViz((prev) => (prev === viz.id ? null : viz.id));
                if (feedbackOpenViz !== viz.id) loadFeedback(viz.id);
              }}
            >
              <MessageSquare className="h-3 w-3" />
              Feedback
            </Button>
          </div>
        </div>
        <div className="p-2">
          <VizCard viz={viz} chartHeight={CHART_HEIGHT} />
        </div>
      </div>
      {feedbackOpenViz === viz.id && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
          <p className="text-sm font-medium">Feedback</p>
          {(feedbackByViz[viz.id] || []).map((fb) => (
            <div key={fb.id} className="space-y-1 pl-2 border-l-2 border-primary/30">
              <p className="text-xs text-muted-foreground">
                {fb.authorUsername} · {fb.createdAt}
              </p>
              <p className="text-sm">{fb.message}</p>
              {(fb.replies || []).map((rep) => (
                <div key={rep.id} className="pl-3 text-sm text-muted-foreground">
                  <span className="font-medium">{rep.authorUsername}:</span> {rep.message}
                  <span className="text-xs ml-1">({rep.createdAt})</span>
                </div>
              ))}
              {(currentUsername && (
                (viz.createdByUsername || '').toString().toLowerCase() === currentUsername ||
                (viz.resharedByUsername || '').toString().toLowerCase() === currentUsername
              )) && (
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Reply (creator/resharer only)"
                    value={newReplyMsg[fb.id] || ''}
                    onChange={(e) => setNewReplyMsg((prev) => ({ ...prev, [fb.id]: e.target.value }))}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button size="sm" className="h-8 gap-1" onClick={() => submitReply(viz.id, fb.id)} disabled={feedbackSubmitting}>
                    <Send className="h-3 w-3" /> Reply
                  </Button>
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Add feedback..."
              value={newFeedbackMsg[viz.id] || ''}
              onChange={(e) => setNewFeedbackMsg((prev) => ({ ...prev, [viz.id]: e.target.value }))}
              className="flex-1 h-9 text-sm"
            />
            <Button size="sm" className="h-9 gap-1" onClick={() => submitFeedback(viz.id)} disabled={feedbackSubmitting}>
              <Send className="h-3 w-3" /> Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Share2 className="h-6 w-6 text-muted-foreground" />
          Views shared with you
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualizations assigned to your role or to you. You can reshare (with a description) or give feedback.
        </p>
      </div>

      {reshareSuccess && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {reshareSuccess}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-8 text-center">
          <Share2 className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
          <p className="text-sm font-medium text-foreground">No views shared with you yet</p>
          <p className="text-xs text-muted-foreground mt-1">When someone assigns or reshares a visualization to you, it will appear here.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title..."
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={filterSharedBy}
                onChange={(e) => setFilterSharedBy(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[140px]"
              >
                <option value="">All sharers</option>
                {sharedByOptions.filter(Boolean).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            {(searchTitle.trim() || filterSharedBy) && (
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => { setSearchTitle(''); setFilterSharedBy(''); }}>
                Clear filters
              </button>
            )}
          </div>

          {filterList(directList).length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-foreground mb-3">Shared with you</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filterList(directList).map((viz) => renderVizBlock(viz))}
              </div>
            </section>
          )}

          {filterList(resharedList).length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-foreground mb-3">Reshared charts</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filterList(resharedList).map((viz) => renderVizBlock(viz))}
              </div>
            </section>
          )}

          {filterList(list).length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No views match the current filters.</p>
          )}
        </>
      )}

      {reshareModal && (
        <Modal open onClose={() => !reshareSubmitting && setReshareModal(null)} titleId="reshare-title" maxWidth="max-w-md">
          <ModalHeader title="Reshare visualization" titleId="reshare-title" onClose={() => !reshareSubmitting && setReshareModal(null)} />
          <ModalBody>
            <p className="text-sm text-muted-foreground mb-2">
              Share &quot;{reshareModal.title}&quot; with a role or user. You must provide a clear description.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="reshare-desc" className="text-xs font-medium">Description *</label>
                <textarea
                  id="reshare-desc"
                  value={reshareDesc}
                  onChange={(e) => setReshareDesc(e.target.value)}
                  placeholder="e.g. Q3 revenue summary for finance team"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  rows={3}
                />
              </div>
              <div>
                <label htmlFor="reshare-target" className="text-xs font-medium">Share with</label>
                <select
                  id="reshare-target"
                  value={reshareTargetType}
                  onChange={(e) => { setReshareTargetType(e.target.value); setReshareTargetValue(''); }}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="role">Role</option>
                  <option value="user">Specific user</option>
                </select>
              </div>
              {reshareTargetType === 'role' ? (
                <div>
                  <label htmlFor="reshare-role" className="text-xs font-medium text-muted-foreground block mb-1">Select role</label>
                  <select
                    id="reshare-role"
                    value={reshareTargetValue}
                    onChange={(e) => setReshareTargetValue(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select role</option>
                    {rolesForSelect.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="reshare-user" className="text-xs font-medium text-muted-foreground block mb-1">Select user</label>
                  <select
                    id="reshare-user"
                    value={reshareTargetValue}
                    onChange={(e) => setReshareTargetValue(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select user</option>
                    {(targetOptions.users || []).map((u) => (
                      <option key={u.username || u} value={u.username || u}>
                        {typeof u === 'object' ? (u.full_name || u.username || '') + (u.role ? ` (${u.role})` : '') : u}
                      </option>
                    ))}
                  </select>
                  {(targetOptions.users || []).length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">No app users found. Ask an admin to add users.</p>
                  )}
                </div>
              )}
            </div>
            {reshareError && <p className="text-sm text-destructive mt-2">{reshareError}</p>}
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => !reshareSubmitting && setReshareModal(null)} disabled={reshareSubmitting}>Cancel</Button>
            <Button onClick={handleReshare} disabled={reshareSubmitting}>
              {reshareSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Reshare
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
