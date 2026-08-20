const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('uses compact tab dimensions and matching terminal offset', () => {
    const elementStyles = fs.readFileSync(
        path.join(__dirname, '../src/styles/element-ui.scss'),
        'utf8'
    )
    const terminalComponent = fs.readFileSync(
        path.join(__dirname, '../src/components/Terminal.vue'),
        'utf8'
    )

    assert.match(elementStyles, /height:\s*26px/)
    assert.match(elementStyles, /line-height:\s*26px/)
    assert.match(elementStyles, /font-size:\s*12px/)
    assert.match(elementStyles, /padding:\s*0 8px/)
    assert.match(terminalComponent, /clientHeight - 28/)
})
