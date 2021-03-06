const sax = require('sax')
const EventEmitter = require('events')
const get = require('lodash.get')

const singletonTags = [
  "area",
  "base",
  "br",
  "col",
  "command",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]

const DEFAULT_BUF_SIZE = 200

const saxt = function (template, view, options) {

  if (!view) {
    view = {}
  }

  options = Object.assign({
    trim: true,
    normalize: false,
    noscript: true,
    lowercase: true,
    includeDoctype: true,
  }, options)

  const BUF_SIZE = options.BUF_SIZE || DEFAULT_BUF_SIZE
  const emitter = new EventEmitter()
  const parser = sax.parser(false, {
    trim: options.trim,
    lowercase: options.lowercase,
    position: options.position,
    normalize: options.normalize,    
    noscript: options.noscript
  })


  let buf = ''
  const lazyEmit = function (data, force) {
    force = typeof force === 'boolean' ? force : false
    buf += data
    if ((buf.length > BUF_SIZE) || force) {
      emitter.emit('data', buf)
      buf = ''
    }
  }

  if (options.includeDoctype) {
    parser.ondoctype = function (type) {
      lazyEmit(`<!DOCTYPE${type}>`)
    }
  }

  parser.onerror = function (e) {
    emitter.emit('error', e)
  }
  parser.ontext = function (t) {
    lazyEmit(t)
  }

  // opened a tag.  node has "name" and "attributes"
  parser.onopentag = function (node) {

    const attributes = node.attributes
    const tag = node.name

    let attrStr = ''
    let children = ''
    Object.keys(attributes).forEach(function (rawKey) {
      let value = attributes[rawKey] || ''
      if (value.length > 1 && value[0] === '{' && value[value.length - 1] === '}') {
        value = get(view, value.substring(1, value.length - 1)) || ''
        if (!(typeof value === 'string')) {
          value = encodeURIComponent(JSON.stringify(value))
        }
      }
      if (rawKey === 'children') {
        children = value
      } else {
        attrStr += ` ${rawKey}`
        if (value) {
          attrStr += `="${value}"`
        }
      }
    })

    if (singletonTags.indexOf(tag) === -1) {
      lazyEmit(`<${tag}${attrStr}>${children}`)
    } else {
      lazyEmit(`<${tag}${attrStr} />`)
    }

  }

  parser.onclosetag = function (tagName) {
    if (singletonTags.indexOf(tagName) === -1) {
      lazyEmit(`</${tagName}>`)
    }
  }

  // parser stream is done, and ready to have more stuff written to it.
  parser.onend = function () {
    lazyEmit('', true)
    emitter.emit('end')
  }

  process.nextTick(function () {
    if (typeof template === 'string') {
      parser.write(template).close()
    } else {
      template.on('data', function (data) {
        parser.write(data)
      })
      template.on('end', function () {
        parser.close()
      })
    }
  })

  return emitter
}

module.exports = saxt
