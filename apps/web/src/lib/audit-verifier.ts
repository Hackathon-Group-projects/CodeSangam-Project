// TS mein yeh type JSON ke allowed data ko dikhata hai; JavaScript mein yahi aam text, number aur list hoti hai.
export type JsonData = null | boolean | number | string | JsonData[] | { [key: string]: JsonData };

// TS ka interface ek ledger entry ka naksha hai, jisse browser ko pata rahe ki API se kya fields aayengi.
export interface AuditEntryForVerification {
  seq: number; // Entry ka kram number, jo 0 se shuru hota hai.
  ticketId: string; // Yeh entry kis ticket ki hai.
  actorRef: string; // Is entry ko kis account ya anonymous pehchaan ne banaya.
  type: string; // Entry ka kaam, jaise CREATED ya TRANSITIONED.
  payload: JsonData; // Entry ke saath rakhi chhoti jaankari.
  prevHash: string; // Pichhli entry ki seal.
  hash: string; // Is entry ke saare fields se bani seal.
  timestamp: string; // Entry likhe jaane ka exact waqt.
}

// Ek hi JSON jaankari ko har baar bilkul ek hi text mein badalte hain.
function canonicalJSON(value: JsonData): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'; // Seedhi value ko JSON ke aam likhne ke tareeqe se badalte hain.
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`; // List ke item ka kram nahi badalte.
  const object = value as { [key: string]: JsonData }; // TS ko batate hain ki list nahi, naam aur value wala object hai.
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJSON(object[key])}`).join(',')}}`; // Naam ko ek jaisi tarteeb mein rakhte hain taaki har device ko wahi text mile.
}

// Browser ke apne SHA-256 auzaar se text ki 64 akshar wali seal banate hain.
async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value); // Aam text ko computer ke chhote bytes mein badalte hain.
  const digest = await crypto.subtle.digest('SHA-256', bytes); // Browser se text ki SHA-256 seal banwate hain.
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join(''); // Seal ko padhne layak hexadecimal text banate hain.
}

// Ticket ki har entry ki seal dobara bana kar asal chain se milate hain.
export async function verifyAuditChain(entries: AuditEntryForVerification[], expectedTicketId: string): Promise<{ valid: boolean; checked: number; failedSeq?: number; reason?: string }> {
  if (entries.length === 0) return { valid: false, checked: 0, reason: 'No audit entries were returned.' }; // Khaali chain ko sahi sabit nahi maan sakte.
  let previousHash = '0'.repeat(64); // Pehli entry ke pehle 64 zero ka nishaan hota hai.
  for (let index = 0; index < entries.length; index += 1) { // Har entry ko shuru se aakhir tak ek-ek karke dekhte hain.
    const entry = entries[index]; // Is baar check hone wali entry nikalte hain.
    if (entry.seq !== index) return { valid: false, checked: index, failedSeq: entry.seq, reason: 'Entry order or sequence is missing.' }; // Koi number chhoota ya hila ho to yahin rukte hain.
    if (entry.ticketId !== expectedTicketId) return { valid: false, checked: index, failedSeq: entry.seq, reason: 'An entry belongs to a different ticket.' }; // Doosre ticket ki entry ko chain mein aane nahi dete.
    if (entry.prevHash !== previousHash) return { valid: false, checked: index, failedSeq: entry.seq, reason: 'This entry does not point to the previous seal.' }; // Pichhli seal se taar na mile to badlav ya kami batate hain.
    const hashSource = [entry.prevHash, entry.seq, entry.ticketId, entry.actorRef, entry.type, canonicalJSON(entry.payload), entry.timestamp].join('||'); // Wahi fields usi kram mein jodte hain jisse project seal banata hai.
    const calculatedHash = await sha256(hashSource); // Browser apni taraf se is entry ki nayi seal banata hai.
    if (calculatedHash !== entry.hash) return { valid: false, checked: index, failedSeq: entry.seq, reason: 'The saved seal does not match this entry.' }; // Nayi aur saved seal alag ho to entry badli hui hai.
    previousHash = entry.hash; // Agli entry ko isi seal se judna chahiye.
  }
  return { valid: true, checked: entries.length }; // Sab entry mil gayi to chain sahi dikh rahi hai.
}
