import { getLanguage } from '@/lang/index'

export default {
    sshInfo: {
        host: '',
        username: 'root',
        port: 22,
        password: '',
        logintype: 0
    },
    sshList: [],
    commandList: [],
    configLoaded: false,
    termList: [],
    currentTab: {},
    language: getLanguage()
}
