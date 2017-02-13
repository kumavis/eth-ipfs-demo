window.setImmediate = window.setImmediate || window.setTimeout

const BlockTracker = require('eth-block-tracker')
const HttpProvider = require('ethjs-provider-http')
const BlockHeader = require('ethereumjs-block/header')
const ethUtil = require('ethereumjs-util')
const cidForHash = require('ipld-eth-block/src/common').cidForHash
const ObsStore = require('obs-store')
const createNode = require('./create-node')
const vdom = require('./vdom')
const render = require('./view.js')

const provider = new HttpProvider('https://mainnet.infura.io')
const tracker = new BlockTracker({ provider, pollingInterval: 2e3 })

let ipfs

const store = new ObsStore({
  peerInfo: {},
  peers: [],
  blocks: {},
  isRpcSyncing: false,
})

tracker.on('latest', (block) => {
  console.log('new head:', block.number)
  ipfs.pubsub.publish('eth-block', ethUtil.toBuffer(block.hash), (err) => {
    console.log('pubsub pub status:', err)
  })
})

tracker.on('block', (block) => {
  // log block
  console.log('new block:', block.number)
  // add to ipfs
  const blockHeader = new BlockHeader()
  blockHeader.parentHash = block.parentHash
  blockHeader.uncleHash = block.sha3Uncles
  blockHeader.coinbase = block.miner
  blockHeader.stateRoot = block.stateRoot
  blockHeader.transactionsTrie = block.transactionsRoot
  blockHeader.receiptTrie = block.receiptRoot || block.receiptsRoot || ethUtil.SHA3_NULL
  blockHeader.bloom = block.logsBloom
  blockHeader.difficulty = block.difficulty
  blockHeader.number = block.number
  blockHeader.gasLimit = block.gasLimit
  blockHeader.gasUsed = block.gasUsed
  blockHeader.timestamp = block.timestamp
  blockHeader.extraData = block.extraData
  blockHeader.mixHash = block.mixHash
  blockHeader.nonce = block.nonce
  const rawBlock = blockHeader.serialize()
  const cid = cidForHash('eth-block', ethUtil.toBuffer(block.hash))
  ipfs.block.put(rawBlock, cid, function(err){
    if (err) console.error(err)
    // console.log('ipfs.block.put', arguments)
  })
  // add to state
  registerBlockAsLocal({
    cid: cid.toBaseEncodedString(),
    hash: block.hash,
    number: block.number,
  })
})

createNode((err, node) => {
  if (err) {
    return console.error(err)
  }
  ipfs = node
  global.ipfs = node
  ipfs.id().then((peerInfo) => {
    store.updateState({ peerInfo })
  })
  ipfs.pubsub.subscribe('eth-block', {}, (msg) => {
    if (store.getState().isRpcSyncing) return
    const hashBuf = msg.data
    const hashHex = ethUtil.bufferToHex(hashBuf)
    console.log('pubsub head!', hashHex)
    const cid = cidForHash('eth-block', hashBuf)
    ipfs.block.get(cid, function(err, ipfsBlock){
      if (err) return console.error(err)
      const ethBlock = new BlockHeader(ipfsBlock.data)
      console.log('ethBlock.number:', ethBlock.number)
      registerBlockAsLocal({
        cid: cid.toBaseEncodedString(),
        hash: hashHex,
        number: ethUtil.bufferToHex(ethBlock.number),
      })
    })
  })
})

function registerBlockAsLocal (blockData) {
  const blocks = store.getState().blocks
  blocks[blockData.number] = blockData
  store.updateState({ blocks })
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
}

const { rootNode, updateDom } = vdom()
document.body.appendChild(rootNode)
store.subscribe((state) => {
  updateDom(render(state, actions))
})

setInterval(updatePeers, 1000)

// Get peers from IPFS and display them
let numberOfPeersLastTime = 0
function updatePeers () {
  if (!ipfs) return
  // Once in a while, we need to refresh our list of peers in the UI
  // .swarm.peers returns an array with all our currently connected peer
  ipfs.swarm.peers((err, peers) => {
    if (err) onError(err)
    store.updateState({ peers })
  })
}
