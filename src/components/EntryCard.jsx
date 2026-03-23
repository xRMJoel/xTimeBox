import StatusBadge from './StatusBadge'
import { CATEGORIES, TIME_BLOCKS } from '../lib/constants'

export default function EntryCard({ entry, onEdit, onDelete, readonly = false }) {
  const timeBlock = TIME_BLOCKS.find((t) => t.value === entry.time_block)

  return (
    <div className="glass-card-inset rounded-xl p-4 flex items-start justify-between gap-4 hover:border-white/10 transition-colors group/entry">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold text-white">{entry.category}</span>
          <StatusBadge status={entry.status} />
          {entry.feature_tag && (
            <span className="text-xs px-2 py-0.5 rounded border border-primary/20 text-primary bg-primary/5 font-medium">
              {entry.feature_tag}
            </span>
          )}
        </div>

        {entry.notes && (
          <p className="text-sm text-on-surface-variant italic mt-0.5">{entry.notes}</p>
        )}

        {entry.return_reason && entry.status === 'returned' && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '14px' }}>undo</span>
            <p className="text-xs text-amber-400">{entry.return_reason}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-primary font-bold text-sm">
          {entry.time_value ? Number(entry.time_value).toFixed(2) : '0.00'}d
        </span>

        {!readonly && entry.status !== 'signed_off' && (
          <div className={`flex items-center gap-2 transition-opacity ${entry.status === 'draft' || entry.status === 'returned' ? '' : 'opacity-0 group-hover/entry:opacity-100'}`}>
            {onEdit && (
              <button
                onClick={() => onEdit(entry)}
                className="text-xs text-primary hover:text-primary-dim font-semibold transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (entry.status === 'draft' || entry.status === 'returned') && (
              <button
                onClick={() => onDelete(entry.id)}
                className="text-xs text-error hover:text-error-dim font-semibold transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}

        {entry.status === 'signed_off' && (
          <span className="material-symbols-outlined text-outline opacity-50" style={{ fontSize: '16px' }}>lock</span>
        )}
      </div>
    </div>
  )
}
