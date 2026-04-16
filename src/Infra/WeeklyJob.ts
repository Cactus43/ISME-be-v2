/**
 * WeeklyJob — runs every Monday at midnight.
 *
 * Responsibilities:
 * 1. Create the priority_tracking_sessions row for the new week (idempotent).
 * 2. Seed it with the top-5 oldest open leaks that are still unrepaired,
 *    ordered by steam_flow_kg DESC (substituting any that were repaired
 *    since the previous week).
 *
 * No external cron library required — uses Node.js setTimeout chain.
 */

import type { Logger } from 'pino';
import type { IInterventionAdapter } from '../Data/Interfaces/IAdapter';


// ─── Helpers ──────────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DD using LOCAL calendar (not UTC). */
function ToLocalIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function GetCurrentMonday(d: Date): Date {
  const day = d.getDay()                      // 0=Sun … 6=Sat
  const shift = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + shift)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function GetNextMonday(d: Date): Date {
  const monday = new Date(d)
  monday.setHours(0, 0, 0, 0)
  const day = monday.getDay()
  const daysUntil = day === 1 ? 7 : (1 - day + 7) % 7
  monday.setDate(monday.getDate() + daysUntil)
  return monday
}

function AddDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}


// ─── WeeklyJob ────────────────────────────────────────────────────────────

export class WeeklyJob {

  private readonly _adapter: IInterventionAdapter;
  private readonly _log: Logger;
  private _timer: NodeJS.Timeout | null = null;


  constructor(adapter: IInterventionAdapter, log: Logger) {
    this._adapter = adapter;
    this._log = log.child({ module: 'WeeklyJob' });
  }


  /**
   * Start the job: always seed the current week on startup (idempotent),
   * then schedule the next Monday run.
   */
  Start(): void {
    this._log.info('WeeklyJob started');
    void this._RunThenSchedule();
  }


  Stop(): void {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
      this._log.info('WeeklyJob stopped');
    }
  }


  // ─── Private ────────────────────────────────────────────────────────────

  private async _RunThenSchedule(): Promise<void> {
    // Always run on startup — EnsurePriorityTrackingWeek is fully idempotent.
    await this._RunJob(new Date());
    this._ScheduleNext();
  }

  private _ScheduleNext(): void {
    const now = new Date();
    const nextMonday = GetNextMonday(now);
    const msUntil = nextMonday.getTime() - now.getTime();
    this._log.info({ nextRunAt: nextMonday.toISOString() }, 'WeeklyJob next run scheduled');

    this._timer = setTimeout(() => {
      void (async () => {
        await this._RunJob(new Date());
        // Schedule the following week
        this._ScheduleNext();
      })();
    }, msUntil);

    // unref so the timer does not prevent graceful shutdown
    if (this._timer.unref) this._timer.unref();
  }

  private async _RunJob(now: Date): Promise<void> {
    try {
      const weekStart = GetCurrentMonday(now);
      const weekEnd = AddDays(weekStart, 6);
      this._log.info(
        { weekStart: ToLocalIsoDate(weekStart), weekEnd: ToLocalIsoDate(weekEnd) },
        'WeeklyJob: seeding priority tracking session',
      );
      await this._adapter.EnsurePriorityTrackingWeek(weekStart, weekEnd);
      this._log.info('WeeklyJob: priority tracking session seeded successfully');
    } catch (err) {
      this._log.error({ err }, 'WeeklyJob: failed to seed priority tracking session');
    }
  }
}
