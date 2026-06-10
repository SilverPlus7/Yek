interface Props { tag: string; onRemove?: () => void }

export function TagBadge({ tag, onRemove }: Props) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-900/40 text-blue-300 text-xs px-2.5 py-0.5 rounded-full">
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-red-400 leading-none">&times;</button>
      )}
    </span>
  )
}
