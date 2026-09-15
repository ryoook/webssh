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

test('retries the first unexpected disconnect and only resets attempts after a stable connection', () => {
    assert.match(terminal, /if \(document\.hidden\) return\s+this\.reconnect\(\)/)
    assert.doesNotMatch(terminal, /if \(this\.reconnectAttempts > 0\)/)
    assert.match(terminal, /this\.scheduleReconnectReset\(\)/)
    assert.match(terminal, /this\.reconnectResetTimer = setTimeout\(\(\) => \{[\s\S]*this\.reconnectAttempts = 0[\s\S]*\}, 10000\)/)
    assert.match(terminal, /ws\.onclose = \(\) => \{[\s\S]*clearTimeout\(this\.reconnectResetTimer\)/)
})

test('does not carry a stale close flag into a replacement websocket', () => {
    assert.doesNotMatch(terminal, /resetClose/)
    assert.match(terminal, /if \(this\.ws !== ws\) return/)
    assert.match(terminal, /if \(this\.manuallyClosed\) return/)
})
