import type { DeepLinkDeadline } from '../types'

interface DeepLinkHandlerProps {
  deadline: DeepLinkDeadline
  onAdd: (deadline: DeepLinkDeadline) => void
  onDismiss: () => void
}

export function DeepLinkHandler({ deadline, onAdd, onDismiss }: DeepLinkHandlerProps) {
  return (
    <div className="min-h-screen bg-timeline-surface flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
            🔗
          </div>
          <h2 className="text-xl font-bold text-timeline-dark">Incoming Deadline</h2>
        </div>
        <p className="text-slate-600 mb-6">
          A deadline was shared from another Aurelia OS app. Add it to your timeline?
        </p>
        <div className="space-y-3">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Title
            </p>
            <p className="text-sm font-semibold text-slate-800">{deadline.title}</p>
            {deadline.dueDate && (
              <>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-3 mb-1">
                  Due
                </p>
                <p className="text-sm text-slate-800">
                  {deadline.dueDate}{deadline.dueTime ? ` at ${deadline.dueTime}` : ''}
                </p>
              </>
            )}
            {deadline.sourceApp && (
              <>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-3 mb-1">
                  Source
                </p>
                <p className="text-sm text-slate-800">{deadline.sourceApp}</p>
              </>
            )}
            {deadline.description && (
              <>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-3 mb-1">
                  Details
                </p>
                <p className="text-sm text-slate-800">{deadline.description}</p>
              </>
            )}
          </div>
          <div className="space-y-3">
            <button
              onClick={() => onAdd(deadline)}
              className="w-full bg-timeline-primary hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Add to my timeline
            </button>
            <button
              onClick={onDismiss}
              className="w-full bg-white border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors hover:bg-slate-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
