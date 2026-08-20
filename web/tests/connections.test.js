const test = require('node:test')
const assert = require('node:assert/strict')

const {
    decodeConnections,
    encodeConnections,
    migrateConnections,
    upsertConnection,
    removeConnection
} = require('../src/utils/connections')

test('decodes an empty or encoded connection list', () => {
    assert.deepEqual(decodeConnections(null), [])

    const encoded = Buffer.from(JSON.stringify([{ host: 'server.example.com' }])).toString('base64')
    assert.deepEqual(decodeConnections(encoded), [{ host: 'server.example.com' }])
})

test('returns an empty list for malformed stored data', () => {
    assert.deepEqual(decodeConnections('not-base64-json'), [])
})

test('migrates legacy connections without replacing existing ids', () => {
    let nextId = 0
    const migrated = migrateConnections([
        { host: 'legacy.example.com' },
        { id: 'existing-id', host: 'current.example.com' }
    ], () => `generated-${++nextId}`)

    assert.deepEqual(migrated, [
        { id: 'generated-1', host: 'legacy.example.com' },
        { id: 'existing-id', host: 'current.example.com' }
    ])
})

test('encodes data that can be decoded again', () => {
    const connections = [{ id: 'one', host: 'server.example.com' }]
    assert.deepEqual(decodeConnections(encodeConnections(connections)), connections)
})

test('adds and updates connections without mutating the input list', () => {
    const original = [{ id: 'one', host: 'old.example.com' }]
    const added = upsertConnection(original, { id: 'two', host: 'new.example.com' })
    const updated = upsertConnection(original, { id: 'one', host: 'updated.example.com' })

    assert.deepEqual(original, [{ id: 'one', host: 'old.example.com' }])
    assert.deepEqual(added, [
        { id: 'one', host: 'old.example.com' },
        { id: 'two', host: 'new.example.com' }
    ])
    assert.deepEqual(updated, [{ id: 'one', host: 'updated.example.com' }])
})

test('removes a connection by id without mutating the input list', () => {
    const original = [
        { id: 'one', host: 'one.example.com' },
        { id: 'two', host: 'two.example.com' }
    ]

    assert.deepEqual(removeConnection(original, 'one'), [
        { id: 'two', host: 'two.example.com' }
    ])
    assert.equal(original.length, 2)
})
