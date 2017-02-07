const h = require('virtual-dom/h')
const diff = require('virtual-dom/diff')
const patch = require('virtual-dom/patch')
const createElement = require('virtual-dom/create-element')

module.exports = startDom

function startDom(){
  // let tree = render(state)
  let tree = h('div')
  let rootNode = createElement(tree)
  return { updateDom, rootNode }

  function updateDom(newTree){
    let patches = diff(tree, newTree)
    rootNode = patch(rootNode, patches)
    tree = newTree
  }
}