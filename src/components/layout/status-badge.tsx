import { Badge } from '@/components/ui/badge'
import { statusLabel, type TaskStatus } from '@/lib/format'

const colors: Record<TaskStatus, string> = {
  new: 'border-transparent bg-status-new text-status-new-ink',
  in_progress: 'border-transparent bg-status-progress text-status-progress-ink',
  in_review: 'border-transparent bg-status-review text-status-review-ink',
  accepted: 'border-transparent bg-status-accepted text-status-accepted-ink',
  rework: 'border-transparent bg-status-rework text-status-rework-ink',
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className={`font-medium ${colors[status]}`}>
      {statusLabel(status)}
    </Badge>
  )
}
