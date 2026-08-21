const test = require('node:test')
const assert = require('node:assert/strict')

const {
    shouldMigrate,
    decodeLegacyList
} = require('../src/utils/migrate')

test('decodeLegacyList returns empty for missing or bad data', () => {
    assert.deepEqual(decodeLegacyList(null), [])
    assert.deepEqual(decodeLegacyList('not-base64'), [])
})

test('decodeLegacyList decodes base64 json arrays', () => {
    const encoded = Buffer.from(JSON.stringify([{ id: '1', host: 'a' }])).toString('base64')
    assert.deepEqual(decodeLegacyList(encoded), [{ id: '1', host: 'a' }])
})

test('shouldMigrate only when server empty and legacy present', () => {
    assert.equal(shouldMigrate([], [], { connections: [{ id: '1' }], commands: [] }), true)
    assert.equal(shouldMigrate([], [], { connections: [], commands: [{ id: 'c' }] }), true)
    assert.equal(shouldMigrate([{ id: '1' }], [], { connections: [{ id: '2' }], commands: [] }), false)
    assert.equal(shouldMigrate([], [], { connections: [], commands: [] }), false)
})
