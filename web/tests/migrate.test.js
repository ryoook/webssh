const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
    shouldMigrateResource,
    decodeLegacyList,
    clearLegacyLocalStorage
} = require('../src/utils/migrate')

function mockStorage(initial) {
    return Object.assign({
        removeItem(key) {
            delete this[key]
        }
    }, initial)
}

test('decodeLegacyList returns empty for missing or bad data', () => {
    assert.deepEqual(decodeLegacyList(null), [])
    assert.deepEqual(decodeLegacyList('not-base64'), [])
})

test('decodeLegacyList decodes base64 json arrays', () => {
    const encoded = Buffer.from(JSON.stringify([{ id: '1', host: 'a' }])).toString('base64')
    assert.deepEqual(decodeLegacyList(encoded), [{ id: '1', host: 'a' }])
})

test('shouldMigrateResource only when that server list is empty and legacy is present', () => {
    assert.equal(shouldMigrateResource([], [{ id: '1' }]), true)
    assert.equal(shouldMigrateResource(null, [{ id: '1' }]), true)
    assert.equal(shouldMigrateResource([{ id: '1' }], [{ id: '2' }]), false)
    assert.equal(shouldMigrateResource([], []), false)
    assert.equal(shouldMigrateResource([], null), false)
    assert.equal(shouldMigrateResource([{ id: '1' }], []), false)
})

test('connections and commands migrate independently when the other side already has server data', () => {
    const serverConnections = [{ id: 'server-conn' }]
    const serverCommands = []
    const legacy = {
        connections: [{ id: 'legacy-conn' }],
        commands: [{ id: 'legacy-cmd' }]
    }

    assert.equal(shouldMigrateResource(serverConnections, legacy.connections), false)
    assert.equal(shouldMigrateResource(serverCommands, legacy.commands), true)
})

test('clearLegacyLocalStorage removes only requested keys', () => {
    const store = mockStorage({
        sshList: 'conn',
        commandList: 'cmd',
        language: 'zh'
    })

    clearLegacyLocalStorage(store, ['sshList'])

    assert.equal(Object.prototype.hasOwnProperty.call(store, 'sshList'), false)
    assert.equal(store.commandList, 'cmd')
    assert.equal(store.language, 'zh')
})

test('clearLegacyLocalStorage does not clear both keys when called with one key', () => {
    const store = mockStorage({
        sshList: 'conn',
        commandList: 'cmd'
    })

    clearLegacyLocalStorage(store, ['commandList'])

    assert.equal(store.sshList, 'conn')
    assert.equal(Object.prototype.hasOwnProperty.call(store, 'commandList'), false)
})

test('loadAndMigrate uses per-resource helpers and only clears migrated keys', () => {
    const actions = fs.readFileSync(
        path.join(__dirname, '../src/store/actions.js'),
        'utf8'
    )

    assert.match(actions, /shouldMigrateResource\(connections,\s*legacy\.connections\)/)
    assert.match(actions, /shouldMigrateResource\(commands,\s*legacy\.commands\)/)
    assert.match(actions, /clearLegacyLocalStorage\(undefined,\s*\['sshList'\]\)/)
    assert.match(actions, /clearLegacyLocalStorage\(undefined,\s*\['commandList'\]\)/)
    assert.doesNotMatch(actions, /shouldMigrate\(/)
    assert.doesNotMatch(actions, /if \(legacy\.connections\.length > 0 \|\| legacy\.commands\.length > 0\)/)
})

test('store blocks PUT until configLoaded after successful GET', () => {
    const state = fs.readFileSync(
        path.join(__dirname, '../src/store/state.js'),
        'utf8'
    )
    const mutations = fs.readFileSync(
        path.join(__dirname, '../src/store/mutations.js'),
        'utf8'
    )
    const actions = fs.readFileSync(
        path.join(__dirname, '../src/store/actions.js'),
        'utf8'
    )

    assert.match(state, /configLoaded:\s*false/)
    assert.match(mutations, /SET_CONFIG_LOADED/)
    assert.match(actions, /commit\('SET_CONFIG_LOADED',\s*true\)/)
    assert.match(actions, /if\s*\(!state\.configLoaded\)/)
    assert.match(actions, /Message\.warning/)
})

test('drawers await persist dispatch before closing forms or assuming delete', () => {
    const connectionDrawer = fs.readFileSync(
        path.join(__dirname, '../src/components/ConnectionDrawer.vue'),
        'utf8'
    )
    const commandDrawer = fs.readFileSync(
        path.join(__dirname, '../src/components/CommandDrawer.vue'),
        'utf8'
    )

    assert.match(
        connectionDrawer,
        /await this\.\$store\.dispatch\('upsertConnection', connection\)/
    )
    assert.match(
        connectionDrawer,
        /await this\.\$store\.dispatch\('deleteConnection', connection\.id\)/
    )
    assert.match(
        commandDrawer,
        /await this\.\$store\.dispatch\('upsertCommand'/
    )
    assert.match(
        commandDrawer,
        /await this\.\$store\.dispatch\('deleteCommand', command\.id\)/
    )
})
