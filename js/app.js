'use strict'

const ObsStore = require('obs-store')
const vdom = require('./vdom')
const render = require('./view.js')

const pify = require('pify')

const PeerInfo = require('peer-info')
const PeerId = require('peer-id')
const multiaddr = require('multiaddr')

const kitsunetFactory = require('kitsunet')

const store = new ObsStore({
  peerInfo: {},
  peers: [],
  blocks: [],
  slices: new Set(),
  bestBlock: null,
  account: '0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5',
  contract: '0x6810e776880c02933d47db1b9fc05908e5386b96',
  accountBalance: '',
  tokenBalance: '',
  tokenHolder: '0x1d805bc00b8fa3c96ae6c8fa97b2fd24b19a9801',
  isRpcSyncing: false
})

run()
async function run () {
  try {
    const id = await pify(PeerId.create)()
    const peerInfo = await pify(PeerInfo.create)(id)
    const peerIdStr = peerInfo.id.toB58String()

    const { kitsunet, providerTools } = await kitsunetFactory({
      options: {
        sliceDepth: 10,
        // rpcUrl: 'https://monkey.musteka.la',
        ethAddrs: [
          '0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5',
          '0x6810e776880c02933d47db1b9fc05908e5386b96',
          '0x1d805bc00b8fa3c96ae6c8fa97b2fd24b19a9801'
        ],
        libp2pBootstrap: [
          // '/ip4/127.0.0.1/tcp/33001/ws/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC',
          // '/ip4/127.0.0.1/tcp/33003/ws/ipfs/QmZMmjMMP9VUyBkA6zFdEGmuFRdwjsiHZ3KtxMp89i7Xwv'
          `/dns4/monkey.musteka.la/tcp/443/wss/ipfs/QmUA1Ghihi5u3gDwEDxhbu49jU42QPbvHttZFwB6b4K5oC`
        ]
      },
      addrs: [
        // `/dns4/signaller.lab.metamask.io/tcp/443/wss/p2p-webrtc-star/ipfs/${peerIdStr}`
        // `/ip4/127.0.0.1/tcp/9090/ws/p2p-webrtc-star/ipfs/${peerIdStr}`
      ],
      identity: id.toJSON()
    })

    global.tools = providerTools
    global.kitsunet = kitsunet

    const { rootNode, updateDom } = vdom()
    document.body.appendChild(rootNode)
    store.subscribe((state) => {
      updateDom(render(state, actions))
    })

    store.updateState({ peerInfo: global.kitsunet.peerInfo })
    global.tools.blockTracker.on('latest', actions.setBestBlock)
    global.tools.sliceTracker.on('latest', (slice) => {
      const { slices } = store.getState()
      slices.add(slice.sliceId)
      store.updateState({ slices })
    })

    global.kitsunet.kitsunetPeer.on('kitsunet:connect', updatePeerList)
    global.kitsunet.kitsunetPeer.on('kitsunet:disconnect', updatePeerList)
  } catch (error) {
    console.error(error)
    onError(error)
  }
}

//
// view
//

const actions = global.actions = {
  startTracker: async () => {
    console.log('start kitsunet client...')
    await global.kitsunet.start()
    store.updateState({ isRpcSyncing: true })
    store.updateState({ peerInfo: global.kitsunet.peerInfo })
  },
  stopTracker: () => {
    console.log('stop kitsunet client...')
    global.kitsunet.stop()
    store.updateState({ isRpcSyncing: false })
  },
  setBestBlock: (bestBlock) => {
    store.updateState({ bestBlock })
  },
  lookupAccountBalance: async (account) => {
    const resultDisplay = document.querySelector('#kitsunet-balance-result')

    resultDisplay.value = ''
    const balance = await global.tools.eth.getBalance(account)
    console.log('balance:', balance)
    resultDisplay.value = balance
  },
  setTokenHolder: (tokenHolder) => {
    store.updateState({ tokenHolder })
  },
  lookupTokenBalance: async () => {
    const resultDisplay = document.querySelector('#token-result')
    resultDisplay.value = ''

    // gnosis
    const tokenABI = [{
      'constant': true,
      'inputs': [
        {
          'name': '_owner',
          'type': 'address'
        }
      ],
      'name': 'balanceOf',
      'outputs': [
        {
          'name': 'balance',
          'type': 'uint256'
        }
      ],
      'payable': false,
      'type': 'function'
    }]

    try {
      const token = global.tools.eth.contract(tokenABI).at('0x6810e776880c02933d47db1b9fc05908e5386b96')
      const { tokenHolder } = store.getState()
      const returnValues = await token.balanceOf(tokenHolder)
      // parse return values
      const balance = parseInt(returnValues[0].toString(16), 16) / 1e18

      console.log('balance:', balance)
      resultDisplay.value = balance
    } catch (err) {
      onError(err)
      console.error(err)
    }
  },
  connectToPeer: async (event) => {
    const element = event.target
    const input = document.querySelector('input.connect-peer')

    if (!input.value.length) {
      return
    }

    const address = await multiaddrToPeerInfo(input.value)
    element.disabled = true

    const kitsunetPeer = global.kitsunet.kitsunetPeer
    try {
      await kitsunetPeer.dial(address)
    } catch (err) {
      onError(err)
      console.error(err)
    } finally {
      // clear input
      input.value = ''
      setTimeout(() => {
        element.disabled = false
      }, 500)
    }
  },
  disconnectFromPeer: async (event) => {
  }
}

// Get peers from IPFS and display them
function updatePeerList () {
  store.updateState({
    peers: Array.from(global.kitsunet.kitsunetPeer.connected.values())
  })
}

function onError (error) {
  store.updateState({ error })
}

async function multiaddrToPeerInfo (addr) {
  const ma = multiaddr(addr)
  try {
    const peerId = PeerId.createFromB58String(ma.getPeerId())
    const peerInfo = await pify(PeerInfo.create)(peerId)
    peerInfo.multiaddrs.add(ma)
    return peerInfo
  } catch (err) {
    console.error(err)
  }
}
