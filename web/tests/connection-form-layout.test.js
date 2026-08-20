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
