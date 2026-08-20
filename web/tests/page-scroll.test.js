const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

test('prevents the page shell from scrolling outside the terminal', () => {
    const globalStyles = fs.readFileSync(
        path.join(__dirname, '../src/styles/index.scss'),
        'utf8'
    )
    const app = fs.readFileSync(
        path.join(__dirname, '../src/App.vue'),
        'utf8'
    )

    assert.match(globalStyles, /html,\s*body\s*\{[\s\S]*overflow:\s*hidden/)
    assert.match(app, /<el-main style="padding:\s*0;\s*overflow:\s*hidden">/)
})
