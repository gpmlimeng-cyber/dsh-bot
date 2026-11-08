// Group task board: tasks live on the room (room.tasks), the same JSON every other
// group field is saved in. Six states, light dependencies with cycle detection, an
// attempt id that voids a previous assignee's late writes, a revision for optimistic
// concurrency, and an optional quality gate for review/requirements tasks.
//
// The board itself is a record: it never wakes anyone. The relay reads `readyTasks`
// before a group round so the admin can @ whoever should pick work up (spec §7).
import { randomUUID } from 'node:crypto'

const TITLE_MAX = 200
const NOTE_MAX = 2000
const COMMENT_MAX = 2000
const EVENTS_MAX = 100
const OPEN_MAX = 200
const ARCHIVE_MAX = 500
const KINDS = new Set(['work', 'requirements', 'implementation', 'verification', 'review', 'repair', 'integration'])
const STATUSES = new Set(['pending', 'claimed', 'doing', 'done', 'failed', 'cancelled'])
const TERMINAL = new Set(['done', 'failed', 'cancelled'])
const GATE_KINDS = new Set(['requirements', 'implementation', 'verification'])

// 行 = 当前，列 = 目标（spec §3）。`pending` 列只给 reopen 用。
const TRANSITIONS = {
  pending: new Set(['claimed', 'doing', 'cancelled']),
  claimed: new Set(['pending', 'doing', 'cancelled']),
  doing: new Set(['done', 'failed', 'cancelled']),
  done: new Set(['pending']),
  failed: new Set(['pending']),
  cancelled: new Set(['pending']),
}

const bad = (code, message, data) => Object.assign(new Error(message), { code, ...(data === undefined ? {} : { data }) })
const taskId = () => `t_${randomUUID().replace(/-/g, '').slice(0, 10)}`
const attemptId = () => `a_${randomUUID().replace(/-/g, '').slice(0, 10)}`

const textOf = value => (typeof value === 'string' ? value.trim() : '')

function roomTasks(room) {
  if (room.tasks === undefined) room.tasks = []
  return room.tasks
}

function findTask(room, id) {
  const task = roomTasks(room).find(entry => entry.id === id)
  if (task === undefined) throw bad('task/not-found', `这条任务不在「${room.name}」里`, { id })
  return task
}

const isDone = (room, id) => roomTasks(room).find(task => task.id === id)?.status === 'done'

// 依赖全完成？返回第一个未完成的前置（消息里写「等 N 号」）。
function firstBlocking(room, task) {
  for (const depId of task.deps ?? []) {
    if (!isDone(room, depId)) return roomTasks(room).find(entry => entry.id === depId) ?? { id: depId, no: null }
  }
  return undefined
}

function checkDeps(room, task, deps) {
  const seen = new Set()
  for (const depId of deps) {
    if (typeof depId !== 'string' || depId === '') throw bad('task/deps', '依赖必须是任务 id', { depId })
    if (depId === task?.id) throw bad('task/deps', '一条任务不能依赖自己', { depId })
    if (seen.has(depId)) continue
    seen.add(depId)
    if (!roomTasks(room).some(entry => entry.id === depId)) throw bad('task/deps', `依赖的任务 ${depId} 不在这个群里`, { depId })
  }
  // 从每个前置出发沿 deps 走：能走回自己就是环；visited 让脏数据也不会转圈。
  if (task !== undefined) {
    const visited = new Set()
    const reaches = (id) => {
      if (id === task.id) return true
      if (visited.has(id)) return false
      visited.add(id)
      const entry = roomTasks(room).find(item => item.id === id)
      return (entry?.deps ?? []).some(next => reaches(next))
    }
    for (const depId of seen) if (reaches(depId)) throw bad('task/cycle', '这些依赖绕成了一个环', { depId })
  }
  return [...seen]
}

function touch(room, task, event, now = Date.now()) {
  room.tasksVersion = (room.tasksVersion ?? 0) + 1
  if (task === undefined) return now
  task.rev = (task.rev ?? 1) + 1
  task.updatedAt = now
  if (event !== undefined) {
    task.events = [...(task.events ?? []), { at: now, ...event }].slice(-EVENTS_MAX)
  }
  return now
}

function prune(room) {
  const tasks = roomTasks(room)
  const archived = tasks.filter(task => TERMINAL.has(task.status))
  if (archived.length <= ARCHIVE_MAX) return
  const drop = new Set(archived.slice(0, archived.length - ARCHIVE_MAX).map(task => task.id))
  room.tasks = tasks.filter(task => !drop.has(task.id))
}

function taskJson(task) {
  return {
    id: task.id,
    roomId: task.roomId,
    no: task.no,
    title: task.title,
    note: task.note ?? '',
    status: task.status,
    assignee: task.assignee ?? null,
    createdBy: task.createdBy ?? 'user',
    attempt: task.attempt ?? 1,
    attemptId: task.attemptId,
    rev: task.rev ?? 1,
    deps: [...(task.deps ?? [])],
    kind: task.kind ?? 'work',
    gate: task.gate === true,
    source: task.source ?? 'manual',
    goalStage: task.goalStage ?? null,
    order: task.order ?? 0,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    doneAt: task.doneAt ?? null,
  }
}

function countsOf(tasks) {
  const counts = { pending: 0, claimed: 0, doing: 0, done: 0, failed: 0, cancelled: 0 }
  for (const task of tasks) counts[task.status] = (counts[task.status] ?? 0) + 1
  return counts
}

// 目标推进时，阶段里的活同步进同一张清单（spec §1/§11-9）。读时按需同步，幂等：
// 每个阶段任务一个稳定 key，状态跟着阶段走，被 revise 去掉的置为已取消；只读由 update 挡。
function syncGoal(room, now = Date.now()) {
  const goal = room.goal
  if (goal === undefined || !Array.isArray(goal.stages) || goal.stages.length === 0) return false
  const tasks = roomTasks(room)
  const wanted = new Set()
  let changed = false
  let previous = []
  goal.stages.forEach((stage, index) => {
    const stageIds = []
    for (const item of stage.tasks ?? []) {
      const key = `goal:${goal.id}:${stage.id}:${item.botId}`
      wanted.add(key)
      let task = tasks.find(entry => entry.goalKey === key)
      if (task === undefined) {
        task = {
          id: taskId(), roomId: room.id, no: (room.tasksSeq ?? 0) + 1,
          title: String(item.task ?? '').slice(0, TITLE_MAX), note: '',
          status: 'pending', assignee: item.botId ?? null, createdBy: 'goal',
          attempt: 1, attemptId: attemptId(), rev: 1,
          deps: [...previous], kind: 'work', gate: false,
          source: 'goal', goalStage: index + 1, order: index * 100,
          createdAt: now, updatedAt: now, doneAt: null, goalKey: key,
          events: [{ at: now, by: 'goal', kind: 'created', from: null, to: 'pending', text: `目标第 ${index + 1} 段` }],
        }
        room.tasksSeq = task.no
        tasks.push(task)
        changed = true
      } else if (JSON.stringify(task.deps ?? []) !== JSON.stringify(previous)) {
        task.deps = [...previous]
        task.rev += 1
        task.updatedAt = now
        changed = true
      }
      const target = goal.status === 'completed' || stage.status === 'passed' ? 'done'
        : goal.status === 'cancelled' ? 'cancelled'
          : item.status === 'done' ? 'done'
            : item.status === 'working' ? 'doing' : 'pending'
      if (task.status !== target) {
        task.status = target
        task.doneAt = TERMINAL.has(target) ? now : null
        task.rev += 1
        task.updatedAt = now
        changed = true
      }
      stageIds.push(task.id)
    }
    previous = stageIds
  })
  for (const task of tasks) {
    if (task.source === 'goal' && !wanted.has(task.goalKey) && task.status !== 'cancelled') {
      task.status = 'cancelled'
      task.doneAt = now
      task.rev += 1
      task.updatedAt = now
      changed = true
    }
  }
  return changed
}

export function install(rt) {
  const tasksOf = (roomId) => {
    const room = rt.roomOf(typeof roomId === 'string' ? roomId : '')
    if (room === undefined) throw bad('bot/not-found', 'Unknown group chat')
    return { room, tasks: roomTasks(room) }
  }

  const readyIds = (room) => roomTasks(room)
    .filter(task => task.status === 'pending' && (task.deps ?? []).every(depId => isDone(room, depId)))
    .map(task => task.id)

  async function view(roomId) {
    const { room, tasks } = tasksOf(roomId)
    if (syncGoal(room)) {
      room.tasksVersion = (room.tasksVersion ?? 0) + 1
      await rt.save()
    }
    const sorted = [...tasks].sort((a, b) => a.no - b.no)
    return {
      roomId: room.id,
      version: room.tasksVersion ?? 0,
      tasks: sorted.map(taskJson),
      ready: readyIds(room),
      counts: countsOf(tasks),
    }
  }

  function events(roomId, id) {
    const { room } = tasksOf(roomId)
    const task = findTask(room, id)
    return { events: [...(task.events ?? [])] }
  }

  async function add(roomId, body) {
    const { room, tasks } = tasksOf(roomId)
    const title = textOf(body.title)
    if (title === '') throw bad('task/invalid', '标题不能为空')
    if (title.length > TITLE_MAX) throw bad('task/invalid', `标题最多 ${TITLE_MAX} 字`, { limit: TITLE_MAX })
    const note = body.note === undefined ? '' : textOf(body.note)
    if (note.length > NOTE_MAX) throw bad('task/invalid', `备注最多 ${NOTE_MAX} 字`, { limit: NOTE_MAX })
    const assignee = body.assignee === undefined || body.assignee === null || body.assignee === '' ? null : String(body.assignee)
    if (assignee !== null && !room.members.includes(assignee)) throw bad('task/invalid', '负责人不是这个群的成员', { assignee })
    const kind = body.kind === undefined ? 'work' : String(body.kind)
    if (!KINDS.has(kind)) throw bad('task/invalid', `未知任务类型 ${kind}`, { kind })
    const gate = body.gate === true
    const by = typeof body.by === 'string' && body.by !== '' ? body.by : 'user'
    const deps = Array.isArray(body.deps) ? checkDeps(room, undefined, body.deps) : []
    const now = Date.now()
    const task = {
      id: taskId(),
      roomId: room.id,
      no: (room.tasksSeq ?? 0) + 1,
      title,
      note,
      status: 'pending',
      assignee,
      createdBy: by,
      attempt: 1,
      attemptId: attemptId(),
      rev: 1,
      deps,
      kind,
      gate,
      source: 'manual',
      goalStage: null,
      order: Number.isFinite(body.order) ? body.order : 0,
      createdAt: now,
      updatedAt: now,
      doneAt: null,
      events: [{ at: now, by, kind: 'created', from: null, to: 'pending', text: title }],
    }
    const open = tasks.filter(entry => !TERMINAL.has(entry.status)).length
    if (open >= OPEN_MAX) throw bad('task/limit', `「${room.name}」未完成的任务最多 ${OPEN_MAX} 条，先完成或取消一些`, { limit: OPEN_MAX })
    room.tasksSeq = task.no
    tasks.push(task)
    prune(room)
    touch(room, undefined)
    await rt.save()
    return { task: taskJson(task) }
  }

  async function update(roomId, body) {
    const { room } = tasksOf(roomId)
    const task = findTask(room, String(body.id ?? ''))
    const by = typeof body.by === 'string' && body.by !== '' ? body.by : 'user'
    if (body.rev !== task.rev) throw bad('task/conflict', '别人先改过这条任务了，重新拉一次再提交', { rev: task.rev })
    if (body.attemptId !== task.attemptId) throw bad('task/stale', '这条任务已经改派，旧负责人的结果作废', { attemptId: task.attemptId })

    const goalOwned = task.source === 'goal'
    const wantsStatus = body.status !== undefined && body.status !== task.status
    const wantsAssignee = body.assignee !== undefined && (body.assignee ?? null) !== (task.assignee ?? null)
    const metaKeys = ['title', 'note', 'deps', 'kind', 'gate'].filter(key => body[key] !== undefined)
    const metaChanged = metaKeys.some((key) => {
      if (key === 'deps') return JSON.stringify(body.deps ?? []) !== JSON.stringify(task.deps ?? [])
      if (key === 'gate') return (body.gate === true) !== (task.gate === true)
      if (key === 'title' || key === 'note') return textOf(body[key]) !== (task[key] ?? '')
      return body[key] !== task[key]
    })
    if ([wantsStatus, wantsAssignee, metaChanged].filter(Boolean).length > 1) {
      throw bad('task/invalid', '一次只能改一类：状态、负责人、或标题/备注/依赖')
    }
    if (!wantsStatus && !wantsAssignee && !metaChanged) throw bad('task/invalid', '没有要改的字段')

    if (goalOwned && (wantsStatus || wantsAssignee)) throw bad('task/readonly', '目标带来的任务只能跟着目标推进')
    if (goalOwned && metaKeys.some(key => key !== 'note')) throw bad('task/readonly', '目标带来的任务只能加备注')
    const now = Date.now()

    if (wantsStatus) {
      const to = String(body.status)
      if (!STATUSES.has(to)) throw bad('task/invalid', `未知状态 ${to}`, { status: to })
      if (!TRANSITIONS[task.status]?.has(to)) throw bad('task/transition', `不能从 ${task.status} 变成 ${to}`, { from: task.status, to })
      // 依赖与占用只在真正要开工时校验。
      if (to === 'claimed' || to === 'doing') {
        if (task.assignee == null) throw bad('task/forbidden', '先指派给一个成员，再领任务')
        if (typeof body.by === 'string' && body.by !== '' && body.by !== task.assignee) throw bad('task/forbidden', '只有负责人本人能领这条任务')
        const blocked = firstBlocking(room, task)
        if (blocked !== undefined) throw bad('task/blocked', `还在等 ${blocked.no ?? blocked.id} 号任务完成`, { depId: blocked.id, no: blocked.no })
        const busy = roomTasks(room).find(entry => entry.id !== task.id && entry.assignee === task.assignee && (entry.status === 'claimed' || entry.status === 'doing'))
        if (busy !== undefined) throw bad('task/busy', `${rt.botOf(task.assignee)?.name ?? '该成员'} 手上已有 ${busy.no} 号任务`, { no: busy.no })
      }
      if (to === 'done' && task.gate === true) {
        if (task.kind === 'review') {
          if (body.verdict !== 'pass' && body.verdict !== 'needs_revision') throw bad('task/gate', '评审门需要 verdict：pass 或 needs_revision')
        } else if (GATE_KINDS.has(task.kind) && textOf(body.acceptance) === '') {
          throw bad('task/gate', '质量门要求写明验收：做了什么、怎么验的')
        }
      }
      const from = task.status
      if (to === 'done' && task.gate === true && task.kind === 'review' && body.verdict === 'needs_revision') {
        // 评审打回：这条失败，同时挂一条不依赖它的返工任务，否则永远解锁不了。
        task.status = 'failed'
        task.doneAt = now
        task.events = [...(task.events ?? []), { at: now, by, kind: 'gate', from, to: 'failed', text: textOf(body.acceptance) || 'needs_revision' }].slice(-EVENTS_MAX)
        const repair = {
          id: taskId(), roomId: room.id, no: (room.tasksSeq ?? 0) + 1,
          title: `返工 ${task.no} 号：${task.title}`.slice(0, TITLE_MAX),
          note: `评审未通过（${task.no} 号）。${textOf(body.acceptance)}`.slice(0, NOTE_MAX),
          status: 'pending', assignee: task.assignee ?? null, createdBy: by,
          attempt: 1, attemptId: attemptId(), rev: 1, deps: [], kind: 'repair', gate: false,
          source: 'manual', goalStage: null, order: task.order ?? 0,
          createdAt: now, updatedAt: now, doneAt: null,
          events: [{ at: now, by, kind: 'created', from: null, to: 'pending', text: `返工 ${task.no} 号` }],
        }
        room.tasksSeq = repair.no
        roomTasks(room).push(repair)
        prune(room)
        touch(room, task)
        await rt.save()
        return { task: taskJson(task) }
      }
      task.status = to
      task.doneAt = TERMINAL.has(to) ? now : null
      task.events = [...(task.events ?? []), { at: now, by, kind: 'status', from, to, text: textOf(body.acceptance) || (body.verdict ? `verdict:${body.verdict}` : '') }].slice(-EVENTS_MAX)
      touch(room, task)
      await rt.save()
      return { task: taskJson(task) }
    }

    if (wantsAssignee) {
      const next = body.assignee === null || body.assignee === '' ? null : String(body.assignee)
      if (next !== null && !room.members.includes(next)) throw bad('task/invalid', '负责人不是这个群的成员', { assignee: next })
      const from = task.assignee ?? null
      task.assignee = next
      task.attempt = (task.attempt ?? 1) + 1
      task.attemptId = attemptId()
      task.status = 'pending'
      task.doneAt = null
      task.events = [...(task.events ?? []), { at: now, by, kind: 'assignee', from, to: next, text: `attempt ${task.attempt}` }].slice(-EVENTS_MAX)
      touch(room, task)
      await rt.save()
      return { task: taskJson(task) }
    }

    // 元数据：标题 / 备注 / 依赖 / 类型 / 质量门
    if (body.title !== undefined) {
      const title = textOf(body.title)
      if (title === '') throw bad('task/invalid', '标题不能为空')
      if (title.length > TITLE_MAX) throw bad('task/invalid', `标题最多 ${TITLE_MAX} 字`, { limit: TITLE_MAX })
      task.title = title
    }
    if (body.note !== undefined) {
      const note = textOf(body.note)
      if (note.length > NOTE_MAX) throw bad('task/invalid', `备注最多 ${NOTE_MAX} 字`, { limit: NOTE_MAX })
      task.note = note
    }
    if (body.deps !== undefined) {
      task.deps = checkDeps(room, task, Array.isArray(body.deps) ? body.deps : [])
      task.events = [...(task.events ?? []), { at: now, by, kind: 'deps', from: null, to: task.deps, text: task.deps.length > 0 ? 'deps changed' : 'no deps' }].slice(-EVENTS_MAX)
    }
    if (body.kind !== undefined) {
      const kind = String(body.kind)
      if (!KINDS.has(kind)) throw bad('task/invalid', `未知任务类型 ${kind}`, { kind })
      task.kind = kind
    }
    if (body.gate !== undefined) {
      if (goalOwned) throw bad('task/invalid', '目标带来的任务不开质量门')
      task.gate = body.gate === true
    }
    touch(room, task)
    await rt.save()
    return { task: taskJson(task) }
  }

  async function comment(roomId, body) {
    const { room } = tasksOf(roomId)
    const task = findTask(room, String(body.id ?? ''))
    const text = textOf(body.text)
    if (text === '') throw bad('task/invalid', '评论不能为空')
    if (text.length > COMMENT_MAX) throw bad('task/invalid', `评论最多 ${COMMENT_MAX} 字`, { limit: COMMENT_MAX })
    const by = typeof body.by === 'string' && body.by !== '' ? body.by : 'user'
    const now = Date.now()
    const event = { at: now, by, kind: 'comment', from: null, to: null, text }
    task.events = [...(task.events ?? []), event].slice(-EVENTS_MAX)
    touch(room, task)
    await rt.save()
    return { event }
  }

  async function remove(roomId, body) {
    const { room, tasks } = tasksOf(roomId)
    const task = findTask(room, String(body.id ?? ''))
    if (body.rev !== task.rev) throw bad('task/conflict', '别人先改过这条任务了，重新拉一次再提交', { rev: task.rev })
    const by = typeof body.by === 'string' && body.by !== '' ? body.by : 'user'
    if (task.createdBy !== by) throw bad('task/forbidden', '只有创建者能删这条任务', { createdBy: task.createdBy })
    const usedBy = tasks.find(entry => entry.id !== task.id && (entry.deps ?? []).includes(task.id))
    if (usedBy !== undefined) throw bad('task/deps', `${usedBy.no} 号任务还依赖它，先改掉依赖再删`, { no: usedBy.no, id: usedBy.id })
    room.tasks = tasks.filter(entry => entry.id !== task.id)
    room.tasksVersion = (room.tasksVersion ?? 0) + 1
    await rt.save()
    return { ok: true }
  }

  // 群回合开始前给管理员看的一份话：哪些任务可开工、归谁（spec §7）。
  function readyTasks(room) {
    if (room === undefined) return []
    syncGoal(room)
    if (room.tasks === undefined || room.tasks.length === 0) return []
    return roomTasks(room)
      .filter(task => task.status === 'pending' && task.assignee != null && (task.deps ?? []).every(depId => isDone(room, depId)))
      .map(task => ({ no: task.no, id: task.id, title: task.title, assignee: task.assignee, name: rt.botOf(task.assignee)?.name ?? task.assignee }))
  }

  Object.assign(rt, { tasksView: view, taskEvents: events, taskAdd: add, taskUpdate: update, taskComment: comment, taskRemove: remove, readyTasks })
}
