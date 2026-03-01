/**
 * Full-page "Views shared with you" for all eligible users.
 * Shows visualizations assigned to the current user (by role or username) by analysts.
 * Two viz per row, chart height matches NextGen Query (280px). Filters: search by title, filter by shared-by.
 */
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Loader2, Share2, Search, User } from 'lucide-react';
import { VizCard } from '../components/AssignedViewsSection';
import { Input } from '../components/ui/input';

const CHART_HEIGHT = 280; // Match NextGen Query visualization panel

export default function SharedViewsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTitle, setSearchTitle] = useState('');
  const [filterSharedBy, setFilterSharedBy] = useState('');

  useEffect(() => {
    axios
      .get('/api/query/assigned-visualizations/for-me', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      .then((res) => setList(res.data?.visualizations || []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  const sharedByOptions = useMemo(() => {
    const names = new Set((list || []).map((v) => v.createdByUsername).filter(Boolean));
    return ['', ...Array.from(names).sort()];
  }, [list]);

  const filteredList = useMemo(() => {
    if (!list.length) return [];
    let out = list;
    const titleTerm = (searchTitle || '').trim().toLowerCase();
    if (titleTerm) {
      out = out.filter((v) => (v.title || '').toLowerCase().includes(titleTerm));
    }
    if (filterSharedBy) {
      out = out.filter((v) => (v.createdByUsername || '') === filterSharedBy);
    }
    return out;
  }, [list, searchTitle, filterSharedBy]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Share2 className="h-6 w-6 text-muted-foreground" />
          Views shared with you
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualizations assigned to your role or to you by an analyst (NextGen Query).
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading shared views...</p>
          </div>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-8 text-center">
          <Share2 className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
          <p className="text-sm font-medium text-foreground">No views shared with you yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            When an analyst assigns a visualization to your role or to you, it will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Filters: search by title, filter by shared-by */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by title..."
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={filterSharedBy}
                onChange={(e) => setFilterSharedBy(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[140px]"
              >
                <option value="">All sharers</option>
                {sharedByOptions.filter(Boolean).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            {(searchTitle.trim() || filterSharedBy) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTitle('');
                  setFilterSharedBy('');
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredList.map((viz) => (
              <VizCard key={viz.id} viz={viz} chartHeight={CHART_HEIGHT} />
            ))}
          </div>
          {filteredList.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No views match the current filters.</p>
          )}
        </>
      )}
    </div>
  );
}
