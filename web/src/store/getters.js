function encodeBase64(value) {
    const bytes = new TextEncoder().encode(value)
    let binary = ''
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte)
    })
    return window.btoa(binary)
}

export default {
    sshReq: state => encodeBase64(JSON.stringify({
        username: state.sshInfo.username,
        ipaddress: state.sshInfo.host,
        port: Number(state.sshInfo.port),
        password: state.sshInfo.password,
        logintype: state.sshInfo.logintype === undefined ? 0 : state.sshInfo.logintype,
        requesttty: state.sshInfo.requesttty !== false,
        command: state.sshInfo.command || ''
    }))
}
