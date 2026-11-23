import { useEffect, useRef, useState } from 'react'
import { PageHeader, Avatar, Button, Input } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { formatDateTime } from '../../lib/utils'
import { Send } from 'lucide-react'

export function TrainerMessages() {
  const { user } = useAuth()
  const { trainers, members, users, messages, sendMessage, markMessagesRead } = useApp()
  const me = trainers.find((t) => t.userId === user?.id)
  const mine = members.filter((m) => m.trainerId === me?.id)
  const [to, setTo] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const selected = mine.find((m) => m.id === to)
  const otherUser = selected ? users.find((u) => u.id === selected.userId) : null
  const thread = selected
    ? messages
        .filter((msg) =>
          (msg.fromId === user?.id && msg.toId === selected.userId) ||
          (msg.toId === user?.id && msg.fromId === selected.userId))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : []

  useEffect(() => {
    if (selected && user) {
      const unread = thread.filter((m) => m.toId === user.id && !m.read).map((m) => m.id)
      if (unread.length) markMessagesRead(unread)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [thread.length])

  const send = () => {
    const body = draft.trim()
    if (!body || !selected || !user) return
    sendMessage({ fromId: user.id, toId: selected.userId, body })
    setDraft('')
  }

  const nameOf = (mid: string) => users.find((u) => u.id === members.find((m) => m.id === mid)?.userId)?.name ?? 'Member'

  return (
    <div>
      <PageHeader eyebrow="Coach" title="Messages" desc="Keep in touch with your members." />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="card p-2">
          <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-mist">Members</p>
          <ul className="space-y-0.5">
            {mine.map((m) => {
              const u = users.find((x) => x.id === m.userId)
              const unread = messages.some((msg) => msg.fromId === m.userId && msg.toId === user?.id && !msg.read)
              return (
                <li key={m.id}>
                  <button
                    onClick={() => setTo(m.id)}
                    className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-white/5 ${selected?.id === m.id ? 'bg-lime/10' : ''}`}
                  >
                    <Avatar src={u?.avatar} name={u?.name ?? '?'} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{u?.name}</span>
                    {unread && <span className="size-2 shrink-0 rounded-full bg-ember" />}
                  </button>
                </li>
              )
            })}
            {!mine.length && <p className="p-2 text-sm text-mist">No members assigned.</p>}
          </ul>
        </div>

        <div className="card flex min-h-[420px] flex-col">
          {selected && otherUser ? (
            <>
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <Avatar src={otherUser.avatar} name={otherUser.name} size="sm" />
                <p className="font-semibold">{otherUser.name}</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread.map((msg) => {
                  const mineMsg = msg.fromId === user?.id
                  return (
                    <div key={msg.id} className={`flex ${mineMsg ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mineMsg ? 'bg-lime text-lime-ink' : 'bg-white/5'}`}>
                        <p>{msg.body}</p>
                        <p className={`mt-0.5 text-[10px] ${mineMsg ? 'text-lime-ink/60' : 'text-mist'}`}>{formatDateTime(msg.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>
              <div className="flex gap-2 border-t border-line p-3">
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Write a message…" />
                <Button onClick={send}><Send className="size-4" /> Send</Button>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center text-sm text-mist">
              Select a member to open the conversation.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
