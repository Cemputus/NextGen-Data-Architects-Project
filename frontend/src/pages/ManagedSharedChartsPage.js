/**
 * Analyst: Managed shared Charts
 * List charts shared by me, view feedback, delete, Edit (opens NextGen Query with SQL), reply to feedback.
 * State persisted across refresh via refetch on mount.
 */
import React, { useEffect, useState } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, BarChart3, Trash2, Edit3, MessageSquare, Send } from 'lucide-react';
import { VizCard } from '../components/AssignedViewsSection';
import { Button } from '../components/ui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/modal';
import { Input } from '../components/ui/input';

const CHART_HEIGHT = 240;

export default function ManagedSharedChartsPage() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackByViz, setFeedbackByViz] = useState({});
  const [expandedViz, setExpandedViz] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [newReplyMsg, setNewReplyMsg] = usePersistedState('managed_shared_newReplyMsg', {});
  const [replySubmitting, setReplySubmitting] = useState(false);

  const token = () => localStorage.getItem('token');
  const auth = () => ({ headers: { Authorization: `Bearer ${token()}` } });

  useEffect(() => {
    axios.get('/api/query/assigned-visualizations/my-shared', auth())
      .then((r) => setList(r.data?.visualizations || []))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load your shared charts.'))
      .finally(() => setLoading(false));
  }, []);

  const loadFeedback = (vizId) => {
    axios.get(`/api/query/assigned-visualizations/${vizId}/feedback`, auth())
      .then((r) => setFeedbackByViz((prev) => ({ ...prev, [vizId]: r.data?.feedback || [] })))
      .catch(() => setFeedbackByViz((prev) => ({ ...prev, [vizId]: [] })));
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/query/assigned-visualizations/${deleteConfirm.id}`, auth());
      setList((prev) => prev.filter((v) => v.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete.');
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (viz) => {
    navigate('/analyst/query', { state: { editViz: { id: viz.id, queryText: viz.queryText, chartType: viz.chartType, xColumn: viz.xColumn, yColumn: viz.yColumn, title: viz.title } } });
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
          Managed shared Charts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          View and manage visualizations you have shared. See feedback, reply, edit in SQL workspace, or delete.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-8 text-center">
          <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
          <p className="text-sm font-medium text-foreground">No shared charts yet</p>
          <p className="text-xs text-muted-foreground mt-1">Assign a visualization from NextGen Query to see it here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((viz) => (
            <div key={viz.id} className="border rounded-lg overflow-hidden bg-card">
              <div className="p-3 border-b bg-muted/30 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{viz.title}</span>
                <span className="text-xs text-muted-foreground">
                  Shared with {viz.targetType}: {viz.targetValue} · {viz.createdAt}
                </span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={() => handleEdit(viz)}>
                    <Edit3 className="h-3 w-3" /> Edit
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1 h-8 text-xs text-destructive" onClick={() => setDeleteConfirm(viz)}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
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
                        <p className="text-xs text-muted-foreground">{fb.authorUsername} · {fb.createdAt}</p>
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
                          <Button size="sm" className="h-8 gap-1" onClick={() => submitReply(viz.id, fb.id)} disabled={replySubmitting}>
                            <Send className="h-3 w-3" /> Reply
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteConfirm && (
        <Modal open onClose={() => !deleting && setDeleteConfirm(null)} titleId="delete-viz-title" maxWidth="max-w-sm">
          <ModalHeader title="Delete shared chart" titleId="delete-viz-title" onClose={() => !deleting && setDeleteConfirm(null)} />
          <ModalBody>
            <p className="text-sm">Delete &quot;{deleteConfirm.title}&quot;? This cannot be undone.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => !deleting && setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
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
