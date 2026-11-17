// Offline demo: two simulated devices talking through an in-memory server
// that lives only in this tab. Same crypto as the real thing; nothing is sent
// anywhere and everything is discarded on reload.
import { ChatClient, MemoryChatServer, MemoryKeyStore } from '@aurelia/core/chat'

export type DemoPerson = { userId: string; name: string; email: string; client: ChatClient }

export async function createDemo(): Promise<{ server: MemoryChatServer; people: DemoPerson[] }> {
  const server = new MemoryChatServer()
  const spec = [
    { userId: 'demo-chief-of-staff', name: 'Avery (Chief of Staff)', email: 'avery@demo.aurelia' },
    { userId: 'demo-cfo', name: 'Blake (CFO)', email: 'blake@demo.aurelia' },
    { userId: 'demo-ghostwriter', name: 'Casey (Ghostwriter)', email: 'casey@demo.aurelia' },
  ]
  const people: DemoPerson[] = []
  for (const s of spec) {
    server.registerUser(s.userId, s.email)
    const client = new ChatClient({
      transport: server.transportFor(s.userId),
      keyStore: new MemoryKeyStore(),
      userId: s.userId,
      deviceLabel: 'Demo device',
    })
    await client.init()
    people.push({ ...s, client })
  }
  const [avery, blake] = people
  const room = await avery.client.createRoom({ name: 'Board prep', memberUserIds: [blake.userId] })
  await avery.client.sendText(room.id, 'Q3 deck is final. Holding external release until 09:30 AEST.')
  await blake.client.sendText(room.id, 'Confirmed. Numbers reconciled with the audit pack.')
  return { server, people }
}
