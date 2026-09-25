// Checks the client-side avatar rules in src/lib/avatar.ts (Node strips the
// TypeScript types itself). These are the friendly checks; the bucket limits
// in supabase/avatars.sql are the ones that can't be skipped.
//
//   npm run test:rls

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AVATAR_MAX_BYTES, avatarPath, formatBytes, validateAvatar } from '../src/lib/avatar.ts'

const file = (name, type, bytes) => new File([new Uint8Array(bytes)], name, { type })

test('accepts PNG, JPEG, WebP and GIF up to exactly 1 MB', () => {
  assert.equal(validateAvatar(file('me.png', 'image/png', 2048)), null)
  assert.equal(validateAvatar(file('me.jpg', 'image/jpeg', AVATAR_MAX_BYTES)), null)
  assert.equal(validateAvatar(file('me.webp', 'image/webp', 10)), null)
  assert.equal(validateAvatar(file('me.gif', 'image/gif', 10)), null)
})

test('rejects one byte over 1 MB, and says how big the file is', () => {
  assert.match(validateAvatar(file('big.png', 'image/png', AVATAR_MAX_BYTES + 1)), /is 1\.1 MB\. Choose an image of 1 MB or less/)
  assert.match(validateAvatar(file('huge.jpg', 'image/jpeg', 4.2 * 1024 * 1024)), /“huge\.jpg” is 4\.2 MB/)
})

test('rejects files that are not a supported image', () => {
  for (const [name, type] of [
    ['report.pdf', 'application/pdf'],
    ['notes.txt', 'text/plain'],
    ['logo.svg', 'image/svg+xml'],
    ['photo.heic', 'image/heic'],
    ['mystery', ''],
  ]) {
    assert.match(validateAvatar(file(name, type, 100)), /isn’t a supported image/, name)
  }
})

test('rejects an empty file', () => {
  assert.match(validateAvatar(file('blank.png', 'image/png', 0)), /is empty/)
})

test('uploads go into a folder named after the user id', () => {
  assert.equal(avatarPath('0b5c-user'), '0b5c-user/avatar')
})

test('formats sizes for people', () => {
  assert.equal(formatBytes(512), '512 bytes')
  assert.equal(formatBytes(300 * 1024), '300 KB')
  assert.equal(formatBytes(3 * 1024 * 1024), '3.0 MB')
})
