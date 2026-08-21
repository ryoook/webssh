import request from '@/utils/request'

export function getConnections() {
    return request.get('/connections')
}

export function putConnections(list) {
    return request.put('/connections', list)
}

export function getCommands() {
    return request.get('/commands')
}

export function putCommands(list) {
    return request.put('/commands', list)
}
