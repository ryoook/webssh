function encodeBase64(value) {
    if (typeof window === 'undefined') {
        return Buffer.from(value, 'utf8').toString('base64')
    }
    const bytes = new TextEncoder().encode(value)
    let binary = ''
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte)
    })
    return window.btoa(binary)
}

function decodeBase64(value) {
    if (typeof window === 'undefined') {
        return Buffer.from(value, 'base64').toString('utf8')
    }
    const binary = window.atob(value)
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    return new TextDecoder().decode(bytes)
}

function decodeConnections(encoded) {
    if (!encoded) {
        return []
    }
    try {
        const connections = JSON.parse(decodeBase64(encoded))
        return Array.isArray(connections) ? connections : []
    } catch (error) {
        return []
    }
}

function encodeConnections(connections) {
    return encodeBase64(JSON.stringify(connections))
}

function createConnectionId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function migrateConnections(connections, idFactory = createConnectionId) {
    return connections.map(connection => connection.id
        ? Object.assign({}, connection)
        : Object.assign({ id: idFactory() }, connection)
    )
}

function upsertConnection(connections, connection) {
    const index = connections.findIndex(item => item.id === connection.id)
    if (index === -1) {
        return connections.concat([Object.assign({}, connection)])
    }
    return connections.map(item => item.id === connection.id
        ? Object.assign({}, connection)
        : Object.assign({}, item)
    )
}

function removeConnection(connections, id) {
    return connections
        .filter(connection => connection.id !== id)
        .map(connection => Object.assign({}, connection))
}

module.exports = {
    createConnectionId,
    decodeConnections,
    encodeConnections,
    migrateConnections,
    removeConnection,
    upsertConnection
}
