<template>
    <div class="connection-drawer">
        <el-button
            class="connection-trigger"
            type="primary"
            icon="el-icon-connection"
            @click="showDrawer"
            @mouseenter.native="showDrawer"
            @mouseleave.native="scheduleDrawerClose"
        >
            {{ $t('Connections') }}
        </el-button>

        <el-drawer
            :visible.sync="drawerVisible"
            direction="rtl"
            :size="drawerWidth"
            :modal="false"
            :with-header="false"
        >
            <div
                class="drawer-surface"
                @mouseenter="cancelDrawerClose"
                @mouseleave="scheduleDrawerClose"
            >
                <div class="drawer-title">
                    <strong>{{ $t('Connections') }}</strong>
                    <el-button type="text" icon="el-icon-close" @click="drawerVisible = false" />
                </div>

                <div class="drawer-content">
                    <div class="drawer-tools">
                        <el-button type="primary" size="small" icon="el-icon-plus" @click="createConnection">
                            {{ $t('NewConnection') }}
                        </el-button>
                        <el-button
                            size="small"
                            :type="managing ? 'warning' : 'default'"
                            icon="el-icon-setting"
                            @click="managing = !managing"
                        >
                            {{ managing ? $t('FinishManaging') : $t('Manage') }}
                        </el-button>
                        <el-button size="small" icon="el-icon-s-flag" @click="handleSetLanguage">
                            {{ languageLabel }}
                        </el-button>
                    </div>

                    <el-empty v-if="connections.length === 0" :description="$t('NoConnections')" />
                    <div v-else class="connection-list">
                        <div
                            v-for="connection in connections"
                            :key="connection.id"
                            class="connection-item"
                            :class="{ managing: managing }"
                            @click="selectConnection(connection)"
                        >
                            <div class="connection-icon">
                                <i class="el-icon-monitor"></i>
                            </div>
                            <div class="connection-summary">
                                <strong>{{ connection.host }}</strong>
                                <span>{{ connection.username }}@{{ connection.host }}:{{ connection.port }}</span>
                                <small>{{ connection.logintype === 1 ? $t('privateKey') : $t('password') }}</small>
                            </div>
                            <div v-if="managing" class="connection-actions">
                                <el-button
                                    type="text"
                                    icon="el-icon-edit"
                                    :title="$t('Edit')"
                                    @click.stop="editConnection(connection)"
                                />
                                <el-button
                                    type="text"
                                    class="delete-button"
                                    icon="el-icon-delete"
                                    :title="$t('Delete')"
                                    @click.stop="confirmDelete(connection)"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </el-drawer>

        <el-dialog
            :title="editing ? $t('EditConnection') : $t('NewConnection')"
            :visible.sync="formVisible"
            :close-on-click-modal="false"
            append-to-body
            width="min(520px, 92%)"
            @closed="resetForm"
        >
            <el-form ref="connectionForm" :model="form" :rules="rules" label-width="110px">
                <el-form-item label="Host" prop="host">
                    <el-input v-model.trim="form.host" :placeholder="$t('hostTip')" />
                </el-form-item>
                <el-form-item label="Port" prop="port">
                    <el-input-number v-model="form.port" :min="1" :max="65535" controls-position="right" />
                </el-form-item>
                <el-form-item label="Username" prop="username">
                    <el-input v-model.trim="form.username" :placeholder="$t('nameTip')" />
                </el-form-item>
                <el-form-item :label="$t('Authentication')">
                    <el-radio-group v-model="form.logintype">
                        <el-radio-button :label="0">{{ $t('password') }}</el-radio-button>
                        <el-radio-button :label="1">{{ $t('privateKey') }}</el-radio-button>
                    </el-radio-group>
                </el-form-item>
                <el-form-item
                    :label="form.logintype === 1 ? $t('privateKey') : $t('password')"
                    prop="password"
                >
                    <el-input
                        v-if="form.logintype === 0"
                        v-model="form.password"
                        type="password"
                        show-password
                        :placeholder="$t('inputTip') + $t('password')"
                        @keyup.enter.native="saveConnection"
                    />
                    <template v-else>
                        <el-input
                            v-model="form.password"
                            type="textarea"
                            :rows="8"
                            :placeholder="$t('keyTip')"
                        />
                        <input
                            ref="privateKeyFile"
                            class="private-key-file"
                            type="file"
                            @change="readPrivateKey"
                        />
                        <el-button class="select-key-button" size="small" @click="$refs.privateKeyFile.click()">
                            {{ $t('SelectFile') }}
                        </el-button>
                    </template>
                </el-form-item>
            </el-form>
            <div slot="footer">
                <el-button @click="formVisible = false">{{ $t('Cancel') }}</el-button>
                <el-button type="primary" @click="saveConnection">{{ $t('Save') }}</el-button>
            </div>
        </el-dialog>
    </div>
</template>

<script>
import { getLanguage } from '@/lang/index'
import {
    createConnectionId,
    decodeConnections
} from '@/utils/connections'

function emptyConnection() {
    return {
        id: createConnectionId(),
        host: '',
        username: 'root',
        port: 22,
        password: '',
        logintype: 0
    }
}

export default {
    name: 'ConnectionDrawer',
    data() {
        const validatePort = (rule, value, callback) => {
            if (!Number.isInteger(value) || value < 1 || value > 65535) {
                callback(new Error(this.$t('InvalidPort')))
                return
            }
            callback()
        }
        return {
            drawerVisible: false,
            formVisible: false,
            managing: false,
            editing: false,
            connectAfterSave: false,
            drawerCloseTimer: null,
            windowWidth: document.documentElement.clientWidth,
            form: emptyConnection(),
            rules: {
                host: [{ required: true, message: this.$t('RequiredValue'), trigger: 'blur' }],
                port: [{ validator: validatePort, trigger: 'change' }],
                username: [{ required: true, message: this.$t('RequiredValue'), trigger: 'blur' }],
                password: [{ required: true, message: this.$t('RequiredValue'), trigger: 'blur' }]
            }
        }
    },
    computed: {
        connections() {
            return decodeConnections(this.$store.state.sshList)
        },
        drawerWidth() {
            return this.windowWidth < 480 ? '100%' : '340px'
        },
        languageLabel() {
            return this.$store.state.language === 'zh' ? 'EN' : '中文'
        }
    },
    mounted() {
        window.addEventListener('resize', this.updateWindowWidth)
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.updateWindowWidth)
        this.cancelDrawerClose()
    },
    methods: {
        showDrawer() {
            this.cancelDrawerClose()
            this.drawerVisible = true
        },
        scheduleDrawerClose() {
            this.cancelDrawerClose()
            this.drawerCloseTimer = setTimeout(() => {
                this.drawerVisible = false
            }, 150)
        },
        cancelDrawerClose() {
            if (this.drawerCloseTimer !== null) {
                clearTimeout(this.drawerCloseTimer)
                this.drawerCloseTimer = null
            }
        },
        updateWindowWidth() {
            this.windowWidth = document.documentElement.clientWidth
        },
        createConnection() {
            this.form = emptyConnection()
            this.editing = false
            this.connectAfterSave = false
            this.formVisible = true
        },
        editConnection(connection, connectAfterSave = false) {
            this.form = Object.assign({}, connection)
            this.editing = true
            this.connectAfterSave = connectAfterSave
            this.formVisible = true
        },
        selectConnection(connection) {
            if (this.managing) {
                return
            }
            if (!connection.password) {
                this.editConnection(connection, true)
                return
            }
            this.openConnection(connection)
        },
        openConnection(connection) {
            this.$emit('connect', Object.assign({}, connection))
            this.drawerVisible = false
        },
        saveConnection() {
            this.$refs.connectionForm.validate(valid => {
                if (!valid) {
                    return
                }
                const connection = Object.assign({}, this.form, {
                    port: Number(this.form.port)
                })
                this.$store.commit('UPSERT_CONNECTION', connection)
                this.formVisible = false
                if (this.connectAfterSave) {
                    this.openConnection(connection)
                }
            })
        },
        confirmDelete(connection) {
            this.$confirm(
                this.$t('DeleteConnectionConfirm', { host: connection.host }),
                this.$t('DeleteConnection'),
                {
                    confirmButtonText: this.$t('OK'),
                    cancelButtonText: this.$t('Cancel'),
                    type: 'warning'
                }
            ).then(() => {
                this.$store.commit('DELETE_CONNECTION', connection.id)
            }).catch(() => {})
        },
        resetForm() {
            this.form = emptyConnection()
            this.editing = false
            this.connectAfterSave = false
            if (this.$refs.connectionForm) {
                this.$refs.connectionForm.clearValidate()
            }
            if (this.$refs.privateKeyFile) {
                this.$refs.privateKeyFile.value = ''
            }
        },
        readPrivateKey(event) {
            const file = event.target.files[0]
            if (!file) {
                return
            }
            const reader = new FileReader()
            reader.onload = result => {
                this.form.password = result.target.result
            }
            reader.readAsText(file)
        },
        handleSetLanguage() {
            const language = getLanguage() === 'zh' ? 'en' : 'zh'
            this.$i18n.locale = language
            this.$store.dispatch('setLanguage', language)
        }
    }
}
</script>

<style scoped lang="scss">
.connection-trigger {
    position: fixed;
    right: 0;
    top: 50%;
    z-index: 1900;
    transform: translateY(-50%);
    padding: 13px 10px;
    border-radius: 6px 0 0 6px;
    writing-mode: vertical-rl;
    letter-spacing: 2px;
}

.drawer-surface {
    height: 100vh;
}

.drawer-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 54px;
    padding: 0 18px;
    border-bottom: 1px solid #ebeef5;
    color: #303133;
    font-size: 16px;
}

.drawer-content {
    height: calc(100vh - 54px);
    padding: 0 18px 18px;
    overflow-y: auto;
}

.drawer-tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-bottom: 16px;
    border-bottom: 1px solid #ebeef5;

    ::v-deep .el-button {
        margin-left: 0;
    }
}

.connection-list {
    padding-top: 12px;
}

.connection-item {
    display: flex;
    align-items: center;
    min-height: 66px;
    margin-bottom: 10px;
    padding: 10px 12px;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    transition: border-color .2s, box-shadow .2s;

    &:hover {
        border-color: #409eff;
        box-shadow: 0 2px 8px rgba(64, 158, 255, .14);
    }

    &.managing {
        cursor: default;
    }
}

.connection-icon {
    margin-right: 10px;
    color: #409eff;
    font-size: 24px;
}

.connection-summary {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;

    strong,
    span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    span {
        margin-top: 4px;
        color: #606266;
        font-size: 13px;
    }

    small {
        margin-top: 3px;
        color: #909399;
    }
}

.connection-actions {
    display: flex;
    margin-left: 8px;

    .delete-button {
        color: #f56c6c;
    }
}

.private-key-file {
    position: absolute;
    clip: rect(0 0 0 0);
}

.select-key-button {
    margin-top: 8px;
}

@media (max-width: 480px) {
    .connection-trigger {
        top: auto;
        bottom: 20px;
        transform: none;
    }
}
</style>
