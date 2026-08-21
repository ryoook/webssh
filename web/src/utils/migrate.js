const { decodeConnections, migrateConnections } = require('./connections')
const { decodeCommands } = require('./commands')

function decodeLegacyList(encoded) {
    return decodeConnections(encoded)
}

function shouldMigrateResource(serverList, legacyList) {
    const serverEmpty = !serverList || serverList.length === 0
    const legacyPresent = !!(legacyList && legacyList.length > 0)
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

function clearLegacyLocalStorage(storage, keys) {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage)
    if (!store || !keys || keys.length === 0) {
        return
    }
    keys.forEach(key => {
        store.removeItem(key)
    })
}

module.exports = {
    clearLegacyLocalStorage,
    decodeLegacyList,
    readLegacyLocalStorage,
    shouldMigrateResource
}
