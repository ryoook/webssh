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

test('Terminal exposes insertText using paste without enter', () => {
    assert.match(terminal, /insertText\s*\(/)
    assert.match(terminal, /this\.term\.paste\(/)
    assert.doesNotMatch(terminal, /insertText[\s\S]{0,200}paste\([^)]*\\r/)
})

test('Tabs exposes insertToCurrentTerm for the active tab', () => {
    assert.match(tabs, /insertToCurrentTerm\s*\(/)
    assert.match(tabs, /insertText\(/)
})
