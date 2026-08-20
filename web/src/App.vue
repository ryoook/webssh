<template>
  <div id="app">
    <el-container>
      <el-main style="padding: 0; overflow: hidden">
        <tabs ref="tabs"></tabs>
      </el-main>
    </el-container>
    <connection-drawer @connect="openConnection" />
  </div>
</template>

<script>
import ConnectionDrawer from '@/components/ConnectionDrawer'
import Tabs from '@/components/Tabs'

export default {
    name: 'App',
    components: {
        ConnectionDrawer,
        tabs: Tabs
    },
    methods: {
        openConnection(connection) {
            this.$store.commit('SET_SSH', connection)
            this.$nextTick(() => {
                this.$refs.tabs.openTerm()
            })
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
