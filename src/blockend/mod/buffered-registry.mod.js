module.exports = function BufferedRegistry () {
  const timeout = 5000
  const pending = {}
  return {
    async _writeReg (key, value) {
      await this.repo.writeReg(key, value)
      if (!pending[key.toString()]) return
      const { set, timerId } = pending[key.toString()]
      delete pending[key.toString()]
      clearTimeout(timerId)
      set(value)
    },
    async _readReg (key) {
      const value = await this.repo.readReg(key)
      if (value) return value
      if (pending[key.toString()]) return pending[key.toString()]
      let set = null
      let timerId = null
      const promise = new Promise((resolve, reject) => {
        set = resolve
        timerId = setTimeout(() => {
          delete pending[key.toString()]
          reject(new Error('BufferedReadTimedOut'))
        }, timeout)
      })
      if (!set) throw new Error('ConcurrencyError')
      pending[key.toString()] = { promise, set, timerId }
      return promise
    }
  }
}
