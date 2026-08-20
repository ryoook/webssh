import {
    createConnectionId,
    decodeConnections,
    encodeConnections,
    removeConnection,
    upsertConnection
} from '@/utils/connections'
import {
    createCommandId,
    decodeCommands,
    encodeCommands,
    removeCommand,
    upsertCommand
} from '@/utils/commands'

function persistConnections(state, connections) {
    const encoded = encodeConnections(connections)
    state.sshList = encoded
    localStorage.setItem('sshList', encoded)
}

function persistCommands(state, commands) {
    const encoded = encodeCommands(commands)
    state.commandList = encoded
    localStorage.setItem('commandList', encoded)
}

export default {
    SET_PASS(state, pass) {
        state.sshInfo.password = pass
    },
    SET_LIST(state, list) {
        state.sshList = list
        localStorage.setItem('sshList', list)
    },
    UPSERT_CONNECTION(state, connection) {
        const normalizedConnection = connection.id
            ? connection
            : Object.assign({ id: createConnectionId() }, connection)
        persistConnections(
            state,
            upsertConnection(decodeConnections(state.sshList), normalizedConnection)
        )
    },
    DELETE_CONNECTION(state, id) {
        persistConnections(
            state,
            removeConnection(decodeConnections(state.sshList), id)
        )
    },
    UPSERT_COMMAND(state, command) {
        const normalizedCommand = command.id
            ? command
            : Object.assign({ id: createCommandId() }, command)
        persistCommands(
            state,
            upsertCommand(decodeCommands(state.commandList), normalizedCommand)
        )
    },
    DELETE_COMMAND(state, id) {
        persistCommands(
            state,
            removeCommand(decodeCommands(state.commandList), id)
        )
    },
    SET_TERMLIST(state, list) {
        state.termList = list
    },
    SET_SSH(state, ssh) {
        state.sshInfo.host = ssh.host
        state.sshInfo.username = ssh.username
        state.sshInfo.port = ssh.port
        state.sshInfo.logintype = ssh.logintype
        if (ssh.password !== undefined) {
            state.sshInfo.password = ssh.password
        }
    },
    SET_TAB(state, tab) {
        state.currentTab = tab
    },
    SET_LANGUAGE: (state, language) => {
        state.language = language
        localStorage.setItem('language', language)
    }
}
