import test from 'node:test'
import assert from 'node:assert/strict'
import { renderPrivacyHtml } from './privacyHtml.js'
import { renderAccountDeletionHtml } from './accountDeletionHtml.js'

test('privacy and deletion pages explain contact, public deletion and actual grace period', () => {
  const privacy = renderPrivacyHtml()
  assert.match(privacy, /nilepay\.customers@gmail\.com/)
  assert.match(privacy, /href="\/account-deletion"/)
  assert.match(privacy, /72-hour/)
  assert.match(privacy, /90 days/)
  assert.match(privacy, /365 days/)
  assert.match(privacy, /pseudonymiz/)
  const deletion = renderAccountDeletionHtml()
  assert.match(deletion, /href="\/privacy"/)
  assert.match(deletion, /72-hour/)
  assert.doesNotMatch(deletion, /Under Egyptian financial regulations|permanently anonymized/)
})
