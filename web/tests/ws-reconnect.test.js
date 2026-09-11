const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const terminal = fs.readFileSync(
    path.join(__dirname, '../src/components/Terminal.vue'),
    'utf8'
)

test('reconnects a disconnected terminal when the page becomes visible', () => {
    assert.match(terminal, /document\.addEventListener\('visibilitychange', this\.visibilityHandler\)/)
    assert.match(terminal, /!document\.hidden && !this\.isWebSocketOpen\(\)/)
    assert.match(terminal, /this\.reconnect\(\)/)
})

test('uses bounded reconnect backoff and shows the disconnect notice after five failures', () => {
    assert.match(terminal, /const delays = \[1000, 2000, 4000, 6000\]/)
    assert.match(terminal, /this\.reconnectAttempts >= 5/)
    assert.match(terminal, /this\.showDisconnectedMessage\(\)/)
})
