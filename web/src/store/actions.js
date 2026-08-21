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
    shouldMigrateResource
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

function guardConfigLoaded(state) {
    if (!state.configLoaded) {
        Message.warning('配置尚未加载完成，请稍后重试')
        throw new Error('config not loaded')
    }
}

export default {
    setLanguage({ commit }, language) {
        commit('SET_LANGUAGE', language)
    },
    async loadAndMigrate({ commit }) {
        const { connections, commands } = await reloadAll(commit)
        commit('SET_CONFIG_LOADED', true)
        const legacy = readLegacyLocalStorage()
        let migrated = false
        try {
            if (shouldMigrateResource(connections, legacy.connections)) {
                await putConnections(legacy.connections)
                clearLegacyLocalStorage(undefined, ['sshList'])
                migrated = true
            }
            if (shouldMigrateResource(commands, legacy.commands)) {
                await putCommands(legacy.commands)
                clearLegacyLocalStorage(undefined, ['commandList'])
                migrated = true
            }
        } finally {
            if (migrated) {
                await reloadAll(commit)
            }
        }
    },
    async upsertConnection({ commit, state }, connection) {
        guardConfigLoaded(state)
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
        guardConfigLoaded(state)
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
        guardConfigLoaded(state)
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
        guardConfigLoaded(state)
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
