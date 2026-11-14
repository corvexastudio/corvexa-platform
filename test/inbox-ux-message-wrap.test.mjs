import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('MessageBubble has overflow-wrap, word-break, min-w-0, and linkification', () => {
  const content = fs.readFileSync('src/components/inbox/message-bubble.tsx', 'utf8')
  assert.ok(content.includes('overflow-wrap:anywhere'), 'Must contain overflow-wrap:anywhere')
  assert.ok(content.includes('break-words'), 'Must contain break-words')
  assert.ok(content.includes('min-w-0'), 'Must contain min-w-0 on outer wrapper and inner container')
  assert.ok(content.includes('break-all'), 'Must contain break-all for URL wrapping')
  assert.ok(content.includes('renderMessageBody'), 'Must parse and render links cleanly')
  assert.ok(content.includes('ExternalLink'), 'Must render external link indicator for URLs')
})

test('Inbox conversation header is responsive with 2-tier layout and full customer identity', () => {
  const content = fs.readFileSync('src/app/client/inbox/page.tsx', 'utf8')
  assert.ok(content.includes('getInitials'), 'Must generate initials for avatar')
  assert.ok(content.includes('formatNationalUs'), 'Must format phone numbers cleanly')
  assert.ok(content.includes('w-72 xl:w-80'), 'Dossier width must be responsive (w-72 xl:w-80)')
  assert.ok(content.includes('overflow-x-hidden') && content.includes('min-w-0'), 'Message list container must prevent horizontal overflow and allow flex shrinking')
  assert.ok(content.includes('Hide Dossier'), 'Dossier button must have descriptive state')
})

test('ConversationRow uses proper name initials and formats names and phones', () => {
  const content = fs.readFileSync('src/components/inbox/conversation-row.tsx', 'utf8')
  assert.ok(content.includes('getInitials(displayName)'), 'Must use getInitials for avatar')
  assert.ok(content.includes('formatCustomerName'), 'Must format customer names with formatCustomerName')
  assert.ok(content.includes('formatNationalUs'), 'Must format phone numbers with formatNationalUs')
})

test('InboxPage formats customer names and addresses across header and dossiers', () => {
  const content = fs.readFileSync('src/app/client/inbox/page.tsx', 'utf8')
  assert.ok(content.includes('formatCustomerName(activeConv.contact?.name)'), 'Header and dossier must title-case customer name')
  assert.ok(content.includes('formatStandardUsAddress(activeConv.contact.address)'), 'Header and dossier must standardize address')
})
