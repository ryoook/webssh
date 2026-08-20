import { getLanguage } from '@/lang/index'
import {
    decodeConnections,
    encodeConnections,
    migrateConnections
} from '@/utils/connections'
import {
    decodeCommands,
    encodeCommands
} from '@/utils/commands'

const storedConnections = Object.prototype.hasOwnProperty.call(localStorage, 'sshList')
    ? localStorage.getItem('sshList')
    : null
const migratedConnections = migrateConnections(decodeConnections(storedConnections))
const encodedConnections = storedConnections === null
    ? null
    : encodeConnections(migratedConnections)

const storedCommands = Object.prototype.hasOwnProperty.call(localStorage, 'commandList')
    ? localStorage.getItem('commandList')
    : null
const encodedCommands = storedCommands === null
    ? null
    : encodeCommands(decodeCommands(storedCommands))

if (encodedConnections !== null && encodedConnections !== storedConnections) {
    localStorage.setItem('sshList', encodedConnections)
}

export default {
    sshInfo: {
        host: '',
        username: 'root',
        port: 22,
        password: '',
        logintype: 0
    },
    sshList: encodedConnections,
    commandList: encodedCommands,
    termList: [],
    currentTab: {},
    language: getLanguage()
}
