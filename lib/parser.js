import Tokenizer from './tokenizer'
import types from './tokentypes'

var typesName = {}
typesName[types.TK_TEXT] = "text node"
typesName[types.TK_LCB] = "left curly brace"
typesName[types.TK_RCB] = "right curly brace"
typesName[types.TK_GT] = ">"
typesName[types.TK_SLASH_GT] = "/>"
typesName[types.TK_TAG_NAME] = "open tag name"
typesName[types.TK_ATTR_NAME] = "attribute name"
typesName[types.TK_ATTR_EQUAL] = "="
typesName[types.TK_ATTR_STRING] = "attribute string"
typesName[types.TK_CLOSE_TAG] = "close tag"
typesName[types.TK_EOF] = "EOF"

function Parser (input) {
  this.tokens = new Tokenizer(input)
}

var pp = Parser.prototype

pp.is = function (type) {
  return (this.tokens.peekToken().type === type)
}

pp.parse = function () {
  this.tokens.index = 0
  var root = this.parseProgram()
  this.eat(types.TK_EOF)
  return root
}

pp.parseProgram = function () {
  if (this.is(types.TK_TAG_NAME)) {
    var node = this.parseNode()
    return node
  }else {
    // error
  }
}

pp.parseStat = function () {
  var stat = {
    type: 'Stat',
    members: []
  }
  if (
    this.is(types.TK_TAG_NAME) ||
    this.is(types.TK_TEXT) ||
    this.is(types.TK_LCB)
  ) {
    pushMembers(stat.members, [this.parseFrag()])
    pushMembers(stat.members, this.parseStat().members)
  } else {// TODO: Follow check
    // end
  }
  return stat
}

/*
 * push stat's memeber and concat all text
 */
function pushMembers (target, candidates) {
  for (var i = 0, len = candidates.length; i < len; i++) {
    var lasIdx = target.length - 1
    if (
      isString(target[lasIdx]) && 
      isString(candidates[i])
    ) {
      target[lasIdx] += candidates[i]
    } else {
      target.push(candidates[i])
    }
  }
}

function isString (str) {
  return typeof str === 'string'
}

pp.parseFrag = function () {
  if (this.is(types.TK_TAG_NAME)) return this.parseNode()
  else if (this.is(types.TK_LCB)) {
    this.eat(types.TK_LCB)
    return this.parseExpr()
  }
  else if (this.is(types.TK_TEXT)) {
    var token = this.eat(types.TK_TEXT)
    return token.label
  } else {
    this.parseError('parseFrag')
  }
}

/*
 * Node -> OpenTag NodeTail
 */

pp.parseNode = function () {
  var token = this.tokens.peekToken()
  var node = {
    type: 'Node',
    name: token.label
  }
  this.parseOpenTag(node)
  this.parseNodeTail(node)
  return node
}

/*
 * OpenTag -> tagName Attrs
 */

pp.parseOpenTag = function (node) {
  this.eat(types.TK_TAG_NAME)
  node.attributes = this.parseAttrs()
}

/*
 * NodeTail -> '>' Stat closeTag
 *           | '/>'
 */

pp.parseNodeTail = function (node) {
  if (this.is(types.TK_GT)) {
    this.eat(types.TK_GT)
    node.body = this.parseStat()
    this.eat(types.TK_CLOSE_TAG)
  } else if (this.is(types.TK_SLASH_GT)) {
    this.eat(types.TK_SLASH_GT)
  } else {
    this.parseError('parseNodeTail')
  }
}

pp.parseAttrs = function () {
  var attrs = {}
  if (this.is(types.TK_ATTR_NAME)) {
    extend(attrs, this.parseAttr())
    extend(attrs, this.parseAttrs())
  } else if (
    this.is(types.TK_GT) ||
    this.is(types.TK_SLASH_GT)
  ) {
    // do nothing
  } else {
    this.parseError('parseAttrs')
  }
  return attrs
}

pp.parseAttr = function () {
  var attr = {}
  var token = this.eat(types.TK_ATTR_NAME)
  var value = this.parseValue()
  attr[token.label] = value
  return attr
}

/*
 * Expr -> ExprFrag Expr | ε
 * ExprFrag -> text | Node
 */

pp.parseExpr = function () {
  var expr = {
    type: 'Expr',
    members: []
  }
  if (this.is(types.TK_RCB)) {
     this.eat(types.TK_RCB)
  } else{
     pushMembers(expr.members, [this.parseExprFrag()])
     pushMembers(expr.members, this.parseExpr().members)
  }
  return expr
}

pp.parseExprFrag = function () {
  if (this.is(types.TK_TAG_NAME)) return this.parseNode()
  else if (this.is(types.TK_TEXT)) {
    var token = this.eat(types.TK_TEXT)
    return token.label
  } else {
    this.parseError('parseExprFrag')
  }
}

pp.parseValue = function () {
  if (
    this.is(types.TK_ATTR_EQUAL)
  ) {
    this.eat(types.TK_ATTR_EQUAL)
    if (this.is(types.TK_LCB)){
      this.eat(types.TK_LCB)
      var expr = this.parseExpr()
      this.tokens.restoreContext(types.TK_TAG_NAME)
      return expr
    }else {
      var token = this.eat(types.TK_ATTR_STRING)
      return token.label
    }
  } else if (
    this.is(types.TK_GT) ||
    this.is(types.TK_SLASH_GT) ||
    this.is(types.TK_ATTR_NAME)
  ) {
    // do nothing
  } else {
    this.parseError('parseValue')
  }
}

pp.error = function (msg) {
  throw new Error('Parse Error: ' + msg)
}

pp.parseError = function (name) {
  var token = this.tokens.peekToken()
  this.error('in ' + name + ', unexpected token \'' + token.label + '\'')
}

pp.eat = function (type) {
  var token = this.tokens.nextToken()
  if (token.type !== type) {
    this.error('expect a(n) ' + typesName[type] + ', but got a(n) ' + typesName[token.type])
  }
  return token
}

function extend (src, dest) {
  for (var key in dest) {
    if (dest.hasOwnProperty(key)) {
      src[key] = dest[key]
    }
  }
}

export default Parser