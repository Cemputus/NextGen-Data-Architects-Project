/**
 * Manage Charts — 7.2
 * Saved Charts: all charts created by you from NextGen Query.
 * Manage Charts | Shared: subset actively shared with roles/users (view feedback, unshare/delete, edit).
 * List, filter, edit metadata, edit in SQL, delete/unshare workflows.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, BarChart3, Trash2, Edit3, MessageSquare, Send, Search, Share2 } from 'lucide-react';
import { VizCard } from '../components/AssignedViewsSection';
import { Button } from '../components/ui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/modal';
import { Input } from '../components/ui/input';
import { PageHeader } from '../components/ui/page-header';

const CHART_HEIGHT = 240;

function filterList(list, filterTerm) {
  const term = (filterTerm || '').trim().toLowerCase();
  if (!term) return list;
  return list.filter(
    (v) =>
      (v.title || '').toLowerCase().includes(term) ||
      (v.description || '').toLowerCase().includes(term) ||
      (v.tags || '').toLowerCase().includes(term) ||
      (v.targetValue || '').toLowerCase().includes(term)
  );
}

export default function ManagedSharedChartsPage() {
  const navigate = useNavigate();
  const [savedList, setSavedList] = useState([]);
  const [sharedList, setSharedList] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [loadingShared, setLoadingShared] = useState(true);
  const [error, setError] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [feedbackByViz, setFeedbackByViz] = useState({});
  const [expandedViz, setExpandedViz] = usePersistedState('managed_shared_expandedViz', null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [newReplyMsg, setNewReplyMsg] = usePersistedState('managed_shared_newReplyMsg', {});
  const [replySubmitting, setReplySubmitting] = useState(false);

  const token = () => (typeof window !== 'undefined' ? sessionStorage.getItem('ucu_session_token') : null);
  const auth = () => ({ headers: { Authorization: `Bearer ${token()}` } });

  const loadSaved = () => {
    setLoadingSaved(true);
    axios
      .get('/api/query/assigned-visualizations/saved', auth())
      .then((r) => setSavedList(r.data?.visualizations || []))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load saved charts.'))
      .finally(() => setLoadingSaved(false));
  };

  const loadShared = () => {
    setLoadingShared(true);
    axios
      .get('/api/query/assigned-visualizations/my-shared', auth())
      .then((r) => setSharedList(r.data?.visualizations || []))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load shared charts.'))
      .finally(() => setLoadingShared(false));
  };

  useEffect(() => {
    loadSaved();
    loadShared();
  }, []);

  useEffect(() => {
    if (expandedViz && (savedList.some((v) => v.id === expandedViz) || sharedList.some((v) => v.id === expandedViz))) {
      loadFeedback(expandedViz);
    }
  }, [expandedViz, savedList, sharedList]);

  const loadFeedback = (vizId) => {
    axios
      .get(`/api/query/assigned-visualizations/${vizId}/feedback`, auth())
      .then((r) => setFeedbackByViz((prev) => ({ ...prev, [vizId]: r.data?.feedback || [] })))
      .catch(() => setFeedbackByViz((prev) => ({ ...prev, [vizId]: [] })));
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/query/assigned-visualizations/${deleteConfirm.id}`, auth());
      setSavedList((prev) => prev.filter((v) => v.id !== deleteConfirm.id));
      setSharedList((prev) => prev.filter((v) => v.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete.');
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (viz) => {
    navigate('/analyst/query', {
      state: {
        editViz: {
          id: viz.id,
          queryText: viz.queryText ?? viz.query_text ?? '',
          chartType: viz.chartType ?? viz.chart_type ?? 'bar',
          xColumn: viz.xColumn ?? viz.x_column ?? '',
          yColumn: viz.yColumn ?? viz.y_column ?? '',
          title: viz.title ?? '',
        },
      },
    });
  };

  const submitReply = async (vizId, feedbackId) => {
    const msg = (newReplyMsg[feedbackId] || '').trim();
    if (!msg) return;
    setReplySubmitting(true);
    try {
      await axios.post(`/api/query/assigned-visualizations/feedback/${feedbackId}/reply`, { message: msg }, auth());
      setNewReplyMsg((prev) => ({ ...prev, [feedbackId]: '' }));
      loadFeedback(vizId);
    } finally {
      setReplySubmitting(false);
    }
  };

  const filteredSaved = useMemo(() => filterList(savedList, filterTerm), [savedList, filterTerm]);
  const filteredShared = useMemo(() => filterList(sharedList, filterTerm), [sharedList, filterTerm]);
  const loading = loadingSaved || loadingShared;

  const isSavedOnly = (v) => (v.targetType || '').toLowerCase() === 'dashboard' || !(v.targetType || '').trim();

  const renderChartCard = (viz, showSharedActions = true, isSavedSection = false) => (
    <div key={viz.id} className="border rounded-lg overflow-hidden bg-card flex flex-col">
      <div className="p-3 border-b bg-muted/30 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium">{viz.title}</span>
          {(viz.description || viz.tags) && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {[viz.description, viz.tags].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {viz.updatedAt || viz.createdAt}
          {isSavedSection ? ' · For dashboards only' : ` · ${viz.targetType}: ${viz.targetValue}`}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {showSharedActions && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 h-8 text-xs"
              onClick={() => handleEdit(viz)}
              title="Edit in NextGen Query and update this chart"
            >
              <Edit3 className="h-3 w-3" /> Edit
            </Button>
          )}
          {showSharedActions && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 h-8 text-xs text-destructive"
              onClick={() => setDeleteConfirm(viz)}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          )}
          {showSharedActions && !isSavedOnly(viz) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 h-8 text-xs"
              onClick={() => {
                setExpandedViz((prev) => (prev === viz.id ? null : viz.id));
                if (expandedViz !== viz.id) loadFeedback(viz.id);
              }}
            >
              <MessageSquare className="h-3 w-3" /> Feedback
            </Button>
          )}
        </div>
      </div>
      <div className="p-3">
        <VizCard viz={viz} chartHeight={CHART_HEIGHT} />
      </div>
      {expandedViz === viz.id && (
        <div className="p-3 border-t bg-muted/10 space-y-3">
          <p className="text-sm font-medium">Feedback</p>
          {(feedbackByViz[viz.id] || []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No feedback yet.</p>
          ) : (
            (feedbackByViz[viz.id] || []).map((fb) => (
              <div key={fb.id} className="pl-2 border-l-2 border-primary/30 space-y-1">
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
                <div className="flex gap-2 items-center mt-1">
                  <Input
                    placeholder="Reply..."
                    value={newReplyMsg[fb.id] || ''}
                    onChange={(e) => setNewReplyMsg((prev) => ({ ...prev, [fb.id]: e.target.value }))}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => submitReply(viz.id, fb.id)}
                    disabled={replySubmitting}
                  >
                    <Send className="h-3 w-3" /> Reply
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Charts"
        description="Saved Charts: charts saved for dashboards only (not shared with anyone). Manage Charts | Shared: charts you have shared with a role or user. No chart appears in both sections."
      />

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by title, description, tags, target..."
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Saved Charts — dashboard-only, not shared with any user/role */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Saved Charts
            </h2>
            <p className="text-xs text-muted-foreground">
              Charts saved for dashboards only. They are not shared with any user or role. Use NextGen Query → Save chart to add here; pin into dashboards via Analyst → Dashboards → Edit content.
            </p>
            {filteredSaved.length === 0 ? (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-6 text-center">
                <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium text-foreground">
                  {savedList.length === 0 ? 'No saved charts' : 'No matches for this filter'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {savedList.length === 0
                    ? 'In NextGen Query, run a query and click Save chart to add one here.'
                    : 'Try a different filter term.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredSaved.map((viz) => renderChartCard(viz, true, true))}
              </div>
            )}
          </section>

          {/* Manage Charts | Shared — actively shared with roles/users */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              Manage Charts | Shared
            </h2>
            <p className="text-xs text-muted-foreground">
              Charts you have shared with roles or users. View feedback, reply, edit in SQL workspace, or unshare (delete).
            </p>
            {filteredShared.length === 0 ? (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-6 text-center">
                <Share2 className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium text-foreground">
                  {sharedList.length === 0 ? 'No shared charts yet' : 'No matches for this filter'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {sharedList.length === 0
                    ? 'Assign a visualization to a role or user in NextGen Query to see it here.'
                    : 'Try a different filter term.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredShared.map((viz) => renderChartCard(viz, true))}
              </div>
            )}
          </section>
        </>
      )}

      {deleteConfirm && (
        <Modal open onClose={() => !deleting && setDeleteConfirm(null)} titleId="delete-viz-title" maxWidth="max-w-sm">
          <ModalHeader
            title="Delete shared chart"
            titleId="delete-viz-title"
            onClose={() => !deleting && setDeleteConfirm(null)}
          />
          <ModalBody>
            <p className="text-sm">
              Delete &quot;{deleteConfirm.title}&quot;? This will remove it from the recipient. This cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => !deleting && setDeleteConfirm(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
