<template>
  <div id="app">
    <el-container>
      <el-main style="padding: 0; overflow: hidden">
        <tabs ref="tabs"></tabs>
      </el-main>
    </el-container>
    <command-drawer ref="commandDrawer" @insert="insertCommand" />
    <connection-drawer @connect="openConnection" />
  </div>
</template>

<script>
import CommandDrawer from '@/components/CommandDrawer'
import ConnectionDrawer from '@/components/ConnectionDrawer'
import Tabs from '@/components/Tabs'

export default {
    name: 'App',
    components: {
        CommandDrawer,
        ConnectionDrawer,
        tabs: Tabs
    },
    methods: {
        openConnection(connection) {
            this.$store.commit('SET_SSH', connection)
            this.$nextTick(() => {
                this.$refs.tabs.openTerm()
            })
        },
        insertCommand(content) {
            const inserted = this.$refs.tabs.insertToCurrentTerm(content)
            if (!inserted) {
                this.$message.warning(this.$t('OpenTerminalFirst'))
                return
            }
            this.$refs.commandDrawer.closeDrawer()
        }
    }
}
</script>

<style lang="scss">
#app {
    height: 100%;
    > div {
        height: 100%;
    }
}
</style>
