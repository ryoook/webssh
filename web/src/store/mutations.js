import { createConnectionId, removeConnection, upsertConnection } from '@/utils/connections'
import { createCommandId, removeCommand, upsertCommand } from '@/utils/commands'

export default {
    SET_PASS(state, pass) {
        state.sshInfo.password = pass
    },
    SET_CONNECTIONS(state, list) {
        state.sshList = Array.isArray(list) ? list : []
    },
    SET_COMMANDS(state, list) {
        state.commandList = Array.isArray(list) ? list : []
    },
    UPSERT_CONNECTION(state, connection) {
        const normalized = connection.id
            ? connection
            : Object.assign({ id: createConnectionId() }, connection)
        state.sshList = upsertConnection(state.sshList, normalized)
    },
    DELETE_CONNECTION(state, id) {
        state.sshList = removeConnection(state.sshList, id)
    },
    UPSERT_COMMAND(state, command) {
        const normalized = command.id
            ? command
            : Object.assign({ id: createCommandId() }, command)
        state.commandList = upsertCommand(state.commandList, normalized)
    },
    DELETE_COMMAND(state, id) {
        state.commandList = removeCommand(state.commandList, id)
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
