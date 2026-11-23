"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Focus, Pause, Play, Plus, Trash2, ChartNoAxesColumnIncreasing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type AppData, type FocusState, emptyData, formatTime, habitStreak, localDate, readData, STORAGE_KEY } from "@/lib/data";

type AddType = "task" | "habit";

const lengths = [45, 60];

function newId() {
  return crypto.randomUUID();
}

export function FocusApp() {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [selectedTask, setSelectedTask] = useState("");
  const [duration, setDuration] = useState(60);
  const [customLength, setCustomLength] = useState(false);
  const [addType, setAddType] = useState<AddType | null>(null);
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState<"focus" | "progress">("focus");

  useEffect(() => {
    setData(readData());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, ready]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const today = localDate(new Date(now));
  const focus = data.focus;
  const remaining = focus?.endAt
    ? Math.max(0, Math.ceil((focus.endAt - now) / 1000))
    : focus?.remainingSeconds ?? duration * 60;
  const progress = focus ? Math.max(0, Math.min(100, (1 - remaining / (focus.durationMinutes * 60)) * 100)) : 0;
  const activeTasks = data.tasks.filter(task => !task.completedAt);
  const completedToday = data.tasks.filter(task => task.completedAt && localDate(new Date(task.completedAt)) === today);
  const visibleTasks = [...activeTasks, ...completedToday];
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + index);
    const key = localDate(date);
    const minutes = data.sessions.filter(session => localDate(new Date(session.finishedAt)) === key).reduce((sum, session) => sum + session.durationSeconds, 0) / 60;
    return { key, label: date.toLocaleDateString(undefined, { weekday: "short" }), minutes };
  });
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1);
  const monthSessions = data.sessions.filter(session => new Date(session.finishedAt) >= monthStart);
  const weekMinutes = weekDays.reduce((sum, day) => sum + day.minutes, 0);
  const monthMinutes = monthSessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 60;
  const monthTasks = data.tasks.filter(task => task.completedAt && new Date(task.completedAt) >= monthStart).length;
  const monthHabitChecks = data.habits.reduce((sum, habit) => sum + habit.completedDates.filter(date => date >= localDate(monthStart)).length, 0);

  useEffect(() => {
    if (!ready || !focus?.endAt || focus.endAt > now) return;
    setData(previous => {
      const active = previous.focus;
      if (!active?.endAt || active.endAt > Date.now()) return previous;
      const seconds = active.elapsedSeconds + Math.round((active.endAt - (active.runStartedAt ?? active.endAt)) / 1000);
      return {
        ...previous,
        focus: null,
        sessions: [...previous.sessions, {
          id: newId(),
          taskId: active.taskId,
          goalId: previous.tasks.find(task => task.id === active.taskId)?.goalId ?? null,
          startedAt: active.startedAt,
          finishedAt: new Date(active.endAt).toISOString(),
          durationSeconds: Math.max(0, seconds),
        }],
      };
    });
  }, [ready, focus, now]);

  function startFocus() {
    const time = Date.now();
    const next: FocusState = {
      taskId: selectedTask || null,
      durationMinutes: duration,
      startedAt: new Date(time).toISOString(),
      runStartedAt: time,
      endAt: time + duration * 60_000,
      remainingSeconds: duration * 60,
      elapsedSeconds: 0,
    };
    setData(previous => ({ ...previous, focus: next }));
  }

  function pauseFocus() {
    setData(previous => {
      const active = previous.focus;
      if (!active?.endAt) return previous;
      const time = Date.now();
      const elapsed = Math.max(0, Math.round((time - (active.runStartedAt ?? time)) / 1000));
      return { ...previous, focus: {
        ...active,
        endAt: null,
        runStartedAt: null,
        remainingSeconds: Math.max(0, Math.ceil((active.endAt - time) / 1000)),
        elapsedSeconds: active.elapsedSeconds + elapsed,
      } };
    });
  }

  function resumeFocus() {
    setData(previous => {
      const active = previous.focus;
      if (!active || active.endAt) return previous;
      const time = Date.now();
      return { ...previous, focus: { ...active, runStartedAt: time, endAt: time + active.remainingSeconds * 1000 } };
    });
  }

  function finishFocus() {
    setData(previous => {
      const active = previous.focus;
      if (!active) return previous;
      const time = Date.now();
      const seconds = active.elapsedSeconds + (active.runStartedAt ? Math.max(0, Math.round((time - active.runStartedAt) / 1000)) : 0);
      return {
        ...previous,
        focus: null,
        sessions: seconds > 0 ? [...previous.sessions, {
          id: newId(),
          taskId: active.taskId,
          goalId: previous.tasks.find(task => task.id === active.taskId)?.goalId ?? null,
          startedAt: active.startedAt,
          finishedAt: new Date(time).toISOString(),
          durationSeconds: seconds,
        }] : previous.sessions,
      };
    });
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title || !addType) return;
    const id = newId();
    const createdAt = new Date().toISOString();
    setData(previous => addType === "task"
      ? { ...previous, tasks: [...previous.tasks, { id, title, goalId: null, plannedDate: today, createdAt, completedAt: null }] }
      : { ...previous, habits: [...previous.habits, { id, title, createdAt, completedDates: [] }] });
    setAddType(null);
    setDraft("");
  }

  function toggleTask(id: string) {
    setData(previous => ({ ...previous, tasks: previous.tasks.map(task => task.id === id ? { ...task, completedAt: task.completedAt ? null : new Date().toISOString() } : task) }));
  }

  function toggleHabit(id: string) {
    setData(previous => ({ ...previous, habits: previous.habits.map(habit => habit.id === id
      ? { ...habit, completedDates: habit.completedDates.includes(today) ? habit.completedDates.filter(date => date !== today) : [...habit.completedDates, today] }
      : habit) }));
  }

  function openAdd(type: AddType) {
    setDraft("");
    setAddType(type);
  }

  if (!ready) return <div className="loading-screen">LOCK IN<span>.</span></div>;

  return <div className="focus-app">
    <header className="app-header">
      <div className="header-inner">
        <div className="brand"><Focus size={21} strokeWidth={2.3} /><span>LOCK IN<span className="brand-dot">.</span></span></div>
        <div className="header-actions"><Button variant="outline" className="add-button page-switch" onClick={() => setPage(page === "focus" ? "progress" : "focus")}>{page === "focus" ? <><ChartNoAxesColumnIncreasing size={16} /> Progress</> : <><Focus size={16} /> Focus</>}</Button></div>
      </div>
    </header>

    {page === "focus" ? <main className="focus-main">
      <div className="intro side-card"><p className="intro-label">YOUR SPACE TO FOCUS</p><h1>Lock in<span>.</span></h1><p>Choose a task, start the timer, and do the work.</p></div>

      <section className="session" aria-label="Focus session">
        <div className="session-heading"><span className="session-status"><span className={focus?.endAt ? "status-dot active" : "status-dot"} />{focus ? focus.endAt ? "In progress" : "Paused" : "Ready when you are"}</span><span className="session-length">{focus?.durationMinutes ?? duration} min session</span></div>
        <div className="time-display"><div className="time-caption">TIME REMAINING</div><div className="time-number" role="timer" aria-label={`${formatTime(remaining)} remaining`}>{formatTime(remaining)}</div><div className="time-task">{focus ? data.tasks.find(task => task.id === focus.taskId)?.title ?? "Just focusing" : "One thing at a time"}</div></div>
        <div className="time-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Session progress"><span style={{ width: `${progress}%` }} /></div>
        <div className="session-controls">
          {!focus ? <Button className="primary-button" onClick={startFocus}><Play size={16} fill="currentColor" /> Start focus</Button> : <>
            <Button className="primary-button" onClick={focus.endAt ? pauseFocus : resumeFocus}>{focus.endAt ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}{focus.endAt ? "Pause" : "Resume"}</Button>
            <Button variant="outline" className="quiet-button" onClick={finishFocus}><Check size={16} /> Finish</Button>
            <button className="text-button" onClick={() => setData(previous => ({ ...previous, focus: null }))}>Discard</button>
          </>}
        </div>
        <div className="session-settings">
          <label className="task-picker">Working on<select value={focus?.taskId ?? selectedTask} disabled={!!focus} onChange={event => setSelectedTask(event.target.value)}><option value="">Just focusing</option>{activeTasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
          <div className="length-picker"><span>Session length</span><div>{lengths.map(value => <button key={value} className={!customLength && duration === value ? "selected" : ""} disabled={!!focus} onClick={() => { setDuration(value); setCustomLength(false); }}>{value}m</button>)}<button className={customLength ? "selected" : ""} disabled={!!focus} onClick={() => { setCustomLength(true); setDuration(value => value === 45 || value === 60 ? 90 : value); }}>Custom</button></div>{customLength && <label className="custom-length"><input aria-label="Custom session length in minutes" type="number" min="1" max="240" step="1" value={duration} disabled={!!focus} onChange={event => setDuration(Math.max(1, Math.min(240, Number(event.target.value) || 1)))} /> min</label>}</div>
        </div>
      </section>

      <div className="daily-sections">
        <section className="daily-section" aria-labelledby="tasks-heading">
          <div className="section-heading"><div><h2 id="tasks-heading">Tasks</h2><p>What needs your attention?</p></div><Button variant="outline" className="add-button" onClick={() => openAdd("task")}><Plus size={16} /> Add task</Button></div>
          {visibleTasks.length === 0 ? <div className="empty-list">No tasks yet. Add one to get started.</div> : <div className="daily-list">{visibleTasks.map(task => <div className="daily-item" key={task.id}><button className={`item-check ${task.completedAt ? "checked" : ""}`} aria-label={task.completedAt ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} onClick={() => toggleTask(task.id)}>{task.completedAt && <Check size={14} />}</button><div className="item-copy"><span className={task.completedAt ? "completed" : ""}>{task.title}</span>{task.plannedDate !== today && !task.completedAt && <small>Carried over</small>}</div><button className="delete-button" aria-label={`Delete ${task.title}`} onClick={() => setData(previous => ({ ...previous, tasks: previous.tasks.filter(item => item.id !== task.id) }))}><Trash2 size={15} /></button></div>)}</div>}
        </section>

        <section className="daily-section" aria-labelledby="habits-heading">
          <div className="section-heading"><div><h2 id="habits-heading">Habits</h2><p>Small steps, every day.</p></div><Button variant="outline" className="add-button" onClick={() => openAdd("habit")}><Plus size={16} /> Add habit</Button></div>
          {data.habits.length === 0 ? <div className="empty-list">No habits yet. Start with something small.</div> : <div className="daily-list">{data.habits.map(habit => { const done = habit.completedDates.includes(today); const streak = habitStreak(habit.completedDates, today); return <div className="daily-item" key={habit.id}><button className={`item-check ${done ? "checked" : ""}`} aria-label={done ? `Uncheck ${habit.title}` : `Check ${habit.title}`} onClick={() => toggleHabit(habit.id)}>{done && <Check size={14} />}</button><div className="item-copy"><span>{habit.title}</span>{streak > 0 && <small>{streak} day streak</small>}</div><button className="delete-button" aria-label={`Delete ${habit.title}`} onClick={() => setData(previous => ({ ...previous, habits: previous.habits.filter(item => item.id !== habit.id) }))}><Trash2 size={15} /></button></div>; })}</div>}
        </section>
      </div>
    </main> : <main className="progress-main">
      <div className="progress-intro"><p className="intro-label">YOUR CONSISTENCY, AT A GLANCE</p><h1>Your progress<span>.</span></h1><p>Every focused session and small daily win adds up.</p></div>
      <div className="progress-summary">
        <section className="progress-card"><span>This week</span><strong>{Math.round(weekMinutes)}<small> min focused</small></strong><div className="week-chart" aria-label="Focus minutes by day">{weekDays.map(day => <div className="week-bar" key={day.key}><div className="week-bar-track"><span style={{ height: `${Math.max(day.minutes ? 8 : 0, Math.min(100, day.minutes / Math.max(60, ...weekDays.map(d => d.minutes)) * 100))}%` }} /></div><small>{day.label}</small></div>)}</div></section>
        <section className="progress-card"><span>{new Date(now).toLocaleDateString(undefined, { month: "long" })}</span><strong>{Math.round(monthMinutes)}<small> min focused</small></strong><p>{monthSessions.length} focus {monthSessions.length === 1 ? "session" : "sessions"} this month</p></section>
        <section className="progress-card"><span>Tasks completed</span><strong>{monthTasks}<small> this month</small></strong><p>Keep your momentum going.</p></section>
        <section className="progress-card"><span>Habit check-ins</span><strong>{monthHabitChecks}<small> this month</small></strong><p>Small steps, repeated daily.</p></section>
      </div>
    </main>}

    <Dialog open={addType !== null} onOpenChange={open => { if (!open) setAddType(null); }}><DialogContent className="add-dialog"><DialogHeader><DialogTitle>Add {addType}</DialogTitle><DialogDescription>{addType === "task" ? "Name the work you want to do." : "Choose something small to repeat every day."}</DialogDescription></DialogHeader><form className="add-form" onSubmit={addItem}><label htmlFor="item-title">{addType === "task" ? "Task name" : "Habit name"}</label><Input id="item-title" autoFocus maxLength={100} value={draft} onChange={event => setDraft(event.target.value)} placeholder={addType === "task" ? "e.g. Finish the proposal" : "e.g. Read for 20 minutes"} /><Button className="primary-button" type="submit" disabled={!draft.trim()}>Add {addType}</Button></form></DialogContent></Dialog>
  </div>;
}
