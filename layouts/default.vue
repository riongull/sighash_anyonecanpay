<template>
  <v-app>
    <v-main>
      <v-container>
        <Snackbar />
      </v-container>
      <nuxt />
    </v-main>
  </v-app>
</template>

<script>
import { mapActions } from 'vuex'

import Snackbar from '~/components/Snackbar'

export default {
  components: { Snackbar },
  data() {
    return {}
  },
  computed: {},
  async created() {
    try {
      await this.initWallet({
        mnemonic:
          'essay love suffer inquiry buffalo advance glue boil arrive glove clutch oyster', // Supply a mnemonic with funds
      })
    } catch (e) {
      console.error(e)
      this.showSnackbar({ text: e.message })
    }
  },
  mounted() {},
  methods: {
    ...mapActions(['initWallet', 'showSnackbar']),
  },
}
</script>

<style>
* {
  text-transform: none !important;
}
</style>
