const { decodeConnections, migrateConnections } = require('./connections')
const { decodeCommands } = require('./commands')

function decodeLegacyList(encoded) {
    return decodeConnections(encoded)
}

function shouldMigrate(serverConnections, serverCommands, legacy) {
    const serverEmpty = (!serverConnections || serverConnections.length === 0)
        && (!serverCommands || serverCommands.length === 0)
    const legacyPresent = (legacy.connections && legacy.connections.length > 0)
        || (legacy.commands && legacy.commands.length > 0)
    return serverEmpty && legacyPresent
}

function readLegacyLocalStorage(storage) {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage)
    if (!store) {
        return { connections: [], commands: [] }
    }
    const hasConn = Object.prototype.hasOwnProperty.call(store, 'sshList')
    const hasCmd = Object.prototype.hasOwnProperty.call(store, 'commandList')
    const connections = hasConn
        ? migrateConnections(decodeConnections(store.getItem('sshList')))
        : []
    const commands = hasCmd
        ? decodeCommands(store.getItem('commandList'))
        : []
    return { connections, commands }
}

function clearLegacyLocalStorage(storage) {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage)
    if (!store) {
        return
    }
    store.removeItem('sshList')
    store.removeItem('commandList')
}

module.exports = {
    clearLegacyLocalStorage,
    decodeLegacyList,
    readLegacyLocalStorage,
    shouldMigrate
}
