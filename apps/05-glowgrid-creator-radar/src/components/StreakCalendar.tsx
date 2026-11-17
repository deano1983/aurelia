import { useState, useCallback, useEffect, memo } from 'react';
import type { StreakRecord } from '../types';
import { loadStreak, saveStreak } from '../utils/storage';
import {
  computeStreak,
  isPosted,
  toggleDate,
  monthDays,
  monthLabel,
  todayISO,
} from '../utils/streak';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface StreakCalendarProps {
  onStreakChange?: (record: StreakRecord) => void;
}

const DayCell = memo(({ day, posted, today }: { day: number; posted: boolean; today: boolean }) => (
    <div
      className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
        posted
          ? 'bg-emerald-500 text-white'
          : today
            ? 'bg-blue-50 border border-blue-200 text-blue-700'
            : 'bg-gray-50 border border-transparent text-gray-400 hover:border-gray-300 hover:bg-gray-100'
      }`}
    >
      {day}
    </div>
  ));
DayCell.displayName = 'DayCell';

export default function StreakCalendar({ onStreakChange }: StreakCalendarProps) {
  const [record, setRecord] = useState<StreakRecord>({ postedDates: [] });
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    setRecord(loadStreak());
  }, []);

  const stats = computeStreak(record);
  const days = monthDays(viewMonth.year, viewMonth.month);
  const today = todayISO();
  const firstDay = days[0];
  const leadingEmpty = firstDay ? firstDay.weekday : 0;

  const setPosted = useCallback(
    (iso: string, posted: boolean) => {
      const next = toggleDate(record, iso);
      if (!posted && !record.postedDates.includes(iso)) return; // unchanged
      setRecord(next);
      saveStreak(next);
      onStreakChange?.(next);
    },
    [record, onStreakChange],
  );

  const prevMonth = () => {
    setViewMonth((m) => (m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }));
  };
  const nextMonth = () => {
    setViewMonth((m) => (m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }));
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm no-print">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Streak Calendar</h2>
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <button
            onClick={prevMonth}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:pointer-events-none"
          >
            ◀
          </button>
          <span>{monthLabel(viewMonth.year, viewMonth.month)}</span>
          <button
            onClick={nextMonth}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:pointer-events-none"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="glass-panel mb-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase">Current Streak</div>
            <div className="text-xl font-bold text-emerald-600">{stats.currentStreak} days</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase">Longest Streak</div>
            <div className="text-xl font-bold">{stats.longestStreak} days</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase">Posts This Life</div>
            <div className="text-xl font-bold">{stats.totalPosts}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase">Last Posted</div>
            <div className="text-xl font-bold">{stats.lastPosted ?? '—'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-xs font-medium text-gray-500 text-center">
            {w}
          </div>
        ))}
        {[...Array(leadingEmpty)].map((_, i) => (
          <div key={`lead-${i}`} className="aspect-square" />
        ))}
        {days.map(({ iso, day }) => {
          const posted = isPosted(record, iso);
          const isToday = iso === today;
          const selectable = iso <= today;
          return (
            <button
              key={iso}
              onClick={() => setPosted(iso, !posted)}
              className="p-0"
              disabled={!selectable}
            >
              <DayCell day={day} posted={posted} today={isToday} />
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Green = posted · blue ring = today · click past dates to toggle. Stale gaps break the
        streak — deadlines flow to <strong>01 Timeline</strong>.
      </p>
    </section>
  );
}