<template>
    <div>
        <div :id="id"></div>
    </div>
</template>

<script>
import { checkSSH } from '@/api/common'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { AttachAddon } from 'xterm-addon-attach'

export default {
    name: 'Terminal',
    props: ['id'],
    data() {
        return {
            term: null,
            ws: null,
            resetClose: false,
            manuallyClosed: false,
            reconnectAttempts: 0,
            reconnectTimer: null,
            reconnectDisabled: false,
            heartbeatTimer: null,
            visibilityHandler: null,
            ssh: null,
            savePass: false,
            fontSize: 15
        }
    },
    mounted() {
        this.visibilityHandler = () => {
            if (!document.hidden && !this.isWebSocketOpen()) {
                this.reconnect()
            }
        }
        document.addEventListener('visibilitychange', this.visibilityHandler)
        this.createTerm()
    },
    methods: {
        setSSH() {
            this.$store.commit('SET_SSH', this.ssh)
        },
        insertText(text) {
            if (!this.term || text == null || text === '') {
                return false
            }
            this.term.paste(String(text))
            return true
        },
        resizeTerm(termWeb) {
            termWeb.style.height = (document.body.clientHeight - 28) + 'px'
        },
        createTerm() {
            if (this.$store.state.sshInfo.password === '') {
                return
            }
            const termWeb = document.getElementById(this.id)
            this.resizeTerm(termWeb)
            this.close()
            const fitAddon = new FitAddon()
            this.term = new Terminal()
            this.term.loadAddon(fitAddon)
            this.term.open(document.getElementById(this.id))
            try { fitAddon.fit() } catch (e) {/**/}
            this.manuallyClosed = false
            this.reconnectDisabled = false
            const self = this
            this.connectWebSocket()
            this.term.attachCustomKeyEventHandler((e) => {
                const keyArray = ['F5', 'F11', 'F12']
                if (keyArray.indexOf(e.key) > -1) {
                    return false
                }
                // ctrl + v
                if (e.ctrlKey && e.key === 'v') {
                    document.execCommand('copy')
                    return false
                }
                // ctrl + c
                if (e.ctrlKey && e.key === 'c' && self.term.hasSelection()) {
                    document.execCommand('copy')
                    return false
                }
            })
            // detect available wheel event
            // 各个厂商的高版本浏览器都支持"wheel"
            // Webkit 和 IE一定支持"mousewheel"
            // "DOMMouseScroll" 用于低版本的firefox
            const wheelSupport = 'onwheel' in document.createElement('div') ? 'wheel' : document.onmousewheel !== undefined ? 'mousewheel' : 'DOMMouseScroll'
            termWeb.addEventListener(wheelSupport, (e) => {
                if (e.ctrlKey) {
                    e.preventDefault()
                    if (e.deltaY < 0) {
                        self.term.setOption('fontSize', ++this.fontSize)
                    } else {
                        self.term.setOption('fontSize', --this.fontSize)
                    }
                    try { fitAddon.fit() } catch (e) {/**/}
                    if (self.isWebSocketOpen()) {
                        self.ws.send(`resize:${self.term.rows}:${self.term.cols}`)
                    }
                }
            })
            window.addEventListener('resize', () => {
                self.resizeTerm(termWeb)
                try { fitAddon.fit() } catch (e) {/**/}
                if (self.isWebSocketOpen()) {
                    self.ws.send(`resize:${self.term.rows}:${self.term.cols}`)
                }
            })
        },
        connectWebSocket() {
            let closeTip = '已超时关闭!'
            if (this.$store.state.language === 'en') {
                closeTip = 'Connection timed out!'
            }
            const prefix = process.env.NODE_ENV === 'production' ? '' : '/ws'
            const sshReq = this.$store.getters.sshReq
            const ws = new WebSocket(`${(location.protocol === 'http:' ? 'ws' : 'wss')}://${location.host}${prefix}/term?sshInfo=${encodeURIComponent(sshReq)}&rows=${this.term.rows}&cols=${this.term.cols}&closeTip=${encodeURIComponent(closeTip)}`)
            this.ws = ws
            ws.onopen = () => {
                console.log(Date(), 'onopen')
                if (this.ws !== ws) return
                this.reconnectAttempts = 0
                this.startHeartbeat()
                this.connected()
            }
            ws.onclose = () => {
                console.log(Date(), 'onclose')
                if (this.ws !== ws) return
                this.stopHeartbeat()
                this.ws = null
                if (this.resetClose || this.manuallyClosed) {
                    this.resetClose = false
                    return
                }
                if (document.hidden) return
                if (this.reconnectAttempts > 0) {
                    this.reconnect()
                    return
                }
                this.showDisconnectedMessage()
            }
            ws.onerror = () => {
                console.log(Date(), 'onerror')
            }
            const attachAddon = new AttachAddon(ws)
            this.term.loadAddon(attachAddon)
        },
        isWebSocketOpen() {
            return this.ws !== null && this.ws.readyState === WebSocket.OPEN
        },
        isWebSocketActive() {
            return this.ws !== null && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
        },
        startHeartbeat() {
            this.stopHeartbeat()
            this.heartbeatTimer = setInterval(() => {
                if (this.isWebSocketOpen()) this.ws.send('ping')
            }, 30000)
        },
        stopHeartbeat() {
            clearInterval(this.heartbeatTimer)
            this.heartbeatTimer = null
        },
        reconnect() {
            if (this.manuallyClosed || this.reconnectDisabled || document.hidden || this.reconnectTimer || this.isWebSocketActive()) return
            if (this.reconnectAttempts >= 5) {
                this.showDisconnectedMessage()
                return
            }
            const delays = [1000, 2000, 4000, 6000]
            const delay = delays[Math.min(this.reconnectAttempts, delays.length - 1)]
            this.reconnectAttempts++
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null
                if (!document.hidden && !this.manuallyClosed && !this.reconnectDisabled) this.connectWebSocket()
            }, delay)
        },
        showDisconnectedMessage() {
            if (this.reconnectDisabled || this.manuallyClosed) return
            this.reconnectDisabled = true
            if (!this.savePass) {
                this.$store.commit('SET_PASS', '')
                if (this.ssh) this.ssh.password = ''
            }
            this.$message({
                message: this.$t('wsClose'),
                type: 'warning',
                duration: 0,
                showClose: true,
                onClose: () => {
                    this.$emit('close-tab')
                }
            })
        },
        async connected() {
            const sshInfo = this.$store.state.sshInfo
            // 深度拷贝对象
            this.ssh = Object.assign({}, sshInfo)
            // 校验ssh连接信息是否正确
            const result = await checkSSH(this.$store.getters.sshReq)
            if (result.Msg !== 'success') {
                return
            } else {
                this.savePass = result.Data.savePass
            }
            document.title = sshInfo.host
        },
        close() {
            this.manuallyClosed = true
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
            this.stopHeartbeat()
            if (this.ws !== null) {
                this.ws.close()
                this.resetClose = true
            }
            if (this.term !== null) {
                this.term.dispose()
            }
        }
    },
    beforeDestroy() {
        document.removeEventListener('visibilitychange', this.visibilityHandler)
        this.close()
    }
}
</script>
