const h = require('virtual-dom/virtual-hyperscript')

module.exports = render

function render (state, actions) {
  return (

    h('div', [

      h('div.header', [
        h('a', {
          'attributes': {
            'href': 'https://musteka.la',
            'target': '_blank'
          }
        }, [
          h('img#logo', {
            'attributes': {
              'src': 'mustekala.svg',
              'height': '32'
            },
            'id': {
              'name': 'id',
              'value': 'logo'
            }
          })
        ])
      ]),

      h('div.wrapper', [
        h('div#kitsunet.kitsunet', [

          // block bridging
          h('#bridge-control.panel', [
            h('h2', 'Kitsunet - Ethereum on libp2p'),

            h('div', 'best block:'),
            state.bestBlock ? renderBlock(state.bestBlock) : h('div', '(none)'),

            h('button#start', {
              'attributes': {
                'type': 'button',
                'disabled': !state.isRpcSyncing ? undefined : true
              },
              onclick: actions.startTracker
            }, `Start`),
            `
              `
            // ,
            // h('button#stop', {
            //   'attributes': {
            //     'disabled': state.isRpcSyncing ? undefined : true,
            //     'type': 'button'
            //   },
            //   onclick: actions.stopTracker
            // }, `Stop`)
          ]),

          // block inventory
          h('#block-container.panel', [
            Array.from(state.slices.values()).map((s) => [s, h('br')])
          ]),

          // data lookups
          h('#query-container.panel', [

            //
            // general query
            //

            h('h2.space-top', 'Account Balance Lookup'),

            // balance
            h('input#kitsunet-balance', {
              'attributes': {
                'type': 'text',
                'placeholder': 'balance lookup',
                'value': state.account
              }
            }),

            h('button', {
              'attributes': {
                'disabled': state.bestBlock ? undefined : true,
                'type': 'button'
              },
              onclick: (event) => {
                const input = document.querySelector('#kitsunet-balance')
                actions.lookupAccountBalance(input.value)
              }
            }, `Account's balance`),

            // balance result
            h('input#kitsunet-balance-result', {
              type: 'text',
              disabled: true
            })

          ]),

          h('#token-container.panel', [

            //
            // token balance
            //

            h('h2.space-top', 'Gnosis Token balance'),

            // token holder address
            h('input#token-query', {
              'attributes': {
                'type': 'text',
                'placeholder': 'eth-kitsunet pseudo path',
                'value': state.tokenHolder
              },
              oninput: (event) => actions.setTokenHolder(event.target.value)
            }),

            // initiate lookup
            h('button', {
              'attributes': {
                'disabled': state.bestBlock ? undefined : true,
                'type': 'button'
              },
              onclick: actions.lookupTokenBalance
            }, `Lookup Gnosis Balance`),

            // cid path
            h('input#token-result', {
              type: 'text',
              disabled: true
            })

          ]),

          // peer status
          h('div.left.panel', [
            h('div#details' + state.peerInfo.multiaddrs ? '' : '.disabled', [
              h('h2', `Your daemon`),
              h('h3', `ID`),
              h('pre.id-container', state.peerInfo.id ? state.peerInfo.id.toB58String() : ''),
              h('h3', `Addresses`),
              h('ul.addresses-container', [(
                state.peerInfo.multiaddrs && state.peerInfo.multiaddrs.size > 0
                  ? state.peerInfo.multiaddrs.toArray().map((address) => {
                    return h('li', [
                      h('span.address', address.toString())
                    ])
                  })
                  : h('li', `Not yet online`)
              )])
            ])
          ]),
          h('div.right.panel', [
            h('div#peers' + state.peers.length ? '' : '.disabled', [
              h('h2', 'Remote Peers'),
              (
                state.peers.length
                  ? h('ul', state.peers.map((peer) => {
                    return (
                      peer.multiaddrs.toArray().map((a) => {
                        const address = a.toString()
                        return h('li', [
                          h('button.disconnect-peer', {
                            attributes: {
                              'data-address': address,
                              disabled: peer.isDisconnecting
                            },
                            onclick: actions.disconnectFromPeer
                          }, 'x'),
                          h('span.address', address)
                        ])
                      })
                    )
                  })
                  )
                  : h('i', 'Waiting for peers...')
              )
            ]),
            h('div', [
              h('input.connect-peer', {
                'attributes': {
                  'disabled': state.peerInfo.multiaddrs && state.peerInfo.multiaddrs.size > 0 ? undefined : true,
                  'type': 'text',
                  'placeholder': 'Multiaddr'
                }
              }),
              `
                `,
              h('button.connect-peer', {
                disabled: state.peerInfo.multiaddrs && state.peerInfo.multiaddrs.size ? undefined : true,
                onclick: actions.connectToPeer
              }, `Connect to peer`)
            ])
          ]),
          h('div.clear'),

          // errors
          h('pre#errors',
            state.error
          )
        ])
      ])

    ])
  )
}

function renderBlock (block) {
  const number = parseInt(block.number)
  return h('div', `block: #${number}, stateRoot: ${block.stateRoot}`)
}
