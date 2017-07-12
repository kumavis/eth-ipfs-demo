window.setImmediate = window.setImmediate || window.setTimeout

const BlockTracker = require('eth-block-tracker')
const HttpProvider = require('ethjs-provider-http')
const blockHeaderFromRpc = require('ethereumjs-block/header-from-rpc')
const ethUtil = require('ethereumjs-util')
const cidFromHash = require('ipld-eth-star/util/cidFromHash')
const CID = require('cids')
const ObsStore = require('obs-store')
const createNode = require('./create-node')
const vdom = require('./vdom')
const render = require('./view.js')

const ETH_IPFS_BRIDGES = [
  '/dns4/ipfs.lab.metamask.io/tcp/443/wss/ipfs/QmdcCVdmHsA1s69GhQZrszpnb3wmtRwv81jojAurhsH9cz',
  '/dns4/fox.musteka.la/tcp/443/wss/ipfs/Qmc7etyUd9tEa3ZBD3LCTMDL96qcMi8cKfHEiLt5nhVdVC',
  '/dns4/bat.musteka.la/tcp/443/wss/ipfs/QmPaBC5Lmfj7vctVxRPcKvfZds9Zk96dgjgthvg4Dgf7at',
  '/dns4/monkey.musteka.la/tcp/443/wss/ipfs/QmZDfxSycZxaaYyrCyHdNEiip3wmxTgriPzEYETEn9Z6K3',
  '/dns4/panda.musteka.la/tcp/443/wss/ipfs/QmUGARsthjG4EJBCrYzkuCESjn5G2akmmuawKPbZrFM3E5',
  '/dns4/tiger.musteka.la/tcp/443/wss/ipfs/QmXFdPj3FuVpkgmNHNTFitkp4DSmVuF6HxNX6tCZr4LFz9',
]

const provider = new HttpProvider('https://mainnet.infura.io')
const tracker = new BlockTracker({ provider, pollingInterval: 4e3 })

let ipfs

const store = new ObsStore({
  peerInfo: {},
  peers: [],
  blocks: [],
  bestBlock: null,
  pseudoQuery: '/eth/latest/state/0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5/balance',
  dagQuery: '',
  isRpcSyncing: false,
})

tracker.on('block', (blockParams) => {
  // add to ipfs
  const blockHeader = blockHeaderFromRpc(blockParams)
  const rawBlock = blockHeader.serialize()
  const cid = cidFromHash('eth-block', blockHeader.hash())
  ipfs.block.put(rawBlock, cid, function(err){
    if (err) console.error(err)
  })
  // add to state
  registerBlockAsLocal({
    cid: cid.toBaseEncodedString(),
    hash: blockParams.hash,
    number: blockParams.number,
  })
})

createNode((err, node) => {
  if (err) {
    return console.error(err)
  }
  ipfs = node
  global.ipfs = node

  // connect to bootstrap eth-ipfs bridge nodes
  ETH_IPFS_BRIDGES.map((address) => ipfs.swarm.connect(address))
  // read peer info
  ipfs.id().then((peerInfo) => {
    store.updateState({ peerInfo })
  })
})

function registerBlockAsLocal (block) {
  // add block to collection
  const { blocks, bestBlock } = store.getState()
  const blockNumber = parseInt(block.number)
  blocks[blockNumber] = block
  store.updateState({ blocks })
  // check if new block is best block
  if (!bestBlock || (parseInt(block.number) > parseInt(bestBlock.number))) {
    actions.setBestBlock(block)
  }
}

//
// view
//

const actions = {
  startTracker: () => {
    console.log('start rpc sync...')
    tracker.start()
    // tracker.start({ fromBlock: '0x2d5068' })
    store.updateState({ isRpcSyncing: true })
  },
  stopTracker: () => {
    console.log('stop rpc sync...')
    tracker.stop()
    store.updateState({ isRpcSyncing: false })
  },
  setPseudoQuery: (pseudoQuery) => {
    store.updateState({ pseudoQuery })
    actions.updateDagQuery()
  },
  setBestBlock: (bestBlock) => {
    store.updateState({ bestBlock })
    actions.updateDagQuery()
  },
  updateDagQuery: () => {
    const { pseudoQuery, bestBlock } = store.getState()
    const parts = pseudoQuery.split('/')
    if (!bestBlock) return
    // build ipfs dag query string
    let dagQueryParts = []
    // take /eth/latest and replace with latest cid
    dagQueryParts.push(bestBlock.cid)
    let remainingParts = parts.slice(3)
    // search for hex key in remainingParts
    remainingParts = remainingParts.map((part) => {
      // abort if not hex
      if (part.slice(0,2) !== '0x') return part
      // hash
      const keyBuf = new Buffer(part.slice(2), 'hex')
      const hashString = ethUtil.sha3(keyBuf).toString('hex')
      // chunked into half-bytes
      const chunked = hashString.split('').join('/')
      return chunked
    })
    // finalize
    dagQueryParts = dagQueryParts.concat(remainingParts)
    const dagQuery = dagQueryParts.join('/')
    store.updateState({ dagQuery })
  },
  resolveIpldPath: (pathString) => {
    const pathParts = pathString.split('/')
    const cid = new CID(pathParts[0])
    const path = pathParts.slice(1).join('/')
    console.log(`ipfs.dag.get(${pathParts[0]}, "${path}")`)
    ipfs.dag.get(cid, path).then((result) => {
      console.log('query result:', '0x'+result.value.toString('hex'))
    }).catch((err) => {
      console.error(err)
    })
  },
  connectToPeer: (event) => {
    const element = event.target
    const input = document.querySelector('input.connect-peer')
    const address = input.value
    element.disabled = true
    ipfs.swarm.connect(address, (err) => {
      if (err) {
        return onError(err)
      }

      // clear input
      input.value = ''
      setTimeout(() => {
        element.disabled = false
      }, 500)
    })
  },
  disconnectFromPeer: async (event) => {
    const element = event.target
    const address = element.getAttribute('data-address')
    const peers = await ipfs.swarm.peers()
    const peer = peers.find((peer) => peer.addr.toString() === address)
    if (!peer) return
    const peerInfo = peer.peer
    element.disabled = true
    peer.isDisconnecting = true
    ipfs.swarm.disconnect(peerInfo, (err) => {
      element.disabled = false
      if (err) {
        return onError(err)
      }
      updatePeerList()
    })
  },
}

const { rootNode, updateDom } = vdom()
document.body.appendChild(rootNode)
store.subscribe((state) => {
  updateDom(render(state, actions))
})

setInterval(updatePeerList, 1000)

// Get peers from IPFS and display them
let numberOfPeersLastTime = 0
function updatePeerList () {
  if (!ipfs) return
  // Once in a while, we need to refresh our list of peers in the UI
  // .swarm.peers returns an array with all our currently connected peer
  ipfs.swarm.peers((err, peers) => {
    if (err) onError(err)
    store.updateState({ peers })
  })
}

function onError(error) {
  store.updateState({ error })
}
