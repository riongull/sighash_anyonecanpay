export default (context, inject) => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  inject('sleep', sleep)
}
