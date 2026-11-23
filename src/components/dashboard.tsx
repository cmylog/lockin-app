"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Clock3, Flame, Focus, LayoutDashboard, Pause, Play, Plus, Target, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { AppData, emptyData, FocusState, formatTime, habitStreak, localDate, minutesLabel, readData, STORAGE_KEY } from "@/lib/data";

type View = "today" | "focus" | "progress";
type AddType = "goal" | "task" | "habit";

function dayName(date: Date) { return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); }
function shortDay(date: Date) { return date.toLocaleDateString(undefined, { weekday: "short" }); }
function newId() { return crypto.randomUUID(); }

export function Dashboard() {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("today");
  const [modal, setModal] = useState<AddType | null>(null);
  const [draft, setDraft] = useState("");
  const [draftGoal, setDraftGoal] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [duration, setDuration] = useState(25);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { setData(readData()); setReady(true); }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data, ready]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  const today = localDate(new Date(now));
  const focus = data.focus;
  const remaining = focus?.endAt ? Math.max(0, Math.ceil((focus.endAt - now) / 1000)) : focus?.remainingSeconds ?? duration * 60;

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
          id: newId(), taskId: active.taskId, goalId: previous.tasks.find(task => task.id === active.taskId)?.goalId ?? null,
          startedAt: active.startedAt, finishedAt: new Date(active.endAt).toISOString(), durationSeconds: Math.max(0, seconds),
        }],
      };
    });
  }, [ready, focus, now]);

  const activeTasks = data.tasks.filter(task => !task.completedAt);
  const completedToday = data.tasks.filter(task => task.completedAt && localDate(new Date(task.completedAt)) === today);
  const todaySessions = data.sessions.filter(session => localDate(new Date(session.finishedAt)) === today);
  const todaySeconds = todaySessions.reduce((sum, session) => sum + session.durationSeconds, 0);
  const checkedHabits = data.habits.filter(habit => habit.completedDates.includes(today)).length;
  const totalItems = activeTasks.length + completedToday.length + data.habits.length;
  const doneItems = completedToday.length + checkedHabits;
  const completion = totalItems ? Math.round(doneItems / totalItems * 100) : 0;

  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const key = localDate(date);
    const seconds = data.sessions.filter(session => localDate(new Date(session.finishedAt)) === key).reduce((sum, session) => sum + session.durationSeconds, 0);
    return { key, label: shortDay(date), seconds, today: key === today };
  }), [data.sessions, now, today]);
  const weekSeconds = week.reduce((sum, day) => sum + day.seconds, 0);
  const maxWeek = Math.max(3600, ...week.map(day => day.seconds));

  function openModal(type: AddType) { setDraft(""); setDraftGoal(data.goals[0]?.id ?? ""); setModal(type); }
  function addItem(event: React.FormEvent) {
    event.preventDefault();
    const title = draft.trim();
    if (!title || !modal) return;
    const id = newId(); const createdAt = new Date().toISOString();
    setData(previous => {
      if (modal === "goal") return { ...previous, goals: [...previous.goals, { id, title, createdAt }] };
      if (modal === "habit") return { ...previous, habits: [...previous.habits, { id, title, createdAt, completedDates: [] }] };
      return { ...previous, tasks: [...previous.tasks, { id, title, goalId: draftGoal || null, plannedDate: today, createdAt, completedAt: null }] };
    });
    setModal(null);
  }
  function toggleTask(id: string) { setData(previous => ({ ...previous, tasks: previous.tasks.map(task => task.id === id ? { ...task, completedAt: task.completedAt ? null : new Date().toISOString() } : task) })); }
  function toggleHabit(id: string) { setData(previous => ({ ...previous, habits: previous.habits.map(habit => habit.id === id ? { ...habit, completedDates: habit.completedDates.includes(today) ? habit.completedDates.filter(date => date !== today) : [...habit.completedDates, today] } : habit) })); }
  function deleteGoal(id: string) { setData(previous => ({ ...previous, goals: previous.goals.filter(goal => goal.id !== id), tasks: previous.tasks.map(task => task.goalId === id ? { ...task, goalId: null } : task) })); }
  function deleteTask(id: string) { setData(previous => ({ ...previous, tasks: previous.tasks.filter(task => task.id !== id) })); }
  function deleteHabit(id: string) { setData(previous => ({ ...previous, habits: previous.habits.filter(habit => habit.id !== id) })); }
  function startFocus() {
    const startedAt = new Date().toISOString(); const time = Date.now();
    const next: FocusState = { taskId: selectedTask || null, durationMinutes: duration, startedAt, runStartedAt: time, endAt: time + duration * 60000, remainingSeconds: duration * 60, elapsedSeconds: 0 };
    setData(previous => ({ ...previous, focus: next }));
  }
  function pauseFocus() { setData(previous => {
    const active = previous.focus; if (!active?.endAt) return previous;
    const time = Date.now(); const elapsed = Math.max(0, Math.round((time - (active.runStartedAt ?? time)) / 1000));
    return { ...previous, focus: { ...active, endAt: null, runStartedAt: null, remainingSeconds: Math.max(0, Math.ceil((active.endAt - time) / 1000)), elapsedSeconds: active.elapsedSeconds + elapsed } };
  }); }
  function resumeFocus() { setData(previous => {
    const active = previous.focus; if (!active || active.endAt) return previous;
    const time = Date.now(); return { ...previous, focus: { ...active, runStartedAt: time, endAt: time + active.remainingSeconds * 1000 } };
  }); }
  function finishFocus() { setData(previous => {
    const active = previous.focus; if (!active) return previous;
    const time = Date.now(); const seconds = active.elapsedSeconds + (active.runStartedAt ? Math.max(0, Math.round((time - active.runStartedAt) / 1000)) : 0);
    return { ...previous, focus: null, sessions: seconds > 0 ? [...previous.sessions, { id: newId(), taskId: active.taskId, goalId: previous.tasks.find(task => task.id === active.taskId)?.goalId ?? null, startedAt: active.startedAt, finishedAt: new Date(time).toISOString(), durationSeconds: seconds }] : previous.sessions };
  }); }
  function discardFocus() { setData(previous => ({ ...previous, focus: null })); }

  if (!ready) return <div className="loading-screen">LOCK IN<span className="loading-dot">.</span></div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Focus size={22} strokeWidth={2.6} /></div><span>LOCK IN<span className="brand-dot">.</span></span></div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Main navigation">
        <button className={`nav-item ${view === "today" ? "active" : ""}`} onClick={() => setView("today")}><LayoutDashboard size={18} /> Today</button>
        <button className={`nav-item ${view === "focus" ? "active" : ""}`} onClick={() => setView("focus")}><Focus size={18} /> Focus {focus && <span className="live-dot" />}</button>
        <button className={`nav-item ${view === "progress" ? "active" : ""}`} onClick={() => setView("progress")}><TrendingUp size={18} /> Progress</button>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-motto">Small steps.<br /><strong>Serious momentum.</strong></div><div className="sidebar-foot">YOUR SPACE TO SHOW UP</div></div>
    </aside>

    <main className="main-panel">
      <header className="topbar"><div className="mobile-brand"><Focus size={18} /> LOCK IN<span>.</span></div><div className="topbar-date">{dayName(new Date(now))}</div><div className="topbar-right"><span className="private-pill"><span /> Saved in this browser</span><div className="avatar">LI</div></div></header>
      <div className="content">
        {view === "today" && <>
          <section className="hero"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR DAILY COMMAND CENTER</div><h1>Make today <em>count.</em></h1><p>Pick your priorities. Build your rhythm. Do the work.</p><Button className="hero-button" onClick={() => setView("focus")}>Start focusing <ArrowUpRight size={17} /></Button></div><div className="hero-visual" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="hero-center"><Focus size={58} strokeWidth={1.1} /></div></div></section>
          <div className="stats-grid"><Stat icon={<Check size={18} />} label="TASKS DONE" value={`${completedToday.length}`} note={`${activeTasks.length} still in progress`} /><Stat icon={<Clock3 size={18} />} label="FOCUS TIME" value={minutesLabel(todaySeconds)} note="Put in the work today" /><Stat icon={<Flame size={18} />} label="HABITS CHECKED" value={`${checkedHabits}/${data.habits.length}`} note="Keep the rhythm going" /></div>
          <div className="section-grid"><section className="panel"><PanelHeader kicker="THE PLAN" title="Your tasks" action="Add task" onAction={() => openModal("task")} />{data.tasks.length === 0 ? <Empty icon={<Target size={24} />} title="No tasks yet" description="Add your first task and give today a direction." action="Add a task" onAction={() => openModal("task")} /> : <div className="item-list">{[...activeTasks, ...completedToday].map(task => <div className={`list-item ${task.completedAt ? "is-done" : ""}`} key={task.id}><button className="check-button" aria-label={task.completedAt ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} onClick={() => toggleTask(task.id)}>{task.completedAt ? <Check size={15} /> : null}</button><div className="item-main"><div className="item-title">{task.title}</div><div className="item-meta">{data.goals.find(goal => goal.id === task.goalId)?.title ?? "Personal"}{task.completedAt ? " · Done today" : task.plannedDate !== today ? " · Carried over" : ""}</div></div><button className="icon-button" aria-label={`Delete ${task.title}`} onClick={() => deleteTask(task.id)}><Trash2 size={15} /></button></div>)}</div>}</section>
          <section className="panel"><PanelHeader kicker="YOUR ROUTINE" title="Daily habits" action="Add habit" onAction={() => openModal("habit")} />{data.habits.length === 0 ? <Empty icon={<Flame size={24} />} title="Start a streak" description="Small actions done daily add up." action="Add a habit" onAction={() => openModal("habit")} /> : <div className="item-list">{data.habits.map(habit => { const done = habit.completedDates.includes(today); const streak = habitStreak(habit.completedDates, today); return <div className="list-item" key={habit.id}><button className={`check-button ${done ? "checked" : ""}`} aria-label={done ? `Uncheck ${habit.title}` : `Check ${habit.title}`} onClick={() => toggleHabit(habit.id)}>{done ? <Check size={15} /> : null}</button><div className="item-main"><div className="item-title">{habit.title}</div><div className="item-meta">{streak > 0 ? `${streak} day streak` : "Ready when you are"}</div></div><button className="icon-button" aria-label={`Delete ${habit.title}`} onClick={() => deleteHabit(habit.id)}><Trash2 size={15} /></button></div>; })}</div>}</section></div>
          <section className="panel goals-panel"><PanelHeader kicker="THE BIG PICTURE" title="Your goals" action="Add goal" onAction={() => openModal("goal")} />{data.goals.length === 0 ? <Empty icon={<Target size={24} />} title="Aim at something" description="Create a goal to connect your daily tasks to a bigger outcome." action="Add a goal" onAction={() => openModal("goal")} /> : <div className="goals-grid">{data.goals.map((goal, index) => { const tasks = data.tasks.filter(task => task.goalId === goal.id); const completed = tasks.filter(task => task.completedAt).length; return <Card className="goal-card" key={goal.id}><CardContent className="goal-content"><div className={`goal-icon goal-icon-${index % 3}`}><Target size={20} /></div><button className="icon-button goal-delete" aria-label={`Delete ${goal.title}`} onClick={() => deleteGoal(goal.id)}><Trash2 size={15} /></button><h3>{goal.title}</h3><div className="goal-meta">{completed} of {tasks.length} tasks completed</div><Progress value={tasks.length ? completed / tasks.length * 100 : 0} className="goal-progress" /></CardContent></Card>; })}</div>}</section>
        </>}

        {view === "focus" && <section className="focus-page"><div className="eyebrow"><span className="eyebrow-line" /> DEEP WORK MODE</div><h1>Time to <em>lock in.</em></h1><p className="page-subtitle">One task. One session. Give it your full attention.</p><div className="focus-layout"><div className="timer-card"><div className="timer-top"><span><span className="live-dot" /> {focus ? focus.endAt ? "SESSION IN PROGRESS" : "SESSION PAUSED" : "READY WHEN YOU ARE"}</span><Focus size={20} /></div><div className="timer-ring" style={{ "--timer-progress": `${focus ? (1 - remaining / (focus.durationMinutes * 60)) * 100 : 0}%` } as React.CSSProperties}><div className="timer-inner"><div className="timer-caption">{focus ? "TIME REMAINING" : "FOCUS SESSION"}</div><div className="timer-numbers" role="timer" aria-label={`${formatTime(remaining)} remaining`}>{formatTime(remaining)}</div><div className="timer-description">{focus ? data.tasks.find(task => task.id === focus.taskId)?.title ?? "Your time is yours" : `${duration} minute session`}</div></div></div><div className="timer-controls">{!focus ? <Button className="primary-action" onClick={startFocus}><Play size={17} fill="currentColor" /> Start session</Button> : <><Button className="primary-action" onClick={focus.endAt ? pauseFocus : resumeFocus}>{focus.endAt ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}{focus.endAt ? "Pause" : "Resume"}</Button><Button variant="outline" className="secondary-action" onClick={finishFocus}><Check size={17} /> Finish</Button><button className="discard-button" onClick={discardFocus}>Discard session</button></>}</div></div><div className="focus-side"><div className="side-card"><div className="side-card-icon"><Target size={20} /></div><h3>What are you working on?</h3><p>Choose a task to connect this session to your progress.</p><select aria-label="Focus task" value={focus?.taskId ?? selectedTask} disabled={!!focus} onChange={event => setSelectedTask(event.target.value)}><option value="">Just focusing</option>{activeTasks.map(task => <option value={task.id} key={task.id}>{task.title}</option>)}</select></div><div className="side-card"><div className="side-card-icon amber"><Clock3 size={20} /></div><h3>Set your session</h3><p>Choose the amount of time you want to commit.</p><div className="duration-grid">{[15, 25, 45, 60].map(value => <button key={value} className={duration === value ? "selected" : ""} disabled={!!focus} onClick={() => setDuration(value)}>{value}m</button>)}</div></div><div className="focus-quote">“The secret of getting ahead is getting started.”<span>— Mark Twain</span></div></div></div></section>}

        {view === "progress" && <section className="progress-page"><div className="eyebrow"><span className="eyebrow-line" /> YOUR MOMENTUM</div><h1>See how far <em>you’ve come.</em></h1><p className="page-subtitle">Every focused minute and small win moves you forward.</p><div className="stats-grid progress-stats"><Stat icon={<Clock3 size={18} />} label="THIS WEEK" value={minutesLabel(weekSeconds)} note="Total focus time" /><Stat icon={<Target size={18} />} label="ALL-TIME SESSIONS" value={`${data.sessions.length}`} note="Times you showed up" /><Stat icon={<Check size={18} />} label="TODAY'S PROGRESS" value={`${completion}%`} note={`${doneItems} of ${totalItems} items done`} /></div><div className="section-grid progress-grid"><section className="panel chart-panel"><PanelHeader kicker="LAST 7 DAYS" title="Focus activity" /><div className="chart">{week.map(day => <div className="chart-column" key={day.key}><div className="chart-value">{day.seconds ? minutesLabel(day.seconds) : ""}</div><div className="chart-bar-area"><div className={`chart-bar ${day.today ? "today" : ""}`} style={{ height: `${Math.max(3, day.seconds / maxWeek * 100)}%` }} /></div><div className={`chart-label ${day.today ? "today" : ""}`}>{day.label}</div></div>)}</div></section><section className="panel summary-panel"><PanelHeader kicker="KEEP IT GOING" title="Today’s snapshot" /><div className="summary-row"><span>Tasks completed</span><strong>{completedToday.length}</strong></div><div className="summary-row"><span>Habits checked</span><strong>{checkedHabits} / {data.habits.length}</strong></div><div className="summary-row"><span>Focus sessions</span><strong>{todaySessions.length}</strong></div><div className="summary-row"><span>Focus time</span><strong>{minutesLabel(todaySeconds)}</strong></div><div className="snapshot-progress"><div><span>Daily completion</span><strong>{completion}%</strong></div><Progress value={completion} /></div></section></div><section className="panel sessions-panel"><PanelHeader kicker="YOUR WORK" title="Recent sessions" />{data.sessions.length === 0 ? <Empty icon={<Clock3 size={24} />} title="Your first session starts here" description="Start a focus session to see your work add up." action="Start focusing" onAction={() => setView("focus")} /> : <div className="item-list">{[...data.sessions].reverse().slice(0, 8).map(session => <div className="list-item" key={session.id}><div className="session-icon"><Focus size={16} /></div><div className="item-main"><div className="item-title">{data.tasks.find(task => task.id === session.taskId)?.title ?? "Focus session"}</div><div className="item-meta">{new Date(session.finishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div></div><strong className="session-duration">{minutesLabel(session.durationSeconds)}</strong></div>)}</div>}</section></section>}
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation"><button className={view === "today" ? "active" : ""} onClick={() => setView("today")}><LayoutDashboard size={20} /><span>Today</span></button><button className={view === "focus" ? "active" : ""} onClick={() => setView("focus")}><Focus size={20} /><span>Focus</span></button><button className={view === "progress" ? "active" : ""} onClick={() => setView("progress")}><TrendingUp size={20} /><span>Progress</span></button></nav>
    </main>

    <Dialog open={modal !== null} onOpenChange={open => { if (!open) setModal(null); }}><DialogContent className="add-dialog"><DialogHeader><DialogTitle>Add {modal}</DialogTitle><DialogDescription>{modal === "goal" ? "Set a direction for the work ahead." : modal === "habit" ? "Choose a small action to repeat each day." : "Write down what you want to get done."}</DialogDescription></DialogHeader><form onSubmit={addItem} className="add-form"><label htmlFor="item-title">{modal === "goal" ? "Goal name" : modal === "habit" ? "Habit name" : "Task name"}</label><Input id="item-title" autoFocus maxLength={100} value={draft} onChange={event => setDraft(event.target.value)} placeholder={modal === "goal" ? "e.g. Build my portfolio" : modal === "habit" ? "e.g. Read for 20 minutes" : "e.g. Draft the homepage"} />{modal === "task" && <><label htmlFor="goal-select">Goal (optional)</label><select id="goal-select" value={draftGoal} onChange={event => setDraftGoal(event.target.value)}><option value="">Personal</option>{data.goals.map(goal => <option value={goal.id} key={goal.id}>{goal.title}</option>)}</select></>}<Button type="submit" className="primary-action" disabled={!draft.trim()}>Add {modal}</Button></form></DialogContent></Dialog>
  </div>;
}

function Stat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) { return <div className="stat-card"><div className="stat-top"><div className="stat-icon">{icon}</div><ArrowUpRight size={16} /></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>; }
function PanelHeader({ kicker, title, action, onAction }: { kicker: string; title: string; action?: string; onAction?: () => void }) { return <div className="panel-header"><div><div className="panel-kicker">{kicker}</div><h2>{title}</h2></div>{action && <Button variant="outline" size="sm" onClick={onAction}><Plus size={15} /> {action}</Button>}</div>; }
function Empty({ icon, title, description, action, onAction }: { icon: React.ReactNode; title: string; description: string; action: string; onAction: () => void }) { return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p><button onClick={onAction}>{action} <Plus size={15} /></button></div>; }
