import type { TimelineItem } from '../types'
import { exportIcsToFile } from '../utils/icsGenerator'

interface IcsExportButtonProps {
  items: TimelineItem[]
}

export function IcsExportButton({ items }: IcsExportButtonProps) {
  const handleExport = () => {
    if (items.length === 0) {
      window.alert('There are no deadlines to export yet.')
      return
    }
    exportIcsToFile(items)
  }

  return (
    <button
      onClick={handleExport}
      className="w-full flex items-center justify-center gap-2 bg-timeline-dark hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
      aria-label="Export timeline to .ics calendar"
    >
      📅 Export .ics Calendar
    </button>
  )
}
