const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const component = fs.readFileSync(
    path.join(__dirname, '../src/components/CommandDrawer.vue'),
    'utf8'
)

test('opens the command drawer on trigger hover', () => {
    assert.match(component, /@mouseenter\.native="showDrawer"/)
    assert.match(component, /@mouseleave\.native="scheduleDrawerClose"/)
})

test('keeps the drawer open while hovered and schedules closing on leave', () => {
    assert.match(component, /@mouseenter="cancelDrawerClose"/)
    assert.match(component, /@mouseleave="scheduleDrawerClose"/)
    assert.match(component, /setTimeout\(\(\) => \{[\s\S]*drawerVisible = false[\s\S]*\}, 150\)/)
})

test('does not use a modal overlay for hover interaction', () => {
    assert.match(component, /:modal="false"/)
})
