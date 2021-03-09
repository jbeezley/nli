<template>
  <div id="app">
    <Render3D
      v-if="state"
      :state="state"
      @point="printSelected"
    />
  </div>
</template>

<script>
import Render3D from './components/Render3D.vue'

import State from './data/state';

export default {
  name: 'App',
  components: {
    Render3D,
  },
  data() {
    this.loadState();
    return {
      state: null,
    };
  },
  methods: {
    async loadState() {
      this.state = await State.load('6047ce572fa25629b919f66d');
    },
    printSelected(point) {
      console.log(point);
    },
  },
}
</script>

<style>
document,#app {
  height: 100vh;
  width: 100%;
}
</style>
