const h = require('virtual-dom/virtual-hyperscript')

module.exports = render

function render(state, actions) {
  return (

    h('div.header', [
      h('a', {
        'attributes': {
          'href': 'https://ipfs.io',
          'target': '_blank'
        }
      }, [
        h('img#logo', {
          'attributes': {
            'src': 'ipfs-logo.svg',
            'height': '32'
          },
          'id': {
            'name': 'id',
            'value': 'logo'
          }
        })
      ]),
    ]),
    h('div.wrapper', [
      h('div#ipfs.ipfs', [
        h('div.left.panel', [
          h('div#details'+ state.peerInfo.addresses ? '' : '.disabled', [
            h('h2', `Your daemon`),
            h('h3', `ID`),
            h('pre.id-container', state.peerInfo.id),
            h('h3', `Addresses`),
            h('ul.addresses-container', [(
              state.peerInfo.addresses ?
                state.peerInfo.addresses.map((address) => h('li', [h('span.address', address)]))
              : h('li', `Not yet online`)
            )])
          ])
        ]),
        h('div.right.panel', [
          h('div#peers'+ state.peers.length ? '' : '.disabled', [
            h('h2', 'Remote Peers'),
            (
              state.peers.length ?
                h('ul', [
                  state.peers.map((peer) => h('li', peer.addr.toString()))
                ])
              : h('i', 'Waiting for peers...')
            ),
          ]),
          h('div', [
            h('input.connect-peer', {
              'attributes': {
                'disabled': state.peerInfo.addresses ? undefined : true,
                'type': 'text',
                'placeholder': 'Multiaddr',
              }
            }),
            `
              `,
            h('button.connect-peer', {
              'attributes': {
                'disabled': state.peerInfo.addresses ? undefined : true,
              }
            }, `Connect to peer`)
          ])
        ]),
        h('div.clear'),
        
        h('#resolve-container.panel', [
          h('h2', `Resolve from network`),
          h('input', {
            'attributes': {
              'disabled': state.peerInfo.addresses ? undefined : true,
              'type': 'text',
              'placeholder': 'CID/path/to/data',
            }
          }),
          h('button', {
            'attributes': {
              'disabled': state.peerInfo.addresses ? undefined : true,
              'type': 'button'
            },
            onclick: actions.resolveIpldPath,
          }, `Resolve Path`),
        ]),

        h('#block-container.panel', [
          h('button#start', {
            'attributes': {
              'type': 'button',
              'disabled': !state.isRpcSyncing ? undefined : true,
            },
            onclick: actions.startTracker,
          }, `Start RPC Sync`),
          `
            `,
          h('button#stop', {
            'attributes': {
              'disabled': state.isRpcSyncing ? undefined : true,
              'type': 'button'
            },
            onclick: actions.stopTracker,
          }, `Stop RPC Sync`),
          Object.keys(state.blocks).map((blockNumber) => {
            const block = state.blocks[blockNumber]
            return h('div', `block: ${blockNumber} cid: ${block.cid}`)
          })
        ]),
        h('pre#errors.hidden')
      ])
    ])

  )
}
