'use client'; // Next.js ko batate hain ki yeh screen browser mein chalegi, kyunki login aur live updates browser se milte hain.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'; // React se screen yaad rakhne, update karne aur browser ke saath kaam karne ke tools lete hain.
import Link from 'next/link'; // Next.js ke andar pages ke beech jaldi jaane wala link lete hain.
import { io, type Socket } from 'socket.io-client'; // Server se live paighaam lene ka zariya aur us connection ka TS shape lete hain.
import { Activity, AlertTriangle, Bell, Clock3, ExternalLink, LoaderCircle, MessageSquare, RefreshCw, Send, ShieldCheck, X } from 'lucide-react'; // Screen par chhote pehchaan wale icons lete hain.
import { useAuth } from '../../../components/auth-provider'; // Login ki hui user ki jaankari lene wala app ka helper lete hain.
import { apiFetch } from '../../../lib/api-client'; // Server ko request bhejne wala shared helper lete hain.

// TS mein yeh list JS ke aam strings ko sirf ticket ke pehchane hue status tak simit karti hai.
type TicketStatus = 'FILED' | 'ASSIGNED' | 'IN_REVIEW' | 'RESOLVED' | 'ESCALATED';

// TS ka type ek ticket object ka naksha hai, jisse editor galat naam ya galat data pakad sake.
type OfficerTicket = {
  id: string; // Har ticket ka alag pehchaan code.
  title: string; // Ticket ka chhota sa naam.
  description: string; // Petitioner ne jo baat likhi.
  category: string; // Ticket kis vishay ka hai.
  priority: string; // Ticket ko kitni jaldi dekhna hai.
  status: TicketStatus; // Ticket abhi kis marhale mein hai.
  currentTier: number; // Kaunsa adhikari star abhi ticket sambhal raha hai.
  createdAt: string; // Ticket kab file hua.
  slaDueAt: string | null; // Kaam ki aakhri tareekh ya abhi koi tareekh nahi.
  isAnonymous: boolean; // Petitioner ne apna naam chhupaya hai ya nahi.
  version: number; // Ticket kitni baar badla, jisse purana update pehchana ja sake.
};

// TS ka yeh chhota naksha server se aane wale live paighaam ka sambhavit roop batata hai.
type LiveEvent = {
  ticketId?: string; // Paighaam kisi ticket ke baare mein ho to uska pehchaan code.
  status?: TicketStatus; // Paighaam mein naya status ho sakta hai.
  message?: string; // Server chahe to seedha dikhane layak sandesh bhej sakta hai.
  type?: string; // Jaise ticket-update ya SLA warning ka naam.
};

// TS mein yeh type inbox ke ek notice ka roop tay karta hai.
type InboxNotice = {
  id: string; // Notice ki apni pehchaan.
  title: string; // Notice ki ek line ka heading.
  detail: string; // Notice mein dikhne wala chhota sandesh.
  ticketId?: string; // Notice sambandhit ticket tak le ja sakta hai.
  createdAt: string; // Notice aane ka samay.
  read: boolean; // User ne notice dekha hai ya nahi.
};

// TS ka yeh type discussion mein API se aane wale ek comment ka naksha hai.
type OfficerComment = {
  id: string; // Comment ka alag pehchaan code.
  content: string; // Officer ka likha hua sandesh.
  createdAt: string; // Sandesh likhe jaane ka waqt.
  actorName?: string; // Server naam de to dikhate hain, warna role dikhayenge.
  isInternal: boolean; // Yeh baat sirf staff ke liye hai ya sab dekh sakte hain.
};

// Browser mein server ka pata alag diya ho to woh lete hain; warna local API ka pata rakhte hain.
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// TS ka Record ek seedhi dictionary hai: role naam se adhikari star dhoondhne ke liye.
const roleTier: Record<string, number> = {
  OFFICER_TIER_1: 1, // Pehla adhikari star.
  COMMITTEE_TIER_2: 2, // Doosra adhikari star.
  OMBUDSMAN_TIER_3: 3, // Teesra aur sabse upar wala adhikari star.
};

// Dropdown mein dikhane ke liye system ke saare jaane hue ticket status.
const statuses: TicketStatus[] = ['FILED', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED', 'ESCALATED'];

// Doosre filters ke liye pehchane hue urgency naam.
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// Deadline ko insaan ko samajh aane wale bache hue samay mein badalte hain.
function deadlineLabel(value: string | null): { label: string; overdue: boolean; hasDeadline: boolean } {
  if (!value) return { label: 'SLA not started', overdue: false, hasDeadline: false }; // Deadline na ho to yeh seedha batate hain.
  const remaining = new Date(value).getTime() - Date.now(); // Deadline aur abhi ke waqt ka farq milliseconds mein nikalte hain.
  if (remaining <= 0) return { label: 'SLA breached', overdue: true, hasDeadline: true }; // Waqt nikal gaya ho to late dikhate hain.
  const hours = Math.floor(remaining / 3_600_000); // Bache hue milliseconds mein se poore ghante nikalte hain.
  const minutes = Math.floor((remaining % 3_600_000) / 60_000); // Bache hue hisse ke minute nikalte hain.
  return { label: hours ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`, overdue: false, hasDeadline: true }; // Bacha hua waqt seedhe shabdon mein lautate hain.
}

// Is screen ka main hissa hai: officer apne kaam dekh sakta aur update sun sakta hai.
export default function OfficerDashboard() {
  const { user, token, isLoading: authLoading, isAuthenticated } = useAuth(); // Login user, uska key aur login check ka haal lete hain.
  const [tickets, setTickets] = useState<OfficerTicket[]>([]); // Aaye hue ticket yahan yaad rakhte hain; TS batata hai ki list mein ticket hi hon.
  const [inbox, setInbox] = useState<InboxNotice[]>([]); // Aaye hue alerts is list mein rakhte hain.
  const [inboxLoaded, setInboxLoaded] = useState(false); // Saved inbox padhi gayi hai ya nahi yaad rakhte hain.
  const [loading, setLoading] = useState(true); // Shuru mein data aane tak ghoomta hua nishaan dikhate hain.
  const [error, setError] = useState(''); // Server se dikkat aaye to uska sandesh yahan rakhte hain.
  const [statusFilter, setStatusFilter] = useState('ACTIVE'); // Chuney hue status ko yaad rakhte hain.
  const [priorityFilter, setPriorityFilter] = useState('ALL'); // Chuney hue urgency ko yaad rakhte hain.
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // Chuney hue vishay ko yaad rakhte hain.
  const [slaFilter, setSlaFilter] = useState('ALL'); // Chuney hue deadline haal ko yaad rakhte hain.
  const [busyTicket, setBusyTicket] = useState<string | null>(null); // Jis ticket ka update chal raha ho uska code rakhte hain.
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({}); // Har ticket ka resolution note uske code se jodkar rakhte hain.
  const [live, setLive] = useState(false); // Server se live taar jura hai ya nahi dikhate hain.
  const [notice, setNotice] = useState(''); // Abhi aayi chhoti jaankari screen par dikhate hain.
  const [inboxOpen, setInboxOpen] = useState(false); // Bell dabane par inbox khula hai ya band yaad rakhte hain.
  const [selectedTicket, setSelectedTicket] = useState<OfficerTicket | null>(null); // Khuli hui case drawer ke ticket ko yaad rakhte hain.
  const socketRef = useRef<Socket | null>(null); // Live connection ka handle rakhte hain taaki naye case rooms mein jud saken.

  // User ke role se uska adhikari star nikalte hain; role nahi mila to yeh khali rahega.
  const tier = user ? roleTier[user.role] : undefined;

  // Local storage mein purane alerts bache hon to login ke baad inbox mein wapas bharte hain.
  useEffect(() => {
    setInboxLoaded(false); // User badle to pehle purane user ke alerts ko save karna rok dete hain.
    setInbox([]); // Naye user ke purane alerts ko doosre user ko dikhne se bachate hain.
    if (!user?.id) return; // User ka code na ho to uski inbox alag nahi kar sakte.
    try {
      const saved = window.localStorage.getItem(`vishanti-officer-inbox:${user.id}`); // Sirf is user ki saved inbox padhte hain.
      if (saved) setInbox(JSON.parse(saved) as InboxNotice[]); // Text ko wapas notice list bana kar screen par rakhte hain.
    } catch {
      setInbox([]); // Purani ya kharab saved jaankari ho to khaali inbox se shuru karte hain.
    }
    setInboxLoaded(true); // Padhne ki koshish poori ho to ab inbox save karna surakshit hai.
  }, [user?.id]); // User badle tabhi uski inbox dobara padhte hain.

  // Inbox badalne par uski nayi copy browser mein rakhte hain, taaki refresh ke baad bhi dikhe.
  useEffect(() => {
    if (!user?.id || !inboxLoaded) return; // Login user aur purani inbox padhne se pehle save nahi karte.
    window.localStorage.setItem(`vishanti-officer-inbox:${user.id}`, JSON.stringify(inbox)); // Notice list ko text bana kar isi browser mein rakhte hain.
  }, [inbox, inboxLoaded, user?.id]); // Inbox ya user badle to saved copy bhi badalte hain.

  // Connection waapas aane par server mein jama chhute hue alerts bhi inbox mein lete hain.
  const loadServerInbox = useCallback(async () => {
    const result = await apiFetch<InboxNotice[]>('/api/notifications'); // Login user ke liye jama notification list server se mangwate hain.
    if (!result.success || !Array.isArray(result.data)) return; // API na ho to local inbox waise hi rehne dete hain.
    setInbox((current) => { // Server aur browser mein rakhe notices ko ek saath rakhte hain.
      const byId = new Map(current.map((item) => [item.id, item])); // Pehle local notices ko unke alag code se map karte hain.
      result.data!.forEach((item) => byId.set(item.id, byId.has(item.id) ? { ...item, read: byId.get(item.id)!.read } : item)); // Naye server alerts jodte hain aur padhe hone ki nishani bachate hain.
      return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50); // Naye pehle rakhkar sirf 50 bachate hain.
    });
  }, []); // Is request ko refresh cycle ke beech stable rakhte hain.

  // Officer ke liye tickets server se mangwate hain aur saamne aayi dikkat ko screen par rakhte hain.
  const loadTickets = useCallback(async () => {
    setLoading(true); // Data aane tak loading nishaan dikhate hain.
    setError(''); // Purana error hata dete hain, taaki nayi koshish saaf rahe.
    const result = await apiFetch<OfficerTicket[]>('/api/officer/tickets'); // API se officer queue mangwate hain; TS kehta hai jawab ticket list hona chahiye.
    if (result.success && Array.isArray(result.data)) { // Jawab theek aur list jaisa ho to use qabool karte hain.
      setTickets(result.data); // Nayi ticket list screen ke liye yaad rakhte hain.
    } else {
      setError(result.error || 'Could not load the officer queue.'); // Jawab na aaye to insaan ko samajhne layak baat dikhate hain.
    }
    setLoading(false); // Koshish khatam hui to ghoomta nishaan band karte hain.
  }, []); // Is kaam ko bekaar mein dobara banne se bachate hain.

  // Login aur officer role tay hone par pehli baar queue mangwate hain.
  useEffect(() => {
    if (!authLoading && isAuthenticated && tier) void loadTickets(); // Officer ho aur login check ho chuka ho tab queue mangwate hain.
    else if (!authLoading) setLoading(false); // Login check ke baad agar officer nahi to loading band karte hain.
  }, [authLoading, isAuthenticated, tier, loadTickets]); // Inmein se kuch badle to screen ka faisla dobara karte hain.

  // Live server taar tootne par har aadhe minute mein queue dobara padhte hain.
  useEffect(() => {
    if (!token || !tier || live) return; // Login, adhikar ya pehle se jura live taar na ho to poll nahi karte.
    const timer = window.setInterval(() => { void loadTickets(); void loadServerInbox(); }, 30_000); // 30 second baad queue aur offline mein jama alerts dono mangwate hain.
    return () => window.clearInterval(timer); // Page chhodne ya live judne par purana timer band karte hain.
  }, [token, tier, live, loadTickets, loadServerInbox]); // Connection ka haal badle to timer ko sahi rakhte hain.

  // Login key ke saath live connection kholte hain aur server ke naye paighaam sunte hain.
  useEffect(() => {
    if (!token || !tier) return; // Bina authorized officer ke server ka private paighaam nahi sunte.
    const socket: Socket = io(API_ORIGIN, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true }); // Pehle live raasta, zarurat par server ka doosra raasta aazmate hain.
    socketRef.current = socket; // Is connection ko baad ke room requests ke liye sambhal kar rakhte hain.
    socket.on('connect', () => { setLive(true); void loadTickets(); void loadServerInbox(); }); // Judte hi queue aur offline mein aaye alerts dono taaza karte hain.
    socket.on('disconnect', () => setLive(false)); // Taar tootne par offline nishaan dikhate hain.
    socket.on('connect_error', () => setLive(false)); // Server tak na pahunch sake to offline nishaan rakhte hain.
    socket.on('ticket-updated', (event: LiveEvent) => { // Ticket badalne ka server paighaam sunte hain.
      addInboxNotice('Petition updated', event, 'A petition in your queue has a new update.'); // Notice ko inbox mein rakhte hain.
      void loadTickets(); // Nayi sthiti server se dobara laate hain.
    });
    socket.on('sla-warning', (event: LiveEvent) => { // Deadline paas aane ka paighaam sunte hain.
      addInboxNotice('SLA deadline approaching', event, 'A case needs attention before its deadline.'); // Officer ko yaad dilane wala notice banate hain.
      void loadTickets(); // Sahi bachi deadline dikhane ke liye list taaza karte hain.
    });
    socket.on('sla-breached', (event: LiveEvent) => { // Deadline beetne ka paighaam sunte hain.
      addInboxNotice('SLA deadline passed', event, 'A case deadline has passed and may need escalation.'); // Deadline paar hone ka notice banate hain.
      void loadTickets(); // Naya status dekhne ke liye list taaza karte hain.
    });
    return () => { socket.disconnect(); socketRef.current = null; setLive(false); }; // Page band ho to connection saaf tareeqe se band karte hain.
  }, [token, tier, loadTickets, loadServerInbox]); // Login ya officer star badle to purana connection badalte hain.

  // Har dikh rahe case ke private live room mein server se judne ki darkhwast bhejte hain.
  useEffect(() => {
    if (!live || !socketRef.current) return; // Connection band ho to room mein jaane ki koshish nahi karte.
    tickets.forEach((ticket) => socketRef.current?.emit('ticket:subscribe', { ticketId: ticket.id })); // Har ticket ka update alag se sunne ke liye uska code server ko dete hain.
  }, [tickets, live]); // Queue badle ya live taar jude to nayi room darkhwast bhejte hain.

  // Naye live paighaam ko inbox mein jodte hain aur screen par chhoti khabar dikhate hain.
  function addInboxNotice(title: string, event: LiveEvent, fallback: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; // Har notice ko alag code dete hain.
    const detail = event.message || [event.ticketId ? `Ticket ${event.ticketId}` : '', event.status ? `Status ${event.status}` : '', event.type || ''].filter(Boolean).join(' · ') || fallback; // Server ki detail na ho to available jaankari mila kar dikhate hain.
    const newNotice: InboxNotice = { id, title, detail, ticketId: event.ticketId, createdAt: new Date().toISOString(), read: false }; // Inbox ke liye poora notice banate hain.
    setInbox((current) => [newNotice, ...current].slice(0, 50)); // Naya notice sabse upar rakhkar sirf pichhle 50 bachate hain.
    setNotice(title); // Page par chhoti temporary khabar dikhate hain.
  }

  // Chune hue status, urgency, category aur deadline ke mutabik ticket list chhantte hain.
  const visibleTickets = useMemo(() => tickets.filter((ticket) => { // Har ticket ko sharton se milakar sahi list banate hain.
    if (statusFilter === 'ACTIVE' && ticket.status === 'RESOLVED') return false; // Active view mein solved tickets chhupate hain.
    if (statusFilter !== 'ACTIVE' && ticket.status !== statusFilter) return false; // Khaas status chuna ho to doosre hata dete hain.
    if (priorityFilter !== 'ALL' && ticket.priority !== priorityFilter) return false; // Urgency filter se na milne wale hata dete hain.
    if (categoryFilter !== 'ALL' && ticket.category !== categoryFilter) return false; // Category se na milne wale hata dete hain.
    const deadline = deadlineLabel(ticket.slaDueAt); // Ticket ki deadline ka haal nikalte hain.
    if (slaFilter === 'OVERDUE' && !deadline.overdue) return false; // Sirf late cases chune hon to baaki hata dete hain.
    if (slaFilter === 'ON_TRACK' && (deadline.overdue || !deadline.hasDeadline)) return false; // Sirf waqt par chal rahe cases chune hon to baaki hata dete hain.
    if (slaFilter === 'NO_DEADLINE' && deadline.hasDeadline) return false; // Deadline na wale chune hon to deadline wale hata dete hain.
    return true; // Saari chuni shartein milti hain to ticket dikhate hain.
  }), [tickets, statusFilter, priorityFilter, categoryFilter, slaFilter]); // Filter badle to list phir banate hain.

  // Ticket ka status server se badalte hain aur resolution mein officer ka apna note bhejte hain.
  async function updateStatus(ticket: OfficerTicket, toStatus: TicketStatus, resolutionNote = '') {
    setBusyTicket(ticket.id); // Is ticket ka button kuch der ke liye rok dete hain.
    setNotice(''); // Purani chhoti khabar mita dete hain.
    const result = await apiFetch(`/api/tickets/${encodeURIComponent(ticket.id)}/transition`, { method: 'PATCH', body: JSON.stringify({ toStatus, ...(toStatus === 'RESOLVED' ? { resolutionNote: resolutionNote || resolutionNotes[ticket.id] || '' } : {}) }) }); // Naya status aur zaruri note server ko bhejte hain.
    if (result.success) { // Server ne update qabool kiya ho to.
      setNotice('Status update saved to the audit ledger.'); // Officer ko safalta batate hain.
      await loadTickets(); // Server ki asli nayi list padhte hain.
      setSelectedTicket(null); // Purana status dikhane wala drawer band kar dete hain.
    } else {
      setNotice(result.error || 'The status update could not be saved.'); // Server ki dikkat officer ko dikhate hain.
    }
    setBusyTicket(null); // Request poori ho to button wapas chalu karte hain.
  }

  // Sab notices ko dekha hua banate hain jab officer inbox khol chuka ho.
  function markInboxRead() {
    setInbox((current) => current.map((item) => ({ ...item, read: true }))); // Har notice ki read nishani true karte hain.
  }

  // Login check ya pehli queue request chal rahi ho to ghoomta nishaan dikhate hain.
  if (authLoading || loading) return <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-slate-400"><LoaderCircle className="h-5 w-5 animate-spin" /> Loading officer queue…</div>;

  // Sirf officer star wale login users ko triage screen tak aane dete hain.
  if (!isAuthenticated || !tier) return <section className="mx-auto max-w-xl rounded-2xl border border-amber-500/20 bg-slate-900/70 p-8 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-amber-400" /><h1 className="mt-4 text-xl font-bold text-white">Official access required</h1><p className="mt-2 text-sm text-slate-400">Sign in with an authorized Tier 1, Tier 2, or Tier 3 account to open the triage queue.</p><Link href="/auth/login" className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Go to sign in</Link></section>;

  // Upar wale chhote numbers ke liye late aur khule cases gin lete hain.
  const overdueCount = tickets.filter((ticket) => deadlineLabel(ticket.slaDueAt).overdue).length; // Deadline beet chuke cases ginte hain.
  const activeCount = tickets.filter((ticket) => ticket.status !== 'RESOLVED').length; // Abhi solve na hue cases ginte hain.
  const unreadCount = inbox.filter((item) => !item.read).length; // Abhi tak na dekhe alerts ginte hain.
  const categories = Array.from(new Set(tickets.map((ticket) => ticket.category))); // Maujood tickets se alag-alag categories nikalte hain.

  // Officer ki poori screen dikhate hain.
  return <div className="space-y-7 py-3">
    {/* Upar ka hissa role, page ka kaam aur live connection ka haal batata hai. */}
    <section className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 p-6 sm:flex-row sm:items-center sm:p-8">
      <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300"><ShieldCheck className="h-4 w-4" /> Tier {tier} authority portal</div><h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">Officer triage queue</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Review cases assigned to your authority tier, keep SLA deadlines visible, and record each decision in the immutable audit trail.</p></div>
      <div className="flex items-center gap-2 self-start rounded-full border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs"><span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-slate-500'}`} /><span className={live ? 'text-emerald-300' : 'text-slate-400'}>{live ? 'Live updates connected' : 'Live updates reconnecting'}</span></div>
    </section>

    {/* Koi khabar ya dikkat ho to officer ko foran batate hain. */}
    {notice && <div role="status" className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">{notice}</div>}
    {error && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200 sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><button onClick={() => void loadTickets()} className="inline-flex items-center gap-2 self-start rounded-lg border border-rose-400/20 px-3 py-2 font-medium hover:bg-rose-500/10"><RefreshCw className="h-4 w-4" /> Retry</button></div>}

    {/* Chaar chhote cards queue, kaam aur inbox ki surat dikhate hain. */}
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Metric label="Cases in queue" value={tickets.length} icon={<Activity className="h-4 w-4" />} /><Metric label="Active cases" value={activeCount} icon={<MessageSquare className="h-4 w-4" />} /><Metric label="SLA breaches" value={overdueCount} icon={<AlertTriangle className="h-4 w-4" />} danger={overdueCount > 0} /><Metric label="Unread updates" value={unreadCount} icon={<Bell className="h-4 w-4" />} /></section>

    {/* Inbox bell live updates ko temporary screen message ke alawa yahan sambhalta hai. */}
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <button onClick={() => { setInboxOpen((open) => !open); if (!inboxOpen) markInboxRead(); }} aria-expanded={inboxOpen} className="flex w-full items-center justify-between px-5 py-4 text-left"><span className="flex items-center gap-2 text-sm font-semibold text-white"><Bell className="h-4 w-4 text-indigo-300" /> Notification inbox <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] text-indigo-200">{unreadCount} new</span></span>{inboxOpen ? <X className="h-4 w-4 text-slate-400" /> : <span className="text-xs text-slate-500">{inbox.length} saved</span>}</button>
      {inboxOpen && <div className="max-h-72 overflow-y-auto border-t border-slate-800">{inbox.length ? inbox.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 border-b border-slate-800/70 px-5 py-3 last:border-0"><div><p className="text-xs font-semibold text-slate-200">{item.title}</p><p className="mt-1 break-all text-xs text-slate-400">{item.detail}</p><time className="mt-1 block text-[10px] text-slate-600">{new Date(item.createdAt).toLocaleString()}</time></div>{item.ticketId && <Link href={`/tickets/${item.ticketId}`} className="shrink-0 text-xs text-indigo-300 hover:text-indigo-200">Open</Link>}</div>) : <p className="p-5 text-center text-xs text-slate-500">No updates yet. New live updates will be saved here.</p>}</div>}
    </section>

    {/* Queue ke chhote cards dikhate hain ki officer kitna kaam sambhal raha hai. */}
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
      <div className="flex flex-col gap-4 border-b border-slate-800 p-5 sm:px-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-bold text-white">Assigned petitions</h2><p className="mt-1 text-xs text-slate-500">Only redacted petitioner details are shown for anonymous cases.</p></div><button aria-label="Refresh queue" onClick={() => void loadTickets()} className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 hover:text-white"><RefreshCw className="h-4 w-4" /> Refresh</button></div>
        {/* Chaar dropdown se officer apne liye zaruri cases chunta hai. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="ACTIVE">All active</option>{statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select>
          <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="ALL">All priorities</option>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>
          <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="ALL">All categories</option>{categories.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select>
          <select aria-label="Filter by SLA" value={slaFilter} onChange={(event) => setSlaFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"><option value="ALL">All SLA states</option><option value="OVERDUE">Overdue</option><option value="ON_TRACK">On track</option><option value="NO_DEADLINE">No deadline</option></select>
        </div>
      </div>

      {/* Khaali list ho to sahi wajah ya khaali queue ka seedha paighaam dikhate hain. */}
      {visibleTickets.length === 0 ? <div className="px-6 py-14 text-center">{error ? <p className="text-sm text-slate-400">The queue is unavailable until the officer API is reachable.</p> : <><Clock3 className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 text-sm font-medium text-slate-300">No petitions in this view</p><p className="mt-1 text-xs text-slate-500">New cases assigned to Tier {tier} will appear here.</p></>}</div> : <div className="divide-y divide-slate-800/80">
        {/* Har ticket ke liye uski halat, deadline aur mumkin agla kaam dikhate hain. */}
        {visibleTickets.map((ticket) => {
          const deadline = deadlineLabel(ticket.slaDueAt); // Ticket ki deadline ko padhne layak banate hain.
          const nextStatus: TicketStatus | null = ticket.status === 'FILED' ? 'ASSIGNED' : ticket.status === 'ASSIGNED' ? 'IN_REVIEW' : ticket.status === 'IN_REVIEW' ? 'RESOLVED' : null; // Maujooda sthiti se agla allowed button chunne mein madad lete hain.
          return <article key={ticket.id} className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${statusClass(ticket.status)}`}>{ticket.status.replace('_', ' ')}</span><span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-semibold text-slate-300">{ticket.priority}</span><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{ticket.category.replaceAll('_', ' ')}</span><span className="text-[10px] text-slate-600">Tier {ticket.currentTier}</span></div>
                <h3 className="mt-3 text-lg font-semibold text-white">{ticket.title}</h3>
                <p className="mt-2 line-clamp-3 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-slate-400">{ticket.description}</p>
                <p className="mt-3 text-xs text-slate-500">{ticket.isAnonymous ? 'Anonymous petitioner' : 'Identified petitioner'} · Filed {new Date(ticket.createdAt).toLocaleString()}</p>
              </div>
              {/* Button aur deadline ko alag rakhta hai taaki officer ko agla kaam saaf dikhe. */}
              <div className="flex shrink-0 flex-col gap-2 xl:min-w-48">
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${deadline.overdue ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-slate-700 bg-slate-950/70 text-slate-300'}`}><Clock3 className="h-3.5 w-3.5" />{deadline.label}</div>
                <button onClick={() => setSelectedTicket(ticket)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"><ExternalLink className="h-3.5 w-3.5" /> Manage case</button>
              </div>
            </div>
          </article>;
        })}
      </div>}
    </section>
    {/* Case drawer se officer status badal sakta aur staff ke beech note likh sakta hai. */}
    {selectedTicket && <TicketActionDrawer ticket={selectedTicket} busy={busyTicket === selectedTicket.id} onClose={() => setSelectedTicket(null)} onTransition={(toStatus, note) => updateStatus(selectedTicket, toStatus, note)} />}
  </div>;
}

// Case drawer status buttons aur staff ke private comment thread ko ek jagah rakhta hai.
function TicketActionDrawer({ ticket, busy, onClose, onTransition }: { ticket: OfficerTicket; busy: boolean; onClose: () => void; onTransition: (status: TicketStatus, note?: string) => void }) {
  const [resolutionNote, setResolutionNote] = useState(''); // Resolution bhejne se pehle adhikari ka note yahan rakhte hain.
  const [comments, setComments] = useState<OfficerComment[]>([]); // Server se aaye discussion notes yahan dikhate hain.
  const [draft, setDraft] = useState(''); // Naya internal note likhte waqt uska text yahan rakhte hain.
  const [commentError, setCommentError] = useState(''); // Comment padhne ya bhejne mein dikkat ho to batate hain.
  const [commentBusy, setCommentBusy] = useState(false); // Comment bhejte waqt button ko rokne ke liye nishani rakhte hain.
  const [commentLoading, setCommentLoading] = useState(true); // Comment list aane tak loading nishani dikhate hain.
  const nextStatus: TicketStatus | null = ticket.status === 'FILED' ? 'ASSIGNED' : ticket.status === 'ASSIGNED' ? 'IN_REVIEW' : ticket.status === 'IN_REVIEW' ? 'RESOLVED' : null; // Ticket ki maujooda sthiti se agla button nikalte hain.

  // Is ticket ke internal discussion notes API se laate hain.
  const loadComments = useCallback(async () => {
    setCommentLoading(true); // Purani list ke baad nayi list laate waqt loading dikhate hain.
    const result = await apiFetch<OfficerComment[]>(`/api/tickets/${encodeURIComponent(ticket.id)}/comments?scope=internal`); // Sirf staff ke notes mangwate hain.
    if (result.success && Array.isArray(result.data)) setComments(result.data); // Sahi list ho to screen par dikhate hain.
    else setCommentError(result.error || 'Internal notes are not available yet.'); // API na ho to wajah dikhate hain.
    setCommentLoading(false); // Padhne ki koshish khatam karte hain.
  }, [ticket.id]); // Ticket badle tabhi uske comments dobara mangwate hain.

  // Drawer khulne par purane comments padhte hain.
  useEffect(() => { void loadComments(); }, [loadComments]); // Har naya ticket khule to uski baatein mangwate hain.

  // Officer ka internal comment save karte hain.
  async function postComment() {
    if (draft.trim().length < 1) return; // Khaali note bhejne se rokte hain.
    setCommentBusy(true); // Submit button ko request ke dauran rok dete hain.
    setCommentError(''); // Pichla error hata dete hain.
    const result = await apiFetch(`/api/tickets/${encodeURIComponent(ticket.id)}/comments`, { method: 'POST', body: JSON.stringify({ content: draft.trim(), isInternal: true }) }); // Note ko staff-only mark karke server ko bhejte hain.
    if (result.success) { setDraft(''); await loadComments(); } // Save ho to text khaali karke taaza list laate hain.
    else setCommentError(result.error || 'The note could not be saved.'); // Save na ho to seedha sandesh dikhate hain.
    setCommentBusy(false); // Request khatam ho to button wapas chalu karte hain.
  }

  // Side drawer kholte hain jo mobile par poori screen le leta hai.
  return <div role="presentation" className="fixed inset-0 z-[60] bg-black/70" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-label={`Manage ${ticket.title}`} className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto border-l border-slate-700 bg-slate-950 p-5 shadow-2xl sm:p-7">
      {/* Drawer ka heading aur band karne ka button. */}
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">Tier {ticket.currentTier} · {ticket.status.replace('_', ' ')}</p><h2 className="mt-2 text-xl font-bold text-white">{ticket.title}</h2><p className="mt-2 text-xs text-slate-500">{ticket.category.replaceAll('_', ' ')} · {ticket.priority} priority</p></div><button onClick={onClose} aria-label="Close case drawer" className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button></div>
      {/* Complaint text ko poora padhne ke liye alag box mein dikhate hain. */}
      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/70 p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{ticket.description}</p><p className="mt-3 text-[10px] text-slate-500">{ticket.isAnonymous ? 'Anonymous petitioner' : 'Identified petitioner'}</p></div>
      {/* Status badalne ke buttons aur resolution ke liye zaruri note. */}
      <section className="mt-6"><h3 className="text-sm font-semibold text-white">Case action</h3>{nextStatus === 'RESOLVED' && <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} rows={3} placeholder="Resolution note, at least 10 characters" className="mt-3 w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none" />}<div className="mt-3 flex flex-wrap gap-2">{nextStatus && <button disabled={busy || (nextStatus === 'RESOLVED' && resolutionNote.trim().length < 10)} onClick={() => onTransition(nextStatus, resolutionNote)} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{busy ? 'Saving…' : nextStatus === 'RESOLVED' ? 'Resolve with note' : `Move to ${nextStatus.replace('_', ' ')}`}</button>}<Link href={`/tickets/${ticket.id}`} className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800">View audit record</Link></div></section>
      {/* Private discussion neeche rakhi hai, taaki staff case note likh sake. */}
      <section className="mt-7 flex-1 border-t border-slate-800 pt-5"><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><MessageSquare className="h-4 w-4 text-indigo-300" /> Internal discussion</h3><p className="mt-1 text-xs text-slate-500">These notes are for authorized staff only.</p>{commentError && <p role="alert" className="mt-3 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-200">{commentError}</p>}{commentLoading ? <p className="mt-4 text-xs text-slate-500">Loading internal notes…</p> : comments.length ? <div className="mt-4 space-y-3">{comments.map((comment) => <article key={comment.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="flex justify-between gap-3"><span className="text-xs font-medium text-slate-200">{comment.actorName || 'Official'}</span><time className="text-[10px] text-slate-600">{new Date(comment.createdAt).toLocaleString()}</time></div><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">{comment.content}</p></article>)}</div> : <p className="mt-4 rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">No internal notes yet.</p>}
        {/* Naya private note likhne aur bhejne ke liye yeh text box hai. */}
        <div className="mt-4"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={3} placeholder="Write an internal note for the team…" className="w-full resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none" /><div className="mt-2 flex items-center justify-between"><span className="text-[10px] text-slate-600">{draft.length}/2000</span><button disabled={commentBusy || !draft.trim()} onClick={() => void postComment()} className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50">{commentBusy ? 'Saving…' : 'Add internal note'} <Send className="h-3.5 w-3.5" /></button></div></div>
      </section>
    </aside>
  </div>;
}

// Chhota number-card ek naam, ginti aur icon ko saaf saath dikhata hai.
function Metric({ label, value, icon, danger = false }: { label: string; value: number; icon: React.ReactNode; danger?: boolean }) {
  return <div className={`rounded-xl border bg-slate-900/60 p-4 ${danger ? 'border-rose-500/30' : 'border-slate-800'}`}><div className="flex items-center justify-between text-xs text-slate-400"><span>{label}</span><span className={danger ? 'text-rose-400' : 'text-indigo-300'}>{icon}</span></div><p className={`mt-2 text-2xl font-extrabold ${danger ? 'text-rose-300' : 'text-white'}`}>{value}</p></div>;
}

// Har status ko alag rang dete hain taaki bina padhe bhi uski surat samajh aaye.
function statusClass(status: TicketStatus): string {
  const styles: Record<TicketStatus, string> = { FILED: 'border-blue-500/30 bg-blue-500/10 text-blue-300', ASSIGNED: 'border-violet-500/30 bg-violet-500/10 text-violet-300', IN_REVIEW: 'border-amber-500/30 bg-amber-500/10 text-amber-300', RESOLVED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', ESCALATED: 'border-rose-500/30 bg-rose-500/10 text-rose-300' }; // TS Record kehta hai ki har ticket status ka ek rang zaroor hona chahiye.
  return styles[status]; // Chuney hue status ka rang lautate hain.
}
