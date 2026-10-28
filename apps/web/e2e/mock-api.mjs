import { createHash } from 'node:crypto'; // Test ke sample record ki seal banane ke liye Node ka hash tool lete hain.
import { createServer } from 'node:http'; // Test ke liye chhota HTTP server banane ka tool lete hain.

// Yeh test ticket ka naksha hai; iska data sirf test browser ko dikhaya jayega.
const ticket = {
  id: '11111111-1111-4111-8111-111111111111', // Test ke liye pehchanne layak ticket code.
  title: 'Day six officer test petition', // Test card par dikhne wala naam.
  description: 'This sample petition is used only to exercise the officer review flow.', // Test complaint ka saada matn.
  category: 'ACADEMIC', // Sample complaint ka vishay.
  priority: 'HIGH', // Sample complaint ki urgency.
  status: 'IN_REVIEW', // Test ko resolve karne se pehle review stage par rakhte hain.
  currentTier: 1, // Test user pehle officer star par hai.
  createdAt: '2026-10-27T10:00:00.000Z', // Test mein ek hi sthir file hone ka samay rakhte hain.
  slaDueAt: '2027-10-27T10:00:00.000Z', // Deadline ko door rakhte hain taaki test late na ho.
  isAnonymous: true, // Naam na dikhane wala sample case banate hain.
  version: 2, // Pehle se ek baar badle ticket jaisa sample number rakhte hain.
};

// Test ke internal comments isi list mein rehte hain.
const comments = [];

// Public chart ke liye banawati, pehchaan na batane wale numbers rakhte hain.
const publicMetrics = {
  totals: { filed: 12, resolved: 7, active: 5, escalated: 1 }, // Kul test petition ki ginti.
  averageResolutionHours: 18, // Test mein overall ausat ghante.
  slaCompliancePercent: 92, // Test mein samay par hue kaam ka hissa.
  resolutionVelocity: [{ tier: 1, averageHours: 18 }, { tier: 2, averageHours: 25 }, { tier: 3, averageHours: 31 }], // Har authority star ka ausat samay.
  categoryTrends: [{ category: 'ACADEMIC', count: 5 }, { category: 'HOSTEL_MESS', count: 4 }], // Do category ke test counts.
  tierCompliance: [{ tier: 1, compliant: 8, breached: 1 }, { tier: 2, compliant: 3, breached: 1 }], // Tier ke hisaab se test deadlines.
  clusters: [{ id: 'cluster-1', label: 'Mess food quality', count: 4, sentiment: 0.72 }], // Ek sample AI theme aur uska group size.
  merkleRoot: { hash: 'a'.repeat(64), timestamp: '2026-10-27T00:00:00.000Z' }, // Page par dikhne wali sample checkpoint seal.
};

// JSON jawab browser tak bhejne ka ek chhota helper banate hain.
function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); // Jawab ko JSON batate aur local browser ko padhne dete hain.
  response.end(JSON.stringify(body)); // JavaScript object ko text bana kar bhejte hain.
}

// API ke liye ek hi ledger entry banate hain; browser isi ko dobara seal karega.
function createAuditEntry(ticketId) {
  const entry = { seq: 0, ticketId, actorRef: 'public-test-pseudonym', type: 'CREATED', payload: { status: 'FILED' }, prevHash: '0'.repeat(64), timestamp: '2026-10-27T10:00:00.000Z' }; // Seal banane mein kaam aane wale sample fields rakhte hain.
  const canonicalPayload = JSON.stringify(entry.payload); // Ek key wale sample data ko JSON text mein badalte hain.
  const source = [entry.prevHash, entry.seq, entry.ticketId, entry.actorRef, entry.type, canonicalPayload, entry.timestamp].join('||'); // Project wale rule jaisa hi fields ka kram banate hain.
  const hash = createHash('sha256').update(source, 'utf8').digest('hex'); // Node se test entry ki 64-akshar seal banwate hain.
  return { ...entry, hash }; // Seal ko entry mein jodkar browser ko bhejne layak banate hain.
}

// Local test app ke requests yahan sunte hain.
const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1:4001'); // Request path aur uske query words alag karte hain.
  if (request.method === 'OPTIONS') { response.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-allow-headers': 'content-type,authorization,idempotency-key' }); response.end(); return; } // Browser ke pehle poochhe sawal ka jawab dete hain.
  if (url.pathname === '/health') return sendJson(response, 200, { status: 'ok' }); // Test runner ko server ready hone ka jawab dete hain.
  if (url.pathname === '/api/public/metrics') return sendJson(response, 200, { success: true, data: publicMetrics }); // Public dashboard ko sirf jama sample numbers dete hain.
  if (url.pathname === '/api/auth/login' && request.method === 'POST') return sendJson(response, 200, { success: true, data: { token: 'day6-test-token', user: { id: 'officer-test-id', name: 'Test Officer', email: 'officer@example.edu', role: 'OFFICER_TIER_1', tier: 1 } } }); // Officer login test ko sample account dete hain.
  if (url.pathname === '/api/officer/tickets') return sendJson(response, 200, { success: true, data: [ticket] }); // Officer page ko test ticket dikhate hain.
  if (url.pathname === '/api/notifications') return sendJson(response, 200, { success: true, data: [] }); // Shuru mein koi chhuta hua alert nahi dikhate hain.
  if (url.pathname === '/api/tickets' && request.method === 'POST') return sendJson(response, 201, { success: true, data: { ticket: { id: ticket.id }, receiptSecret: 'b'.repeat(64) } }); // Intake test ko ek nakli ticket aur server wala receipt dete hain.
  if (url.pathname === `/api/tickets/${ticket.id}/audit`) return sendJson(response, 200, { success: true, data: [createAuditEntry(ticket.id)] }); // Checker ko ek sahi sample ledger entry dete hain.
  if (url.pathname === `/api/tickets/${ticket.id}/comments` && request.method === 'GET') return sendJson(response, 200, { success: true, data: comments }); // Drawer ko jama internal baatein dete hain.
  if (url.pathname === `/api/tickets/${ticket.id}/comments` && request.method === 'POST') { // Naya internal note aaya ho to use test list mein rakhte hain.
    let body = ''; // Aane wale text ko jama karne ke liye khaali jagah rakhte hain.
    for await (const chunk of request) body += chunk; // Request ke chhote hisson ko ek text mein jodte hain.
    const data = JSON.parse(body); // Text ko wapas JavaScript object banate hain.
    comments.push({ id: `comment-${comments.length + 1}`, content: data.content, isInternal: true, actorName: 'Test Officer', createdAt: new Date().toISOString() }); // Test comment ko sample naam ke saath yaad rakhte hain.
    return sendJson(response, 201, { success: true, data: { saved: true } }); // Browser ko batate hain ki test comment save hua.
  }
  if (url.pathname === `/api/tickets/${ticket.id}/transition` && request.method === 'PATCH') { // Officer ne status badla ho to sample ticket update karte hain.
    let body = ''; // Status request ke text ke liye khaali jagah rakhte hain.
    for await (const chunk of request) body += chunk; // Request ke tukde jodte hain.
    const data = JSON.parse(body); // Text ko status aur note wale object mein padhte hain.
    ticket.status = data.toStatus; // Test ticket ko nayi status dete hain.
    ticket.version += 1; // Ticket badla, isliye uska badlav number badhate hain.
    return sendJson(response, 200, { success: true, data: ticket }); // Nayi test sthiti wapas bhejte hain.
  }
  return sendJson(response, 404, { success: false, message: 'No test API route for this request.' }); // Gair maujood test API ka saaf jawab dete hain.
});

// Mock API ko sirf local test computer par chalu rakhte hain.
server.listen(4001, '127.0.0.1'); // Port 4001 par Next.js test app ke requests sunte hain.
