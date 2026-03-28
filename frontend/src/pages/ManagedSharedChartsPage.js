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
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
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
  const [editDescViz, setEditDescViz] = useState(null);
  const [editDescValue, setEditDescValue] = useState('');
  const [editDescSaving, setEditDescSaving] = useState(false);

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
    // Always load shared charts.
    loadShared();
    // Only analyst and admin roles can see "Saved Charts" (dashboard-only charts).
    const role = (user?.role || '').toString().toLowerCase();
    if (role === 'analyst' || role === 'admin') {
      loadSaved();
    } else {
      setLoadingSaved(false);
      setSavedList([]);
    }
  }, [user?.role]);

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

  const openEditDescription = (viz) => {
    setEditDescViz(viz);
    setEditDescValue(viz.description || '');
  };

  const handleSaveDescription = async () => {
    if (!editDescViz) return;
    setEditDescSaving(true);
    try {
      await axios.patch(
        `/api/query/assigned-visualizations/${editDescViz.id}`,
        { description: editDescValue },
        auth()
      );
      // Update local state so both owner and reshared recipients see the new description.
      setSavedList((prev) => prev.map((v) => (v.id === editDescViz.id ? { ...v, description: editDescValue } : v)));
      setSharedList((prev) => prev.map((v) => (v.id === editDescViz.id ? { ...v, description: editDescValue } : v)));
      setEditDescViz(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update description.');
    } finally {
      setEditDescSaving(false);
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

  const roleLower = (user?.role || '').toString().toLowerCase();
  const canSeeSaved = roleLower === 'analyst' || roleLower === 'admin';
  const canEditDescriptionOnly = !canSeeSaved;

  const renderChartCard = (viz, showSharedActions = true, isSavedSection = false) => (
    <div key={viz.id} className="border rounded-lg overflow-hidden bg-card flex flex-col">
      <div className="p-3 border-b bg-muted/30 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium">{viz.title}</span>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {isSavedSection ? (
              <>
                Saved by <span className="font-medium">{viz.createdByUsername}</span>
              </>
            ) : (
              <>
                {viz.resharedByUsername ? (
                  <>
                    Reshared by{' '}
                    <span className="font-medium">{viz.resharedByUsername}</span>
                    {viz.targetType && viz.targetValue && (
                      <> to {viz.targetType} → {viz.targetValue}</>
                    )}
                    {viz.originalCreatorUsername &&
                      viz.originalCreatorUsername !== viz.resharedByUsername && (
                        <> · Original by {viz.originalCreatorUsername}</>
                      )}
                  </>
                ) : (
                  <>
                    Shared by{' '}
                    <span className="font-medium">{viz.createdByUsername}</span>
                    {viz.targetType && viz.targetValue && (
                      <> to {viz.targetType} → {viz.targetValue}</>
                    )}
                  </>
                )}
              </>
            )}
          </p>
          {(viz.reshareDescription || viz.description || viz.tags) && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {[
                viz.reshareDescription || null,
                viz.description || null,
                viz.tags || null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {viz.updatedAt || viz.createdAt}
                </span>
        <div className="flex items-center gap-2 shrink-0">
          {showSharedActions && canSeeSaved && (
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
          {showSharedActions && canEditDescriptionOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 h-8 text-xs"
              onClick={() => openEditDescription(viz)}
              title="Edit description for this shared chart"
            >
              <Edit3 className="h-3 w-3" /> Edit description
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
            <>
              {(feedbackByViz[viz.id] || []).map((fb) => (
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
                </div>
              ))}
              {/* Single reply box for the latest feedback in this conversation */}
              <div className="flex gap-2 items-center mt-2 pt-2 border-t border-border/60">
                          <Input
                            placeholder="Reply..."
                  value={newReplyMsg['__thread'] || ''}
                  onChange={(e) => setNewReplyMsg((prev) => ({ ...prev, __thread: e.target.value }))}
                            className="flex-1 h-8 text-sm"
                          />
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => {
                    const list = feedbackByViz[viz.id] || [];
                    const latest = list[list.length - 1];
                    if (!latest) return;
                    const msg = (newReplyMsg['__thread'] || '').trim();
                    if (!msg) return;
                    // Reuse submitReply but pass the latest feedback id
                    setNewReplyMsg((prev) => ({ ...prev, [latest.id]: msg, __thread: '' }));
                    submitReply(viz.id, latest.id);
                  }}
                  disabled={replySubmitting}
                >
                            <Send className="h-3 w-3" /> Reply
                          </Button>
                        </div>
            </>
                  )}
                </div>
              )}
            </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Charts"
        description={
          canSeeSaved
            ? 'Saved Charts: charts saved for dashboards only (not shared with anyone). Manage Charts | Shared: charts you have shared with a role or user. No chart appears in both sections.'
            : 'Manage Charts | Shared: charts you have shared with a role or user. No chart appears in both sections.'
        }
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
          {/* Saved Charts — dashboard-only, not shared with any user/role (Analyst/Admin only) */}
          {canSeeSaved && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Saved Charts
              </h2>
              <p className="text-xs text-muted-foreground">
                Not shared. Add in NextGen Query → Save chart; pin in Dashboards → Edit.
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
          )}

          {/* Manage Charts | Shared — shared with a role or user only (all roles) */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              Manage Charts | Shared
            </h2>
            <p className="text-xs text-muted-foreground">
              Charts you have shared with a role or user. Recipients see them under &quot;Views shared with you&quot;. View feedback, reply, edit in SQL, or unshare (delete).
            </p>
            {filteredShared.length === 0 ? (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-6 text-center">
                <Share2 className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium text-foreground">
                  {sharedList.length === 0 ? 'No shared charts' : 'No matches for this filter'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {sharedList.length === 0
                    ? 'In NextGen Query, use Assign to role or user to share a chart here.'
                    : 'Try a different filter term.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredShared.map((viz) => renderChartCard(viz, true, false))}
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

      {editDescViz && (
        <Modal
          open
          onClose={() => !editDescSaving && setEditDescViz(null)}
          titleId="edit-desc-title"
          maxWidth="max-w-md"
        >
          <ModalHeader
            title="Edit chart description"
            titleId="edit-desc-title"
            onClose={() => !editDescSaving && setEditDescViz(null)}
          />
          <ModalBody>
            <p className="text-sm mb-2">
              Update the description for <span className="font-semibold">{editDescViz.title}</span>.
            </p>
            <Input
              value={editDescValue}
              onChange={(e) => setEditDescValue(e.target.value)}
              placeholder="Enter a helpful description for this chart"
              className="mt-1"
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => !editDescSaving && setEditDescViz(null)}
              disabled={editDescSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveDescription} disabled={editDescSaving}>
              {editDescSaving ? 'Saving...' : 'Save description'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
