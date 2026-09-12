import {
  formatFetchedAt,
  originLabel,
  statusLabel,
  timeFieldLabel,
} from '@/lib/content';
import type { Provenance } from '@/lib/journey';

export function ProvenanceMeta({
  provenance,
  compact = false,
}: {
  provenance: Provenance;
  compact?: boolean;
}) {
  const source = provenance.sourceUrl.trim();
  return (
    <div
      className="provenance"
      data-origin={provenance.origin}
      data-status={provenance.status}
    >
      <span className="tag provenance-status">
        {statusLabel(provenance.status)}
      </span>
      <span className={'tag provenance-origin origin-' + provenance.origin}>
        {originLabel(provenance.origin)}
      </span>
      <p className="provenance-meta">
        来源：
        {source ? (
          <a href={source} target="_blank" rel="noreferrer">
            {source.replace(/^https:\/\//, '')} ↗
          </a>
        ) : (
          '未提供来源链接'
        )}
        {compact ? ' · ' : <br />}
        {timeFieldLabel(provenance.origin)}：
        {formatFetchedAt(provenance.fetchedAt)}
      </p>
    </div>
  );
}
