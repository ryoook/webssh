const test = require('node:test')
const assert = require('node:assert/strict')

const {
    decodeCommands,
    encodeCommands,
    upsertCommand,
    removeCommand
} = require('../src/utils/commands')

test('decodes an empty or encoded command list', () => {
    assert.deepEqual(decodeCommands(null), [])

    const encoded = Buffer.from(JSON.stringify([
        { id: 'one', name: 'ls', content: 'ls -la' }
    ])).toString('base64')
    assert.deepEqual(decodeCommands(encoded), [
        { id: 'one', name: 'ls', content: 'ls -la' }
    ])
})

test('returns an empty list for malformed stored data', () => {
    assert.deepEqual(decodeCommands('not-base64-json'), [])
})

test('encodes data that can be decoded again', () => {
    const commands = [{ id: 'one', name: 'df', content: 'df -h' }]
    assert.deepEqual(decodeCommands(encodeCommands(commands)), commands)
})

test('adds and updates commands without mutating the input list', () => {
    const original = [{ id: 'one', name: 'old', content: 'echo old' }]
    const added = upsertCommand(original, { id: 'two', name: 'new', content: 'echo new' })
    const updated = upsertCommand(original, { id: 'one', name: 'updated', content: 'echo updated' })

    assert.deepEqual(original, [{ id: 'one', name: 'old', content: 'echo old' }])
    assert.deepEqual(added, [
        { id: 'one', name: 'old', content: 'echo old' },
        { id: 'two', name: 'new', content: 'echo new' }
    ])
    assert.deepEqual(updated, [{ id: 'one', name: 'updated', content: 'echo updated' }])
})

test('removes a command by id without mutating the input list', () => {
    const original = [
        { id: 'one', name: 'a', content: 'echo a' },
        { id: 'two', name: 'b', content: 'echo b' }
    ]

    assert.deepEqual(removeCommand(original, 'one'), [
        { id: 'two', name: 'b', content: 'echo b' }
    ])
    assert.equal(original.length, 2)
})
