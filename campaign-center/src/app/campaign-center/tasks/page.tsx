'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import { formatDate, formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import {
  Plus, Sparkles, Calendar, User, Flag, CheckCircle2, Circle,
  Clock, MoreHorizontal, ChevronDown, Trash2, MessageSquare
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

const STATUS_COLUMNS: Array<{ status: TaskStatus; label: string; color: string }> = [
  { status: 'todo', label: 'To Do', color: 'text-muted-foreground' },
  { status: 'in_progress', label: 'In Progress', color: 'text-blue-400' },
  { status: 'review', label: 'In Review', color: 'text-yellow-400' },
  { status: 'done', label: 'Done', color: 'text-emerald-400' },
]

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-400', dot: 'bg-red-400' },
  high: { label: 'High', color: 'text-orange-400', dot: 'bg-orange-400' },
  medium: { label: 'Medium', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  low: { label: 'Low', color: 'text-blue-400', dot: 'bg-blue-400' },
}

export default function TasksPage() {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [showNewTask, setShowNewTask] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const supabase = createClient()
  const { user, profile } = useAuth()
  const qc = useQueryClient()

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          client:clients(id, name, logo_url),
          assignee:profiles!assigned_to(id, full_name, avatar_url)
        `)
        .not('status', 'eq', 'cancelled')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as Task[]
    },
    refetchInterval: 30 * 1000,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const { error } = await supabase
        .from('tasks')
        .update({
          status,
          completed_at: status === 'done' ? new Date().toISOString() : null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: () => toast.error('Failed to update task'),
  })

  const generateAITasks = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'generate_tasks' }),
      })
      if (!res.ok) throw new Error('Failed to generate tasks')
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`Generated ${data.tasks?.length || 0} AI tasks`)
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: () => toast.error('Failed to generate AI tasks'),
  })

  const tasksByStatus = STATUS_COLUMNS.reduce<Record<TaskStatus, Task[]>>((acc, col) => {
    acc[col.status] = tasks.filter(t => t.status === col.status)
    return acc
  }, {} as Record<TaskStatus, Task[]>)

  const overdueTasks = tasks.filter(t =>
    t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
  )

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Task Management" subtitle={`${tasks.length} tasks`}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 p-1 rounded-lg bg-surface">
            <button onClick={() => setView('board')} className={cn('text-xs px-3 py-1.5 rounded-md transition-all font-medium', view === 'board' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              Board
            </button>
            <button onClick={() => setView('list')} className={cn('text-xs px-3 py-1.5 rounded-md transition-all font-medium', view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              List
            </button>
          </div>
        </div>
      </TopBar>

      <div className="flex-1 overflow-auto p-6">
        {/* Action bar */}
        <div className="flex items-center gap-3 mb-6">
          {overdueTasks.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <Clock className="w-4 h-4" />
              <span>{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}</span>
            </div>
          )}

          <button
            onClick={() => generateAITasks.mutate()}
            disabled={generateAITasks.isPending}
            className="btn-secondary gap-2 text-sm"
          >
            <Sparkles className="w-4 h-4 text-brand-400" />
            {generateAITasks.isPending ? 'Generating...' : 'AI Generate Tasks'}
          </button>

          <button
            onClick={() => setShowNewTask(true)}
            className="btn-primary gap-2 text-sm ml-auto"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>

        {/* Board View */}
        {view === 'board' ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUS_COLUMNS.map(col => (
              <div key={col.status} className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={cn('text-sm font-semibold', col.color)}>{col.label}</span>
                  <span className="text-xs text-muted-foreground bg-surface px-1.5 py-0.5 rounded-full">
                    {tasksByStatus[col.status]?.length || 0}
                  </span>
                </div>

                <div className="space-y-2">
                  {(tasksByStatus[col.status] || []).map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={(status) => updateStatus.mutate({ id: task.id, status })}
                      onClick={() => setSelectedTask(task)}
                    />
                  ))}

                  {col.status === 'todo' && (
                    <button
                      onClick={() => setShowNewTask(true)}
                      className="w-full text-left p-3 rounded-lg border border-dashed border-border text-muted-foreground text-xs hover:border-brand-600/40 hover:text-foreground transition-all flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add task
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left px-4 py-3 w-8"></th>
                  <th className="text-left px-4 py-3">Task</th>
                  <th className="text-left px-4 py-3">Priority</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Assignee</th>
                  <th className="text-left px-4 py-3">Due Date</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.map(task => (
                  <tr key={task.id} className="hover:bg-surface/50 transition-colors group cursor-pointer" onClick={() => setSelectedTask(task)}>
                    <td className="px-4 py-3">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          updateStatus.mutate({ id: task.id, status: task.status === 'done' ? 'todo' : 'done' })
                        }}
                        className="text-muted-foreground hover:text-emerald-400 transition-colors"
                      >
                        {task.status === 'done'
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          : <Circle className="w-4 h-4" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className={cn('text-sm font-medium', task.status === 'done' && 'line-through text-muted-foreground')}>
                          {task.title}
                        </p>
                        {task.is_ai_generated && (
                          <span className="text-[10px] text-brand-400 flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> AI generated
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-4 py-3">
                      {task.client && (
                        <span className="text-xs text-muted-foreground">{task.client.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {task.assignee && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-brand-gradient flex items-center justify-center text-white text-[10px] font-bold">
                            {task.assignee.full_name.charAt(0)}
                          </div>
                          <span className="text-xs">{task.assignee.full_name.split(' ')[0]}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {task.due_date && (
                        <span className={cn(
                          'text-xs',
                          new Date(task.due_date) < new Date() && task.status !== 'done'
                            ? 'text-red-400 font-medium'
                            : 'text-muted-foreground'
                        )}>
                          {formatDate(task.due_date)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={task.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Task Modal */}
      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['tasks'] })
            setShowNewTask(false)
          }}
        />
      )}

      {/* Task Detail */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => qc.invalidateQueries({ queryKey: ['tasks'] })}
        />
      )}
    </div>
  )
}

function TaskCard({ task, onStatusChange, onClick }: {
  task: Task
  onStatusChange: (status: TaskStatus) => void
  onClick: () => void
}) {
  const pConfig = PRIORITY_CONFIG[task.priority]
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

  return (
    <div
      onClick={onClick}
      className={cn(
        'card p-3 cursor-pointer card-hover group',
        isOverdue && 'border-red-500/20'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium leading-snug flex-1">{task.title}</p>
        <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', pConfig.dot)} title={pConfig.label} />
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
        {task.client && <span className="truncate flex-1">{task.client.name}</span>}

        {task.due_date && (
          <span className={cn('flex items-center gap-1 flex-shrink-0', isOverdue && 'text-red-400')}>
            <Calendar className="w-3 h-3" />
            {formatDate(task.due_date)}
          </span>
        )}

        {task.assignee && (
          <div className="w-5 h-5 rounded-full bg-brand-gradient flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {task.assignee.full_name.charAt(0)}
          </div>
        )}

        {task.is_ai_generated && <Sparkles className="w-3 h-3 text-brand-400 flex-shrink-0" />}
      </div>
    </div>
  )
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = PRIORITY_CONFIG[priority]
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      <span className={cn('text-xs', config.color)}>{config.label}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const statusConfig = STATUS_COLUMNS.find(s => s.status === status)
  return <span className={cn('text-xs font-medium', statusConfig?.color)}>{statusConfig?.label || status}</span>
}

function NewTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const { user } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !user) return
    setLoading(true)
    try {
      await supabase.from('tasks').insert({
        title: title.trim(),
        description: description || null,
        priority,
        due_date: dueDate || null,
        created_by: user.id,
      })
      onCreated()
      toast.success('Task created')
    } catch {
      toast.error('Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="card w-full max-w-md animate-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-semibold">New Task</h2>
          <button onClick={onClose} className="btn-ghost p-2">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title *</label>
            <input
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Task title..."
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Priority</label>
              <select
                className="input cursor-pointer"
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Due Date</label>
              <input
                type="date"
                className="input cursor-pointer"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading || !title.trim()} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TaskDetailModal({ task, onClose, onUpdate }: { task: Task; onClose: () => void; onUpdate: () => void }) {
  const [comment, setComment] = useState('')
  const supabase = createClient()
  const { user } = useAuth()

  const addComment = async () => {
    if (!comment.trim() || !user) return
    await supabase.from('task_comments').insert({
      task_id: task.id,
      user_id: user.id,
      content: comment.trim(),
    })
    setComment('')
    onUpdate()
    toast.success('Comment added')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in">
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2 mb-1">
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
              {task.is_ai_generated && (
                <span className="text-[10px] text-brand-400 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> AI
                </span>
              )}
            </div>
            <h2 className="font-semibold">{task.title}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 flex-shrink-0">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {task.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {task.due_date && (
              <div className="bg-surface rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                <p className={cn('font-medium', new Date(task.due_date) < new Date() && task.status !== 'done' ? 'text-red-400' : '')}>
                  {formatDate(task.due_date)}
                </p>
              </div>
            )}
            {task.client && (
              <div className="bg-surface rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Client</p>
                <p className="font-medium">{task.client.name}</p>
              </div>
            )}
          </div>

          {/* Comment input */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Add Comment</p>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Write a comment..."
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }}
              />
              <button onClick={addComment} disabled={!comment.trim()} className="btn-primary px-3">
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Created {formatRelativeTime(task.created_at)}</p>
        </div>
      </div>
    </div>
  )
}
