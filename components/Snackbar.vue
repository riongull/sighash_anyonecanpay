<template>
  <v-snackbar v-model="snackbar.show" :top="'top'" :color="snackbar.color">
    {{ snackbar.text }}
    <v-btn
      dark
      absolute
      text
      right
      small
      style="padding-bottom: 6px"
      @click="snackbarAction()"
    >
      {{ snackbar.link ? 'View' : 'Close' }}
    </v-btn>
  </v-snackbar>
</template>

<script>
export default {
  components: {},
  data() {
    return {
      snackbar: {
        show: false,
        color: 'red',
        text: '',
        timestamp: 0,
        link: null,
      },
    }
  },
  created() {
    this.$store.watch(
      (state) => state.snackbar.timestamp,
      () => {
        console.log('state.snackbar :>> ', this.$store.state.snackbar)
        this.snackbar = JSON.parse(JSON.stringify(this.$store.state.snackbar))
        console.log('this.snackbar :>> ', this.snackbar)
      }
    )
  },
  methods: {
    snackbarAction() {
      if (this.snackbar.link) this.$router.push(this.snackbar.link)
      this.snackbar.show = false
    },
  },
}
</script>
