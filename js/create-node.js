'use strict'
const Ipfs = require('ipfs')

module.exports = (callback) => {
  // Create a new repository for IPFS in a random path always
  const repoPath = '/tmp/ipfs' + Math.random()
  const ipfs = new Ipfs({
    repo: repoPath,
    EXPERIMENTAL: {
      pubsub: true,
    },
  })

  // dummy binary resolver for contract code
  const dagBin = {
    resolver: {
      multicodec: 'base2',
      resolve: (ipfsBlock, path, callback) => {
        callback(null, {
          value: ipfsBlock.data,
          remainderPath: path,
        })
      },
      tree: (ipfsBlock, options, callback) => {
        callback(null, [])
      }
    },
    util: {
      deserialize: (data, cb) => {
        cb(null, data)
      },
      serialize: (data, cb) => {
        cb(null, data)
      },
      cid: (data, cb) => {
        cb(null, new CID(1, 'base2', data))
      }
    }
  }

  ipfs._ipldResolver.support.add(dagBin.resolver.multicodec,
    dagBin.resolver,
    dagBin.util)

  ipfs.on('start', () => {
    callback(null, ipfs)
  })

}
