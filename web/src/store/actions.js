import { Message } from 'element-ui'
import {
    getConnections,
    putConnections,
    getCommands,
    putCommands
} from '@/api/config'
import {
    clearLegacyLocalStorage,
    readLegacyLocalStorage,
    shouldMigrate
} from '@/utils/migrate'

async function reloadAll(commit) {
    const [connections, commands] = await Promise.all([
        getConnections(),
        getCommands()
    ])
    commit('SET_CONNECTIONS', connections)
    commit('SET_COMMANDS', commands)
    return { connections, commands }
}

export default {
    setLanguage({ commit }, language) {
        commit('SET_LANGUAGE', language)
    },
    async loadAndMigrate({ commit }) {
        const { connections, commands } = await reloadAll(commit)
        const legacy = readLegacyLocalStorage()
        if (shouldMigrate(connections, commands, legacy)) {
            if (legacy.connections.length > 0) {
                await putConnections(legacy.connections)
            }
            if (legacy.commands.length > 0) {
                await putCommands(legacy.commands)
            }
            clearLegacyLocalStorage()
            await reloadAll(commit)
            return
        }
        if (legacy.connections.length > 0 || legacy.commands.length > 0) {
            clearLegacyLocalStorage()
        }
    },
    async upsertConnection({ commit, state }, connection) {
        commit('UPSERT_CONNECTION', connection)
        try {
            await putConnections(state.sshList)
        } catch (error) {
            Message.error('保存连接失败')
            await reloadAll(commit)
            throw error
        }
    },
    async deleteConnection({ commit, state }, id) {
        commit('DELETE_CONNECTION', id)
        try {
            await putConnections(state.sshList)
        } catch (error) {
            Message.error('删除连接失败')
            await reloadAll(commit)
            throw error
        }
    },
    async upsertCommand({ commit, state }, command) {
        commit('UPSERT_COMMAND', command)
        try {
            await putCommands(state.commandList)
        } catch (error) {
            Message.error('保存命令失败')
            await reloadAll(commit)
            throw error
        }
    },
    async deleteCommand({ commit, state }, id) {
        commit('DELETE_COMMAND', id)
        try {
            await putCommands(state.commandList)
        } catch (error) {
            Message.error('删除命令失败')
            await reloadAll(commit)
            throw error
        }
    }
}
