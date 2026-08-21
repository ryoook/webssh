<template>
    <div class="command-drawer">
        <el-button
            class="command-trigger"
            type="primary"
            icon="el-icon-document"
            @click="showDrawer"
            @mouseenter.native="showDrawer"
            @mouseleave.native="scheduleDrawerClose"
        >
            {{ $t('Commands') }}
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
                    <strong>{{ $t('Commands') }}</strong>
                    <el-button type="text" icon="el-icon-close" @click="drawerVisible = false" />
                </div>

                <div class="drawer-content">
                    <div class="drawer-tools">
                        <el-button type="primary" size="small" icon="el-icon-plus" @click="createCommand">
                            {{ $t('NewCommand') }}
                        </el-button>
                        <el-button
                            size="small"
                            :type="managing ? 'warning' : 'default'"
                            icon="el-icon-setting"
                            @click="managing = !managing"
                        >
                            {{ managing ? $t('FinishManaging') : $t('Manage') }}
                        </el-button>
                    </div>

                    <el-empty v-if="commands.length === 0" :description="$t('NoCommands')" />
                    <div v-else class="command-list">
                        <div
                            v-for="command in commands"
                            :key="command.id"
                            class="command-item"
                            :class="{ managing: managing }"
                            @click="selectCommand(command)"
                        >
                            <div class="command-icon">
                                <i class="el-icon-document-copy"></i>
                            </div>
                            <div class="command-summary">
                                <strong>{{ command.name }}</strong>
                                <span>{{ contentPreview(command.content) }}</span>
                            </div>
                            <div v-if="managing" class="command-actions">
                                <el-button
                                    type="text"
                                    icon="el-icon-edit"
                                    :title="$t('Edit')"
                                    @click.stop="editCommand(command)"
                                />
                                <el-button
                                    type="text"
                                    class="delete-button"
                                    icon="el-icon-delete"
                                    :title="$t('Delete')"
                                    @click.stop="confirmDelete(command)"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </el-drawer>

        <el-dialog
            :title="editing ? $t('EditCommand') : $t('NewCommand')"
            :visible.sync="formVisible"
            :close-on-click-modal="false"
            append-to-body
            width="min(520px, 92%)"
            @closed="resetForm"
        >
            <el-form ref="commandForm" :model="form" :rules="rules" label-width="90px">
                <el-form-item :label="$t('CommandName')" prop="name">
                    <el-input v-model.trim="form.name" :placeholder="$t('nameRequired')" />
                </el-form-item>
                <el-form-item :label="$t('CommandContent')" prop="content">
                    <el-input
                        v-model="form.content"
                        type="textarea"
                        :rows="8"
                        :placeholder="$t('contentRequired')"
                    />
                </el-form-item>
            </el-form>
            <div slot="footer">
                <el-button @click="formVisible = false">{{ $t('Cancel') }}</el-button>
                <el-button type="primary" @click="saveCommand">{{ $t('Save') }}</el-button>
            </div>
        </el-dialog>
    </div>
</template>

<script>
import { createCommandId } from '@/utils/commands'

function emptyCommand() {
    return {
        id: createCommandId(),
        name: '',
        content: ''
    }
}

export default {
    name: 'CommandDrawer',
    data() {
        return {
            drawerVisible: false,
            formVisible: false,
            managing: false,
            editing: false,
            drawerCloseTimer: null,
            windowWidth: document.documentElement.clientWidth,
            form: emptyCommand(),
            rules: {
                name: [{ required: true, message: this.$t('RequiredValue'), trigger: 'blur' }],
                content: [{ required: true, message: this.$t('RequiredValue'), trigger: 'blur' }]
            }
        }
    },
    computed: {
        commands() {
            return this.$store.state.commandList
        },
        drawerWidth() {
            return this.windowWidth < 480 ? '100%' : '340px'
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
        contentPreview(content) {
            const firstLine = String(content || '').split(/\r?\n/)[0]
            return firstLine
        },
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
        createCommand() {
            this.form = emptyCommand()
            this.editing = false
            this.formVisible = true
        },
        editCommand(command) {
            this.form = Object.assign({}, command)
            this.editing = true
            this.formVisible = true
        },
        selectCommand(command) {
            if (this.managing) {
                return
            }
            this.$emit('insert', command.content)
        },
        saveCommand() {
            this.$refs.commandForm.validate(async valid => {
                if (!valid) {
                    return
                }
                try {
                    await this.$store.dispatch('upsertCommand', Object.assign({}, this.form))
                    this.formVisible = false
                } catch (error) {
                    // keep form open; action already showed the error
                }
            })
        },
        confirmDelete(command) {
            this.$confirm(
                this.$t('DeleteCommandConfirm', { name: command.name }),
                this.$t('DeleteCommand'),
                {
                    confirmButtonText: this.$t('OK'),
                    cancelButtonText: this.$t('Cancel'),
                    type: 'warning'
                }
            ).then(async () => {
                try {
                    await this.$store.dispatch('deleteCommand', command.id)
                } catch (error) {
                    // reload already happens in the action
                }
            }).catch(() => {})
        },
        resetForm() {
            this.form = emptyCommand()
            this.editing = false
            if (this.$refs.commandForm) {
                this.$refs.commandForm.clearValidate()
            }
        },
        closeDrawer() {
            this.drawerVisible = false
        }
    }
}
</script>

<style scoped lang="scss">
.command-trigger {
    position: fixed;
    right: 0;
    top: calc(50% - 72px);
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

.command-list {
    padding-top: 12px;
}

.command-item {
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

.command-icon {
    margin-right: 10px;
    color: #409eff;
    font-size: 24px;
}

.command-summary {
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
}

.command-actions {
    display: flex;
    margin-left: 8px;

    .delete-button {
        color: #f56c6c;
    }
}

@media (max-width: 480px) {
    .command-trigger {
        top: auto;
        bottom: 88px;
        transform: none;
    }
}
</style>
