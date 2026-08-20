const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, relativePath), 'utf8')
}

test('moves file browser entry from drawer to tab context menu', () => {
    const drawer = read('../src/components/ConnectionDrawer.vue')
    const tabs = read('../src/components/Tabs.vue')

    assert.doesNotMatch(drawer, /<file-list/)
    assert.match(tabs, /@click="openFileBrowser\(\)"/)
    assert.match(tabs, /<file-list ref="fileList" :show-button="false"/)
})

test('file browser exposes a programmatic open method', () => {
    const fileList = read('../src/components/FileList.vue')

    assert.match(fileList, /props:\s*\{[\s\S]*showButton/)
    assert.match(fileList, /openBrowser\(\)/)
})

test('tab menu switches to the targeted connection before opening files', () => {
    const tabs = read('../src/components/Tabs.vue')

    assert.match(tabs, /this\.\$refs\[`\$\{this\.menuTab\}`\]\[0\]\.setSSH\(\)/)
    assert.match(tabs, /this\.\$refs\.fileList\.openBrowser\(\)/)
})
