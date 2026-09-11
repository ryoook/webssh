const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('SSH request uses JSON serialization and includes the startup command', () => {
    const getters = fs.readFileSync(
        path.join(__dirname, '../src/store/getters.js'),
        'utf8'
    )

    assert.match(getters, /JSON\.stringify/)
    assert.match(getters, /command: state\.sshInfo\.command \|\| ''/)
    assert.doesNotMatch(getters, /"password":"\$\{/)
})

test('SSH request is URL encoded before use in HTTP and WebSocket URLs', () => {
    const commonApi = fs.readFileSync(
        path.join(__dirname, '../src/api/common.js'),
        'utf8'
    )
    const terminal = fs.readFileSync(
        path.join(__dirname, '../src/components/Terminal.vue'),
        'utf8'
    )

    assert.match(commonApi, /encodeURIComponent\(sshInfo\)/)
    assert.match(terminal, /encodeURIComponent\(sshReq\)/)
})
