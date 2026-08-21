const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const terminal = fs.readFileSync(
    path.join(__dirname, '../src/components/Terminal.vue'),
    'utf8'
)
const tabs = fs.readFileSync(
    path.join(__dirname, '../src/components/Tabs.vue'),
    'utf8'
)

test('closes the tab when the websocket disconnect message is dismissed', () => {
    assert.match(terminal, /onClose:\s*\(\)\s*=>\s*\{[\s\S]*\$emit\('close-tab'\)/)
    assert.match(tabs, /@close-tab="closeDisconnectedTab\(item\.name\)"/)
    assert.match(tabs, /closeDisconnectedTab\s*\(/)
})
