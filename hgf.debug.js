(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.WebTorrent = f()}})(function(){var define,module,exports;
const R = typeof Reflect === 'object' ? Reflect : null
const ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply (target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args)
  }

let ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys (target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target))
  }
} else {
  ReflectOwnKeys = function ReflectOwnKeys (target) {
    return Object.getOwnPropertyNames(target)
  }
}

class EventEmitter {
  constructor () {
    if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
      this._events = Object.create(null)
      this._eventsCount = 0
    }

    this._maxListeners = this._maxListeners || undefined
  }

  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.
  setMaxListeners (n) {
    this._maxListeners = n
    return this
  }

  getMaxListeners () {
    return $getMaxListeners(this)
  }

  /**
   * @param  {string} type
   * @param  {...*} args
   * @return {boolean}
   */
  emit (type, ...args) {
    let doError = (type === 'error')

    const events = this._events
    if (events !== undefined) {
      doError = (doError && events.error === undefined)
    } else if (!doError) {
      return false
    }

    // If there is no 'error' event listener then throw.
    if (doError) {
      let er
      if (args.length > 0) {
        er = args[0]
      }
      if (er instanceof Error) {
        // Note: The comments on the `throw` lines are intentional, they show
        // up in Node's output if this results in an unhandled exception.
        throw er // Unhandled 'error' event
      }
      // At least give some kind of context to the user
      const err = new Error(`Unhandled error.${er ? ` (${er.message})` : ''}`)
      err.context = er
      throw err // Unhandled 'error' event
    }

    const handler = events[type]

    if (handler === undefined) {
      return false
    }

    if (typeof handler === 'function') {
      ReflectApply(handler, this, args)
    } else {
      const len = handler.length
      const listeners = arrayClone(handler, len)
      for (var i = 0; i < len; ++i) {
        ReflectApply(listeners[i], this, args)
      }
    }

    return true
  }

  addListener (type, listener) {
    return _addListener(this, type, listener, false)
  }

  prependListener (type, listener) {
    return _addListener(this, type, listener, true)
  }

  once (type, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError(`The "listener" argument must be of type Function. Received type ${typeof listener}`)
    }
    this.on(type, _onceWrap(this, type, listener))
    return this
  }

  prependOnceListener (type, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError(`The "listener" argument must be of type Function. Received type ${typeof listener}`)
    }
    this.prependListener(type, _onceWrap(this, type, listener))
    return this
  }

  // Emits a 'removeListener' event if and only if the listener was removed.
  removeListener (type, listener) {
    let list
    let events
    let position
    let i
    let originalListener

    if (typeof listener !== 'function') {
      throw new TypeError(`The "listener" argument must be of type Function. Received type ${typeof listener}`)
    }

    events = this._events
    if (events === undefined) {
      return this
    }

    list = events[type]
    if (list === undefined) {
      return this
    }

    if (list === listener || list.listener === listener) {
      if (--this._eventsCount === 0) {
        this._events = Object.create(null)
      } else {
        delete events[type]
        if (events.removeListener) {
          this.emit('removeListener', type, list.listener || listener)
        }
      }
    } else if (typeof list !== 'function') {
      position = -1

      for (i = list.length - 1; i >= 0; i--) {
        if (list[i] === listener || list[i].listener === listener) {
          originalListener = list[i].listener
          position = i
          break
        }
      }

      if (position < 0) {
        return this
      }

      if (position === 0) {
        list.shift()
      } else {
        spliceOne(list, position)
      }

      if (list.length === 1) {
        events[type] = list[0]
      }

      if (events.removeListener !== undefined) {
        this.emit('removeListener', type, originalListener || listener)
      }
    }

    return this
  }

  removeAllListeners (type) {
    let listeners
    let events
    let i

    events = this._events
    if (events === undefined) {
      return this
    }

    // not listening for removeListener, no need to emit
    if (events.removeListener === undefined) {
      if (arguments.length === 0) {
        this._events = Object.create(null)
        this._eventsCount = 0
      } else if (events[type] !== undefined) {
        if (--this._eventsCount === 0) { this._events = Object.create(null) } else { delete events[type] }
      }
      return this
    }

    // emit removeListener for all listeners on all events
    if (arguments.length === 0) {
      const keys = Object.keys(events)
      let key
      for (i = 0; i < keys.length; ++i) {
        key = keys[i]
        if (key === 'removeListener') continue
        this.removeAllListeners(key)
      }
      this.removeAllListeners('removeListener')
      this._events = Object.create(null)
      this._eventsCount = 0
      return this
    }

    listeners = events[type]

    if (typeof listeners === 'function') {
      this.removeListener(type, listeners)
    } else if (listeners !== undefined) {
      // LIFO order
      for (i = listeners.length - 1; i >= 0; i--) {
        this.removeListener(type, listeners[i])
      }
    }

    return this
  }

  listeners (type) {
    return _listeners(this, type, true)
  }

  rawListeners (type) {
    return _listeners(this, type, false)
  }

  eventNames () {
    return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : []
  }
}

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter

EventEmitter.prototype._events = undefined
EventEmitter.prototype._eventsCount = 0
EventEmitter.prototype._maxListeners = undefined

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10

function $getMaxListeners ({_maxListeners}) {
  if (_maxListeners === undefined) {
    return EventEmitter.defaultMaxListeners
  }
  return _maxListeners
}

function _addListener (target, type, listener, prepend) {
  let m
  let events
  let existing

  if (typeof listener !== 'function') {
    throw new TypeError(`The "listener" argument must be of type Function. Received type ${typeof listener}`)
  }

  events = target._events
  if (events === undefined) {
    events = target._events = Object.create(null)
    target._eventsCount = 0
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type, listener.listener ? listener.listener : listener)

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events
    }
    existing = events[type]
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener
    ++target._eventsCount
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener]
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener)
    } else {
      existing.push(listener)
    }

    // Check for listener leak
    m = $getMaxListeners(target)
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      const w = new Error(`Possible EventEmitter memory leak detected. ${existing.length} ${String(type)} listeners added. Use emitter.setMaxListeners() to increase limit`)
      w.name = 'MaxListenersExceededWarning'
      w.emitter = target
      w.type = type
      w.count = existing.length
      console.warn(w)
    }
  }

  return target
}

EventEmitter.prototype.on = EventEmitter.prototype.addListener
EventEmitter.prototype.off = EventEmitter.prototype.removeListener

function onceWrapper (...args) {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn)
    this.fired = true
    ReflectApply(this.listener, this.target, args)
  }
}

function _onceWrap (target, type, listener) {
  const state = { fired: false, wrapFn: undefined, target, type, listener }
  const wrapped = onceWrapper.bind(state)
  wrapped.listener = listener
  state.wrapFn = wrapped
  return wrapped
}

function _listeners ({_events}, type, unwrap) {
  const events = _events

  if (events === undefined) { return [] }

  const evlistener = events[type]
  if (evlistener === undefined) { return [] }

  if (typeof evlistener === 'function') {
    return unwrap ? [evlistener.listener || evlistener] : [evlistener]
  }

  return unwrap
    ? unwrapListeners(evlistener)
    : arrayClone(evlistener, evlistener.length)
}

EventEmitter.listenerCount = (emitter, type) => {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type)
  } else {
    return listenerCount.call(emitter, type)
  }
}

EventEmitter.prototype.listenerCount = listenerCount

function listenerCount (type) {
  const events = this._events

  if (events !== undefined) {
    const evlistener = events[type]

    if (typeof evlistener === 'function') {
      return 1
    } else if (evlistener !== undefined) {
      return evlistener.length
    }
  }

  return 0
}

function arrayClone (arr, n) {
  const copy = new Array(n)
  for (let i = 0; i < n; ++i) {
    copy[i] = arr[i]
  }
  return copy
}

function spliceOne (list, index) {
  for (; index + 1 < list.length; index++) { list[index] = list[index + 1] }
  list.pop()
}

function unwrapListeners (arr) {
  const ret = new Array(arr.length)
  for (let i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i]
  }
  return ret
}

var _$EventEmitter_6 = EventEmitter

/* removed: const _$EventEmitter_6 = require('events') */;

class Tracker extends _$EventEmitter_6 {
  constructor (client, announceUrl) {
    super()

    this.client = client
    this.announceUrl = announceUrl

    this.interval = null
    this.destroyed = false
  }

  setInterval (intervalMs) {
    if (intervalMs == null) intervalMs = this.DEFAULT_ANNOUNCE_INTERVAL

    clearInterval(this.interval)

    if (intervalMs) {
      this.interval = setInterval(() => {
        this.announce(this.client._defaultAnnounceOpts())
      }, intervalMs)
      if (this.interval.unref) this.interval.unref()
    }
  }
}

var _$Tracker_3 = Tracker

var _$common_5 = {};
/* global self crypto */
/**
 * This file is meant to be a substitute to some of what the nodejs api can do
 * that the browser can't do and vice versa.
 */

var sha1 = typeof crypto === 'object'
  ? crypto.subtle.digest.bind(crypto.subtle, 'sha-1')
  : () => Promise.reject(new Error('no web crypto support'))
var toArr = e => new Uint8Array(e)

var alphabet = '0123456789abcdef'
var encodeLookup = []
var decodeLookup = []

for (var i = 0; i < 256; i++) {
  encodeLookup[i] = alphabet[i >> 4 & 0xf] + alphabet[i & 0xf]
  if (i < 16) {
    if (i < 10) {
      decodeLookup[0x30 + i] = i
    } else {
      decodeLookup[0x61 - 10 + i] = i
    }
  }
}

/**
 * Encode a Uint8Array to a hex string
 *
 * @param  {Uint8Array} array Bytes to encode to string
 * @return {string}           hex string
 */
_$common_5.arr2hex = array => {
  var length = array.length
  var string = ''
  var i = 0
  while (i < length) {
    string += encodeLookup[array[i++]]
  }
  return string
}

/**
 * Decodes a hex string to a Uint8Array
 *
 * @param  {string} string hex string to decode to Uint8Array
 * @return {Uint8Array}    Uint8Array
 */
_$common_5.hex2arr = string => {
  var sizeof = string.length >> 1
  var length = sizeof << 1
  var array = new Uint8Array(sizeof)
  var n = 0
  var i = 0
  while (i < length) {
    array[n++] = decodeLookup[string.charCodeAt(i++)] << 4 | decodeLookup[string.charCodeAt(i++)]
  }
  return array
}

/**
 * @param  {string} str
 * @return {string}
 */
_$common_5.binary2hex = str => {
  var hex = '0123456789abcdef'
  var res = ''
  var c
  var i = 0
  var l = str.length

  for (; i < l; ++i) {
    c = str.charCodeAt(i)
    res += hex.charAt((c >> 4) & 0xF)
    res += hex.charAt(c & 0xF)
  }

  return res
}

/**
 * @param  {string} hex
 * @return {string}
 */
_$common_5.hex2binary = hex => {
  for (var string = '', i = 0, l = hex.length; i < l; i += 2) {
    string += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
  }

  return string
}

/**
 * @param  {ArrayBuffer|ArrayBufferView} buffer
 * @return {Promise<Uint8Array>}
 */
_$common_5.sha1 = buffer => sha1(buffer).then(toArr)

_$common_5.text2arr = TextEncoder.prototype.encode.bind(new TextEncoder())

_$common_5.arr2text = TextDecoder.prototype.decode.bind(new TextDecoder())

_$common_5.binaryToHex = str => {
  var hex = '0123456789abcdef'
  var res = ''
  var c
  var i = 0
  var l = str.length

  for (; i < l; ++i) {
    c = str.charCodeAt(i)
    res += hex.charAt((c >> 4) & 0xF)
    res += hex.charAt(c & 0xF)
  }

  return res
}

_$common_5.hexToBinary = hex => {
  for (var string = '', i = 0, l = hex.length; i < l; i += 2) {
    string += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
  }

  return string
}

/* global RTCPeerConnection */

const MAX_BUFFERED_AMOUNT = 64 * 1024
const buffer = new Uint8Array(MAX_BUFFERED_AMOUNT)

class Peer {
  constructor (opts = {}) {
    this.initiator = !opts.offer

    this.remoteAddress =
    this.remotePort =
    this.localAddress =
    this.onMessage =
    this.localPort =
    this.timestamp =
    this.sdp =
    this.onSignal =
    this.error =
    this._evtLoopTimer =
    this._dc = null

    this._bucket = [] // holds messages until ipadress have been found
    this._queue = []
    this._bulkSend = this.bulkSend.bind(this)

    const pc = new RTCPeerConnection(opts.config || Peer.config)
    this._pc = pc

    // (sometimes gets retriggerd by ondatachannel)
    pc.oniceconnectionstatechange = () => {
      switch (pc.iceConnectionState) {
        case 'connected':
          // pc.getStats().then(items => this._onceStats(items))
          break
        case 'disconnected':
          this.destroy(new Error('Ice connection disconnected.'))
          break
        case 'failed':
          this.destroy(new Error('Ice connection failed.'))
          break
        default:
      }
    }

    if (this.initiator) {
      this.createSDP()
    } else {
      this.setSDP(opts['offer'])
    }
  }

  _setupData () {
    const dc = this._dc

    dc.onopen = () => {
      this._pc.getStats().then(items => this._onceStats(items))
    }

    dc.binaryType = 'arraybuffer'

    dc.bufferedAmountLowThreshold = MAX_BUFFERED_AMOUNT

    dc.onmessage = evt => {
      if (this.timestamp) {
        this.onMessage(new Uint8Array(evt.data))
      } else {
        this._bucket.push(new Uint8Array(evt.data))
      }
    }
  }

  _onceStats (items) {
    let selected

    items.forEach(item => {
      // Spec-compliant
      if (item.type === 'transport' && item.selectedCandidatePairId) {
        selected = items.get(item.selectedCandidatePairId)
      }

      // Old implementations
      if (!selected && item.type === 'candidate-pair' && (item.selected || item.nominated)) {
        selected = item
      }
    })

    const local = items.get(selected.localCandidateId) || {}
    const remote = items.get(selected.remoteCandidateId) || {}

    this.networkType = local.networkType

    this.candidateType = local.candidateType
    this.localAddress = local.ip || local.address || local.ipAddress
    this.localPort = local.port || local.portNumber

    this.remoteAddress = remote.ip || remote.address || remote.ipAddress
    this.remotePort = remote.port || remote.portNumber

    this.onConnect && this.onConnect(this)

    this.timestamp = Date.now() / 1000 | 0

    this._bucket.forEach(msg => {
      this.onMessage(msg)
    })
    this._bucket = null
  }

  async createSDP () {
    const pc = this._pc
    if (!this._dc) {
      this._dc = pc.createDataChannel('')
      this._setupData()
    }

    const desc = await pc.createOffer()

    // remove trickle
    desc.sdp = desc.sdp.replace(/a=ice-options:trickle\s\n/g, '')

    // trickle ice
    const iceGathering = new Promise(resolve => {
      setTimeout(resolve, 2000)
      pc.onicecandidate = evt => {
        !evt.candidate && resolve(pc.onicecandidate = null)
      }
    })

    await pc.setLocalDescription(desc)
    await iceGathering

    this.sdp = pc.localDescription
    this.onSignal(this)
  }

  async setSDP (sdp) {
    if (this.destroyed) console.log('cant do this when its closed', this.error)
    const pc = this._pc
    await pc.setRemoteDescription(sdp)
    pc.ondatachannel = null

    if (!pc.localDescription) {
      const iceGathering = new Promise(resolve => {
        pc.onicecandidate = evt => {
          !evt.candidate && resolve(pc.onicecandidate = null)
        }
      })

      const desc = await pc.createAnswer()
      desc.sdp = desc.sdp.replace(/a=ice-options:trickle\s\n/g, '')
      await pc.setLocalDescription(desc)
      await iceGathering
      pc.ondatachannel = evt => {
        this._dc = evt.channel
        this._setupData()
        pc.oniceconnectionstatechange()
      }
    }
    this.sdp = pc.localDescription
    this.onSignal && this.onSignal(this)
  }

  signal (sdp) {
    this.setSDP(sdp)
  }

  /**
   * Send text/binary data to the remote peer.
   * @param {Uint8Array} chunk
   */
  send (chunk) {
    // const channel = this._channel
    // if (this.destroyed) return
    // if (channel.readyState === 'closing') return this.destroy()
    // if (channel.readyState === 'open') {
    //   channel.send(chunk)
    // }

    if (!window.requestIdleCallback) {
      const channel = this._dc
      if (this.destroyed) return
      if (channel.readyState === 'closing') return this.destroy()

      channel.send(chunk)
      return
    }

    if (this.evtLoopTimer) {
      this.queue.push(chunk)
    } else {
      this.queue = [chunk]
      this.evtLoopTimer = window.requestIdleCallback(this._bulkSend)
    }
  }

  bulkSend () {
    const dc = this._dc
    if (this.destroyed) return
    if (dc.readyState === 'closing') return this.destroy()
    const chunks = this.queue

    if (chunks.length === 1) {
      dc.send(chunks[0])
      this.evtLoopTimer = this.queue = null
      return
    }

    let offset = 0
    let merged = []
    for (let i = 0, l = chunks.length; i < l; i++) {
      const chunk = chunks[i]
      if (chunk.length + offset >= buffer.length) {
        // Send many small messages as one
        if (offset) {
          dc.send(buffer.subarray(0, offset))
          offset = 0
          merged = []
        } else {
          dc.send(chunk)
          continue
        }
      }
      merged.push(chunk.length)
      buffer.set(chunk, offset)
      offset += chunk.length
    }

    dc.send(buffer.subarray(0, offset))

    this.evtLoopTimer = this.queue = null
  }

  destroy (err) {
    if (this.destroyed) return
    this.destroyed = true
    this.error = typeof err === 'string'
      ? new Error(err)
      : err || new Error('something closed')

    // this.error = err || null
    // this._debug('destroy (error: %s)', err && (err.message || err))
    const channel = this._dc
    const pc = this._pc

    // Cleanup DataChannel
    if (this._dc) {
      channel.onclose = null
      channel.onerror = null
      channel.onmessage = null
      channel.onopen = null
      if (channel.readyState !== 'closed') channel.close()
    }

    pc.ondatachannel = null
    pc.onicecandidate = null
    pc.oniceconnectionstatechange = null
    pc.onicegatheringstatechange = null
    pc.onsignalingstatechange = null
    if (pc.iceConnectionState === 'new') false && console.log(new Error('dont close this'))
    pc.close()

    // Cleanup local variables
    this._channelReady =
    this._pcReady =
    this.connected =
    this.onMessage =
    this.timestamp =
    this._dc =
    this._pc = null

    this.onDestroy && this.onDestroy(err)
  }
}

/**
 * Expose config, constraints, and data channel config for overriding all Peer
 * instances. Otherwise, just set opts.config, opts.constraints, or opts.channelConfig
 * when constructing a Peer.
 */
Peer.config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }
  ]
}

var _$Peer_7 = Peer

/* global WebSocket */

/* removed: const _$Peer_7 = require('../../../light-peer/light.js') */;
/* removed: const _$Tracker_3 = require('./tracker') */;
const { hexToBinary, binaryToHex } = _$common_5

// Use a socket pool, so tracker clients share WebSocket objects for the same server.
// In practice, WebSockets are pretty slow to establish, so this gives a nice performance
// boost, and saves browser resources.
const socketPool = {}

const RECONNECT_MINIMUM = 15 * 1000
const RECONNECT_MAXIMUM = 30 * 60 * 1000
const RECONNECT_VARIANCE = 30 * 1000
const OFFER_TIMEOUT = 50 * 1000
const __MAX_BUFFERED_AMOUNT_4 = 64 * 1024

class WebSocketTracker extends _$Tracker_3 {
  constructor (client, announceUrl) {
    super(client, announceUrl)
    // debug('new websocket tracker %s', announceUrl)

    this.peers = {} // peers (offer id -> peer)
    this.reusable = {} // peers (offer id -> peer)
    this.socket = null

    this.reconnecting = false
    this.retries = 0
    this.reconnectTimer = null

    // Simple boolean flag to track whether the socket has received data from
    // the websocket server since the last time socket.send() was called.
    this.expectingResponse = false

    this._openSocket()
  }

  announce (opts) {
    if (this.destroyed || this.reconnecting) return
    if (this.socket._ws.readyState !== WebSocket.OPEN) {
      this.socket._ws.addEventListener('open', () => {
        this.announce(opts)
      }, { once: true })
      return
    }

    const params = Object.assign({}, opts, {
      action: 'announce',
      info_hash: this.client._infoHashBinary,
      peer_id: this.client._peerIdBinary
    })
    if (this._trackerId) params.trackerid = this._trackerId

    if (opts.event === 'stopped' || opts.event === 'completed') {
      // Don't include offers with 'stopped' or 'completed' event
      this._send(params)
    } else {
      // Limit the number of offers that are generated, since it can be slow
      const numwant = Math.min(opts.numwant, 10)

      this._generateOffers(numwant, offers => {
        params.numwant = numwant
        params.offers = offers
        this._send(params)
      })
    }
  }

  scrape (opts) {
    if (this.destroyed || this.reconnecting) return
    if (this.socket._ws.readyState !== WebSocket.OPEN) {
      this.socket._ws.addEventListener('open', () => {
        this.scrape(opts)
      }, { once: true })
      return
    }
    console.log('how did you not notice this?!')
    const infoHashes = (Array.isArray(opts.infoHash) && opts.infoHash.length > 0)
      ? opts.infoHash.map(infoHash => {
        return infoHash.toString('binary')
      })
      : (opts.infoHash && opts.infoHash.toString('binary')) || this.client._infoHashBinary
    const params = {
      action: 'scrape',
      info_hash: infoHashes
    }

    this._send(params)
  }

  destroy () {
    if (this.destroyed) return

    this.destroyed = true

    clearInterval(this.interval)
    clearInterval(this.socket.interval)
    clearTimeout(this.reconnectTimer)

    // Destroy peers
    for (const peerId in this.peers) {
      const peer = this.peers[peerId]
      clearTimeout(peer.trackerTimeout)
      peer.destroy()
    }
    this.peers = null

    if (this.socket) {
      this.socket._ws.removeEventListener('open', this._onSocketConnectBound)
      this.socket._ws.removeEventListener('message', this._onSocketDataBound)
      this.socket._ws.removeEventListener('close', this._onSocketCloseBound)
      this.socket._ws.removeEventListener('error', this._onSocketErrorBound)
      this.socket = null
    }

    this._onSocketConnectBound = null
    this._onSocketErrorBound = null
    this._onSocketDataBound = null
    this._onSocketCloseBound = null

    if (socketPool[this.announceUrl]) {
      socketPool[this.announceUrl].consumers -= 1
    }

    // Other instances are using the socket, so there's nothing left to do here
    if (socketPool[this.announceUrl].consumers > 0) return

    let socket = socketPool[this.announceUrl]
    delete socketPool[this.announceUrl]

    // If there is no data response expected, destroy immediately.
    if (!this.expectingResponse) return destroyCleanup()

    // Otherwise, wait a short time for potential responses to come in from the
    // server, then force close the socket.
    var timeout = setTimeout(destroyCleanup, 1000)

    // But, if a response comes from the server before the timeout fires, do cleanup
    // right away.
    socket._ws.addEventListener('data', destroyCleanup)

    function destroyCleanup () {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      socket._ws.removeEventListener('data', destroyCleanup)
      socket._ws.close()
    }
  }

  _openSocket () {
    this.destroyed = false

    if (!this.peers) this.peers = {}
    const once = { once: true }

    this._onSocketConnectBound = () => {
      this._onSocketConnect()
    }
    this._onSocketErrorBound = err => {
      this._onSocketError(err)
    }
    this._onSocketDataBound = evt => {
      this._onSocketData(evt.data)
    }
    this._onSocketCloseBound = () => {
      this._onSocketClose()
    }

    this.socket = socketPool[this.announceUrl]
    if (this.socket) {
      socketPool[this.announceUrl].consumers += 1
    } else {
      console.log('opened', this.announceUrl)
      this.socket = socketPool[this.announceUrl] = {
        _ws: new WebSocket(this.announceUrl),
        consumers: 1,
        buffer: []
      }
      this.socket._ws.addEventListener('open', this._onSocketConnectBound, once)
    }

    this.socket._ws.addEventListener('message', this._onSocketDataBound)
    this.socket._ws.addEventListener('close', this._onSocketCloseBound, once)
    this.socket._ws.addEventListener('error', this._onSocketErrorBound, once)
  }

  _onSocketConnect () {
    console.log('connected')
    if (this.destroyed) return

    if (this.reconnecting) {
      this.reconnecting = false
      this.retries = 0
      this.announce(this.client._defaultAnnounceOpts())
    }
  }

  _onSocketData (data) {
    if (this.destroyed) return

    this.expectingResponse = false

    try {
      data = JSON.parse(data)
    } catch (err) {
      this.client.emit('warning', new Error('Invalid tracker response'))
      return
    }

    if (data.action === 'announce') {
      this._onAnnounceResponse(data)
    } else if (data.action === 'scrape') {
      this._onScrapeResponse(data)
    } else {
      this._onSocketError(new Error(`invalid action in WS response: ${data.action}`))
    }
  }

  _onAnnounceResponse (data) {
    if (data.info_hash !== this.client._infoHashBinary) {
      // debug(
      //   'ignoring websocket data from %s for %s (looking for %s: reused socket)',
      //   this.announceUrl, binaryToHex(data.info_hash), this.client.infoHash
      // )
      return
    }

    if (data.peer_id && data.peer_id === this.client._peerIdBinary) {
      // ignore offers/answers from this client
      return
    }

    // debug(
    //   'received %s from %s for %s',
    //   JSON.stringify(data), this.announceUrl, this.client.infoHash
    // )

    const failure = data['failure reason']
    if (failure) return this.client.emit('warning', new Error(failure))

    const warning = data['warning message']
    if (warning) this.client.emit('warning', new Error(warning))

    const interval = data.interval || data['min interval']
    if (interval) this.setInterval(interval * 1000)

    const trackerId = data['tracker id']
    if (trackerId) {
      // If absent, do not discard previous trackerId value
      this._trackerId = trackerId
    }

    if (data.complete != null) {
      const response = Object.assign({}, data, {
        announce: this.announceUrl,
        infoHash: binaryToHex(data.info_hash)
      })
      this.client.emit('update', response)
    }

    let peer
    if (data.offer && data.peer_id) {
      const peerId = binaryToHex(data.peer_id)
      if (this.client._filter && !this.client._filter(peerId)) return
      peer = this._createPeer({ offer: data.offer })
      peer.id = peerId

      peer.onSignal = peer => {
        peer.onSignal = null
        const params = {
          action: 'announce',
          info_hash: this.client._infoHashBinary,
          peer_id: this.client._peerIdBinary,
          to_peer_id: data.peer_id,
          answer: peer.sdp,
          offer_id: data.offer_id
        }
        if (this._trackerId) params.trackerid = this._trackerId
        this._send(params)
        this.client.emit('peer', peer)
        // peer.onConnect = () => {
        //   console.log(peer._dc)
        //   peer.connected = true
        //   this.client.emit('peer', peer)
        // }
      }
    }

    if (data.answer && data.peer_id) {
      const offerId = binaryToHex(data.offer_id)
      peer = this.peers[offerId]
      if (peer) {
        peer.id = binaryToHex(data.peer_id)
        const peerId = binaryToHex(data.peer_id)

        if (this.client._filter && !this.client._filter(peerId)) {
          return peer.destroy('filtered')
        }

        this.client.emit('peer', peer)

        peer.signal(data.answer)

        clearTimeout(peer.trackerTimeout)
        peer.trackerTimeout = null
        delete this.peers[offerId]
      } else {
        // debug(`got unexpected answer: ${JSON.stringify(data.answer)}`)
      }
    }
  }

  _onScrapeResponse (data) {
    data = data.files || {}

    const keys = Object.keys(data)
    if (keys.length === 0) {
      this.client.emit('warning', new Error('invalid scrape response'))
      return
    }

    keys.forEach(infoHash => {
      // TODO: optionally handle data.flags.min_request_interval
      // (separate from announce interval)
      const response = Object.assign(data[infoHash], {
        announce: this.announceUrl,
        infoHash: binaryToHex(infoHash)
      })
      this.client.emit('scrape', response)
    })
  }

  _onSocketClose () {
    if (this.destroyed) return
    this.destroy()
    this._startReconnectTimer()
  }

  _onSocketError (err) {
    if (this.destroyed) return
    this.destroy()
    // errors will often happen if a tracker is offline, so don't treat it as fatal
    this.client.emit('warning', err)
    this._startReconnectTimer()
  }

  _startReconnectTimer () {
    const ms = Math.floor(Math.random() * RECONNECT_VARIANCE) + Math.min(Math.pow(2, this.retries) * RECONNECT_MINIMUM, RECONNECT_MAXIMUM)

    this.reconnecting = true
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.retries++
      this._openSocket()
    }, ms)
    // debug('reconnecting socket in %s ms', ms)
  }

  _send (params) {
    if (this.destroyed) return
    this.expectingResponse = true
    const message = JSON.stringify(params)
    // debug('send %s', message)
    const { _ws, buffer } = this.socket
    if (buffer.length || _ws.readyState !== WebSocket.OPEN || _ws.bufferedAmount > __MAX_BUFFERED_AMOUNT_4) {
      buffer.push(message)

      if (!this.socket.interval) {
        this.socket.interval = setInterval(() => {
          while (_ws.readyState === WebSocket.OPEN && buffer.length && _ws.bufferedAmount < __MAX_BUFFERED_AMOUNT_4) {
            _ws.send(buffer.shift())
          }
          if (!buffer.length) {
            clearInterval(this.socket.interval)
            delete this.socket.interval
          }
        }, 150)
      }
    } else {
      _ws.send(message)
    }
  }

  async _generateOffers (numwant, cb) {
    let offers = []
    let i = numwant
    // debug('creating peer (from _generateOffers)')
    while (i--) {
      const peer = this._createPeer()

      offers.push(new Promise(resolve => {
        peer.onSignal = resolve
      }))
    }

    const peers = await Promise.all(offers)

    offers = []

    for (let peer of peers) {
      const offerId = peer.sdp.sdp
        .match(/a=fingerprint:[\w-]*\s(.*)/)[1].replace(/[^\w]*/g, '')
        .substr(0, 20)
        .toLowerCase()

      peer.onDestroy = () => {
        peer['destroyCalled'] = true
        delete this.peers[offerId]
      }

      this.peers[offerId] = peer

      offers.push({
        offer: peer.sdp,
        offer_id: hexToBinary(offerId)
      })

      peer.trackerTimeout = setTimeout(() => {
        peer.trackerTimeout = null
        delete this.peers[offerId]
        peer.destroy()
      }, OFFER_TIMEOUT)
    }

    cb(offers)
  }

  _createPeer (opts) {
    opts = Object.assign({
      config: this.client._rtcConfig
    }, opts)

    const peer = new _$Peer_7(opts)

    return peer
  }
}

WebSocketTracker.prototype.DEFAULT_ANNOUNCE_INTERVAL = 30 * 1000 // 30 seconds
// Normally this shouldn't be accessed but is occasionally useful
WebSocketTracker._socketPool = socketPool

var _$WebSocketTracker_4 = WebSocketTracker

// const debug = require('debug')('bittorrent-tracker:client')
/* removed: const _$EventEmitter_6 = require('events') */;
/* removed: const _$common_5 = require('../common') */;
/* removed: const _$WebSocketTracker_4 = require('./lib/client/websocket-tracker') */;

const { arr2hex } = _$common_5

/**
 * BitTorrent tracker client.
 * Find torrent peers, to help a torrent client participate in a torrent swarm.
 */
class Client extends _$EventEmitter_6 {
  /**
   * @param {Object} opts                          options object
   * @param {Uint8Array} opts.infoHash             torrent info hash
   * @param {Uint8Array} opts.peerId               peer id
   * @param {string|Array.<string>} opts.announce  announce
   * @param {Function} opts.getAnnounceOpts        callback to provide data to tracker
   * @param {number} opts.rtcConfig                RTCPeerConnection configuration object
   */
  constructor (opts) {
    super()
    this._peerIdBinary = String.fromCharCode.apply(null, opts.peerId)

    // TODO: do we need this to be a string?
    this.infoHash = typeof opts.infoHash === 'string'
      ? opts.infoHash.toLowerCase()
      : arr2hex(opts.infoHash)
    this._infoHashBinary = _$common_5.hexToBinary(this.infoHash)

    this.destroyed = false

    this._getAnnounceOpts = opts.getAnnounceOpts
    this._filter = opts.filter
    this._rtcConfig = opts.rtcConfig

    let announce = typeof opts.announce === 'string'
      ? [ opts.announce ]
      : opts.announce == null ? [] : opts.announce

    // Remove trailing slash from trackers to catch duplicates
    announce = announce.map(announceUrl => {
      announceUrl = announceUrl.toString()
      if (announceUrl[announceUrl.length - 1] === '/') {
        announceUrl = announceUrl.substring(0, announceUrl.length - 1)
      }
      return announceUrl
    })
    announce = [...new Set(announce)]

    this._trackers = announce
      .map(announceUrl => {
        // TODO: should we try to cast ws: to wss:?
        if (announceUrl.startsWith('wss:') || announceUrl.startsWith('ws:')) {
          return new _$WebSocketTracker_4(this, announceUrl)
        } else {
          // console.warn(`Unsupported tracker protocol: ${announceUrl}`)
          return null
        }
      })
      .filter(Boolean)
  }

  /**
   * Send a `start` announce to the trackers.
   * @param {Object=} opts
   * @param {number=} opts.uploaded
   * @param {number=} opts.downloaded
   * @param {number=} opts.left (if not set, calculated automatically)
   */
  start (opts = {}) {
    // debug('send `start`')
    opts = this._defaultAnnounceOpts(opts)
    opts.event = 'started'
    this._announce(opts)

    // start announcing on intervals
    this._trackers.forEach(tracker => {
      tracker.setInterval()
    })
  }

  /**
   * Send a `stop` announce to the trackers.
   * @param {Object} opts
   * @param {number=} opts.uploaded
   * @param {number=} opts.downloaded
   * @param {number=} opts.numwant
   * @param {number=} opts.left (if not set, calculated automatically)
   */
  stop (opts) {
    // debug('send `stop`')
    opts = this._defaultAnnounceOpts(opts)
    opts.event = 'stopped'
    this._announce(opts)
  }

  /**
   * Send a `complete` announce to the trackers.
   * @param {Object} opts
   * @param {number=} opts.uploaded
   * @param {number=} opts.downloaded
   * @param {number=} opts.numwant
   * @param {number=} opts.left (if not set, calculated automatically)
   */
  complete (opts) {
    // debug('send `complete`')
    if (!opts) opts = {}
    opts = this._defaultAnnounceOpts(opts)
    opts.event = 'completed'
    this._announce(opts)
  }

  /**
   * Send a `update` announce to the trackers.
   * @param {Object} opts
   * @param {number=} opts.uploaded
   * @param {number=} opts.downloaded
   * @param {number=} opts.numwant
   * @param {number=} opts.left (if not set, calculated automatically)
   */
  update (opts) {
    opts = this._defaultAnnounceOpts(opts)
    if (opts.event) delete opts.event
    this._announce(opts)
  }

  _announce (opts) {
    this._trackers.forEach(tracker => {
      // tracker should not modify `opts` object, it's passed to all trackers
      tracker.announce(opts)
    })
  }

  /**
   * Send a scrape request to the trackers.
   * @param  {Object=} opts
   */
  scrape (opts = {}) {
    this._trackers.forEach(tracker => {
      // tracker should not modify `opts` object, it's passed to all trackers
      tracker.scrape(opts)
    })
  }

  setInterval (intervalMs) {
    this._trackers.forEach(tracker => {
      tracker.setInterval(intervalMs)
    })
  }

  destroy () {
    if (this.destroyed) return
    this.destroyed = true
    const trackers = this._trackers
    let i = trackers.length
    while (i--) trackers[i].destroy()

    this._trackers = []
    this._getAnnounceOpts = null
  }

  _defaultAnnounceOpts (opts = {}) {
    if (!opts.numwant) opts.numwant = 50
    if (!opts.uploaded) opts.uploaded = 0
    if (!opts.downloaded) opts.downloaded = 0
    if (this._getAnnounceOpts) opts = Object.assign({}, opts, this._getAnnounceOpts())

    return opts
  }
}

var _$Client_2 = Client

var _$hgf_1 = {};
/* removed: const _$Client_2 = require('./modules/bittorrent-tracker/client') */;
/* removed: const _$common_5 = require('./modules/common') */;

function json2uint(msg) {
  return _$common_5.text2arr(JSON.stringify(msg))
}

function uint2json(msg) {
  return JSON.parse(_$common_5.arr2text(msg))
}

async function main (initiator) {
  var peerId = new Uint8Array([45, 87, 87, 48, 48, 51, 45].concat([...Array(13)].map(_ => Math.random() * 16 | 0)))
  var ip = await fetch('https://api.db-ip.com/v2/free/self/ipAddress').then(r => r.text())
  var infoHash = await _$common_5.sha1(_$common_5.text2arr('HGF:app:' + ip))
  var announce = [ 'wss://tracker.openwebtorrent.com' ]

  var tracker = new _$Client_2({
    infoHash,
    peerId,
    announce
  })

  tracker.start()
  tracker.on('peer', async peer => {
    window.peer = peer
    tracker.stop()

    peer._pc.onnegotiationneeded = async e => {
      const offer = await peer._pc.createOffer()

      // offer.sdp = text.trim()
      await peer._pc.setLocalDescription(offer)
      peer.send(json2uint({ offer: peer._pc.localDescription }))
    }

    peer._pc.ontrack = (e) => {
      console.log('on track')
      const { transceiver } = e
      console.log('ontrack', e)
      mseVideo.srcObject = e.streams[0]
      mseVideo.play()
      e.receiver.jitterBufferDelayHint = 10
      // stream2mediaSorce(stream)
      // stream2mediaSorce(e.streams[0], window.mseVideo)
      // setTimeout(() => {
      //   console.log('playing')
      //   mseVideo.play()
      // }, 5000)
    }

    peer.onMessage = async uint => {
      const data = uint2json(uint)
      console.log('msg data', data)
      if (data.offer) {
        peer._pc.setRemoteDescription(data.offer)

        const answer = await peer._pc.createAnswer()
        console.log('answer', answer)
        // await new Promise((resolve) => {
        //   window.transform = transform
        //   window.answer = answer
        //   window.resolve = resolve
        // })

        peer._pc.setLocalDescription(answer)
        peer.send(json2uint({answer: peer._pc.localDescription}))
      }
      if (data.answer) {
        await peer._pc.setRemoteDescription(data.answer)
      }
    }

    if (initiator) {
      // var camStream = await navigator.mediaDevices.getUserMedia({ video: true })

      const canvasStream = canvas.captureStream(200)
      console.log('canvasStream', canvasStream)
      peer._pc.addTransceiver(canvasStream.getTracks()[0], {
        streams: [ canvasStream ]
      })
    }
  })
}

main(location.search === '?initiator')

// Global state
window.appDied = false;
window.mseVideo;
window.srcEqVideo;
window.theRecorder;
window.mediaSource;
window.sourceBuffer;

});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2stZmxhdC9fcHJlbHVkZSIsIm1vZHVsZXMvZXZlbnRzLmpzIiwibW9kdWxlcy9iaXR0b3JyZW50LXRyYWNrZXIvbGliL2NsaWVudC90cmFja2VyLmpzIiwibW9kdWxlcy9jb21tb24vaW5kZXguanMiLCJtb2R1bGVzL2xpZ2h0LXBlZXIvbGlnaHQuanMiLCJtb2R1bGVzL2JpdHRvcnJlbnQtdHJhY2tlci9saWIvY2xpZW50L3dlYnNvY2tldC10cmFja2VyLmpzIiwibW9kdWxlcy9iaXR0b3JyZW50LXRyYWNrZXIvY2xpZW50LmpzIiwiaGdmLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay1mbGF0L19wb3N0bHVkZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBLEFDREEsTUFBTSxDQUFDLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxHQUFHLE9BQU8sR0FBRyxJQUFJO0FBQ3RELE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssVUFBVTtJQUNuRCxDQUFDLENBQUMsS0FBSztJQUNQLFNBQVMsWUFBWSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFO0lBQy9DLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDO0dBQzdEOztBQUVILElBQUksY0FBYztBQUNsQixJQUFJLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEtBQUssVUFBVSxFQUFFO0VBQ3hDLGNBQWMsR0FBRyxDQUFDLENBQUMsT0FBTztDQUMzQixNQUFNLElBQUksTUFBTSxDQUFDLHFCQUFxQixFQUFFO0VBQ3ZDLGNBQWMsR0FBRyxTQUFTLGNBQWMsRUFBRSxNQUFNLEVBQUU7SUFDaEQsT0FBTyxNQUFNLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDO09BQ3RDLE1BQU0sQ0FBQyxN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dGlvbihmKXtpZih0eXBlb2YgZXhwb3J0cz09PVwib2JqZWN0XCImJnR5cGVvZiBtb2R1bGUhPT1cInVuZGVmaW5lZFwiKXttb2R1bGUuZXhwb3J0cz1mKCl9ZWxzZSBpZih0eXBlb2YgZGVmaW5lPT09XCJmdW5jdGlvblwiJiZkZWZpbmUuYW1kKXtkZWZpbmUoW10sZil9ZWxzZXt2YXIgZztpZih0eXBlb2Ygd2luZG93IT09XCJ1bmRlZmluZWRcIil7Zz13aW5kb3d9ZWxzZSBpZih0eXBlb2YgZ2xvYmFsIT09XCJ1bmRlZmluZWRcIil7Zz1nbG9iYWx9ZWxzZSBpZih0eXBlb2Ygc2VsZiE9PVwidW5kZWZpbmVkXCIpe2c9c2VsZn1lbHNle2c9dGhpc31nLldlYlRvcnJlbnQgPSBmKCl9fSkoZnVuY3Rpb24oKXt2YXIgZGVmaW5lLG1vZHVsZSxleHBvcnRzO1xuIiwiY29uc3QgUiA9IHR5cGVvZiBSZWZsZWN0ID09PSAnb2JqZWN0JyA/IFJlZmxlY3QgOiBudWxsXG5jb25zdCBSZWZsZWN0QXBwbHkgPSBSICYmIHR5cGVvZiBSLmFwcGx5ID09PSAnZnVuY3Rpb24nXG4gID8gUi5hcHBseVxuICA6IGZ1bmN0aW9uIFJlZmxlY3RBcHBseSAodGFyZ2V0LCByZWNlaXZlciwgYXJncykge1xuICAgIHJldHVybiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbCh0YXJnZXQsIHJlY2VpdmVyLCBhcmdzKVxuICB9XG5cbmxldCBSZWZsZWN0T3duS2V5c1xuaWYgKFIgJiYgdHlwZW9mIFIub3duS2V5cyA9PT0gJ2Z1bmN0aW9uJykge1xuICBSZWZsZWN0T3duS2V5cyA9IFIub3duS2V5c1xufSBlbHNlIGlmIChPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKSB7XG4gIFJlZmxlY3RPd25LZXlzID0gZnVuY3Rpb24gUmVmbGVjdE93bktleXMgKHRhcmdldCkge1xuICAgIHJldHVybiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0YXJnZXQpXG4gICAgICAuY29uY2F0KE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHModGFyZ2V0KSlcbiAgfVxufSBlbHNlIHtcbiAgUmVmbGVjdE93bktleXMgPSBmdW5jdGlvbiBSZWZsZWN0T3duS2V5cyAodGFyZ2V0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRhcmdldClcbiAgfVxufVxuXG5jbGFzcyBFdmVudEVtaXR0ZXIge1xuICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgaWYgKHRoaXMuX2V2ZW50cyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICB0aGlzLl9ldmVudHMgPT09IE9iamVjdC5nZXRQcm90b3R5cGVPZih0aGlzKS5fZXZlbnRzKSB7XG4gICAgICB0aGlzLl9ldmVudHMgPSBPYmplY3QuY3JlYXRlKG51bGwpXG4gICAgICB0aGlzLl9ldmVudHNDb3VudCA9IDBcbiAgICB9XG5cbiAgICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkXG4gIH1cblxuICAvLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3NcbiAgLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG4gIHNldE1heExpc3RlbmVycyAobikge1xuICAgIHRoaXMuX21heExpc3RlbmVycyA9IG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgZ2V0TWF4TGlzdGVuZXJzICgpIHtcbiAgICByZXR1cm4gJGdldE1heExpc3RlbmVycyh0aGlzKVxuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge3N0cmluZ30gdHlwZVxuICAgKiBAcGFyYW0gIHsuLi4qfSBhcmdzXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAqL1xuICBlbWl0ICh0eXBlLCAuLi5hcmdzKSB7XG4gICAgbGV0IGRvRXJyb3IgPSAodHlwZSA9PT0gJ2Vycm9yJylcblxuICAgIGNvbnN0IGV2ZW50cyA9IHRoaXMuX2V2ZW50c1xuICAgIGlmIChldmVudHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgZG9FcnJvciA9IChkb0Vycm9yICYmIGV2ZW50cy5lcnJvciA9PT0gdW5kZWZpbmVkKVxuICAgIH0gZWxzZSBpZiAoIWRvRXJyb3IpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgICBpZiAoZG9FcnJvcikge1xuICAgICAgbGV0IGVyXG4gICAgICBpZiAoYXJncy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGVyID0gYXJnc1swXVxuICAgICAgfVxuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgLy8gTm90ZTogVGhlIGNvbW1lbnRzIG9uIHRoZSBgdGhyb3dgIGxpbmVzIGFyZSBpbnRlbnRpb25hbCwgdGhleSBzaG93XG4gICAgICAgIC8vIHVwIGluIE5vZGUncyBvdXRwdXQgaWYgdGhpcyByZXN1bHRzIGluIGFuIHVuaGFuZGxlZCBleGNlcHRpb24uXG4gICAgICAgIHRocm93IGVyIC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICAvLyBBdCBsZWFzdCBnaXZlIHNvbWUga2luZCBvZiBjb250ZXh0IHRvIHRoZSB1c2VyXG4gICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYFVuaGFuZGxlZCBlcnJvci4ke2VyID8gYCAoJHtlci5tZXNzYWdlfSlgIDogJyd9YClcbiAgICAgIGVyci5jb250ZXh0ID0gZXJcbiAgICAgIHRocm93IGVyciAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgIH1cblxuICAgIGNvbnN0IGhhbmRsZXIgPSBldmVudHNbdHlwZV1cblxuICAgIGlmIChoYW5kbGVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIGlmICh0eXBlb2YgaGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgUmVmbGVjdEFwcGx5KGhhbmRsZXIsIHRoaXMsIGFyZ3MpXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGxlbiA9IGhhbmRsZXIubGVuZ3RoXG4gICAgICBjb25zdCBsaXN0ZW5lcnMgPSBhcnJheUNsb25lKGhhbmRsZXIsIGxlbilcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgUmVmbGVjdEFwcGx5KGxpc3RlbmVyc1tpXSwgdGhpcywgYXJncylcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgYWRkTGlzdGVuZXIgKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIF9hZGRMaXN0ZW5lcih0aGlzLCB0eXBlLCBsaXN0ZW5lciwgZmFsc2UpXG4gIH1cblxuICBwcmVwZW5kTGlzdGVuZXIgKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgcmV0dXJuIF9hZGRMaXN0ZW5lcih0aGlzLCB0eXBlLCBsaXN0ZW5lciwgdHJ1ZSlcbiAgfVxuXG4gIG9uY2UgKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVGhlIFwibGlzdGVuZXJcIiBhcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgRnVuY3Rpb24uIFJlY2VpdmVkIHR5cGUgJHt0eXBlb2YgbGlzdGVuZXJ9YClcbiAgICB9XG4gICAgdGhpcy5vbih0eXBlLCBfb25jZVdyYXAodGhpcywgdHlwZSwgbGlzdGVuZXIpKVxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBwcmVwZW5kT25jZUxpc3RlbmVyICh0eXBlLCBsaXN0ZW5lcikge1xuICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFRoZSBcImxpc3RlbmVyXCIgYXJndW1lbnQgbXVzdCBiZSBvZiB0eXBlIEZ1bmN0aW9uLiBSZWNlaXZlZCB0eXBlICR7dHlwZW9mIGxpc3RlbmVyfWApXG4gICAgfVxuICAgIHRoaXMucHJlcGVuZExpc3RlbmVyKHR5cGUsIF9vbmNlV3JhcCh0aGlzLCB0eXBlLCBsaXN0ZW5lcikpXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8vIEVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZiBhbmQgb25seSBpZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWQuXG4gIHJlbW92ZUxpc3RlbmVyICh0eXBlLCBsaXN0ZW5lcikge1xuICAgIGxldCBsaXN0XG4gICAgbGV0IGV2ZW50c1xuICAgIGxldCBwb3NpdGlvblxuICAgIGxldCBpXG4gICAgbGV0IG9yaWdpbmFsTGlzdGVuZXJcblxuICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFRoZSBcImxpc3RlbmVyXCIgYXJndW1lbnQgbXVzdCBiZSBvZiB0eXBlIEZ1bmN0aW9uLiBSZWNlaXZlZCB0eXBlICR7dHlwZW9mIGxpc3RlbmVyfWApXG4gICAgfVxuXG4gICAgZXZlbnRzID0gdGhpcy5fZXZlbnRzXG4gICAgaWYgKGV2ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIGxpc3QgPSBldmVudHNbdHlwZV1cbiAgICBpZiAobGlzdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fCBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikge1xuICAgICAgaWYgKC0tdGhpcy5fZXZlbnRzQ291bnQgPT09IDApIHtcbiAgICAgICAgdGhpcy5fZXZlbnRzID0gT2JqZWN0LmNyZWF0ZShudWxsKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVsZXRlIGV2ZW50c1t0eXBlXVxuICAgICAgICBpZiAoZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3QubGlzdGVuZXIgfHwgbGlzdGVuZXIpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBsaXN0ICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBwb3NpdGlvbiA9IC0xXG5cbiAgICAgIGZvciAoaSA9IGxpc3QubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8IGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB7XG4gICAgICAgICAgb3JpZ2luYWxMaXN0ZW5lciA9IGxpc3RbaV0ubGlzdGVuZXJcbiAgICAgICAgICBwb3NpdGlvbiA9IGlcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChwb3NpdGlvbiA8IDApIHtcbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICAgIH1cblxuICAgICAgaWYgKHBvc2l0aW9uID09PSAwKSB7XG4gICAgICAgIGxpc3Quc2hpZnQoKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3BsaWNlT25lKGxpc3QsIHBvc2l0aW9uKVxuICAgICAgfVxuXG4gICAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgZXZlbnRzW3R5cGVdID0gbGlzdFswXVxuICAgICAgfVxuXG4gICAgICBpZiAoZXZlbnRzLnJlbW92ZUxpc3RlbmVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIG9yaWdpbmFsTGlzdGVuZXIgfHwgbGlzdGVuZXIpXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIHJlbW92ZUFsbExpc3RlbmVycyAodHlwZSkge1xuICAgIGxldCBsaXN0ZW5lcnNcbiAgICBsZXQgZXZlbnRzXG4gICAgbGV0IGlcblxuICAgIGV2ZW50cyA9IHRoaXMuX2V2ZW50c1xuICAgIGlmIChldmVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gICAgaWYgKGV2ZW50cy5yZW1vdmVMaXN0ZW5lciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aGlzLl9ldmVudHMgPSBPYmplY3QuY3JlYXRlKG51bGwpXG4gICAgICAgIHRoaXMuX2V2ZW50c0NvdW50ID0gMFxuICAgICAgfSBlbHNlIGlmIChldmVudHNbdHlwZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoLS10aGlzLl9ldmVudHNDb3VudCA9PT0gMCkgeyB0aGlzLl9ldmVudHMgPSBPYmplY3QuY3JlYXRlKG51bGwpIH0gZWxzZSB7IGRlbGV0ZSBldmVudHNbdHlwZV0gfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKGV2ZW50cylcbiAgICAgIGxldCBrZXlcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGtleSA9IGtleXNbaV1cbiAgICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWVcbiAgICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KVxuICAgICAgfVxuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJylcbiAgICAgIHRoaXMuX2V2ZW50cyA9IE9iamVjdC5jcmVhdGUobnVsbClcbiAgICAgIHRoaXMuX2V2ZW50c0NvdW50ID0gMFxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICBsaXN0ZW5lcnMgPSBldmVudHNbdHlwZV1cblxuICAgIGlmICh0eXBlb2YgbGlzdGVuZXJzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycylcbiAgICB9IGVsc2UgaWYgKGxpc3RlbmVycyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBMSUZPIG9yZGVyXG4gICAgICBmb3IgKGkgPSBsaXN0ZW5lcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbaV0pXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGxpc3RlbmVycyAodHlwZSkge1xuICAgIHJldHVybiBfbGlzdGVuZXJzKHRoaXMsIHR5cGUsIHRydWUpXG4gIH1cblxuICByYXdMaXN0ZW5lcnMgKHR5cGUpIHtcbiAgICByZXR1cm4gX2xpc3RlbmVycyh0aGlzLCB0eXBlLCBmYWxzZSlcbiAgfVxuXG4gIGV2ZW50TmFtZXMgKCkge1xuICAgIHJldHVybiB0aGlzLl9ldmVudHNDb3VudCA+IDAgPyBSZWZsZWN0T3duS2V5cyh0aGlzLl9ldmVudHMpIDogW11cbiAgfVxufVxuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXJcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHNDb3VudCA9IDBcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZFxuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwXG5cbmZ1bmN0aW9uICRnZXRNYXhMaXN0ZW5lcnMgKHtfbWF4TGlzdGVuZXJzfSkge1xuICBpZiAoX21heExpc3RlbmVycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzXG4gIH1cbiAgcmV0dXJuIF9tYXhMaXN0ZW5lcnNcbn1cblxuZnVuY3Rpb24gX2FkZExpc3RlbmVyICh0YXJnZXQsIHR5cGUsIGxpc3RlbmVyLCBwcmVwZW5kKSB7XG4gIGxldCBtXG4gIGxldCBldmVudHNcbiAgbGV0IGV4aXN0aW5nXG5cbiAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFRoZSBcImxpc3RlbmVyXCIgYXJndW1lbnQgbXVzdCBiZSBvZiB0eXBlIEZ1bmN0aW9uLiBSZWNlaXZlZCB0eXBlICR7dHlwZW9mIGxpc3RlbmVyfWApXG4gIH1cblxuICBldmVudHMgPSB0YXJnZXQuX2V2ZW50c1xuICBpZiAoZXZlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICBldmVudHMgPSB0YXJnZXQuX2V2ZW50cyA9IE9iamVjdC5jcmVhdGUobnVsbClcbiAgICB0YXJnZXQuX2V2ZW50c0NvdW50ID0gMFxuICB9IGVsc2Uge1xuICAgIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gICAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICAgIGlmIChldmVudHMubmV3TGlzdGVuZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGFyZ2V0LmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIubGlzdGVuZXIgPyBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKVxuXG4gICAgICAvLyBSZS1hc3NpZ24gYGV2ZW50c2AgYmVjYXVzZSBhIG5ld0xpc3RlbmVyIGhhbmRsZXIgY291bGQgaGF2ZSBjYXVzZWQgdGhlXG4gICAgICAvLyB0aGlzLl9ldmVudHMgdG8gYmUgYXNzaWduZWQgdG8gYSBuZXcgb2JqZWN0XG4gICAgICBldmVudHMgPSB0YXJnZXQuX2V2ZW50c1xuICAgIH1cbiAgICBleGlzdGluZyA9IGV2ZW50c1t0eXBlXVxuICB9XG5cbiAgaWYgKGV4aXN0aW5nID09PSB1bmRlZmluZWQpIHtcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICBleGlzdGluZyA9IGV2ZW50c1t0eXBlXSA9IGxpc3RlbmVyXG4gICAgKyt0YXJnZXQuX2V2ZW50c0NvdW50XG4gIH0gZWxzZSB7XG4gICAgaWYgKHR5cGVvZiBleGlzdGluZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgICBleGlzdGluZyA9IGV2ZW50c1t0eXBlXSA9XG4gICAgICAgIHByZXBlbmQgPyBbbGlzdGVuZXIsIGV4aXN0aW5nXSA6IFtleGlzdGluZywgbGlzdGVuZXJdXG4gICAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgfSBlbHNlIGlmIChwcmVwZW5kKSB7XG4gICAgICBleGlzdGluZy51bnNoaWZ0KGxpc3RlbmVyKVxuICAgIH0gZWxzZSB7XG4gICAgICBleGlzdGluZy5wdXNoKGxpc3RlbmVyKVxuICAgIH1cblxuICAgIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gICAgbSA9ICRnZXRNYXhMaXN0ZW5lcnModGFyZ2V0KVxuICAgIGlmIChtID4gMCAmJiBleGlzdGluZy5sZW5ndGggPiBtICYmICFleGlzdGluZy53YXJuZWQpIHtcbiAgICAgIGV4aXN0aW5nLndhcm5lZCA9IHRydWVcbiAgICAgIC8vIE5vIGVycm9yIGNvZGUgZm9yIHRoaXMgc2luY2UgaXQgaXMgYSBXYXJuaW5nXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmVzdHJpY3RlZC1zeW50YXhcbiAgICAgIGNvbnN0IHcgPSBuZXcgRXJyb3IoYFBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgbGVhayBkZXRlY3RlZC4gJHtleGlzdGluZy5sZW5ndGh9ICR7U3RyaW5nKHR5cGUpfSBsaXN0ZW5lcnMgYWRkZWQuIFVzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0YClcbiAgICAgIHcubmFtZSA9ICdNYXhMaXN0ZW5lcnNFeGNlZWRlZFdhcm5pbmcnXG4gICAgICB3LmVtaXR0ZXIgPSB0YXJnZXRcbiAgICAgIHcudHlwZSA9IHR5cGVcbiAgICAgIHcuY291bnQgPSBleGlzdGluZy5sZW5ndGhcbiAgICAgIGNvbnNvbGUud2Fybih3KVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0YXJnZXRcbn1cblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXJcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lclxuXG5mdW5jdGlvbiBvbmNlV3JhcHBlciAoLi4uYXJncykge1xuICBpZiAoIXRoaXMuZmlyZWQpIHtcbiAgICB0aGlzLnRhcmdldC5yZW1vdmVMaXN0ZW5lcih0aGlzLnR5cGUsIHRoaXMud3JhcEZuKVxuICAgIHRoaXMuZmlyZWQgPSB0cnVlXG4gICAgUmVmbGVjdEFwcGx5KHRoaXMubGlzdGVuZXIsIHRoaXMudGFyZ2V0LCBhcmdzKVxuICB9XG59XG5cbmZ1bmN0aW9uIF9vbmNlV3JhcCAodGFyZ2V0LCB0eXBlLCBsaXN0ZW5lcikge1xuICBjb25zdCBzdGF0ZSA9IHsgZmlyZWQ6IGZhbHNlLCB3cmFwRm46IHVuZGVmaW5lZCwgdGFyZ2V0LCB0eXBlLCBsaXN0ZW5lciB9XG4gIGNvbnN0IHdyYXBwZWQgPSBvbmNlV3JhcHBlci5iaW5kKHN0YXRlKVxuICB3cmFwcGVkLmxpc3RlbmVyID0gbGlzdGVuZXJcbiAgc3RhdGUud3JhcEZuID0gd3JhcHBlZFxuICByZXR1cm4gd3JhcHBlZFxufVxuXG5mdW5jdGlvbiBfbGlzdGVuZXJzICh7X2V2ZW50c30sIHR5cGUsIHVud3JhcCkge1xuICBjb25zdCBldmVudHMgPSBfZXZlbnRzXG5cbiAgaWYgKGV2ZW50cyA9PT0gdW5kZWZpbmVkKSB7IHJldHVybiBbXSB9XG5cbiAgY29uc3QgZXZsaXN0ZW5lciA9IGV2ZW50c1t0eXBlXVxuICBpZiAoZXZsaXN0ZW5lciA9PT0gdW5kZWZpbmVkKSB7IHJldHVybiBbXSB9XG5cbiAgaWYgKHR5cGVvZiBldmxpc3RlbmVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIHVud3JhcCA/IFtldmxpc3RlbmVyLmxpc3RlbmVyIHx8IGV2bGlzdGVuZXJdIDogW2V2bGlzdGVuZXJdXG4gIH1cblxuICByZXR1cm4gdW53cmFwXG4gICAgPyB1bndyYXBMaXN0ZW5lcnMoZXZsaXN0ZW5lcilcbiAgICA6IGFycmF5Q2xvbmUoZXZsaXN0ZW5lciwgZXZsaXN0ZW5lci5sZW5ndGgpXG59XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gKGVtaXR0ZXIsIHR5cGUpID0+IHtcbiAgaWYgKHR5cGVvZiBlbWl0dGVyLmxpc3RlbmVyQ291bnQgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGxpc3RlbmVyQ291bnQuY2FsbChlbWl0dGVyLCB0eXBlKVxuICB9XG59XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGxpc3RlbmVyQ291bnRcblxuZnVuY3Rpb24gbGlzdGVuZXJDb3VudCAodHlwZSkge1xuICBjb25zdCBldmVudHMgPSB0aGlzLl9ldmVudHNcblxuICBpZiAoZXZlbnRzICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBldmxpc3RlbmVyID0gZXZlbnRzW3R5cGVdXG5cbiAgICBpZiAodHlwZW9mIGV2bGlzdGVuZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiAxXG4gICAgfSBlbHNlIGlmIChldmxpc3RlbmVyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHJldHVybiAwXG59XG5cbmZ1bmN0aW9uIGFycmF5Q2xvbmUgKGFyciwgbikge1xuICBjb25zdCBjb3B5ID0gbmV3IEFycmF5KG4pXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbjsgKytpKSB7XG4gICAgY29weVtpXSA9IGFycltpXVxuICB9XG4gIHJldHVybiBjb3B5XG59XG5cbmZ1bmN0aW9uIHNwbGljZU9uZSAobGlzdCwgaW5kZXgpIHtcbiAgZm9yICg7IGluZGV4ICsgMSA8IGxpc3QubGVuZ3RoOyBpbmRleCsrKSB7IGxpc3RbaW5kZXhdID0gbGlzdFtpbmRleCArIDFdIH1cbiAgbGlzdC5wb3AoKVxufVxuXG5mdW5jdGlvbiB1bndyYXBMaXN0ZW5lcnMgKGFycikge1xuICBjb25zdCByZXQgPSBuZXcgQXJyYXkoYXJyLmxlbmd0aClcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXQubGVuZ3RoOyArK2kpIHtcbiAgICByZXRbaV0gPSBhcnJbaV0ubGlzdGVuZXIgfHwgYXJyW2ldXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlclxuIiwiY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJylcblxuY2xhc3MgVHJhY2tlciBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIGNvbnN0cnVjdG9yIChjbGllbnQsIGFubm91bmNlVXJsKSB7XG4gICAgc3VwZXIoKVxuXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnRcbiAgICB0aGlzLmFubm91bmNlVXJsID0gYW5ub3VuY2VVcmxcblxuICAgIHRoaXMuaW50ZXJ2YWwgPSBudWxsXG4gICAgdGhpcy5kZXN0cm95ZWQgPSBmYWxzZVxuICB9XG5cbiAgc2V0SW50ZXJ2YWwgKGludGVydmFsTXMpIHtcbiAgICBpZiAoaW50ZXJ2YWxNcyA9PSBudWxsKSBpbnRlcnZhbE1zID0gdGhpcy5ERUZBVUxUX0FOTk9VTkNFX0lOVEVSVkFMXG5cbiAgICBjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWwpXG5cbiAgICBpZiAoaW50ZXJ2YWxNcykge1xuICAgICAgdGhpcy5pbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgdGhpcy5hbm5vdW5jZSh0aGlzLmNsaWVudC5fZGVmYXVsdEFubm91bmNlT3B0cygpKVxuICAgICAgfSwgaW50ZXJ2YWxNcylcbiAgICAgIGlmICh0aGlzLmludGVydmFsLnVucmVmKSB0aGlzLmludGVydmFsLnVucmVmKClcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBUcmFja2VyXG4iLCIvKiBnbG9iYWwgc2VsZiBjcnlwdG8gKi9cbi8qKlxuICogVGhpcyBmaWxlIGlzIG1lYW50IHRvIGJlIGEgc3Vic3RpdHV0ZSB0byBzb21lIG9mIHdoYXQgdGhlIG5vZGVqcyBhcGkgY2FuIGRvXG4gKiB0aGF0IHRoZSBicm93c2VyIGNhbid0IGRvIGFuZCB2aWNlIHZlcnNhLlxuICovXG5cbnZhciBzaGExID0gdHlwZW9mIGNyeXB0byA9PT0gJ29iamVjdCdcbiAgPyBjcnlwdG8uc3VidGxlLmRpZ2VzdC5iaW5kKGNyeXB0by5zdWJ0bGUsICdzaGEtMScpXG4gIDogKCkgPT4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdubyB3ZWIgY3J5cHRvIHN1cHBvcnQnKSlcbnZhciB0b0FyciA9IGUgPT4gbmV3IFVpbnQ4QXJyYXkoZSlcblxudmFyIGFscGhhYmV0ID0gJzAxMjM0NTY3ODlhYmNkZWYnXG52YXIgZW5jb2RlTG9va3VwID0gW11cbnZhciBkZWNvZGVMb29rdXAgPSBbXVxuXG5mb3IgKHZhciBpID0gMDsgaSA8IDI1NjsgaSsrKSB7XG4gIGVuY29kZUxvb2t1cFtpXSA9IGFscGhhYmV0W2kgPj4gNCAmIDB4Zl0gKyBhbHBoYWJldFtpICYgMHhmXVxuICBpZiAoaSA8IDE2KSB7XG4gICAgaWYgKGkgPCAxMCkge1xuICAgICAgZGVjb2RlTG9va3VwWzB4MzAgKyBpXSA9IGlcbiAgICB9IGVsc2Uge1xuICAgICAgZGVjb2RlTG9va3VwWzB4NjEgLSAxMCArIGldID0gaVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEVuY29kZSBhIFVpbnQ4QXJyYXkgdG8gYSBoZXggc3RyaW5nXG4gKlxuICogQHBhcmFtICB7VWludDhBcnJheX0gYXJyYXkgQnl0ZXMgdG8gZW5jb2RlIHRvIHN0cmluZ1xuICogQHJldHVybiB7c3RyaW5nfSAgICAgICAgICAgaGV4IHN0cmluZ1xuICovXG5leHBvcnRzLmFycjJoZXggPSBhcnJheSA9PiB7XG4gIHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGhcbiAgdmFyIHN0cmluZyA9ICcnXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbmd0aCkge1xuICAgIHN0cmluZyArPSBlbmNvZGVMb29rdXBbYXJyYXlbaSsrXV1cbiAgfVxuICByZXR1cm4gc3RyaW5nXG59XG5cbi8qKlxuICogRGVjb2RlcyBhIGhleCBzdHJpbmcgdG8gYSBVaW50OEFycmF5XG4gKlxuICogQHBhcmFtICB7c3RyaW5nfSBzdHJpbmcgaGV4IHN0cmluZyB0byBkZWNvZGUgdG8gVWludDhBcnJheVxuICogQHJldHVybiB7VWludDhBcnJheX0gICAgVWludDhBcnJheVxuICovXG5leHBvcnRzLmhleDJhcnIgPSBzdHJpbmcgPT4ge1xuICB2YXIgc2l6ZW9mID0gc3RyaW5nLmxlbmd0aCA+PiAxXG4gIHZhciBsZW5ndGggPSBzaXplb2YgPDwgMVxuICB2YXIgYXJyYXkgPSBuZXcgVWludDhBcnJheShzaXplb2YpXG4gIHZhciBuID0gMFxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW5ndGgpIHtcbiAgICBhcnJheVtuKytdID0gZGVjb2RlTG9va3VwW3N0cmluZy5jaGFyQ29kZUF0KGkrKyldIDw8IDQgfCBkZWNvZGVMb29rdXBbc3RyaW5nLmNoYXJDb2RlQXQoaSsrKV1cbiAgfVxuICByZXR1cm4gYXJyYXlcbn1cblxuLyoqXG4gKiBAcGFyYW0gIHtzdHJpbmd9IHN0clxuICogQHJldHVybiB7c3RyaW5nfVxuICovXG5leHBvcnRzLmJpbmFyeTJoZXggPSBzdHIgPT4ge1xuICB2YXIgaGV4ID0gJzAxMjM0NTY3ODlhYmNkZWYnXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgY1xuICB2YXIgaSA9IDBcbiAgdmFyIGwgPSBzdHIubGVuZ3RoXG5cbiAgZm9yICg7IGkgPCBsOyArK2kpIHtcbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICByZXMgKz0gaGV4LmNoYXJBdCgoYyA+PiA0KSAmIDB4RilcbiAgICByZXMgKz0gaGV4LmNoYXJBdChjICYgMHhGKVxuICB9XG5cbiAgcmV0dXJuIHJlc1xufVxuXG4vKipcbiAqIEBwYXJhbSAge3N0cmluZ30gaGV4XG4gKiBAcmV0dXJuIHtzdHJpbmd9XG4gKi9cbmV4cG9ydHMuaGV4MmJpbmFyeSA9IGhleCA9PiB7XG4gIGZvciAodmFyIHN0cmluZyA9ICcnLCBpID0gMCwgbCA9IGhleC5sZW5ndGg7IGkgPCBsOyBpICs9IDIpIHtcbiAgICBzdHJpbmcgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJzZUludChoZXguc3Vic3RyKGksIDIpLCAxNikpXG4gIH1cblxuICByZXR1cm4gc3RyaW5nXG59XG5cbi8qKlxuICogQHBhcmFtICB7QXJyYXlCdWZmZXJ8QXJyYXlCdWZmZXJWaWV3fSBidWZmZXJcbiAqIEByZXR1cm4ge1Byb21pc2U8VWludDhBcnJheT59XG4gKi9cbmV4cG9ydHMuc2hhMSA9IGJ1ZmZlciA9PiBzaGExKGJ1ZmZlcikudGhlbih0b0FycilcblxuZXhwb3J0cy50ZXh0MmFyciA9IFRleHRFbmNvZGVyLnByb3RvdHlwZS5lbmNvZGUuYmluZChuZXcgVGV4dEVuY29kZXIoKSlcblxuZXhwb3J0cy5hcnIydGV4dCA9IFRleHREZWNvZGVyLnByb3RvdHlwZS5kZWNvZGUuYmluZChuZXcgVGV4dERlY29kZXIoKSlcblxuZXhwb3J0cy5iaW5hcnlUb0hleCA9IHN0ciA9PiB7XG4gIHZhciBoZXggPSAnMDEyMzQ1Njc4OWFiY2RlZidcbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBjXG4gIHZhciBpID0gMFxuICB2YXIgbCA9IHN0ci5sZW5ndGhcblxuICBmb3IgKDsgaSA8IGw7ICsraSkge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIHJlcyArPSBoZXguY2hhckF0KChjID4+IDQpICYgMHhGKVxuICAgIHJlcyArPSBoZXguY2hhckF0KGMgJiAweEYpXG4gIH1cblxuICByZXR1cm4gcmVzXG59XG5cbmV4cG9ydHMuaGV4VG9CaW5hcnkgPSBoZXggPT4ge1xuICBmb3IgKHZhciBzdHJpbmcgPSAnJywgaSA9IDAsIGwgPSBoZXgubGVuZ3RoOyBpIDwgbDsgaSArPSAyKSB7XG4gICAgc3RyaW5nICs9IFN0cmluZy5mcm9tQ2hhckNvZGUocGFyc2VJbnQoaGV4LnN1YnN0cihpLCAyKSwgMTYpKVxuICB9XG5cbiAgcmV0dXJuIHN0cmluZ1xufVxuIiwiLyogZ2xvYmFsIFJUQ1BlZXJDb25uZWN0aW9uICovXG5cbmNvbnN0IE1BWF9CVUZGRVJFRF9BTU9VTlQgPSA2NCAqIDEwMjRcbmNvbnN0IGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KE1BWF9CVUZGRVJFRF9BTU9VTlQpXG5cbmNsYXNzIFBlZXIge1xuICBjb25zdHJ1Y3RvciAob3B0cyA9IHt9KSB7XG4gICAgdGhpcy5pbml0aWF0b3IgPSAhb3B0cy5vZmZlclxuXG4gICAgdGhpcy5yZW1vdGVBZGRyZXNzID1cbiAgICB0aGlzLnJlbW90ZVBvcnQgPVxuICAgIHRoaXMubG9jYWxBZGRyZXNzID1cbiAgICB0aGlzLm9uTWVzc2FnZSA9XG4gICAgdGhpcy5sb2NhbFBvcnQgPVxuICAgIHRoaXMudGltZXN0YW1wID1cbiAgICB0aGlzLnNkcCA9XG4gICAgdGhpcy5vblNpZ25hbCA9XG4gICAgdGhpcy5lcnJvciA9XG4gICAgdGhpcy5fZXZ0TG9vcFRpbWVyID1cbiAgICB0aGlzLl9kYyA9IG51bGxcblxuICAgIHRoaXMuX2J1Y2tldCA9IFtdIC8vIGhvbGRzIG1lc3NhZ2VzIHVudGlsIGlwYWRyZXNzIGhhdmUgYmVlbiBmb3VuZFxuICAgIHRoaXMuX3F1ZXVlID0gW11cbiAgICB0aGlzLl9idWxrU2VuZCA9IHRoaXMuYnVsa1NlbmQuYmluZCh0aGlzKVxuXG4gICAgY29uc3QgcGMgPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24ob3B0cy5jb25maWcgfHwgUGVlci5jb25maWcpXG4gICAgdGhpcy5fcGMgPSBwY1xuXG4gICAgLy8gKHNvbWV0aW1lcyBnZXRzIHJldHJpZ2dlcmQgYnkgb25kYXRhY2hhbm5lbClcbiAgICBwYy5vbmljZWNvbm5lY3Rpb25zdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgIHN3aXRjaCAocGMuaWNlQ29ubmVjdGlvblN0YXRlKSB7XG4gICAgICAgIGNhc2UgJ2Nvbm5lY3RlZCc6XG4gICAgICAgICAgLy8gcGMuZ2V0U3RhdHMoKS50aGVuKGl0ZW1zID0+IHRoaXMuX29uY2VTdGF0cyhpdGVtcykpXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnZGlzY29ubmVjdGVkJzpcbiAgICAgICAgICB0aGlzLmRlc3Ryb3kobmV3IEVycm9yKCdJY2UgY29ubmVjdGlvbiBkaXNjb25uZWN0ZWQuJykpXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnZmFpbGVkJzpcbiAgICAgICAgICB0aGlzLmRlc3Ryb3kobmV3IEVycm9yKCdJY2UgY29ubmVjdGlvbiBmYWlsZWQuJykpXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5pbml0aWF0b3IpIHtcbiAgICAgIHRoaXMuY3JlYXRlU0RQKClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZXRTRFAob3B0c1snb2ZmZXInXSlcbiAgICB9XG4gIH1cblxuICBfc2V0dXBEYXRhICgpIHtcbiAgICBjb25zdCBkYyA9IHRoaXMuX2RjXG5cbiAgICBkYy5vbm9wZW4gPSAoKSA9PiB7XG4gICAgICB0aGlzLl9wYy5nZXRTdGF0cygpLnRoZW4oaXRlbXMgPT4gdGhpcy5fb25jZVN0YXRzKGl0ZW1zKSlcbiAgICB9XG5cbiAgICBkYy5iaW5hcnlUeXBlID0gJ2FycmF5YnVmZmVyJ1xuXG4gICAgZGMuYnVmZmVyZWRBbW91bnRMb3dUaHJlc2hvbGQgPSBNQVhfQlVGRkVSRURfQU1PVU5UXG5cbiAgICBkYy5vbm1lc3NhZ2UgPSBldnQgPT4ge1xuICAgICAgaWYgKHRoaXMudGltZXN0YW1wKSB7XG4gICAgICAgIHRoaXMub25NZXNzYWdlKG5ldyBVaW50OEFycmF5KGV2dC5kYXRhKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2J1Y2tldC5wdXNoKG5ldyBVaW50OEFycmF5KGV2dC5kYXRhKSlcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfb25jZVN0YXRzIChpdGVtcykge1xuICAgIGxldCBzZWxlY3RlZFxuXG4gICAgaXRlbXMuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgIC8vIFNwZWMtY29tcGxpYW50XG4gICAgICBpZiAoaXRlbS50eXBlID09PSAndHJhbnNwb3J0JyAmJiBpdGVtLnNlbGVjdGVkQ2FuZGlkYXRlUGFpcklkKSB7XG4gICAgICAgIHNlbGVjdGVkID0gaXRlbXMuZ2V0KGl0ZW0uc2VsZWN0ZWRDYW5kaWRhdGVQYWlySWQpXG4gICAgICB9XG5cbiAgICAgIC8vIE9sZCBpbXBsZW1lbnRhdGlvbnNcbiAgICAgIGlmICghc2VsZWN0ZWQgJiYgaXRlbS50eXBlID09PSAnY2FuZGlkYXRlLXBhaXInICYmIChpdGVtLnNlbGVjdGVkIHx8IGl0ZW0ubm9taW5hdGVkKSkge1xuICAgICAgICBzZWxlY3RlZCA9IGl0ZW1cbiAgICAgIH1cbiAgICB9KVxuXG4gICAgY29uc3QgbG9jYWwgPSBpdGVtcy5nZXQoc2VsZWN0ZWQubG9jYWxDYW5kaWRhdGVJZCkgfHwge31cbiAgICBjb25zdCByZW1vdGUgPSBpdGVtcy5nZXQoc2VsZWN0ZWQucmVtb3RlQ2FuZGlkYXRlSWQpIHx8IHt9XG5cbiAgICB0aGlzLm5ldHdvcmtUeXBlID0gbG9jYWwubmV0d29ya1R5cGVcblxuICAgIHRoaXMuY2FuZGlkYXRlVHlwZSA9IGxvY2FsLmNhbmRpZGF0ZVR5cGVcbiAgICB0aGlzLmxvY2FsQWRkcmVzcyA9IGxvY2FsLmlwIHx8IGxvY2FsLmFkZHJlc3MgfHwgbG9jYWwuaXBBZGRyZXNzXG4gICAgdGhpcy5sb2NhbFBvcnQgPSBsb2NhbC5wb3J0IHx8IGxvY2FsLnBvcnROdW1iZXJcblxuICAgIHRoaXMucmVtb3RlQWRkcmVzcyA9IHJlbW90ZS5pcCB8fCByZW1vdGUuYWRkcmVzcyB8fCByZW1vdGUuaXBBZGRyZXNzXG4gICAgdGhpcy5yZW1vdGVQb3J0ID0gcmVtb3RlLnBvcnQgfHwgcmVtb3RlLnBvcnROdW1iZXJcblxuICAgIHRoaXMub25Db25uZWN0ICYmIHRoaXMub25Db25uZWN0KHRoaXMpXG5cbiAgICB0aGlzLnRpbWVzdGFtcCA9IERhdGUubm93KCkgLyAxMDAwIHwgMFxuXG4gICAgdGhpcy5fYnVja2V0LmZvckVhY2gobXNnID0+IHtcbiAgICAgIHRoaXMub25NZXNzYWdlKG1zZylcbiAgICB9KVxuICAgIHRoaXMuX2J1Y2tldCA9IG51bGxcbiAgfVxuXG4gIGFzeW5jIGNyZWF0ZVNEUCAoKSB7XG4gICAgY29uc3QgcGMgPSB0aGlzLl9wY1xuICAgIGlmICghdGhpcy5fZGMpIHtcbiAgICAgIHRoaXMuX2RjID0gcGMuY3JlYXRlRGF0YUNoYW5uZWwoJycpXG4gICAgICB0aGlzLl9zZXR1cERhdGEoKVxuICAgIH1cblxuICAgIGNvbnN0IGRlc2MgPSBhd2FpdCBwYy5jcmVhdGVPZmZlcigpXG5cbiAgICAvLyByZW1vdmUgdHJpY2tsZVxuICAgIGRlc2Muc2RwID0gZGVzYy5zZHAucmVwbGFjZSgvYT1pY2Utb3B0aW9uczp0cmlja2xlXFxzXFxuL2csICcnKVxuXG4gICAgLy8gdHJpY2tsZSBpY2VcbiAgICBjb25zdCBpY2VHYXRoZXJpbmcgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgIHNldFRpbWVvdXQocmVzb2x2ZSwgMjAwMClcbiAgICAgIHBjLm9uaWNlY2FuZGlkYXRlID0gZXZ0ID0+IHtcbiAgICAgICAgIWV2dC5jYW5kaWRhdGUgJiYgcmVzb2x2ZShwYy5vbmljZWNhbmRpZGF0ZSA9IG51bGwpXG4gICAgICB9XG4gICAgfSlcblxuICAgIGF3YWl0IHBjLnNldExvY2FsRGVzY3JpcHRpb24oZGVzYylcbiAgICBhd2FpdCBpY2VHYXRoZXJpbmdcblxuICAgIHRoaXMuc2RwID0gcGMubG9jYWxEZXNjcmlwdGlvblxuICAgIHRoaXMub25TaWduYWwodGhpcylcbiAgfVxuXG4gIGFzeW5jIHNldFNEUCAoc2RwKSB7XG4gICAgaWYgKHRoaXMuZGVzdHJveWVkKSBjb25zb2xlLmxvZygnY2FudCBkbyB0aGlzIHdoZW4gaXRzIGNsb3NlZCcsIHRoaXMuZXJyb3IpXG4gICAgY29uc3QgcGMgPSB0aGlzLl9wY1xuICAgIGF3YWl0IHBjLnNldFJlbW90ZURlc2NyaXB0aW9uKHNkcClcbiAgICBwYy5vbmRhdGFjaGFubmVsID0gbnVsbFxuXG4gICAgaWYgKCFwYy5sb2NhbERlc2NyaXB0aW9uKSB7XG4gICAgICBjb25zdCBpY2VHYXRoZXJpbmcgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgcGMub25pY2VjYW5kaWRhdGUgPSBldnQgPT4ge1xuICAgICAgICAgICFldnQuY2FuZGlkYXRlICYmIHJlc29sdmUocGMub25pY2VjYW5kaWRhdGUgPSBudWxsKVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBjb25zdCBkZXNjID0gYXdhaXQgcGMuY3JlYXRlQW5zd2VyKClcbiAgICAgIGRlc2Muc2RwID0gZGVzYy5zZHAucmVwbGFjZSgvYT1pY2Utb3B0aW9uczp0cmlja2xlXFxzXFxuL2csICcnKVxuICAgICAgYXdhaXQgcGMuc2V0TG9jYWxEZXNjcmlwdGlvbihkZXNjKVxuICAgICAgYXdhaXQgaWNlR2F0aGVyaW5nXG4gICAgICBwYy5vbmRhdGFjaGFubmVsID0gZXZ0ID0+IHtcbiAgICAgICAgdGhpcy5fZGMgPSBldnQuY2hhbm5lbFxuICAgICAgICB0aGlzLl9zZXR1cERhdGEoKVxuICAgICAgICBwYy5vbmljZWNvbm5lY3Rpb25zdGF0ZWNoYW5nZSgpXG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc2RwID0gcGMubG9jYWxEZXNjcmlwdGlvblxuICAgIHRoaXMub25TaWduYWwgJiYgdGhpcy5vblNpZ25hbCh0aGlzKVxuICB9XG5cbiAgc2lnbmFsIChzZHApIHtcbiAgICB0aGlzLnNldFNEUChzZHApXG4gIH1cblxuICAvKipcbiAgICogU2VuZCB0ZXh0L2JpbmFyeSBkYXRhIHRvIHRoZSByZW1vdGUgcGVlci5cbiAgICogQHBhcmFtIHtVaW50OEFycmF5fSBjaHVua1xuICAgKi9cbiAgc2VuZCAoY2h1bmspIHtcbiAgICAvLyBjb25zdCBjaGFubmVsID0gdGhpcy5fY2hhbm5lbFxuICAgIC8vIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuXG4gICAgLy8gaWYgKGNoYW5uZWwucmVhZHlTdGF0ZSA9PT0gJ2Nsb3NpbmcnKSByZXR1cm4gdGhpcy5kZXN0cm95KClcbiAgICAvLyBpZiAoY2hhbm5lbC5yZWFkeVN0YXRlID09PSAnb3BlbicpIHtcbiAgICAvLyAgIGNoYW5uZWwuc2VuZChjaHVuaylcbiAgICAvLyB9XG5cbiAgICBpZiAoIXdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrKSB7XG4gICAgICBjb25zdCBjaGFubmVsID0gdGhpcy5fZGNcbiAgICAgIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuXG4gICAgICBpZiAoY2hhbm5lbC5yZWFkeVN0YXRlID09PSAnY2xvc2luZycpIHJldHVybiB0aGlzLmRlc3Ryb3koKVxuXG4gICAgICBjaGFubmVsLnNlbmQoY2h1bmspXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAodGhpcy5ldnRMb29wVGltZXIpIHtcbiAgICAgIHRoaXMucXVldWUucHVzaChjaHVuaylcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5xdWV1ZSA9IFtjaHVua11cbiAgICAgIHRoaXMuZXZ0TG9vcFRpbWVyID0gd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2sodGhpcy5fYnVsa1NlbmQpXG4gICAgfVxuICB9XG5cbiAgYnVsa1NlbmQgKCkge1xuICAgIGNvbnN0IGRjID0gdGhpcy5fZGNcbiAgICBpZiAodGhpcy5kZXN0cm95ZWQpIHJldHVyblxuICAgIGlmIChkYy5yZWFkeVN0YXRlID09PSAnY2xvc2luZycpIHJldHVybiB0aGlzLmRlc3Ryb3koKVxuICAgIGNvbnN0IGNodW5rcyA9IHRoaXMucXVldWVcblxuICAgIGlmIChjaHVua3MubGVuZ3RoID09PSAxKSB7XG4gICAgICBkYy5zZW5kKGNodW5rc1swXSlcbiAgICAgIHRoaXMuZXZ0TG9vcFRpbWVyID0gdGhpcy5xdWV1ZSA9IG51bGxcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGxldCBvZmZzZXQgPSAwXG4gICAgbGV0IG1lcmdlZCA9IFtdXG4gICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjaHVua3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBjb25zdCBjaHVuayA9IGNodW5rc1tpXVxuICAgICAgaWYgKGNodW5rLmxlbmd0aCArIG9mZnNldCA+PSBidWZmZXIubGVuZ3RoKSB7XG4gICAgICAgIC8vIFNlbmQgbWFueSBzbWFsbCBtZXNzYWdlcyBhcyBvbmVcbiAgICAgICAgaWYgKG9mZnNldCkge1xuICAgICAgICAgIGRjLnNlbmQoYnVmZmVyLnN1YmFycmF5KDAsIG9mZnNldCkpXG4gICAgICAgICAgb2Zmc2V0ID0gMFxuICAgICAgICAgIG1lcmdlZCA9IFtdXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGMuc2VuZChjaHVuaylcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBtZXJnZWQucHVzaChjaHVuay5sZW5ndGgpXG4gICAgICBidWZmZXIuc2V0KGNodW5rLCBvZmZzZXQpXG4gICAgICBvZmZzZXQgKz0gY2h1bmsubGVuZ3RoXG4gICAgfVxuXG4gICAgZGMuc2VuZChidWZmZXIuc3ViYXJyYXkoMCwgb2Zmc2V0KSlcblxuICAgIHRoaXMuZXZ0TG9vcFRpbWVyID0gdGhpcy5xdWV1ZSA9IG51bGxcbiAgfVxuXG4gIGRlc3Ryb3kgKGVycikge1xuICAgIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuXG4gICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlXG4gICAgdGhpcy5lcnJvciA9IHR5cGVvZiBlcnIgPT09ICdzdHJpbmcnXG4gICAgICA/IG5ldyBFcnJvcihlcnIpXG4gICAgICA6IGVyciB8fCBuZXcgRXJyb3IoJ3NvbWV0aGluZyBjbG9zZWQnKVxuXG4gICAgLy8gdGhpcy5lcnJvciA9IGVyciB8fCBudWxsXG4gICAgLy8gdGhpcy5fZGVidWcoJ2Rlc3Ryb3kgKGVycm9yOiAlcyknLCBlcnIgJiYgKGVyci5tZXNzYWdlIHx8IGVycikpXG4gICAgY29uc3QgY2hhbm5lbCA9IHRoaXMuX2RjXG4gICAgY29uc3QgcGMgPSB0aGlzLl9wY1xuXG4gICAgLy8gQ2xlYW51cCBEYXRhQ2hhbm5lbFxuICAgIGlmICh0aGlzLl9kYykge1xuICAgICAgY2hhbm5lbC5vbmNsb3NlID0gbnVsbFxuICAgICAgY2hhbm5lbC5vbmVycm9yID0gbnVsbFxuICAgICAgY2hhbm5lbC5vbm1lc3NhZ2UgPSBudWxsXG4gICAgICBjaGFubmVsLm9ub3BlbiA9IG51bGxcbiAgICAgIGlmIChjaGFubmVsLnJlYWR5U3RhdGUgIT09ICdjbG9zZWQnKSBjaGFubmVsLmNsb3NlKClcbiAgICB9XG5cbiAgICBwYy5vbmRhdGFjaGFubmVsID0gbnVsbFxuICAgIHBjLm9uaWNlY2FuZGlkYXRlID0gbnVsbFxuICAgIHBjLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gbnVsbFxuICAgIHBjLm9uaWNlZ2F0aGVyaW5nc3RhdGVjaGFuZ2UgPSBudWxsXG4gICAgcGMub25zaWduYWxpbmdzdGF0ZWNoYW5nZSA9IG51bGxcbiAgICBpZiAocGMuaWNlQ29ubmVjdGlvblN0YXRlID09PSAnbmV3JykgZmFsc2UgJiYgY29uc29sZS5sb2cobmV3IEVycm9yKCdkb250IGNsb3NlIHRoaXMnKSlcbiAgICBwYy5jbG9zZSgpXG5cbiAgICAvLyBDbGVhbnVwIGxvY2FsIHZhcmlhYmxlc1xuICAgIHRoaXMuX2NoYW5uZWxSZWFkeSA9XG4gICAgdGhpcy5fcGNSZWFkeSA9XG4gICAgdGhpcy5jb25uZWN0ZWQgPVxuICAgIHRoaXMub25NZXNzYWdlID1cbiAgICB0aGlzLnRpbWVzdGFtcCA9XG4gICAgdGhpcy5fZGMgPVxuICAgIHRoaXMuX3BjID0gbnVsbFxuXG4gICAgdGhpcy5vbkRlc3Ryb3kgJiYgdGhpcy5vbkRlc3Ryb3koZXJyKVxuICB9XG59XG5cbi8qKlxuICogRXhwb3NlIGNvbmZpZywgY29uc3RyYWludHMsIGFuZCBkYXRhIGNoYW5uZWwgY29uZmlnIGZvciBvdmVycmlkaW5nIGFsbCBQZWVyXG4gKiBpbnN0YW5jZXMuIE90aGVyd2lzZSwganVzdCBzZXQgb3B0cy5jb25maWcsIG9wdHMuY29uc3RyYWludHMsIG9yIG9wdHMuY2hhbm5lbENvbmZpZ1xuICogd2hlbiBjb25zdHJ1Y3RpbmcgYSBQZWVyLlxuICovXG5QZWVyLmNvbmZpZyA9IHtcbiAgaWNlU2VydmVyczogW1xuICAgIHsgdXJsczogJ3N0dW46c3R1bi5sLmdvb2dsZS5jb206MTkzMDInIH0sXG4gICAgeyB1cmxzOiAnc3R1bjpnbG9iYWwuc3R1bi50d2lsaW8uY29tOjM0Nzg/dHJhbnNwb3J0PXVkcCcgfVxuICBdXG59XG5cbm1vZHVsZS5leHBvcnRzID0gUGVlclxuIiwiLyogZ2xvYmFsIFdlYlNvY2tldCAqL1xuXG5jb25zdCBQZWVyID0gcmVxdWlyZSgnLi4vLi4vLi4vbGlnaHQtcGVlci9saWdodC5qcycpXG5jb25zdCBUcmFja2VyID0gcmVxdWlyZSgnLi90cmFja2VyJylcbmNvbnN0IHsgaGV4VG9CaW5hcnksIGJpbmFyeVRvSGV4IH0gPSByZXF1aXJlKCcuLi8uLi8uLi9jb21tb24nKVxuXG4vLyBVc2UgYSBzb2NrZXQgcG9vbCwgc28gdHJhY2tlciBjbGllbnRzIHNoYXJlIFdlYlNvY2tldCBvYmplY3RzIGZvciB0aGUgc2FtZSBzZXJ2ZXIuXG4vLyBJbiBwcmFjdGljZSwgV2ViU29ja2V0cyBhcmUgcHJldHR5IHNsb3cgdG8gZXN0YWJsaXNoLCBzbyB0aGlzIGdpdmVzIGEgbmljZSBwZXJmb3JtYW5jZVxuLy8gYm9vc3QsIGFuZCBzYXZlcyBicm93c2VyIHJlc291cmNlcy5cbmNvbnN0IHNvY2tldFBvb2wgPSB7fVxuXG5jb25zdCBSRUNPTk5FQ1RfTUlOSU1VTSA9IDE1ICogMTAwMFxuY29uc3QgUkVDT05ORUNUX01BWElNVU0gPSAzMCAqIDYwICogMTAwMFxuY29uc3QgUkVDT05ORUNUX1ZBUklBTkNFID0gMzAgKiAxMDAwXG5jb25zdCBPRkZFUl9USU1FT1VUID0gNTAgKiAxMDAwXG5jb25zdCBNQVhfQlVGRkVSRURfQU1PVU5UID0gNjQgKiAxMDI0XG5cbmNsYXNzIFdlYlNvY2tldFRyYWNrZXIgZXh0ZW5kcyBUcmFja2VyIHtcbiAgY29uc3RydWN0b3IgKGNsaWVudCwgYW5ub3VuY2VVcmwpIHtcbiAgICBzdXBlcihjbGllbnQsIGFubm91bmNlVXJsKVxuICAgIC8vIGRlYnVnKCduZXcgd2Vic29ja2V0IHRyYWNrZXIgJXMnLCBhbm5vdW5jZVVybClcblxuICAgIHRoaXMucGVlcnMgPSB7fSAvLyBwZWVycyAob2ZmZXIgaWQgLT4gcGVlcilcbiAgICB0aGlzLnJldXNhYmxlID0ge30gLy8gcGVlcnMgKG9mZmVyIGlkIC0+IHBlZXIpXG4gICAgdGhpcy5zb2NrZXQgPSBudWxsXG5cbiAgICB0aGlzLnJlY29ubmVjdGluZyA9IGZhbHNlXG4gICAgdGhpcy5yZXRyaWVzID0gMFxuICAgIHRoaXMucmVjb25uZWN0VGltZXIgPSBudWxsXG5cbiAgICAvLyBTaW1wbGUgYm9vbGVhbiBmbGFnIHRvIHRyYWNrIHdoZXRoZXIgdGhlIHNvY2tldCBoYXMgcmVjZWl2ZWQgZGF0YSBmcm9tXG4gICAgLy8gdGhlIHdlYnNvY2tldCBzZXJ2ZXIgc2luY2UgdGhlIGxhc3QgdGltZSBzb2NrZXQuc2VuZCgpIHdhcyBjYWxsZWQuXG4gICAgdGhpcy5leHBlY3RpbmdSZXNwb25zZSA9IGZhbHNlXG5cbiAgICB0aGlzLl9vcGVuU29ja2V0KClcbiAgfVxuXG4gIGFubm91bmNlIChvcHRzKSB7XG4gICAgaWYgKHRoaXMuZGVzdHJveWVkIHx8IHRoaXMucmVjb25uZWN0aW5nKSByZXR1cm5cbiAgICBpZiAodGhpcy5zb2NrZXQuX3dzLnJlYWR5U3RhdGUgIT09IFdlYlNvY2tldC5PUEVOKSB7XG4gICAgICB0aGlzLnNvY2tldC5fd3MuYWRkRXZlbnRMaXN0ZW5lcignb3BlbicsICgpID0+IHtcbiAgICAgICAgdGhpcy5hbm5vdW5jZShvcHRzKVxuICAgICAgfSwgeyBvbmNlOiB0cnVlIH0pXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCBwYXJhbXMgPSBPYmplY3QuYXNzaWduKHt9LCBvcHRzLCB7XG4gICAgICBhY3Rpb246ICdhbm5vdW5jZScsXG4gICAgICBpbmZvX2hhc2g6IHRoaXMuY2xpZW50Ll9pbmZvSGFzaEJpbmFyeSxcbiAgICAgIHBlZXJfaWQ6IHRoaXMuY2xpZW50Ll9wZWVySWRCaW5hcnlcbiAgICB9KVxuICAgIGlmICh0aGlzLl90cmFja2VySWQpIHBhcmFtcy50cmFja2VyaWQgPSB0aGlzLl90cmFja2VySWRcblxuICAgIGlmIChvcHRzLmV2ZW50ID09PSAnc3RvcHBlZCcgfHwgb3B0cy5ldmVudCA9PT0gJ2NvbXBsZXRlZCcpIHtcbiAgICAgIC8vIERvbid0IGluY2x1ZGUgb2ZmZXJzIHdpdGggJ3N0b3BwZWQnIG9yICdjb21wbGV0ZWQnIGV2ZW50XG4gICAgICB0aGlzLl9zZW5kKHBhcmFtcylcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTGltaXQgdGhlIG51bWJlciBvZiBvZmZlcnMgdGhhdCBhcmUgZ2VuZXJhdGVkLCBzaW5jZSBpdCBjYW4gYmUgc2xvd1xuICAgICAgY29uc3QgbnVtd2FudCA9IE1hdGgubWluKG9wdHMubnVtd2FudCwgMTApXG5cbiAgICAgIHRoaXMuX2dlbmVyYXRlT2ZmZXJzKG51bXdhbnQsIG9mZmVycyA9PiB7XG4gICAgICAgIHBhcmFtcy5udW13YW50ID0gbnVtd2FudFxuICAgICAgICBwYXJhbXMub2ZmZXJzID0gb2ZmZXJzXG4gICAgICAgIHRoaXMuX3NlbmQocGFyYW1zKVxuICAgICAgfSlcbiAgICB9XG4gIH1cblxuICBzY3JhcGUgKG9wdHMpIHtcbiAgICBpZiAodGhpcy5kZXN0cm95ZWQgfHwgdGhpcy5yZWNvbm5lY3RpbmcpIHJldHVyblxuICAgIGlmICh0aGlzLnNvY2tldC5fd3MucmVhZHlTdGF0ZSAhPT0gV2ViU29ja2V0Lk9QRU4pIHtcbiAgICAgIHRoaXMuc29ja2V0Ll93cy5hZGRFdmVudExpc3RlbmVyKCdvcGVuJywgKCkgPT4ge1xuICAgICAgICB0aGlzLnNjcmFwZShvcHRzKVxuICAgICAgfSwgeyBvbmNlOiB0cnVlIH0pXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgY29uc29sZS5sb2coJ2hvdyBkaWQgeW91IG5vdCBub3RpY2UgdGhpcz8hJylcbiAgICBjb25zdCBpbmZvSGFzaGVzID0gKEFycmF5LmlzQXJyYXkob3B0cy5pbmZvSGFzaCkgJiYgb3B0cy5pbmZvSGFzaC5sZW5ndGggPiAwKVxuICAgICAgPyBvcHRzLmluZm9IYXNoLm1hcChpbmZvSGFzaCA9PiB7XG4gICAgICAgIHJldHVybiBpbmZvSGFzaC50b1N0cmluZygnYmluYXJ5JylcbiAgICAgIH0pXG4gICAgICA6IChvcHRzLmluZm9IYXNoICYmIG9wdHMuaW5mb0hhc2gudG9TdHJpbmcoJ2JpbmFyeScpKSB8fCB0aGlzLmNsaWVudC5faW5mb0hhc2hCaW5hcnlcbiAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICBhY3Rpb246ICdzY3JhcGUnLFxuICAgICAgaW5mb19oYXNoOiBpbmZvSGFzaGVzXG4gICAgfVxuXG4gICAgdGhpcy5fc2VuZChwYXJhbXMpXG4gIH1cblxuICBkZXN0cm95ICgpIHtcbiAgICBpZiAodGhpcy5kZXN0cm95ZWQpIHJldHVyblxuXG4gICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlXG5cbiAgICBjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWwpXG4gICAgY2xlYXJJbnRlcnZhbCh0aGlzLnNvY2tldC5pbnRlcnZhbClcbiAgICBjbGVhclRpbWVvdXQodGhpcy5yZWNvbm5lY3RUaW1lcilcblxuICAgIC8vIERlc3Ryb3kgcGVlcnNcbiAgICBmb3IgKGNvbnN0IHBlZXJJZCBpbiB0aGlzLnBlZXJzKSB7XG4gICAgICBjb25zdCBwZWVyID0gdGhpcy5wZWVyc1twZWVySWRdXG4gICAgICBjbGVhclRpbWVvdXQocGVlci50cmFja2VyVGltZW91dClcbiAgICAgIHBlZXIuZGVzdHJveSgpXG4gICAgfVxuICAgIHRoaXMucGVlcnMgPSBudWxsXG5cbiAgICBpZiAodGhpcy5zb2NrZXQpIHtcbiAgICAgIHRoaXMuc29ja2V0Ll93cy5yZW1vdmVFdmVudExpc3RlbmVyKCdvcGVuJywgdGhpcy5fb25Tb2NrZXRDb25uZWN0Qm91bmQpXG4gICAgICB0aGlzLnNvY2tldC5fd3MucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMuX29uU29ja2V0RGF0YUJvdW5kKVxuICAgICAgdGhpcy5zb2NrZXQuX3dzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Nsb3NlJywgdGhpcy5fb25Tb2NrZXRDbG9zZUJvdW5kKVxuICAgICAgdGhpcy5zb2NrZXQuX3dzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5fb25Tb2NrZXRFcnJvckJvdW5kKVxuICAgICAgdGhpcy5zb2NrZXQgPSBudWxsXG4gICAgfVxuXG4gICAgdGhpcy5fb25Tb2NrZXRDb25uZWN0Qm91bmQgPSBudWxsXG4gICAgdGhpcy5fb25Tb2NrZXRFcnJvckJvdW5kID0gbnVsbFxuICAgIHRoaXMuX29uU29ja2V0RGF0YUJvdW5kID0gbnVsbFxuICAgIHRoaXMuX29uU29ja2V0Q2xvc2VCb3VuZCA9IG51bGxcblxuICAgIGlmIChzb2NrZXRQb29sW3RoaXMuYW5ub3VuY2VVcmxdKSB7XG4gICAgICBzb2NrZXRQb29sW3RoaXMuYW5ub3VuY2VVcmxdLmNvbnN1bWVycyAtPSAxXG4gICAgfVxuXG4gICAgLy8gT3RoZXIgaW5zdGFuY2VzIGFyZSB1c2luZyB0aGUgc29ja2V0LCBzbyB0aGVyZSdzIG5vdGhpbmcgbGVmdCB0byBkbyBoZXJlXG4gICAgaWYgKHNvY2tldFBvb2xbdGhpcy5hbm5vdW5jZVVybF0uY29uc3VtZXJzID4gMCkgcmV0dXJuXG5cbiAgICBsZXQgc29ja2V0ID0gc29ja2V0UG9vbFt0aGlzLmFubm91bmNlVXJsXVxuICAgIGRlbGV0ZSBzb2NrZXRQb29sW3RoaXMuYW5ub3VuY2VVcmxdXG5cbiAgICAvLyBJZiB0aGVyZSBpcyBubyBkYXRhIHJlc3BvbnNlIGV4cGVjdGVkLCBkZXN0cm95IGltbWVkaWF0ZWx5LlxuICAgIGlmICghdGhpcy5leHBlY3RpbmdSZXNwb25zZSkgcmV0dXJuIGRlc3Ryb3lDbGVhbnVwKClcblxuICAgIC8vIE90aGVyd2lzZSwgd2FpdCBhIHNob3J0IHRpbWUgZm9yIHBvdGVudGlhbCByZXNwb25zZXMgdG8gY29tZSBpbiBmcm9tIHRoZVxuICAgIC8vIHNlcnZlciwgdGhlbiBmb3JjZSBjbG9zZSB0aGUgc29ja2V0LlxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChkZXN0cm95Q2xlYW51cCwgMTAwMClcblxuICAgIC8vIEJ1dCwgaWYgYSByZXNwb25zZSBjb21lcyBmcm9tIHRoZSBzZXJ2ZXIgYmVmb3JlIHRoZSB0aW1lb3V0IGZpcmVzLCBkbyBjbGVhbnVwXG4gICAgLy8gcmlnaHQgYXdheS5cbiAgICBzb2NrZXQuX3dzLmFkZEV2ZW50TGlzdGVuZXIoJ2RhdGEnLCBkZXN0cm95Q2xlYW51cClcblxuICAgIGZ1bmN0aW9uIGRlc3Ryb3lDbGVhbnVwICgpIHtcbiAgICAgIGlmICh0aW1lb3V0KSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KVxuICAgICAgICB0aW1lb3V0ID0gbnVsbFxuICAgICAgfVxuICAgICAgc29ja2V0Ll93cy5yZW1vdmVFdmVudExpc3RlbmVyKCdkYXRhJywgZGVzdHJveUNsZWFudXApXG4gICAgICBzb2NrZXQuX3dzLmNsb3NlKClcbiAgICB9XG4gIH1cblxuICBfb3BlblNvY2tldCAoKSB7XG4gICAgdGhpcy5kZXN0cm95ZWQgPSBmYWxzZVxuXG4gICAgaWYgKCF0aGlzLnBlZXJzKSB0aGlzLnBlZXJzID0ge31cbiAgICBjb25zdCBvbmNlID0geyBvbmNlOiB0cnVlIH1cblxuICAgIHRoaXMuX29uU29ja2V0Q29ubmVjdEJvdW5kID0gKCkgPT4ge1xuICAgICAgdGhpcy5fb25Tb2NrZXRDb25uZWN0KClcbiAgICB9XG4gICAgdGhpcy5fb25Tb2NrZXRFcnJvckJvdW5kID0gZXJyID0+IHtcbiAgICAgIHRoaXMuX29uU29ja2V0RXJyb3IoZXJyKVxuICAgIH1cbiAgICB0aGlzLl9vblNvY2tldERhdGFCb3VuZCA9IGV2dCA9PiB7XG4gICAgICB0aGlzLl9vblNvY2tldERhdGEoZXZ0LmRhdGEpXG4gICAgfVxuICAgIHRoaXMuX29uU29ja2V0Q2xvc2VCb3VuZCA9ICgpID0+IHtcbiAgICAgIHRoaXMuX29uU29ja2V0Q2xvc2UoKVxuICAgIH1cblxuICAgIHRoaXMuc29ja2V0ID0gc29ja2V0UG9vbFt0aGlzLmFubm91bmNlVXJsXVxuICAgIGlmICh0aGlzLnNvY2tldCkge1xuICAgICAgc29ja2V0UG9vbFt0aGlzLmFubm91bmNlVXJsXS5jb25zdW1lcnMgKz0gMVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZygnb3BlbmVkJywgdGhpcy5hbm5vdW5jZVVybClcbiAgICAgIHRoaXMuc29ja2V0ID0gc29ja2V0UG9vbFt0aGlzLmFubm91bmNlVXJsXSA9IHtcbiAgICAgICAgX3dzOiBuZXcgV2ViU29ja2V0KHRoaXMuYW5ub3VuY2VVcmwpLFxuICAgICAgICBjb25zdW1lcnM6IDEsXG4gICAgICAgIGJ1ZmZlcjogW11cbiAgICAgIH1cbiAgICAgIHRoaXMuc29ja2V0Ll93cy5hZGRFdmVudExpc3RlbmVyKCdvcGVuJywgdGhpcy5fb25Tb2NrZXRDb25uZWN0Qm91bmQsIG9uY2UpXG4gICAgfVxuXG4gICAgdGhpcy5zb2NrZXQuX3dzLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCB0aGlzLl9vblNvY2tldERhdGFCb3VuZClcbiAgICB0aGlzLnNvY2tldC5fd3MuYWRkRXZlbnRMaXN0ZW5lcignY2xvc2UnLCB0aGlzLl9vblNvY2tldENsb3NlQm91bmQsIG9uY2UpXG4gICAgdGhpcy5zb2NrZXQuX3dzLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5fb25Tb2NrZXRFcnJvckJvdW5kLCBvbmNlKVxuICB9XG5cbiAgX29uU29ja2V0Q29ubmVjdCAoKSB7XG4gICAgY29uc29sZS5sb2coJ2Nvbm5lY3RlZCcpXG4gICAgaWYgKHRoaXMuZGVzdHJveWVkKSByZXR1cm5cblxuICAgIGlmICh0aGlzLnJlY29ubmVjdGluZykge1xuICAgICAgdGhpcy5yZWNvbm5lY3RpbmcgPSBmYWxzZVxuICAgICAgdGhpcy5yZXRyaWVzID0gMFxuICAgICAgdGhpcy5hbm5vdW5jZSh0aGlzLmNsaWVudC5fZGVmYXVsdEFubm91bmNlT3B0cygpKVxuICAgIH1cbiAgfVxuXG4gIF9vblNvY2tldERhdGEgKGRhdGEpIHtcbiAgICBpZiAodGhpcy5kZXN0cm95ZWQpIHJldHVyblxuXG4gICAgdGhpcy5leHBlY3RpbmdSZXNwb25zZSA9IGZhbHNlXG5cbiAgICB0cnkge1xuICAgICAgZGF0YSA9IEpTT04ucGFyc2UoZGF0YSlcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMuY2xpZW50LmVtaXQoJ3dhcm5pbmcnLCBuZXcgRXJyb3IoJ0ludmFsaWQgdHJhY2tlciByZXNwb25zZScpKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKGRhdGEuYWN0aW9uID09PSAnYW5ub3VuY2UnKSB7XG4gICAgICB0aGlzLl9vbkFubm91bmNlUmVzcG9uc2UoZGF0YSlcbiAgICB9IGVsc2UgaWYgKGRhdGEuYWN0aW9uID09PSAnc2NyYXBlJykge1xuICAgICAgdGhpcy5fb25TY3JhcGVSZXNwb25zZShkYXRhKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9vblNvY2tldEVycm9yKG5ldyBFcnJvcihgaW52YWxpZCBhY3Rpb24gaW4gV1MgcmVzcG9uc2U6ICR7ZGF0YS5hY3Rpb259YCkpXG4gICAgfVxuICB9XG5cbiAgX29uQW5ub3VuY2VSZXNwb25zZSAoZGF0YSkge1xuICAgIGlmIChkYXRhLmluZm9faGFzaCAhPT0gdGhpcy5jbGllbnQuX2luZm9IYXNoQmluYXJ5KSB7XG4gICAgICAvLyBkZWJ1ZyhcbiAgICAgIC8vICAgJ2lnbm9yaW5nIHdlYnNvY2tldCBkYXRhIGZyb20gJXMgZm9yICVzIChsb29raW5nIGZvciAlczogcmV1c2VkIHNvY2tldCknLFxuICAgICAgLy8gICB0aGlzLmFubm91bmNlVXJsLCBiaW5hcnlUb0hleChkYXRhLmluZm9faGFzaCksIHRoaXMuY2xpZW50LmluZm9IYXNoXG4gICAgICAvLyApXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoZGF0YS5wZWVyX2lkICYmIGRhdGEucGVlcl9pZCA9PT0gdGhpcy5jbGllbnQuX3BlZXJJZEJpbmFyeSkge1xuICAgICAgLy8gaWdub3JlIG9mZmVycy9hbnN3ZXJzIGZyb20gdGhpcyBjbGllbnRcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIGRlYnVnKFxuICAgIC8vICAgJ3JlY2VpdmVkICVzIGZyb20gJXMgZm9yICVzJyxcbiAgICAvLyAgIEpTT04uc3RyaW5naWZ5KGRhdGEpLCB0aGlzLmFubm91bmNlVXJsLCB0aGlzLmNsaWVudC5pbmZvSGFzaFxuICAgIC8vIClcblxuICAgIGNvbnN0IGZhaWx1cmUgPSBkYXRhWydmYWlsdXJlIHJlYXNvbiddXG4gICAgaWYgKGZhaWx1cmUpIHJldHVybiB0aGlzLmNsaWVudC5lbWl0KCd3YXJuaW5nJywgbmV3IEVycm9yKGZhaWx1cmUpKVxuXG4gICAgY29uc3Qgd2FybmluZyA9IGRhdGFbJ3dhcm5pbmcgbWVzc2FnZSddXG4gICAgaWYgKHdhcm5pbmcpIHRoaXMuY2xpZW50LmVtaXQoJ3dhcm5pbmcnLCBuZXcgRXJyb3Iod2FybmluZykpXG5cbiAgICBjb25zdCBpbnRlcnZhbCA9IGRhdGEuaW50ZXJ2YWwgfHwgZGF0YVsnbWluIGludGVydmFsJ11cbiAgICBpZiAoaW50ZXJ2YWwpIHRoaXMuc2V0SW50ZXJ2YWwoaW50ZXJ2YWwgKiAxMDAwKVxuXG4gICAgY29uc3QgdHJhY2tlcklkID0gZGF0YVsndHJhY2tlciBpZCddXG4gICAgaWYgKHRyYWNrZXJJZCkge1xuICAgICAgLy8gSWYgYWJzZW50LCBkbyBub3QgZGlzY2FyZCBwcmV2aW91cyB0cmFja2VySWQgdmFsdWVcbiAgICAgIHRoaXMuX3RyYWNrZXJJZCA9IHRyYWNrZXJJZFxuICAgIH1cblxuICAgIGlmIChkYXRhLmNvbXBsZXRlICE9IG51bGwpIHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gT2JqZWN0LmFzc2lnbih7fSwgZGF0YSwge1xuICAgICAgICBhbm5vdW5jZTogdGhpcy5hbm5vdW5jZVVybCxcbiAgICAgICAgaW5mb0hhc2g6IGJpbmFyeVRvSGV4KGRhdGEuaW5mb19oYXNoKVxuICAgICAgfSlcbiAgICAgIHRoaXMuY2xpZW50LmVtaXQoJ3VwZGF0ZScsIHJlc3BvbnNlKVxuICAgIH1cblxuICAgIGxldCBwZWVyXG4gICAgaWYgKGRhdGEub2ZmZXIgJiYgZGF0YS5wZWVyX2lkKSB7XG4gICAgICBjb25zdCBwZWVySWQgPSBiaW5hcnlUb0hleChkYXRhLnBlZXJfaWQpXG4gICAgICBpZiAodGhpcy5jbGllbnQuX2ZpbHRlciAmJiAhdGhpcy5jbGllbnQuX2ZpbHRlcihwZWVySWQpKSByZXR1cm5cbiAgICAgIHBlZXIgPSB0aGlzLl9jcmVhdGVQZWVyKHsgb2ZmZXI6IGRhdGEub2ZmZXIgfSlcbiAgICAgIHBlZXIuaWQgPSBwZWVySWRcblxuICAgICAgcGVlci5vblNpZ25hbCA9IHBlZXIgPT4ge1xuICAgICAgICBwZWVyLm9uU2lnbmFsID0gbnVsbFxuICAgICAgICBjb25zdCBwYXJhbXMgPSB7XG4gICAgICAgICAgYWN0aW9uOiAnYW5ub3VuY2UnLFxuICAgICAgICAgIGluZm9faGFzaDogdGhpcy5jbGllbnQuX2luZm9IYXNoQmluYXJ5LFxuICAgICAgICAgIHBlZXJfaWQ6IHRoaXMuY2xpZW50Ll9wZWVySWRCaW5hcnksXG4gICAgICAgICAgdG9fcGVlcl9pZDogZGF0YS5wZWVyX2lkLFxuICAgICAgICAgIGFuc3dlcjogcGVlci5zZHAsXG4gICAgICAgICAgb2ZmZXJfaWQ6IGRhdGEub2ZmZXJfaWRcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fdHJhY2tlcklkKSBwYXJhbXMudHJhY2tlcmlkID0gdGhpcy5fdHJhY2tlcklkXG4gICAgICAgIHRoaXMuX3NlbmQocGFyYW1zKVxuICAgICAgICB0aGlzLmNsaWVudC5lbWl0KCdwZWVyJywgcGVlcilcbiAgICAgICAgLy8gcGVlci5vbkNvbm5lY3QgPSAoKSA9PiB7XG4gICAgICAgIC8vICAgY29uc29sZS5sb2cocGVlci5fZGMpXG4gICAgICAgIC8vICAgcGVlci5jb25uZWN0ZWQgPSB0cnVlXG4gICAgICAgIC8vICAgdGhpcy5jbGllbnQuZW1pdCgncGVlcicsIHBlZXIpXG4gICAgICAgIC8vIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZGF0YS5hbnN3ZXIgJiYgZGF0YS5wZWVyX2lkKSB7XG4gICAgICBjb25zdCBvZmZlcklkID0gYmluYXJ5VG9IZXgoZGF0YS5vZmZlcl9pZClcbiAgICAgIHBlZXIgPSB0aGlzLnBlZXJzW29mZmVySWRdXG4gICAgICBpZiAocGVlcikge1xuICAgICAgICBwZWVyLmlkID0gYmluYXJ5VG9IZXgoZGF0YS5wZWVyX2lkKVxuICAgICAgICBjb25zdCBwZWVySWQgPSBiaW5hcnlUb0hleChkYXRhLnBlZXJfaWQpXG5cbiAgICAgICAgaWYgKHRoaXMuY2xpZW50Ll9maWx0ZXIgJiYgIXRoaXMuY2xpZW50Ll9maWx0ZXIocGVlcklkKSkge1xuICAgICAgICAgIHJldHVybiBwZWVyLmRlc3Ryb3koJ2ZpbHRlcmVkJylcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2xpZW50LmVtaXQoJ3BlZXInLCBwZWVyKVxuXG4gICAgICAgIHBlZXIuc2lnbmFsKGRhdGEuYW5zd2VyKVxuXG4gICAgICAgIGNsZWFyVGltZW91dChwZWVyLnRyYWNrZXJUaW1lb3V0KVxuICAgICAgICBwZWVyLnRyYWNrZXJUaW1lb3V0ID0gbnVsbFxuICAgICAgICBkZWxldGUgdGhpcy5wZWVyc1tvZmZlcklkXVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZGVidWcoYGdvdCB1bmV4cGVjdGVkIGFuc3dlcjogJHtKU09OLnN0cmluZ2lmeShkYXRhLmFuc3dlcil9YClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfb25TY3JhcGVSZXNwb25zZSAoZGF0YSkge1xuICAgIGRhdGEgPSBkYXRhLmZpbGVzIHx8IHt9XG5cbiAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMoZGF0YSlcbiAgICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMuY2xpZW50LmVtaXQoJ3dhcm5pbmcnLCBuZXcgRXJyb3IoJ2ludmFsaWQgc2NyYXBlIHJlc3BvbnNlJykpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBrZXlzLmZvckVhY2goaW5mb0hhc2ggPT4ge1xuICAgICAgLy8gVE9ETzogb3B0aW9uYWxseSBoYW5kbGUgZGF0YS5mbGFncy5taW5fcmVxdWVzdF9pbnRlcnZhbFxuICAgICAgLy8gKHNlcGFyYXRlIGZyb20gYW5ub3VuY2UgaW50ZXJ2YWwpXG4gICAgICBjb25zdCByZXNwb25zZSA9IE9iamVjdC5hc3NpZ24oZGF0YVtpbmZvSGFzaF0sIHtcbiAgICAgICAgYW5ub3VuY2U6IHRoaXMuYW5ub3VuY2VVcmwsXG4gICAgICAgIGluZm9IYXNoOiBiaW5hcnlUb0hleChpbmZvSGFzaClcbiAgICAgIH0pXG4gICAgICB0aGlzLmNsaWVudC5lbWl0KCdzY3JhcGUnLCByZXNwb25zZSlcbiAgICB9KVxuICB9XG5cbiAgX29uU29ja2V0Q2xvc2UgKCkge1xuICAgIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuXG4gICAgdGhpcy5kZXN0cm95KClcbiAgICB0aGlzLl9zdGFydFJlY29ubmVjdFRpbWVyKClcbiAgfVxuXG4gIF9vblNvY2tldEVycm9yIChlcnIpIHtcbiAgICBpZiAodGhpcy5kZXN0cm95ZWQpIHJldHVyblxuICAgIHRoaXMuZGVzdHJveSgpXG4gICAgLy8gZXJyb3JzIHdpbGwgb2Z0ZW4gaGFwcGVuIGlmIGEgdHJhY2tlciBpcyBvZmZsaW5lLCBzbyBkb24ndCB0cmVhdCBpdCBhcyBmYXRhbFxuICAgIHRoaXMuY2xpZW50LmVtaXQoJ3dhcm5pbmcnLCBlcnIpXG4gICAgdGhpcy5fc3RhcnRSZWNvbm5lY3RUaW1lcigpXG4gIH1cblxuICBfc3RhcnRSZWNvbm5lY3RUaW1lciAoKSB7XG4gICAgY29uc3QgbXMgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBSRUNPTk5FQ1RfVkFSSUFOQ0UpICsgTWF0aC5taW4oTWF0aC5wb3coMiwgdGhpcy5yZXRyaWVzKSAqIFJFQ09OTkVDVF9NSU5JTVVNLCBSRUNPTk5FQ1RfTUFYSU1VTSlcblxuICAgIHRoaXMucmVjb25uZWN0aW5nID0gdHJ1ZVxuICAgIGNsZWFyVGltZW91dCh0aGlzLnJlY29ubmVjdFRpbWVyKVxuICAgIHRoaXMucmVjb25uZWN0VGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMucmV0cmllcysrXG4gICAgICB0aGlzLl9vcGVuU29ja2V0KClcbiAgICB9LCBtcylcbiAgICAvLyBkZWJ1ZygncmVjb25uZWN0aW5nIHNvY2tldCBpbiAlcyBtcycsIG1zKVxuICB9XG5cbiAgX3NlbmQgKHBhcmFtcykge1xuICAgIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuXG4gICAgdGhpcy5leHBlY3RpbmdSZXNwb25zZSA9IHRydWVcbiAgICBjb25zdCBtZXNzYWdlID0gSlNPTi5zdHJpbmdpZnkocGFyYW1zKVxuICAgIC8vIGRlYnVnKCdzZW5kICVzJywgbWVzc2FnZSlcbiAgICBjb25zdCB7IF93cywgYnVmZmVyIH0gPSB0aGlzLnNvY2tldFxuICAgIGlmIChidWZmZXIubGVuZ3RoIHx8IF93cy5yZWFkeVN0YXRlICE9PSBXZWJTb2NrZXQuT1BFTiB8fCBfd3MuYnVmZmVyZWRBbW91bnQgPiBNQVhfQlVGRkVSRURfQU1PVU5UKSB7XG4gICAgICBidWZmZXIucHVzaChtZXNzYWdlKVxuXG4gICAgICBpZiAoIXRoaXMuc29ja2V0LmludGVydmFsKSB7XG4gICAgICAgIHRoaXMuc29ja2V0LmludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgIHdoaWxlIChfd3MucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4gJiYgYnVmZmVyLmxlbmd0aCAmJiBfd3MuYnVmZmVyZWRBbW91bnQgPCBNQVhfQlVGRkVSRURfQU1PVU5UKSB7XG4gICAgICAgICAgICBfd3Muc2VuZChidWZmZXIuc2hpZnQoKSlcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFidWZmZXIubGVuZ3RoKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuc29ja2V0LmludGVydmFsKVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuc29ja2V0LmludGVydmFsXG4gICAgICAgICAgfVxuICAgICAgICB9LCAxNTApXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIF93cy5zZW5kKG1lc3NhZ2UpXG4gICAgfVxuICB9XG5cbiAgYXN5bmMgX2dlbmVyYXRlT2ZmZXJzIChudW13YW50LCBjYikge1xuICAgIGxldCBvZmZlcnMgPSBbXVxuICAgIGxldCBpID0gbnVtd2FudFxuICAgIC8vIGRlYnVnKCdjcmVhdGluZyBwZWVyIChmcm9tIF9nZW5lcmF0ZU9mZmVycyknKVxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGNvbnN0IHBlZXIgPSB0aGlzLl9jcmVhdGVQZWVyKClcblxuICAgICAgb2ZmZXJzLnB1c2gobmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgIHBlZXIub25TaWduYWwgPSByZXNvbHZlXG4gICAgICB9KSlcbiAgICB9XG5cbiAgICBjb25zdCBwZWVycyA9IGF3YWl0IFByb21pc2UuYWxsKG9mZmVycylcblxuICAgIG9mZmVycyA9IFtdXG5cbiAgICBmb3IgKGxldCBwZWVyIG9mIHBlZXJzKSB7XG4gICAgICBjb25zdCBvZmZlcklkID0gcGVlci5zZHAuc2RwXG4gICAgICAgIC5tYXRjaCgvYT1maW5nZXJwcmludDpbXFx3LV0qXFxzKC4qKS8pWzFdLnJlcGxhY2UoL1teXFx3XSovZywgJycpXG4gICAgICAgIC5zdWJzdHIoMCwgMjApXG4gICAgICAgIC50b0xvd2VyQ2FzZSgpXG5cbiAgICAgIHBlZXIub25EZXN0cm95ID0gKCkgPT4ge1xuICAgICAgICBwZWVyWydkZXN0cm95Q2FsbGVkJ10gPSB0cnVlXG4gICAgICAgIGRlbGV0ZSB0aGlzLnBlZXJzW29mZmVySWRdXG4gICAgICB9XG5cbiAgICAgIHRoaXMucGVlcnNbb2ZmZXJJZF0gPSBwZWVyXG5cbiAgICAgIG9mZmVycy5wdXNoKHtcbiAgICAgICAgb2ZmZXI6IHBlZXIuc2RwLFxuICAgICAgICBvZmZlcl9pZDogaGV4VG9CaW5hcnkob2ZmZXJJZClcbiAgICAgIH0pXG5cbiAgICAgIHBlZXIudHJhY2tlclRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgcGVlci50cmFja2VyVGltZW91dCA9IG51bGxcbiAgICAgICAgZGVsZXRlIHRoaXMucGVlcnNbb2ZmZXJJZF1cbiAgICAgICAgcGVlci5kZXN0cm95KClcbiAgICAgIH0sIE9GRkVSX1RJTUVPVVQpXG4gICAgfVxuXG4gICAgY2Iob2ZmZXJzKVxuICB9XG5cbiAgX2NyZWF0ZVBlZXIgKG9wdHMpIHtcbiAgICBvcHRzID0gT2JqZWN0LmFzc2lnbih7XG4gICAgICBjb25maWc6IHRoaXMuY2xpZW50Ll9ydGNDb25maWdcbiAgICB9LCBvcHRzKVxuXG4gICAgY29uc3QgcGVlciA9IG5ldyBQZWVyKG9wdHMpXG5cbiAgICByZXR1cm4gcGVlclxuICB9XG59XG5cbldlYlNvY2tldFRyYWNrZXIucHJvdG90eXBlLkRFRkFVTFRfQU5OT1VOQ0VfSU5URVJWQUwgPSAzMCAqIDEwMDAgLy8gMzAgc2Vjb25kc1xuLy8gTm9ybWFsbHkgdGhpcyBzaG91bGRuJ3QgYmUgYWNjZXNzZWQgYnV0IGlzIG9jY2FzaW9uYWxseSB1c2VmdWxcbldlYlNvY2tldFRyYWNrZXIuX3NvY2tldFBvb2wgPSBzb2NrZXRQb29sXG5cbm1vZHVsZS5leHBvcnRzID0gV2ViU29ja2V0VHJhY2tlclxuIiwiLy8gY29uc3QgZGVidWcgPSByZXF1aXJlKCdkZWJ1ZycpKCdiaXR0b3JyZW50LXRyYWNrZXI6Y2xpZW50JylcbmNvbnN0IEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpXG5jb25zdCBjb21tb24gPSByZXF1aXJlKCcuLi9jb21tb24nKVxuY29uc3QgV2ViU29ja2V0VHJhY2tlciA9IHJlcXVpcmUoJy4vbGliL2NsaWVudC93ZWJzb2NrZXQtdHJhY2tlcicpXG5cbmNvbnN0IHsgYXJyMmhleCB9ID0gcmVxdWlyZSgnLi4vY29tbW9uJylcblxuLyoqXG4gKiBCaXRUb3JyZW50IHRyYWNrZXIgY2xpZW50LlxuICogRmluZCB0b3JyZW50IHBlZXJzLCB0byBoZWxwIGEgdG9ycmVudCBjbGllbnQgcGFydGljaXBhdGUgaW4gYSB0b3JyZW50IHN3YXJtLlxuICovXG5jbGFzcyBDbGllbnQgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICAvKipcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdHMgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMgb2JqZWN0XG4gICAqIEBwYXJhbSB7VWludDhBcnJheX0gb3B0cy5pbmZvSGFzaCAgICAgICAgICAgICB0b3JyZW50IGluZm8gaGFzaFxuICAgKiBAcGFyYW0ge1VpbnQ4QXJyYXl9IG9wdHMucGVlcklkICAgICAgICAgICAgICAgcGVlciBpZFxuICAgKiBAcGFyYW0ge3N0cmluZ3xBcnJheS48c3RyaW5nPn0gb3B0cy5hbm5vdW5jZSAgYW5ub3VuY2VcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0cy5nZXRBbm5vdW5jZU9wdHMgICAgICAgIGNhbGxiYWNrIHRvIHByb3ZpZGUgZGF0YSB0byB0cmFja2VyXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBvcHRzLnJ0Y0NvbmZpZyAgICAgICAgICAgICAgICBSVENQZWVyQ29ubmVjdGlvbiBjb25maWd1cmF0aW9uIG9iamVjdFxuICAgKi9cbiAgY29uc3RydWN0b3IgKG9wdHMpIHtcbiAgICBzdXBlcigpXG4gICAgdGhpcy5fcGVlcklkQmluYXJ5ID0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBvcHRzLnBlZXJJZClcblxuICAgIC8vIFRPRE86IGRvIHdlIG5lZWQgdGhpcyB0byBiZSBhIHN0cmluZz9cbiAgICB0aGlzLmluZm9IYXNoID0gdHlwZW9mIG9wdHMuaW5mb0hhc2ggPT09ICdzdHJpbmcnXG4gICAgICA/IG9wdHMuaW5mb0hhc2gudG9Mb3dlckNhc2UoKVxuICAgICAgOiBhcnIyaGV4KG9wdHMuaW5mb0hhc2gpXG4gICAgdGhpcy5faW5mb0hhc2hCaW5hcnkgPSBjb21tb24uaGV4VG9CaW5hcnkodGhpcy5pbmZvSGFzaClcblxuICAgIHRoaXMuZGVzdHJveWVkID0gZmFsc2VcblxuICAgIHRoaXMuX2dldEFubm91bmNlT3B0cyA9IG9wdHMuZ2V0QW5ub3VuY2VPcHRzXG4gICAgdGhpcy5fZmlsdGVyID0gb3B0cy5maWx0ZXJcbiAgICB0aGlzLl9ydGNDb25maWcgPSBvcHRzLnJ0Y0NvbmZpZ1xuXG4gICAgbGV0IGFubm91bmNlID0gdHlwZW9mIG9wdHMuYW5ub3VuY2UgPT09ICdzdHJpbmcnXG4gICAgICA/IFsgb3B0cy5hbm5vdW5jZSBdXG4gICAgICA6IG9wdHMuYW5ub3VuY2UgPT0gbnVsbCA/IFtdIDogb3B0cy5hbm5vdW5jZVxuXG4gICAgLy8gUmVtb3ZlIHRyYWlsaW5nIHNsYXNoIGZyb20gdHJhY2tlcnMgdG8gY2F0Y2ggZHVwbGljYXRlc1xuICAgIGFubm91bmNlID0gYW5ub3VuY2UubWFwKGFubm91bmNlVXJsID0+IHtcbiAgICAgIGFubm91bmNlVXJsID0gYW5ub3VuY2VVcmwudG9TdHJpbmcoKVxuICAgICAgaWYgKGFubm91bmNlVXJsW2Fubm91bmNlVXJsLmxlbmd0aCAtIDFdID09PSAnLycpIHtcbiAgICAgICAgYW5ub3VuY2VVcmwgPSBhbm5vdW5jZVVybC5zdWJzdHJpbmcoMCwgYW5ub3VuY2VVcmwubGVuZ3RoIC0gMSlcbiAgICAgIH1cbiAgICAgIHJldHVybiBhbm5vdW5jZVVybFxuICAgIH0pXG4gICAgYW5ub3VuY2UgPSBbLi4ubmV3IFNldChhbm5vdW5jZSldXG5cbiAgICB0aGlzLl90cmFja2VycyA9IGFubm91bmNlXG4gICAgICAubWFwKGFubm91bmNlVXJsID0+IHtcbiAgICAgICAgLy8gVE9ETzogc2hvdWxkIHdlIHRyeSB0byBjYXN0IHdzOiB0byB3c3M6P1xuICAgICAgICBpZiAoYW5ub3VuY2VVcmwuc3RhcnRzV2l0aCgnd3NzOicpIHx8IGFubm91bmNlVXJsLnN0YXJ0c1dpdGgoJ3dzOicpKSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBXZWJTb2NrZXRUcmFja2VyKHRoaXMsIGFubm91bmNlVXJsKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGNvbnNvbGUud2FybihgVW5zdXBwb3J0ZWQgdHJhY2tlciBwcm90b2NvbDogJHthbm5vdW5jZVVybH1gKVxuICAgICAgICAgIHJldHVybiBudWxsXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pXG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIGBzdGFydGAgYW5ub3VuY2UgdG8gdGhlIHRyYWNrZXJzLlxuICAgKiBAcGFyYW0ge09iamVjdD19IG9wdHNcbiAgICogQHBhcmFtIHtudW1iZXI9fSBvcHRzLnVwbG9hZGVkXG4gICAqIEBwYXJhbSB7bnVtYmVyPX0gb3B0cy5kb3dubG9hZGVkXG4gICAqIEBwYXJhbSB7bnVtYmVyPX0gb3B0cy5sZWZ0IChpZiBub3Qgc2V0LCBjYWxjdWxhdGVkIGF1dG9tYXRpY2FsbHkpXG4gICAqL1xuICBzdGFydCAob3B0cyA9IHt9KSB7XG4gICAgLy8gZGVidWcoJ3NlbmQgYHN0YXJ0YCcpXG4gICAgb3B0cyA9IHRoaXMuX2RlZmF1bHRBbm5vdW5jZU9wdHMob3B0cylcbiAgICBvcHRzLmV2ZW50ID0gJ3N0YXJ0ZWQnXG4gICAgdGhpcy5fYW5ub3VuY2Uob3B0cylcblxuICAgIC8vIHN0YXJ0IGFubm91bmNpbmcgb24gaW50ZXJ2YWxzXG4gICAgdGhpcy5fdHJhY2tlcnMuZm9yRWFjaCh0cmFja2VyID0+IHtcbiAgICAgIHRyYWNrZXIuc2V0SW50ZXJ2YWwoKVxuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIGBzdG9wYCBhbm5vdW5jZSB0byB0aGUgdHJhY2tlcnMuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAqIEBwYXJhbSB7bnVtYmVyPX0gb3B0cy51cGxvYWRlZFxuICAgKiBAcGFyYW0ge251bWJlcj19IG9wdHMuZG93bmxvYWRlZFxuICAgKiBAcGFyYW0ge251bWJlcj19IG9wdHMubnVtd2FudFxuICAgKiBAcGFyYW0ge251bWJlcj19IG9wdHMubGVmdCAoaWYgbm90IHNldCwgY2FsY3VsYXRlZCBhdXRvbWF0aWNhbGx5KVxuICAgKi9cbiAgc3RvcCAob3B0cykge1xuICAgIC8vIGRlYnVnKCdzZW5kIGBzdG9wYCcpXG4gICAgb3B0cyA9IHRoaXMuX2RlZmF1bHRBbm5vdW5jZU9wdHMob3B0cylcbiAgICBvcHRzLmV2ZW50ID0gJ3N0b3BwZWQnXG4gICAgdGhpcy5fYW5ub3VuY2Uob3B0cylcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgYGNvbXBsZXRlYCBhbm5vdW5jZSB0byB0aGUgdHJhY2tlcnMuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAqIEBwYXJhbSB7bnVtYmVyPX0gb3B0cy51cGxvYWRlZFxuICAgKiBAcGFyYW0ge251bWJlcj19IG9wdHMuZG93bmxvYWRlZFxuICAgKiBAcGFyYW0ge251bWJlcj19IG9wdHMubnVtd2FudFxuICAgKiBAcGFyYW0ge251bWJlcj19IG9wdHMubGVmdCAoaWYgbm90IHNldCwgY2FsY3VsYXRlZCBhdXRvbWF0aWNhbGx5KVxuICAgKi9cbiAgY29tcGxldGUgKG9wdHMpIHtcbiAgICAvLyBkZWJ1Zygnc2VuZCBgY29tcGxldGVgJylcbiAgICBpZiAoIW9wdHMpIG9wdHMgPSB7fVxuICAgIG9wdHMgPSB0aGlzLl9kZWZhdWx0QW5ub3VuY2VPcHRzKG9wdHMpXG4gICAgb3B0cy5ldmVudCA9ICdjb21wbGV0ZWQnXG4gICAgdGhpcy5fYW5ub3VuY2Uob3B0cylcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgYHVwZGF0ZWAgYW5ub3VuY2UgdG8gdGhlIHRyYWNrZXJzLlxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICAgKiBAcGFyYW0ge251bWJlcj19IG9wdHMudXBsb2FkZWRcbiAgICogQHBhcmFtIHtudW1iZXI9fSBvcHRzLmRvd25sb2FkZWRcbiAgICogQHBhcmFtIHtudW1iZXI9fSBvcHRzLm51bXdhbnRcbiAgICogQHBhcmFtIHtudW1iZXI9fSBvcHRzLmxlZnQgKGlmIG5vdCBzZXQsIGNhbGN1bGF0ZWQgYXV0b21hdGljYWxseSlcbiAgICovXG4gIHVwZGF0ZSAob3B0cykge1xuICAgIG9wdHMgPSB0aGlzLl9kZWZhdWx0QW5ub3VuY2VPcHRzKG9wdHMpXG4gICAgaWYgKG9wdHMuZXZlbnQpIGRlbGV0ZSBvcHRzLmV2ZW50XG4gICAgdGhpcy5fYW5ub3VuY2Uob3B0cylcbiAgfVxuXG4gIF9hbm5vdW5jZSAob3B0cykge1xuICAgIHRoaXMuX3RyYWNrZXJzLmZvckVhY2godHJhY2tlciA9PiB7XG4gICAgICAvLyB0cmFja2VyIHNob3VsZCBub3QgbW9kaWZ5IGBvcHRzYCBvYmplY3QsIGl0J3MgcGFzc2VkIHRvIGFsbCB0cmFja2Vyc1xuICAgICAgdHJhY2tlci5hbm5vdW5jZShvcHRzKVxuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIHNjcmFwZSByZXF1ZXN0IHRvIHRoZSB0cmFja2Vycy5cbiAgICogQHBhcmFtICB7T2JqZWN0PX0gb3B0c1xuICAgKi9cbiAgc2NyYXBlIChvcHRzID0ge30pIHtcbiAgICB0aGlzLl90cmFja2Vycy5mb3JFYWNoKHRyYWNrZXIgPT4ge1xuICAgICAgLy8gdHJhY2tlciBzaG91bGQgbm90IG1vZGlmeSBgb3B0c2Agb2JqZWN0LCBpdCdzIHBhc3NlZCB0byBhbGwgdHJhY2tlcnNcbiAgICAgIHRyYWNrZXIuc2NyYXBlKG9wdHMpXG4gICAgfSlcbiAgfVxuXG4gIHNldEludGVydmFsIChpbnRlcnZhbE1zKSB7XG4gICAgdGhpcy5fdHJhY2tlcnMuZm9yRWFjaCh0cmFja2VyID0+IHtcbiAgICAgIHRyYWNrZXIuc2V0SW50ZXJ2YWwoaW50ZXJ2YWxNcylcbiAgICB9KVxuICB9XG5cbiAgZGVzdHJveSAoKSB7XG4gICAgaWYgKHRoaXMuZGVzdHJveWVkKSByZXR1cm5cbiAgICB0aGlzLmRlc3Ryb3llZCA9IHRydWVcbiAgICBjb25zdCB0cmFja2VycyA9IHRoaXMuX3RyYWNrZXJzXG4gICAgbGV0IGkgPSB0cmFja2Vycy5sZW5ndGhcbiAgICB3aGlsZSAoaS0tKSB0cmFja2Vyc1tpXS5kZXN0cm95KClcblxuICAgIHRoaXMuX3RyYWNrZXJzID0gW11cbiAgICB0aGlzLl9nZXRBbm5vdW5jZU9wdHMgPSBudWxsXG4gIH1cblxuICBfZGVmYXVsdEFubm91bmNlT3B0cyAob3B0cyA9IHt9KSB7XG4gICAgaWYgKCFvcHRzLm51bXdhbnQpIG9wdHMubnVtd2FudCA9IDUwXG4gICAgaWYgKCFvcHRzLnVwbG9hZGVkKSBvcHRzLnVwbG9hZGVkID0gMFxuICAgIGlmICghb3B0cy5kb3dubG9hZGVkKSBvcHRzLmRvd25sb2FkZWQgPSAwXG4gICAgaWYgKHRoaXMuX2dldEFubm91bmNlT3B0cykgb3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIG9wdHMsIHRoaXMuX2dldEFubm91bmNlT3B0cygpKVxuXG4gICAgcmV0dXJuIG9wdHNcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENsaWVudFxuIiwiY29uc3QgVHJhY2tlciA9IHJlcXVpcmUoJy4vbW9kdWxlcy9iaXR0b3JyZW50LXRyYWNrZXIvY2xpZW50JylcbmNvbnN0IGNvbW1vbiA9IHJlcXVpcmUoJy4vbW9kdWxlcy9jb21tb24nKVxuXG5mdW5jdGlvbiBqc29uMnVpbnQobXNnKSB7XG4gIHJldHVybiBjb21tb24udGV4dDJhcnIoSlNPTi5zdHJpbmdpZnkobXNnKSlcbn1cblxuZnVuY3Rpb24gdWludDJqc29uKG1zZykge1xuICByZXR1cm4gSlNPTi5wYXJzZShjb21tb24uYXJyMnRleHQobXNnKSlcbn1cblxuYXN5bmMgZnVuY3Rpb24gbWFpbiAoaW5pdGlhdG9yKSB7XG4gIHZhciBwZWVySWQgPSBuZXcgVWludDhBcnJheShbNDUsIDg3LCA4NywgNDgsIDQ4LCA1MSwgNDVdLmNvbmNhdChbLi4uQXJyYXkoMTMpXS5tYXAoXyA9PiBNYXRoLnJhbmRvbSgpICogMTYgfCAwKSkpXG4gIHZhciBpcCA9IGF3YWl0IGZldGNoKCdodHRwczovL2FwaS5kYi1pcC5jb20vdjIvZnJlZS9zZWxmL2lwQWRkcmVzcycpLnRoZW4ociA9PiByLnRleHQoKSlcbiAgdmFyIGluZm9IYXNoID0gYXdhaXQgY29tbW9uLnNoYTEoY29tbW9uLnRleHQyYXJyKCdIR0Y6YXBwOicgKyBpcCkpXG4gIHZhciBhbm5vdW5jZSA9IFsgJ3dzczovL3RyYWNrZXIub3BlbndlYnRvcnJlbnQuY29tJyBdXG5cbiAgdmFyIHRyYWNrZXIgPSBuZXcgVHJhY2tlcih7XG4gICAgaW5mb0hhc2gsXG4gICAgcGVlcklkLFxuICAgIGFubm91bmNlXG4gIH0pXG5cbiAgdHJhY2tlci5zdGFydCgpXG4gIHRyYWNrZXIub24oJ3BlZXInLCBhc3luYyBwZWVyID0+IHtcbiAgICB3aW5kb3cucGVlciA9IHBlZXJcbiAgICB0cmFja2VyLnN0b3AoKVxuXG4gICAgcGVlci5fcGMub25uZWdvdGlhdGlvbm5lZWRlZCA9IGFzeW5jIGUgPT4ge1xuICAgICAgY29uc3Qgb2ZmZXIgPSBhd2FpdCBwZWVyLl9wYy5jcmVhdGVPZmZlcigpXG5cbiAgICAgIC8vIG9mZmVyLnNkcCA9IHRleHQudHJpbSgpXG4gICAgICBhd2FpdCBwZWVyLl9wYy5zZXRMb2NhbERlc2NyaXB0aW9uKG9mZmVyKVxuICAgICAgcGVlci5zZW5kKGpzb24ydWludCh7IG9mZmVyOiBwZWVyLl9wYy5sb2NhbERlc2NyaXB0aW9uIH0pKVxuICAgIH1cblxuICAgIHBlZXIuX3BjLm9udHJhY2sgPSAoZSkgPT4ge1xuICAgICAgY29uc29sZS5sb2coJ29uIHRyYWNrJylcbiAgICAgIGNvbnN0IHsgdHJhbnNjZWl2ZXIgfSA9IGVcbiAgICAgIGNvbnNvbGUubG9nKCdvbnRyYWNrJywgZSlcbiAgICAgIG1zZVZpZGVvLnNyY09iamVjdCA9IGUuc3RyZWFtc1swXVxuICAgICAgbXNlVmlkZW8ucGxheSgpXG4gICAgICBlLnJlY2VpdmVyLmppdHRlckJ1ZmZlckRlbGF5SGludCA9IDEwXG4gICAgICAvLyBzdHJlYW0ybWVkaWFTb3JjZShzdHJlYW0pXG4gICAgICAvLyBzdHJlYW0ybWVkaWFTb3JjZShlLnN0cmVhbXNbMF0sIHdpbmRvdy5tc2VWaWRlbylcbiAgICAgIC8vIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgLy8gICBjb25zb2xlLmxvZygncGxheWluZycpXG4gICAgICAvLyAgIG1zZVZpZGVvLnBsYXkoKVxuICAgICAgLy8gfSwgNTAwMClcbiAgICB9XG5cbiAgICBwZWVyLm9uTWVzc2FnZSA9IGFzeW5jIHVpbnQgPT4ge1xuICAgICAgY29uc3QgZGF0YSA9IHVpbnQyanNvbih1aW50KVxuICAgICAgY29uc29sZS5sb2coJ21zZyBkYXRhJywgZGF0YSlcbiAgICAgIGlmIChkYXRhLm9mZmVyKSB7XG4gICAgICAgIHBlZXIuX3BjLnNldFJlbW90ZURlc2NyaXB0aW9uKGRhdGEub2ZmZXIpXG5cbiAgICAgICAgY29uc3QgYW5zd2VyID0gYXdhaXQgcGVlci5fcGMuY3JlYXRlQW5zd2VyKClcbiAgICAgICAgY29uc29sZS5sb2coJ2Fuc3dlcicsIGFuc3dlcilcbiAgICAgICAgLy8gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgLy8gICB3aW5kb3cudHJhbnNmb3JtID0gdHJhbnNmb3JtXG4gICAgICAgIC8vICAgd2luZG93LmFuc3dlciA9IGFuc3dlclxuICAgICAgICAvLyAgIHdpbmRvdy5yZXNvbHZlID0gcmVzb2x2ZVxuICAgICAgICAvLyB9KVxuXG4gICAgICAgIHBlZXIuX3BjLnNldExvY2FsRGVzY3JpcHRpb24oYW5zd2VyKVxuICAgICAgICBwZWVyLnNlbmQoanNvbjJ1aW50KHthbnN3ZXI6IHBlZXIuX3BjLmxvY2FsRGVzY3JpcHRpb259KSlcbiAgICAgIH1cbiAgICAgIGlmIChkYXRhLmFuc3dlcikge1xuICAgICAgICBhd2FpdCBwZWVyLl9wYy5zZXRSZW1vdGVEZXNjcmlwdGlvbihkYXRhLmFuc3dlcilcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaW5pdGlhdG9yKSB7XG4gICAgICAvLyB2YXIgY2FtU3RyZWFtID0gYXdhaXQgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEoeyB2aWRlbzogdHJ1ZSB9KVxuXG4gICAgICBjb25zdCBjYW52YXNTdHJlYW0gPSBjYW52YXMuY2FwdHVyZVN0cmVhbSgyMDApXG4gICAgICBjb25zb2xlLmxvZygnY2FudmFzU3RyZWFtJywgY2FudmFzU3RyZWFtKVxuICAgICAgcGVlci5fcGMuYWRkVHJhbnNjZWl2ZXIoY2FudmFzU3RyZWFtLmdldFRyYWNrcygpWzBdLCB7XG4gICAgICAgIHN0cmVhbXM6IFsgY2FudmFzU3RyZWFtIF1cbiAgICAgIH0pXG4gICAgfVxuICB9KVxufVxuXG5tYWluKGxvY2F0aW9uLnNlYXJjaCA9PT0gJz9pbml0aWF0b3InKVxuXG4vLyBHbG9iYWwgc3RhdGVcbndpbmRvdy5hcHBEaWVkID0gZmFsc2U7XG53aW5kb3cubXNlVmlkZW87XG53aW5kb3cuc3JjRXFWaWRlbztcbndpbmRvdy50aGVSZWNvcmRlcjtcbndpbmRvdy5tZWRpYVNvdXJjZTtcbndpbmRvdy5zb3VyY2VCdWZmZXI7XG4iLCJcbn0pO1xuIl19
