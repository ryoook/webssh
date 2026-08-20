import { getLanguage } from '@/lang/index'
import {
    decodeConnections,
    encodeConnections,
    migrateConnections
} from '@/utils/connections'

const storedConnections = Object.prototype.hasOwnProperty.call(localStorage, 'sshList')
    ? localStorage.getItem('sshList')
    : null
const migratedConnections = migrateConnections(decodeConnections(storedConnections))
const encodedConnections = storedConnections === null
    ? null
    : encodeConnections(migratedConnections)

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
    termList: [],
    currentTab: {},
    language: getLanguage()
}
