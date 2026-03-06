<script>
  import { getSupabase } from '$lib/supabase.js';

  let { data } = $props();
  let incident = $state(data.incident);
  let updates = $state(data.updates);
  let notes = $state(data.notes || []);
  let userProfile = $state(data.userProfile);
  let newNoteContent = $state('');
  let submittingNote = $state(false);

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    });
  }

  async function submitNote() {
    if (!newNoteContent.trim() || !userProfile) return;
    submittingNote = true;
    try {
      const supabase = getSupabase();
      const { data: inserted, error } = await supabase
        .from('incident_notes')
        .insert({
          incident_id: incident.id,
          user_id: userProfile.id,
          content: newNoteContent.trim(),
        })
        .select('id, content, created_at, user_id')
        .single();
      if (error) throw error;
      notes = [...notes, {
        ...inserted,
        users: { display_name: userProfile.display_name, email: null },
      }];
      newNoteContent = '';
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      submittingNote = false;
    }
  }

  let durationMinutes = $derived.by(() => {
    const start = new Date(incident.started_at).getTime();
    const end = incident.resolved_at ? new Date(incident.resolved_at).getTime() : Date.now();
    return Math.round((end - start) / 60000);
  });

  let duration = $derived.by(() => {
    if (durationMinutes < 60) return `${durationMinutes}m`;
    const hrs = Math.floor(durationMinutes / 60);
    return `${hrs}h ${durationMinutes % 60}m`;
  });

  let estimatedCost = $derived.by(() => {
    if (!data.costPerMinuteCents || data.costPerMinuteCents <= 0) return null;
    const totalCents = durationMinutes * data.costPerMinuteCents;
    return (totalCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  });
</script>

<svelte:head>
  <title>{incident.title} — APIdown.net</title>
  <meta name="description" content="{incident.severity.toUpperCase()} incident: {incident.title} affecting {incident.apis?.name || 'API'}. Status: {incident.status}. Duration: {duration}. View full timeline and resolution details." />
  {@html `<script type="application/ld+json">${JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": incident.title,
      "description": `${incident.severity} incident affecting ${incident.apis?.name || 'API'} — ${incident.status}`,
      "datePublished": incident.started_at,
      "dateModified": incident.resolved_at || incident.started_at,
      "author": { "@type": "Organization", "name": "APIdown.net", "url": "https://apidown.net" },
      "publisher": { "@type": "Organization", "name": "APIdown.net", "url": "https://apidown.net", "logo": { "@type": "ImageObject", "url": "https://apidown.net/logo-primary.png" } },
      "mainEntityOfPage": `https://apidown.net/incidents/${incident.id}`,
      "articleSection": "API Incidents",
      "keywords": [incident.apis?.name, "API outage", "API incident", incident.severity, incident.status].filter(Boolean)
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://apidown.net" },
        { "@type": "ListItem", "position": 2, "name": "Incidents", "item": "https://apidown.net/incidents" },
        { "@type": "ListItem", "position": 3, "name": incident.title, "item": `https://apidown.net/incidents/${incident.id}` }
      ]
    }
  ])}</script>`}
</svelte:head>

<a href="/incidents" class="back">&larr; All Incidents</a>

<div class="incident-detail">
  <div class="header">
    <span class="severity severity-{incident.severity}">{incident.severity}</span>
    <span class="status">{incident.status}</span>
  </div>

  <h1>{incident.title}</h1>

  <div class="meta">
    <a href="/api/{incident.apis?.slug}" class="api-link">{incident.apis?.name}</a>
    <span>·</span>
    <span>Started {formatDate(incident.started_at)}</span>
    {#if incident.resolved_at}
      <span>·</span>
      <span>Resolved {formatDate(incident.resolved_at)}</span>
    {/if}
    <span>·</span>
    <span>Duration: {duration}</span>
    {#if incident.report_count > 0}
      <span>·</span>
      <span>{incident.report_count} user report{incident.report_count !== 1 ? 's' : ''}</span>
    {/if}
  </div>

  {#if estimatedCost}
    <div class="cost-estimate">
      <span class="cost-label">Estimated Impact</span>
      <span class="cost-value">{estimatedCost}</span>
      <span class="cost-detail">Based on {durationMinutes} min downtime at ${(data.costPerMinuteCents / 100).toFixed(2)}/min</span>
    </div>
  {/if}

  {#if incident.regions?.length > 0}
    <div class="regions">
      <strong>Affected regions:</strong>
      {#each incident.regions as region}
        <span class="region-tag">{region}</span>
      {/each}
    </div>
  {/if}

  <section class="timeline">
    <h2>Timeline</h2>
    {#if updates.length === 0}
      <p class="empty">No updates yet.</p>
    {:else}
      <div class="timeline-list">
        {#each updates as update (update.id)}
          <div class="timeline-entry">
            <div class="timeline-dot-wrap">
              <span class="timeline-dot timeline-{update.status}"></span>
              <span class="timeline-line"></span>
            </div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-status timeline-badge-{update.status}">{update.status}</span>
                <span class="timeline-time">{formatDate(update.created_at)}</span>
              </div>
              <p class="timeline-message">{update.message}</p>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  {#if userProfile?.tier === 'team'}
    <section class="internal-notes">
      <h2>Internal Notes</h2>
      {#if notes.length === 0}
        <p class="empty">No internal notes yet.</p>
      {:else}
        <div class="notes-list">
          {#each notes as note (note.id)}
            <div class="note-entry">
              <div class="note-header">
                <span class="note-author">{note.users?.display_name || 'Team Member'}</span>
                <span class="note-time">{formatDate(note.created_at)}</span>
              </div>
              <p class="note-content">{note.content}</p>
            </div>
          {/each}
        </div>
      {/if}
      <div class="note-form">
        <textarea
          bind:value={newNoteContent}
          placeholder="Add an internal note..."
          rows="3"
          disabled={submittingNote}
        ></textarea>
        <button
          onclick={submitNote}
          disabled={submittingNote || !newNoteContent.trim()}
        >
          {submittingNote ? 'Adding...' : 'Add Note'}
        </button>
      </div>
    </section>
  {/if}

  <div class="info-box">
    <p>This incident was {incident.auto_created ? 'automatically detected' : 'manually reported'} by APIdown.net based on {incident.auto_created ? 'anomalous signal data from real production traffic.' : 'user reports.'}</p>
  </div>
</div>

<style>
  .back {
    display: inline-block;
    margin-bottom: 1.5rem;
    color: var(--color-text-muted);
    font-size: 0.85rem;
  }

  .incident-detail {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 2rem;
  }

  .header {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 1rem;
  }

  .severity {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
  }

  .severity-minor { background: var(--color-degraded); color: #000; }
  .severity-major { background: #f97316; color: #000; }
  .severity-critical { background: var(--color-down); color: #fff; }

  .status {
    text-transform: capitalize;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.75rem;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
  }

  .api-link {
    font-weight: 600;
  }

  .cost-estimate {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    padding: 0.75rem 1rem;
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid var(--color-down);
    border-radius: 8px;
  }

  .cost-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-down);
  }

  .cost-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .cost-detail {
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }

  .regions {
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }

  .region-tag {
    display: inline-block;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-family: var(--font-mono);
    margin-left: 0.25rem;
  }

  .timeline {
    margin-bottom: 1.5rem;
  }

  .timeline h2 {
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }

  .timeline .empty {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .timeline-list {
    display: flex;
    flex-direction: column;
  }

  .timeline-entry {
    display: flex;
    gap: 0.75rem;
  }

  .timeline-dot-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 16px;
  }

  .timeline-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 4px;
  }

  .timeline-line {
    flex: 1;
    width: 2px;
    background: var(--color-border);
    min-height: 20px;
  }

  .timeline-entry:last-child .timeline-line {
    display: none;
  }

  .timeline-investigating { background: var(--color-degraded); }
  .timeline-identified { background: #f97316; }
  .timeline-monitoring { background: var(--color-primary); }
  .timeline-resolved { background: var(--color-operational); }
  .timeline-update { background: var(--color-text-muted); }

  .timeline-content {
    padding-bottom: 1.25rem;
    flex: 1;
  }

  .timeline-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .timeline-status {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
  }

  .timeline-badge-investigating { background: var(--color-degraded); color: #000; }
  .timeline-badge-identified { background: #f97316; color: #000; }
  .timeline-badge-monitoring { background: var(--color-primary); color: #fff; }
  .timeline-badge-resolved { background: var(--color-operational); color: #000; }
  .timeline-badge-update { background: var(--color-border); color: var(--color-text); }

  .timeline-time {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .timeline-message {
    font-size: 0.85rem;
    color: var(--color-text);
    line-height: 1.4;
  }

  .internal-notes {
    margin-bottom: 1.5rem;
  }

  .internal-notes h2 {
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }

  .internal-notes .empty {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  .notes-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .note-entry {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }

  .note-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.35rem;
  }

  .note-author {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-primary);
  }

  .note-time {
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }

  .note-content {
    font-size: 0.85rem;
    color: var(--color-text);
    line-height: 1.4;
    margin: 0;
  }

  .note-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .note-form textarea {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.85rem;
    font-family: inherit;
    resize: vertical;
  }

  .note-form textarea:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .note-form button {
    align-self: flex-end;
    padding: 0.45rem 1rem;
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .note-form button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .note-form button:hover:not(:disabled) {
    opacity: 0.9;
  }

  .info-box {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem;
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
</style>
