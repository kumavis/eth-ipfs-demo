const Eth = require('ethjs')
const BlockTracker = require('eth-block-tracker')
const JsonRpcEngine = require('json-rpc-engine')
const asMiddleware = require('json-rpc-engine/src/asMiddleware')
const createFetchMiddleware = require('eth-json-rpc-middleware/fetch')
const createVmMiddleware = require('eth-json-rpc-middleware/vm')
const createIpfsMiddleware = require('eth-json-rpc-ipfs')

module.exports = createIpfsEthProvider


function createIpfsEthProvider ({ ipfs, rpcUrl }) {
  // create higher level
  const engine = new JsonRpcEngine()
  const provider = providerFromEngine(engine)
  // create data source
  const { dataEngine } = createDataEngine({ rpcUrl })
  const dataProvider = providerFromEngine(dataEngine)
  const blockTracker = new BlockTracker({ provider: dataProvider, pollingInterval: 4e3 })
  // add handlers
  engine.push(createVmMiddleware({ provider }))
  engine.push(createIpfsMiddleware({ blockTracker, ipfs }))
  engine.push(asMiddleware(dataEngine))
  const eth = new Eth(provider)

  return {
    engine,
    provider,
    dataEngine,
    dataProvider,
    blockTracker,
    eth,
  }
}

function createDataEngine ({ rpcUrl }) {
  const dataEngine = new JsonRpcEngine()
  const dataSource = createFetchMiddleware({ rpcUrl })
  dataEngine.push(dataSource)
  return { dataEngine, dataSource }
}

function providerFromEngine (engine) {
  const provider = { sendAsync: engine.handle.bind(engine) }
  return provider
}