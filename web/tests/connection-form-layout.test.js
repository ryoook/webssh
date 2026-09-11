const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('connection form reserves enough width for the username label', () => {
    const component = fs.readFileSync(
        path.join(__dirname, '../src/components/ConnectionDrawer.vue'),
        'utf8'
    )

    assert.match(component, /label-width="110px"/)
})

test('connection form supports toggling SSH pseudo-terminal allocation', () => {
    const component = fs.readFileSync(
        path.join(__dirname, '../src/components/ConnectionDrawer.vue'),
        'utf8'
    )

    assert.match(component, /v-model="form\.requesttty"/)
    assert.match(component, /requesttty: true/)
})

test('connection form supports a custom SSH startup command', () => {
    const component = fs.readFileSync(
        path.join(__dirname, '../src/components/ConnectionDrawer.vue'),
        'utf8'
    )

    assert.match(component, /v-model="form\.command"/)
    assert.match(component, /command: ''/)
})
