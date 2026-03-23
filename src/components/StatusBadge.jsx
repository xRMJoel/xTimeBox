const STATUS_STYLES = {
  draft: 'bg-white/5 border border-white/10 text-on-surface-variant',
  submitted: 'bg-primary/10 border border-primary/20 text-primary',
  signed_off: 'bg-green-400/10 border border-green-400/20 text-green-400',
  returned: 'bg-amber-400/10 border border-amber-400/20 text-amber-400',
}

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  signed_off: 'Signed Off',
  returned: 'Returned',
}

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'signed_off' ? 'bg-green-400' :
        status === 'submitted' ? 'bg-primary' :
        status === 'returned' ? 'bg-amber-400' : 'bg-on-surface-variant'
      }`}></span>
      {STATUS_LABELS[status] || status}
    </span>
  )
}
