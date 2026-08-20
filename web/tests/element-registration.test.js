const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const elementSetup = fs.readFileSync(
    path.join(__dirname, '../src/utils/element.js'),
    'utf8'
)

const requiredComponents = [
    'Drawer',
    'Empty',
    'InputNumber',
    'RadioGroup',
    'RadioButton'
]

requiredComponents.forEach(component => {
    test(`registers Element UI ${component}`, () => {
        assert.match(elementSetup, new RegExp(`Vue\\.use\\(${component}\\)`))
    })
})

test('registers the Element UI confirmation dialog', () => {
    assert.match(elementSetup, /Vue\.prototype\.\$confirm = MessageBox\.confirm/)
})
