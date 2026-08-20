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

function decodeCommands(encoded) {
    if (!encoded) {
        return []
    }
    try {
        const commands = JSON.parse(decodeBase64(encoded))
        return Array.isArray(commands) ? commands : []
    } catch (error) {
        return []
    }
}

function encodeCommands(commands) {
    return encodeBase64(JSON.stringify(commands))
}

function createCommandId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function upsertCommand(commands, command) {
    const index = commands.findIndex(item => item.id === command.id)
    if (index === -1) {
        return commands.concat([Object.assign({}, command)])
    }
    return commands.map(item => item.id === command.id
        ? Object.assign({}, command)
        : Object.assign({}, item)
    )
}

function removeCommand(commands, id) {
    return commands
        .filter(command => command.id !== id)
        .map(command => Object.assign({}, command))
}

module.exports = {
    createCommandId,
    decodeCommands,
    encodeCommands,
    removeCommand,
    upsertCommand
}
