'use strict'
const Ipfs = require('ipfs')

module.exports = (callback) => {
  // Create a new repository for IPFS in a random path always
  const repoPath = '/tmp/ipfs' + Math.random()
  const node = new Ipfs({
    repo: repoPath,
    EXPERIMENTAL: {
      pubsub: true,
    },
  })

  node.on('start', () => {
    callback(null, node)
  })

}
