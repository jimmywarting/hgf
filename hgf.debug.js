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
      var camStream = await navigator.mediaDevices.getUserMedia({ video: true })

      // const canvasStream = canvas.captureStream(200)
      console.log('canvasStream', camStream)
      peer._pc.addTransceiver(camStream.getTracks()[0], {
        streams: [ camStream ]
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2stZmxhdC9fcHJlbHVkZSIsIm1vZHVsZXMvZXZlbnRzLmpzIiwibW9kdWxlcy9iaXR0b3JyZW50LXRyYWNrZXIvbGliL2NsaWVudC90cmFja2VyLmpzIiwibW9kdWxlcy9jb21tb24vaW5kZXguanMiLCJtb2R1bGVzL2xpZ2h0LXBlZXIvbGlnaHQuanMiLCJtb2R1bGVzL2JpdHRvcnJlbnQtdHJhY2tlci9saWIvY2xpZW50L3dlYnNvY2tldC10cmFja2VyLmpzIiwibW9kdWxlcy9iaXR0b3JyZW50LXRyYWNrZXIvY2xpZW50LmpzIiwiaGdmLmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay1mbGF0L19wb3N0bHVkZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBLEFDREEsTUFBTSxDQUFDLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxHQUFHLE9BQU8sR0FBRyxJQUFJO0FBQ3RELE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxLQUFLLEtBQUssVUFBVTtJQUNuRCxDQUFDLENBQUMsS0FBSztJQUNQLFNBQVMsWUFBWSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFO0lBQy9DLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDO0dBQzdEOztBQUVILElBQUksY0FBYztBQUNsQixJQUFJLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEtBQUssVUFBVSxFQUFFO0VBQ3hDLGNBQWMsR0FBRyxDQUFDLENBQUMsT0FBTztDQUMzQixNQUFNLElBQUksTUFBTSxDQUFDLHFCQUFxQixFQUFFO0VBQ3ZDLGNBQWMsR0FBRyxTQUFTLGNBQWMsRUFBRSxNQUFNLEVBQUU7SUFDaEQsT0FBTyxNQUFNLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDO09BQ3RDLE1BQU0sQ0FBQyxN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IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKGYpe2lmKHR5cGVvZiBleHBvcnRzPT09XCJvYmplY3RcIiYmdHlwZW9mIG1vZHVsZSE9PVwidW5kZWZpbmVkXCIpe21vZHVsZS5leHBvcnRzPWYoKX1lbHNlIGlmKHR5cGVvZiBkZWZpbmU9PT1cImZ1bmN0aW9uXCImJmRlZmluZS5hbWQpe2RlZmluZShbXSxmKX1lbHNle3ZhciBnO2lmKHR5cGVvZiB3aW5kb3chPT1cInVuZGVmaW5lZFwiKXtnPXdpbmRvd31lbHNlIGlmKHR5cGVvZiBnbG9iYWwhPT1cInVuZGVmaW5lZFwiKXtnPWdsb2JhbH1lbHNlIGlmKHR5cGVvZiBzZWxmIT09XCJ1bmRlZmluZWRcIil7Zz1zZWxmfWVsc2V7Zz10aGlzfWcuV2ViVG9ycmVudCA9IGYoKX19KShmdW5jdGlvbigpe3ZhciBkZWZpbmUsbW9kdWxlLGV4cG9ydHM7XG4iLCJjb25zdCBSID0gdHlwZW9mIFJlZmxlY3QgPT09ICdvYmplY3QnID8gUmVmbGVjdCA6IG51bGxcbmNvbnN0IFJlZmxlY3RBcHBseSA9IFIgJiYgdHlwZW9mIFIuYXBwbHkgPT09ICdmdW5jdGlvbidcbiAgPyBSLmFwcGx5XG4gIDogZnVuY3Rpb24gUmVmbGVjdEFwcGx5ICh0YXJnZXQsIHJlY2VpdmVyLCBhcmdzKSB7XG4gICAgcmV0dXJuIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5jYWxsKHRhcmdldCwgcmVjZWl2ZXIsIGFyZ3MpXG4gIH1cblxubGV0IFJlZmxlY3RPd25LZXlzXG5pZiAoUiAmJiB0eXBlb2YgUi5vd25LZXlzID09PSAnZnVuY3Rpb24nKSB7XG4gIFJlZmxlY3RPd25LZXlzID0gUi5vd25LZXlzXG59IGVsc2UgaWYgKE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMpIHtcbiAgUmVmbGVjdE93bktleXMgPSBmdW5jdGlvbiBSZWZsZWN0T3duS2V5cyAodGFyZ2V0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRhcmdldClcbiAgICAgIC5jb25jYXQoT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyh0YXJnZXQpKVxuICB9XG59IGVsc2Uge1xuICBSZWZsZWN0T3duS2V5cyA9IGZ1bmN0aW9uIFJlZmxlY3RPd25LZXlzICh0YXJnZXQpIHtcbiAgICByZXR1cm4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGFyZ2V0KVxuICB9XG59XG5cbmNsYXNzIEV2ZW50RW1pdHRlciB7XG4gIGNvbnN0cnVjdG9yICgpIHtcbiAgICBpZiAodGhpcy5fZXZlbnRzID09PSB1bmRlZmluZWQgfHxcbiAgICAgIHRoaXMuX2V2ZW50cyA9PT0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHRoaXMpLl9ldmVudHMpIHtcbiAgICAgIHRoaXMuX2V2ZW50cyA9IE9iamVjdC5jcmVhdGUobnVsbClcbiAgICAgIHRoaXMuX2V2ZW50c0NvdW50ID0gMFxuICAgIH1cblxuICAgIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWRcbiAgfVxuXG4gIC8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuICAvLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbiAgc2V0TWF4TGlzdGVuZXJzIChuKSB7XG4gICAgdGhpcy5fbWF4TGlzdGVuZXJzID0gblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBnZXRNYXhMaXN0ZW5lcnMgKCkge1xuICAgIHJldHVybiAkZ2V0TWF4TGlzdGVuZXJzKHRoaXMpXG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtICB7c3RyaW5nfSB0eXBlXG4gICAqIEBwYXJhbSAgey4uLip9IGFyZ3NcbiAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICovXG4gIGVtaXQgKHR5cGUsIC4uLmFyZ3MpIHtcbiAgICBsZXQgZG9FcnJvciA9ICh0eXBlID09PSAnZXJyb3InKVxuXG4gICAgY29uc3QgZXZlbnRzID0gdGhpcy5fZXZlbnRzXG4gICAgaWYgKGV2ZW50cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBkb0Vycm9yID0gKGRvRXJyb3IgJiYgZXZlbnRzLmVycm9yID09PSB1bmRlZmluZWQpXG4gICAgfSBlbHNlIGlmICghZG9FcnJvcikge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICAgIGlmIChkb0Vycm9yKSB7XG4gICAgICBsZXQgZXJcbiAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZXIgPSBhcmdzWzBdXG4gICAgICB9XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAvLyBOb3RlOiBUaGUgY29tbWVudHMgb24gdGhlIGB0aHJvd2AgbGluZXMgYXJlIGludGVudGlvbmFsLCB0aGV5IHNob3dcbiAgICAgICAgLy8gdXAgaW4gTm9kZSdzIG91dHB1dCBpZiB0aGlzIHJlc3VsdHMgaW4gYW4gdW5oYW5kbGVkIGV4Y2VwdGlvbi5cbiAgICAgICAgdGhyb3cgZXIgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIC8vIEF0IGxlYXN0IGdpdmUgc29tZSBraW5kIG9mIGNvbnRleHQgdG8gdGhlIHVzZXJcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgVW5oYW5kbGVkIGVycm9yLiR7ZXIgPyBgICgke2VyLm1lc3NhZ2V9KWAgOiAnJ31gKVxuICAgICAgZXJyLmNvbnRleHQgPSBlclxuICAgICAgdGhyb3cgZXJyIC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgfVxuXG4gICAgY29uc3QgaGFuZGxlciA9IGV2ZW50c1t0eXBlXVxuXG4gICAgaWYgKGhhbmRsZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBSZWZsZWN0QXBwbHkoaGFuZGxlciwgdGhpcywgYXJncylcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbGVuID0gaGFuZGxlci5sZW5ndGhcbiAgICAgIGNvbnN0IGxpc3RlbmVycyA9IGFycmF5Q2xvbmUoaGFuZGxlciwgbGVuKVxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICBSZWZsZWN0QXBwbHkobGlzdGVuZXJzW2ldLCB0aGlzLCBhcmdzKVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBhZGRMaXN0ZW5lciAodHlwZSwgbGlzdGVuZXIpIHtcbiAgICByZXR1cm4gX2FkZExpc3RlbmVyKHRoaXMsIHR5cGUsIGxpc3RlbmVyLCBmYWxzZSlcbiAgfVxuXG4gIHByZXBlbmRMaXN0ZW5lciAodHlwZSwgbGlzdGVuZXIpIHtcbiAgICByZXR1cm4gX2FkZExpc3RlbmVyKHRoaXMsIHR5cGUsIGxpc3RlbmVyLCB0cnVlKVxuICB9XG5cbiAgb25jZSAodHlwZSwgbGlzdGVuZXIpIHtcbiAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBUaGUgXCJsaXN0ZW5lclwiIGFyZ3VtZW50IG11c3QgYmUgb2YgdHlwZSBGdW5jdGlvbi4gUmVjZWl2ZWQgdHlwZSAke3R5cGVvZiBsaXN0ZW5lcn1gKVxuICAgIH1cbiAgICB0aGlzLm9uKHR5cGUsIF9vbmNlV3JhcCh0aGlzLCB0eXBlLCBsaXN0ZW5lcikpXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIHByZXBlbmRPbmNlTGlzdGVuZXIgKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVGhlIFwibGlzdGVuZXJcIiBhcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgRnVuY3Rpb24uIFJlY2VpdmVkIHR5cGUgJHt0eXBlb2YgbGlzdGVuZXJ9YClcbiAgICB9XG4gICAgdGhpcy5wcmVwZW5kTGlzdGVuZXIodHlwZSwgX29uY2VXcmFwKHRoaXMsIHR5cGUsIGxpc3RlbmVyKSlcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLy8gRW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmIGFuZCBvbmx5IGlmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZC5cbiAgcmVtb3ZlTGlzdGVuZXIgKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgbGV0IGxpc3RcbiAgICBsZXQgZXZlbnRzXG4gICAgbGV0IHBvc2l0aW9uXG4gICAgbGV0IGlcbiAgICBsZXQgb3JpZ2luYWxMaXN0ZW5lclxuXG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVGhlIFwibGlzdGVuZXJcIiBhcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgRnVuY3Rpb24uIFJlY2VpdmVkIHR5cGUgJHt0eXBlb2YgbGlzdGVuZXJ9YClcbiAgICB9XG5cbiAgICBldmVudHMgPSB0aGlzLl9ldmVudHNcbiAgICBpZiAoZXZlbnRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgbGlzdCA9IGV2ZW50c1t0eXBlXVxuICAgIGlmIChsaXN0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8IGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB7XG4gICAgICBpZiAoLS10aGlzLl9ldmVudHNDb3VudCA9PT0gMCkge1xuICAgICAgICB0aGlzLl9ldmVudHMgPSBPYmplY3QuY3JlYXRlKG51bGwpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWxldGUgZXZlbnRzW3R5cGVdXG4gICAgICAgIGlmIChldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICAgICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdC5saXN0ZW5lciB8fCBsaXN0ZW5lcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGxpc3QgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHBvc2l0aW9uID0gLTFcblxuICAgICAgZm9yIChpID0gbGlzdC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHwgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHtcbiAgICAgICAgICBvcmlnaW5hbExpc3RlbmVyID0gbGlzdFtpXS5saXN0ZW5lclxuICAgICAgICAgIHBvc2l0aW9uID0gaVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHBvc2l0aW9uIDwgMCkge1xuICAgICAgICByZXR1cm4gdGhpc1xuICAgICAgfVxuXG4gICAgICBpZiAocG9zaXRpb24gPT09IDApIHtcbiAgICAgICAgbGlzdC5zaGlmdCgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzcGxpY2VPbmUobGlzdCwgcG9zaXRpb24pXG4gICAgICB9XG5cbiAgICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBldmVudHNbdHlwZV0gPSBsaXN0WzBdXG4gICAgICB9XG5cbiAgICAgIGlmIChldmVudHMucmVtb3ZlTGlzdGVuZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgb3JpZ2luYWxMaXN0ZW5lciB8fCBsaXN0ZW5lcilcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgcmVtb3ZlQWxsTGlzdGVuZXJzICh0eXBlKSB7XG4gICAgbGV0IGxpc3RlbmVyc1xuICAgIGxldCBldmVudHNcbiAgICBsZXQgaVxuXG4gICAgZXZlbnRzID0gdGhpcy5fZXZlbnRzXG4gICAgaWYgKGV2ZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgICBpZiAoZXZlbnRzLnJlbW92ZUxpc3RlbmVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRoaXMuX2V2ZW50cyA9IE9iamVjdC5jcmVhdGUobnVsbClcbiAgICAgICAgdGhpcy5fZXZlbnRzQ291bnQgPSAwXG4gICAgICB9IGVsc2UgaWYgKGV2ZW50c1t0eXBlXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICgtLXRoaXMuX2V2ZW50c0NvdW50ID09PSAwKSB7IHRoaXMuX2V2ZW50cyA9IE9iamVjdC5jcmVhdGUobnVsbCkgfSBlbHNlIHsgZGVsZXRlIGV2ZW50c1t0eXBlXSB9XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMoZXZlbnRzKVxuICAgICAgbGV0IGtleVxuICAgICAgZm9yIChpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAga2V5ID0ga2V5c1tpXVxuICAgICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZVxuICAgICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpXG4gICAgICB9XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKVxuICAgICAgdGhpcy5fZXZlbnRzID0gT2JqZWN0LmNyZWF0ZShudWxsKVxuICAgICAgdGhpcy5fZXZlbnRzQ291bnQgPSAwXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH1cblxuICAgIGxpc3RlbmVycyA9IGV2ZW50c1t0eXBlXVxuXG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lcnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKVxuICAgIH0gZWxzZSBpZiAobGlzdGVuZXJzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIExJRk8gb3JkZXJcbiAgICAgIGZvciAoaSA9IGxpc3RlbmVycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tpXSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgbGlzdGVuZXJzICh0eXBlKSB7XG4gICAgcmV0dXJuIF9saXN0ZW5lcnModGhpcywgdHlwZSwgdHJ1ZSlcbiAgfVxuXG4gIHJhd0xpc3RlbmVycyAodHlwZSkge1xuICAgIHJldHVybiBfbGlzdGVuZXJzKHRoaXMsIHR5cGUsIGZhbHNlKVxuICB9XG5cbiAgZXZlbnROYW1lcyAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2V2ZW50c0NvdW50ID4gMCA/IFJlZmxlY3RPd25LZXlzKHRoaXMuX2V2ZW50cykgOiBbXVxuICB9XG59XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlclxuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50c0NvdW50ID0gMFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkXG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTBcblxuZnVuY3Rpb24gJGdldE1heExpc3RlbmVycyAoe19tYXhMaXN0ZW5lcnN9KSB7XG4gIGlmIChfbWF4TGlzdGVuZXJzID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnNcbiAgfVxuICByZXR1cm4gX21heExpc3RlbmVyc1xufVxuXG5mdW5jdGlvbiBfYWRkTGlzdGVuZXIgKHRhcmdldCwgdHlwZSwgbGlzdGVuZXIsIHByZXBlbmQpIHtcbiAgbGV0IG1cbiAgbGV0IGV2ZW50c1xuICBsZXQgZXhpc3RpbmdcblxuICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVGhlIFwibGlzdGVuZXJcIiBhcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgRnVuY3Rpb24uIFJlY2VpdmVkIHR5cGUgJHt0eXBlb2YgbGlzdGVuZXJ9YClcbiAgfVxuXG4gIGV2ZW50cyA9IHRhcmdldC5fZXZlbnRzXG4gIGlmIChldmVudHMgPT09IHVuZGVmaW5lZCkge1xuICAgIGV2ZW50cyA9IHRhcmdldC5fZXZlbnRzID0gT2JqZWN0LmNyZWF0ZShudWxsKVxuICAgIHRhcmdldC5fZXZlbnRzQ291bnQgPSAwXG4gIH0gZWxzZSB7XG4gICAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gICAgaWYgKGV2ZW50cy5uZXdMaXN0ZW5lciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0YXJnZXQuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lci5saXN0ZW5lciA/IGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpXG5cbiAgICAgIC8vIFJlLWFzc2lnbiBgZXZlbnRzYCBiZWNhdXNlIGEgbmV3TGlzdGVuZXIgaGFuZGxlciBjb3VsZCBoYXZlIGNhdXNlZCB0aGVcbiAgICAgIC8vIHRoaXMuX2V2ZW50cyB0byBiZSBhc3NpZ25lZCB0byBhIG5ldyBvYmplY3RcbiAgICAgIGV2ZW50cyA9IHRhcmdldC5fZXZlbnRzXG4gICAgfVxuICAgIGV4aXN0aW5nID0gZXZlbnRzW3R5cGVdXG4gIH1cblxuICBpZiAoZXhpc3RpbmcgPT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIGV4aXN0aW5nID0gZXZlbnRzW3R5cGVdID0gbGlzdGVuZXJcbiAgICArK3RhcmdldC5fZXZlbnRzQ291bnRcbiAgfSBlbHNlIHtcbiAgICBpZiAodHlwZW9mIGV4aXN0aW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICAgIGV4aXN0aW5nID0gZXZlbnRzW3R5cGVdID1cbiAgICAgICAgcHJlcGVuZCA/IFtsaXN0ZW5lciwgZXhpc3RpbmddIDogW2V4aXN0aW5nLCBsaXN0ZW5lcl1cbiAgICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB9IGVsc2UgaWYgKHByZXBlbmQpIHtcbiAgICAgIGV4aXN0aW5nLnVuc2hpZnQobGlzdGVuZXIpXG4gICAgfSBlbHNlIHtcbiAgICAgIGV4aXN0aW5nLnB1c2gobGlzdGVuZXIpXG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgICBtID0gJGdldE1heExpc3RlbmVycyh0YXJnZXQpXG4gICAgaWYgKG0gPiAwICYmIGV4aXN0aW5nLmxlbmd0aCA+IG0gJiYgIWV4aXN0aW5nLndhcm5lZCkge1xuICAgICAgZXhpc3Rpbmcud2FybmVkID0gdHJ1ZVxuICAgICAgLy8gTm8gZXJyb3IgY29kZSBmb3IgdGhpcyBzaW5jZSBpdCBpcyBhIFdhcm5pbmdcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZXN0cmljdGVkLXN5bnRheFxuICAgICAgY29uc3QgdyA9IG5ldyBFcnJvcihgUG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSBsZWFrIGRldGVjdGVkLiAke2V4aXN0aW5nLmxlbmd0aH0gJHtTdHJpbmcodHlwZSl9IGxpc3RlbmVycyBhZGRlZC4gVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXRgKVxuICAgICAgdy5uYW1lID0gJ01heExpc3RlbmVyc0V4Y2VlZGVkV2FybmluZydcbiAgICAgIHcuZW1pdHRlciA9IHRhcmdldFxuICAgICAgdy50eXBlID0gdHlwZVxuICAgICAgdy5jb3VudCA9IGV4aXN0aW5nLmxlbmd0aFxuICAgICAgY29uc29sZS53YXJuKHcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRhcmdldFxufVxuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lclxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmYgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyXG5cbmZ1bmN0aW9uIG9uY2VXcmFwcGVyICguLi5hcmdzKSB7XG4gIGlmICghdGhpcy5maXJlZCkge1xuICAgIHRoaXMudGFyZ2V0LnJlbW92ZUxpc3RlbmVyKHRoaXMudHlwZSwgdGhpcy53cmFwRm4pXG4gICAgdGhpcy5maXJlZCA9IHRydWVcbiAgICBSZWZsZWN0QXBwbHkodGhpcy5saXN0ZW5lciwgdGhpcy50YXJnZXQsIGFyZ3MpXG4gIH1cbn1cblxuZnVuY3Rpb24gX29uY2VXcmFwICh0YXJnZXQsIHR5cGUsIGxpc3RlbmVyKSB7XG4gIGNvbnN0IHN0YXRlID0geyBmaXJlZDogZmFsc2UsIHdyYXBGbjogdW5kZWZpbmVkLCB0YXJnZXQsIHR5cGUsIGxpc3RlbmVyIH1cbiAgY29uc3Qgd3JhcHBlZCA9IG9uY2VXcmFwcGVyLmJpbmQoc3RhdGUpXG4gIHdyYXBwZWQubGlzdGVuZXIgPSBsaXN0ZW5lclxuICBzdGF0ZS53cmFwRm4gPSB3cmFwcGVkXG4gIHJldHVybiB3cmFwcGVkXG59XG5cbmZ1bmN0aW9uIF9saXN0ZW5lcnMgKHtfZXZlbnRzfSwgdHlwZSwgdW53cmFwKSB7XG4gIGNvbnN0IGV2ZW50cyA9IF9ldmVudHNcblxuICBpZiAoZXZlbnRzID09PSB1bmRlZmluZWQpIHsgcmV0dXJuIFtdIH1cblxuICBjb25zdCBldmxpc3RlbmVyID0gZXZlbnRzW3R5cGVdXG4gIGlmIChldmxpc3RlbmVyID09PSB1bmRlZmluZWQpIHsgcmV0dXJuIFtdIH1cblxuICBpZiAodHlwZW9mIGV2bGlzdGVuZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gdW53cmFwID8gW2V2bGlzdGVuZXIubGlzdGVuZXIgfHwgZXZsaXN0ZW5lcl0gOiBbZXZsaXN0ZW5lcl1cbiAgfVxuXG4gIHJldHVybiB1bndyYXBcbiAgICA/IHVud3JhcExpc3RlbmVycyhldmxpc3RlbmVyKVxuICAgIDogYXJyYXlDbG9uZShldmxpc3RlbmVyLCBldmxpc3RlbmVyLmxlbmd0aClcbn1cblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSAoZW1pdHRlciwgdHlwZSkgPT4ge1xuICBpZiAodHlwZW9mIGVtaXR0ZXIubGlzdGVuZXJDb3VudCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSlcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbGlzdGVuZXJDb3VudC5jYWxsKGVtaXR0ZXIsIHR5cGUpXG4gIH1cbn1cblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gbGlzdGVuZXJDb3VudFxuXG5mdW5jdGlvbiBsaXN0ZW5lckNvdW50ICh0eXBlKSB7XG4gIGNvbnN0IGV2ZW50cyA9IHRoaXMuX2V2ZW50c1xuXG4gIGlmIChldmVudHMgIT09IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IGV2bGlzdGVuZXIgPSBldmVudHNbdHlwZV1cblxuICAgIGlmICh0eXBlb2YgZXZsaXN0ZW5lciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIDFcbiAgICB9IGVsc2UgaWYgKGV2bGlzdGVuZXIgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIDBcbn1cblxuZnVuY3Rpb24gYXJyYXlDbG9uZSAoYXJyLCBuKSB7XG4gIGNvbnN0IGNvcHkgPSBuZXcgQXJyYXkobilcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyArK2kpIHtcbiAgICBjb3B5W2ldID0gYXJyW2ldXG4gIH1cbiAgcmV0dXJuIGNvcHlcbn1cblxuZnVuY3Rpb24gc3BsaWNlT25lIChsaXN0LCBpbmRleCkge1xuICBmb3IgKDsgaW5kZXggKyAxIDwgbGlzdC5sZW5ndGg7IGluZGV4KyspIHsgbGlzdFtpbmRleF0gPSBsaXN0W2luZGV4ICsgMV0gfVxuICBsaXN0LnBvcCgpXG59XG5cbmZ1bmN0aW9uIHVud3JhcExpc3RlbmVycyAoYXJyKSB7XG4gIGNvbnN0IHJldCA9IG5ldyBBcnJheShhcnIubGVuZ3RoKVxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJldC5sZW5ndGg7ICsraSkge1xuICAgIHJldFtpXSA9IGFycltpXS5saXN0ZW5lciB8fCBhcnJbaV1cbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyXG4iLCJjb25zdCBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKVxuXG5jbGFzcyBUcmFja2VyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgY29uc3RydWN0b3IgKGNsaWVudCwgYW5ub3VuY2VVcmwpIHtcbiAgICBzdXBlcigpXG5cbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudFxuICAgIHRoaXMuYW5ub3VuY2VVcmwgPSBhbm5vdW5jZVVybFxuXG4gICAgdGhpcy5pbnRlcnZhbCA9IG51bGxcbiAgICB0aGlzLmRlc3Ryb3llZCA9IGZhbHNlXG4gIH1cblxuICBzZXRJbnRlcnZhbCAoaW50ZXJ2YWxNcykge1xuICAgIGlmIChpbnRlcnZhbE1zID09IG51bGwpIGludGVydmFsTXMgPSB0aGlzLkRFRkFVTFRfQU5OT1VOQ0VfSU5URVJWQUxcblxuICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbClcblxuICAgIGlmIChpbnRlcnZhbE1zKSB7XG4gICAgICB0aGlzLmludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICB0aGlzLmFubm91bmNlKHRoaXMuY2xpZW50Ll9kZWZhdWx0QW5ub3VuY2VPcHRzKCkpXG4gICAgICB9LCBpbnRlcnZhbE1zKVxuICAgICAgaWYgKHRoaXMuaW50ZXJ2YWwudW5yZWYpIHRoaXMuaW50ZXJ2YWwudW5yZWYoKVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFRyYWNrZXJcbiIsIi8qIGdsb2JhbCBzZWxmIGNyeXB0byAqL1xuLyoqXG4gKiBUaGlzIGZpbGUgaXMgbWVhbnQgdG8gYmUgYSBzdWJzdGl0dXRlIHRvIHNvbWUgb2Ygd2hhdCB0aGUgbm9kZWpzIGFwaSBjYW4gZG9cbiAqIHRoYXQgdGhlIGJyb3dzZXIgY2FuJ3QgZG8gYW5kIHZpY2UgdmVyc2EuXG4gKi9cblxudmFyIHNoYTEgPSB0eXBlb2YgY3J5cHRvID09PSAnb2JqZWN0J1xuICA/IGNyeXB0by5zdWJ0bGUuZGlnZXN0LmJpbmQoY3J5cHRvLnN1YnRsZSwgJ3NoYS0xJylcbiAgOiAoKSA9PiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ25vIHdlYiBjcnlwdG8gc3VwcG9ydCcpKVxudmFyIHRvQXJyID0gZSA9PiBuZXcgVWludDhBcnJheShlKVxuXG52YXIgYWxwaGFiZXQgPSAnMDEyMzQ1Njc4OWFiY2RlZidcbnZhciBlbmNvZGVMb29rdXAgPSBbXVxudmFyIGRlY29kZUxvb2t1cCA9IFtdXG5cbmZvciAodmFyIGkgPSAwOyBpIDwgMjU2OyBpKyspIHtcbiAgZW5jb2RlTG9va3VwW2ldID0gYWxwaGFiZXRbaSA+PiA0ICYgMHhmXSArIGFscGhhYmV0W2kgJiAweGZdXG4gIGlmIChpIDwgMTYpIHtcbiAgICBpZiAoaSA8IDEwKSB7XG4gICAgICBkZWNvZGVMb29rdXBbMHgzMCArIGldID0gaVxuICAgIH0gZWxzZSB7XG4gICAgICBkZWNvZGVMb29rdXBbMHg2MSAtIDEwICsgaV0gPSBpXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRW5jb2RlIGEgVWludDhBcnJheSB0byBhIGhleCBzdHJpbmdcbiAqXG4gKiBAcGFyYW0gIHtVaW50OEFycmF5fSBhcnJheSBCeXRlcyB0byBlbmNvZGUgdG8gc3RyaW5nXG4gKiBAcmV0dXJuIHtzdHJpbmd9ICAgICAgICAgICBoZXggc3RyaW5nXG4gKi9cbmV4cG9ydHMuYXJyMmhleCA9IGFycmF5ID0+IHtcbiAgdmFyIGxlbmd0aCA9IGFycmF5Lmxlbmd0aFxuICB2YXIgc3RyaW5nID0gJydcbiAgdmFyIGkgPSAwXG4gIHdoaWxlIChpIDwgbGVuZ3RoKSB7XG4gICAgc3RyaW5nICs9IGVuY29kZUxvb2t1cFthcnJheVtpKytdXVxuICB9XG4gIHJldHVybiBzdHJpbmdcbn1cblxuLyoqXG4gKiBEZWNvZGVzIGEgaGV4IHN0cmluZyB0byBhIFVpbnQ4QXJyYXlcbiAqXG4gKiBAcGFyYW0gIHtzdHJpbmd9IHN0cmluZyBoZXggc3RyaW5nIHRvIGRlY29kZSB0byBVaW50OEFycmF5XG4gKiBAcmV0dXJuIHtVaW50OEFycmF5fSAgICBVaW50OEFycmF5XG4gKi9cbmV4cG9ydHMuaGV4MmFyciA9IHN0cmluZyA9PiB7XG4gIHZhciBzaXplb2YgPSBzdHJpbmcubGVuZ3RoID4+IDFcbiAgdmFyIGxlbmd0aCA9IHNpemVvZiA8PCAxXG4gIHZhciBhcnJheSA9IG5ldyBVaW50OEFycmF5KHNpemVvZilcbiAgdmFyIG4gPSAwXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbmd0aCkge1xuICAgIGFycmF5W24rK10gPSBkZWNvZGVMb29rdXBbc3RyaW5nLmNoYXJDb2RlQXQoaSsrKV0gPDwgNCB8IGRlY29kZUxvb2t1cFtzdHJpbmcuY2hhckNvZGVBdChpKyspXVxuICB9XG4gIHJldHVybiBhcnJheVxufVxuXG4vKipcbiAqIEBwYXJhbSAge3N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtzdHJpbmd9XG4gKi9cbmV4cG9ydHMuYmluYXJ5MmhleCA9IHN0ciA9PiB7XG4gIHZhciBoZXggPSAnMDEyMzQ1Njc4OWFiY2RlZidcbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBjXG4gIHZhciBpID0gMFxuICB2YXIgbCA9IHN0ci5sZW5ndGhcblxuICBmb3IgKDsgaSA8IGw7ICsraSkge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIHJlcyArPSBoZXguY2hhckF0KChjID4+IDQpICYgMHhGKVxuICAgIHJlcyArPSBoZXguY2hhckF0KGMgJiAweEYpXG4gIH1cblxuICByZXR1cm4gcmVzXG59XG5cbi8qKlxuICogQHBhcmFtICB7c3RyaW5nfSBoZXhcbiAqIEByZXR1cm4ge3N0cmluZ31cbiAqL1xuZXhwb3J0cy5oZXgyYmluYXJ5ID0gaGV4ID0+IHtcbiAgZm9yICh2YXIgc3RyaW5nID0gJycsIGkgPSAwLCBsID0gaGV4Lmxlbmd0aDsgaSA8IGw7IGkgKz0gMikge1xuICAgIHN0cmluZyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnNlSW50KGhleC5zdWJzdHIoaSwgMiksIDE2KSlcbiAgfVxuXG4gIHJldHVybiBzdHJpbmdcbn1cblxuLyoqXG4gKiBAcGFyYW0gIHtBcnJheUJ1ZmZlcnxBcnJheUJ1ZmZlclZpZXd9IGJ1ZmZlclxuICogQHJldHVybiB7UHJvbWlzZTxVaW50OEFycmF5Pn1cbiAqL1xuZXhwb3J0cy5zaGExID0gYnVmZmVyID0+IHNoYTEoYnVmZmVyKS50aGVuKHRvQXJyKVxuXG5leHBvcnRzLnRleHQyYXJyID0gVGV4dEVuY29kZXIucHJvdG90eXBlLmVuY29kZS5iaW5kKG5ldyBUZXh0RW5jb2RlcigpKVxuXG5leHBvcnRzLmFycjJ0ZXh0ID0gVGV4dERlY29kZXIucHJvdG90eXBlLmRlY29kZS5iaW5kKG5ldyBUZXh0RGVjb2RlcigpKVxuXG5leHBvcnRzLmJpbmFyeVRvSGV4ID0gc3RyID0+IHtcbiAgdmFyIGhleCA9ICcwMTIzNDU2Nzg5YWJjZGVmJ1xuICB2YXIgcmVzID0gJydcbiAgdmFyIGNcbiAgdmFyIGkgPSAwXG4gIHZhciBsID0gc3RyLmxlbmd0aFxuXG4gIGZvciAoOyBpIDwgbDsgKytpKSB7XG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgcmVzICs9IGhleC5jaGFyQXQoKGMgPj4gNCkgJiAweEYpXG4gICAgcmVzICs9IGhleC5jaGFyQXQoYyAmIDB4RilcbiAgfVxuXG4gIHJldHVybiByZXNcbn1cblxuZXhwb3J0cy5oZXhUb0JpbmFyeSA9IGhleCA9PiB7XG4gIGZvciAodmFyIHN0cmluZyA9ICcnLCBpID0gMCwgbCA9IGhleC5sZW5ndGg7IGkgPCBsOyBpICs9IDIpIHtcbiAgICBzdHJpbmcgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJzZUludChoZXguc3Vic3RyKGksIDIpLCAxNikpXG4gIH1cblxuICByZXR1cm4gc3RyaW5nXG59XG4iLCIvKiBnbG9iYWwgUlRDUGVlckNvbm5lY3Rpb24gKi9cblxuY29uc3QgTUFYX0JVRkZFUkVEX0FNT1VOVCA9IDY0ICogMTAyNFxuY29uc3QgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoTUFYX0JVRkZFUkVEX0FNT1VOVClcblxuY2xhc3MgUGVlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRzID0ge30pIHtcbiAgICB0aGlzLmluaXRpYXRvciA9ICFvcHRzLm9mZmVyXG5cbiAgICB0aGlzLnJlbW90ZUFkZHJlc3MgPVxuICAgIHRoaXMucmVtb3RlUG9ydCA9XG4gICAgdGhpcy5sb2NhbEFkZHJlc3MgPVxuICAgIHRoaXMub25NZXNzYWdlID1cbiAgICB0aGlzLmxvY2FsUG9ydCA9XG4gICAgdGhpcy50aW1lc3RhbXAgPVxuICAgIHRoaXMuc2RwID1cbiAgICB0aGlzLm9uU2lnbmFsID1cbiAgICB0aGlzLmVycm9yID1cbiAgICB0aGlzLl9ldnRMb29wVGltZXIgPVxuICAgIHRoaXMuX2RjID0gbnVsbFxuXG4gICAgdGhpcy5fYnVja2V0ID0gW10gLy8gaG9sZHMgbWVzc2FnZXMgdW50aWwgaXBhZHJlc3MgaGF2ZSBiZWVuIGZvdW5kXG4gICAgdGhpcy5fcXVldWUgPSBbXVxuICAgIHRoaXMuX2J1bGtTZW5kID0gdGhpcy5idWxrU2VuZC5iaW5kKHRoaXMpXG5cbiAgICBjb25zdCBwYyA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbihvcHRzLmNvbmZpZyB8fCBQZWVyLmNvbmZpZylcbiAgICB0aGlzLl9wYyA9IHBjXG5cbiAgICAvLyAoc29tZXRpbWVzIGdldHMgcmV0cmlnZ2VyZCBieSBvbmRhdGFjaGFubmVsKVxuICAgIHBjLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgc3dpdGNoIChwYy5pY2VDb25uZWN0aW9uU3RhdGUpIHtcbiAgICAgICAgY2FzZSAnY29ubmVjdGVkJzpcbiAgICAgICAgICAvLyBwYy5nZXRTdGF0cygpLnRoZW4oaXRlbXMgPT4gdGhpcy5fb25jZVN0YXRzKGl0ZW1zKSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdkaXNjb25uZWN0ZWQnOlxuICAgICAgICAgIHRoaXMuZGVzdHJveShuZXcgRXJyb3IoJ0ljZSBjb25uZWN0aW9uIGRpc2Nvbm5lY3RlZC4nKSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdmYWlsZWQnOlxuICAgICAgICAgIHRoaXMuZGVzdHJveShuZXcgRXJyb3IoJ0ljZSBjb25uZWN0aW9uIGZhaWxlZC4nKSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLmluaXRpYXRvcikge1xuICAgICAgdGhpcy5jcmVhdGVTRFAoKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNldFNEUChvcHRzWydvZmZlciddKVxuICAgIH1cbiAgfVxuXG4gIF9zZXR1cERhdGEgKCkge1xuICAgIGNvbnN0IGRjID0gdGhpcy5fZGNcblxuICAgIGRjLm9ub3BlbiA9ICgpID0+IHtcbiAgICAgIHRoaXMuX3BjLmdldFN0YXRzKCkudGhlbihpdGVtcyA9PiB0aGlzLl9vbmNlU3RhdHMoaXRlbXMpKVxuICAgIH1cblxuICAgIGRjLmJpbmFyeVR5cGUgPSAnYXJyYXlidWZmZXInXG5cbiAgICBkYy5idWZmZXJlZEFtb3VudExvd1RocmVzaG9sZCA9IE1BWF9CVUZGRVJFRF9BTU9VTlRcblxuICAgIGRjLm9ubWVzc2FnZSA9IGV2dCA9PiB7XG4gICAgICBpZiAodGhpcy50aW1lc3RhbXApIHtcbiAgICAgICAgdGhpcy5vbk1lc3NhZ2UobmV3IFVpbnQ4QXJyYXkoZXZ0LmRhdGEpKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fYnVja2V0LnB1c2gobmV3IFVpbnQ4QXJyYXkoZXZ0LmRhdGEpKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9vbmNlU3RhdHMgKGl0ZW1zKSB7XG4gICAgbGV0IHNlbGVjdGVkXG5cbiAgICBpdGVtcy5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgLy8gU3BlYy1jb21wbGlhbnRcbiAgICAgIGlmIChpdGVtLnR5cGUgPT09ICd0cmFuc3BvcnQnICYmIGl0ZW0uc2VsZWN0ZWRDYW5kaWRhdGVQYWlySWQpIHtcbiAgICAgICAgc2VsZWN0ZWQgPSBpdGVtcy5nZXQoaXRlbS5zZWxlY3RlZENhbmRpZGF0ZVBhaXJJZClcbiAgICAgIH1cblxuICAgICAgLy8gT2xkIGltcGxlbWVudGF0aW9uc1xuICAgICAgaWYgKCFzZWxlY3RlZCAmJiBpdGVtLnR5cGUgPT09ICdjYW5kaWRhdGUtcGFpcicgJiYgKGl0ZW0uc2VsZWN0ZWQgfHwgaXRlbS5ub21pbmF0ZWQpKSB7XG4gICAgICAgIHNlbGVjdGVkID0gaXRlbVxuICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zdCBsb2NhbCA9IGl0ZW1zLmdldChzZWxlY3RlZC5sb2NhbENhbmRpZGF0ZUlkKSB8fCB7fVxuICAgIGNvbnN0IHJlbW90ZSA9IGl0ZW1zLmdldChzZWxlY3RlZC5yZW1vdGVDYW5kaWRhdGVJZCkgfHwge31cblxuICAgIHRoaXMubmV0d29ya1R5cGUgPSBsb2NhbC5uZXR3b3JrVHlwZVxuXG4gICAgdGhpcy5jYW5kaWRhdGVUeXBlID0gbG9jYWwuY2FuZGlkYXRlVHlwZVxuICAgIHRoaXMubG9jYWxBZGRyZXNzID0gbG9jYWwuaXAgfHwgbG9jYWwuYWRkcmVzcyB8fCBsb2NhbC5pcEFkZHJlc3NcbiAgICB0aGlzLmxvY2FsUG9ydCA9IGxvY2FsLnBvcnQgfHwgbG9jYWwucG9ydE51bWJlclxuXG4gICAgdGhpcy5yZW1vdGVBZGRyZXNzID0gcmVtb3RlLmlwIHx8IHJlbW90ZS5hZGRyZXNzIHx8IHJlbW90ZS5pcEFkZHJlc3NcbiAgICB0aGlzLnJlbW90ZVBvcnQgPSByZW1vdGUucG9ydCB8fCByZW1vdGUucG9ydE51bWJlclxuXG4gICAgdGhpcy5vbkNvbm5lY3QgJiYgdGhpcy5vbkNvbm5lY3QodGhpcylcblxuICAgIHRoaXMudGltZXN0YW1wID0gRGF0ZS5ub3coKSAvIDEwMDAgfCAwXG5cbiAgICB0aGlzLl9idWNrZXQuZm9yRWFjaChtc2cgPT4ge1xuICAgICAgdGhpcy5vbk1lc3NhZ2UobXNnKVxuICAgIH0pXG4gICAgdGhpcy5fYnVja2V0ID0gbnVsbFxuICB9XG5cbiAgYXN5bmMgY3JlYXRlU0RQICgpIHtcbiAgICBjb25zdCBwYyA9IHRoaXMuX3BjXG4gICAgaWYgKCF0aGlzLl9kYykge1xuICAgICAgdGhpcy5fZGMgPSBwYy5jcmVhdGVEYXRhQ2hhbm5lbCgnJylcbiAgICAgIHRoaXMuX3NldHVwRGF0YSgpXG4gICAgfVxuXG4gICAgY29uc3QgZGVzYyA9IGF3YWl0IHBjLmNyZWF0ZU9mZmVyKClcblxuICAgIC8vIHJlbW92ZSB0cmlja2xlXG4gICAgZGVzYy5zZHAgPSBkZXNjLnNkcC5yZXBsYWNlKC9hPWljZS1vcHRpb25zOnRyaWNrbGVcXHNcXG4vZywgJycpXG5cbiAgICAvLyB0cmlja2xlIGljZVxuICAgIGNvbnN0IGljZUdhdGhlcmluZyA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgc2V0VGltZW91dChyZXNvbHZlLCAyMDAwKVxuICAgICAgcGMub25pY2VjYW5kaWRhdGUgPSBldnQgPT4ge1xuICAgICAgICAhZXZ0LmNhbmRpZGF0ZSAmJiByZXNvbHZlKHBjLm9uaWNlY2FuZGlkYXRlID0gbnVsbClcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgYXdhaXQgcGMuc2V0TG9jYWxEZXNjcmlwdGlvbihkZXNjKVxuICAgIGF3YWl0IGljZUdhdGhlcmluZ1xuXG4gICAgdGhpcy5zZHAgPSBwYy5sb2NhbERlc2NyaXB0aW9uXG4gICAgdGhpcy5vblNpZ25hbCh0aGlzKVxuICB9XG5cbiAgYXN5bmMgc2V0U0RQIChzZHApIHtcbiAgICBpZiAodGhpcy5kZXN0cm95ZWQpIGNvbnNvbGUubG9nKCdjYW50IGRvIHRoaXMgd2hlbiBpdHMgY2xvc2VkJywgdGhpcy5lcnJvcilcbiAgICBjb25zdCBwYyA9IHRoaXMuX3BjXG4gICAgYXdhaXQgcGMuc2V0UmVtb3RlRGVzY3JpcHRpb24oc2RwKVxuICAgIHBjLm9uZGF0YWNoYW5uZWwgPSBudWxsXG5cbiAgICBpZiAoIXBjLmxvY2FsRGVzY3JpcHRpb24pIHtcbiAgICAgIGNvbnN0IGljZUdhdGhlcmluZyA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICBwYy5vbmljZWNhbmRpZGF0ZSA9IGV2dCA9PiB7XG4gICAgICAgICAgIWV2dC5jYW5kaWRhdGUgJiYgcmVzb2x2ZShwYy5vbmljZWNhbmRpZGF0ZSA9IG51bGwpXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIGNvbnN0IGRlc2MgPSBhd2FpdCBwYy5jcmVhdGVBbnN3ZXIoKVxuICAgICAgZGVzYy5zZHAgPSBkZXNjLnNkcC5yZXBsYWNlKC9hPWljZS1vcHRpb25zOnRyaWNrbGVcXHNcXG4vZywgJycpXG4gICAgICBhd2FpdCBwYy5zZXRMb2NhbERlc2NyaXB0aW9uKGRlc2MpXG4gICAgICBhd2FpdCBpY2VHYXRoZXJpbmdcbiAgICAgIHBjLm9uZGF0YWNoYW5uZWwgPSBldnQgPT4ge1xuICAgICAgICB0aGlzLl9kYyA9IGV2dC5jaGFubmVsXG4gICAgICAgIHRoaXMuX3NldHVwRGF0YSgpXG4gICAgICAgIHBjLm9uaWNlY29ubmVjdGlvbnN0YXRlY2hhbmdlKClcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5zZHAgPSBwYy5sb2NhbERlc2NyaXB0aW9uXG4gICAgdGhpcy5vblNpZ25hbCAmJiB0aGlzLm9uU2lnbmFsKHRoaXMpXG4gIH1cblxuICBzaWduYWwgKHNkcCkge1xuICAgIHRoaXMuc2V0U0RQKHNkcClcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIHRleHQvYmluYXJ5IGRhdGEgdG8gdGhlIHJlbW90ZSBwZWVyLlxuICAgKiBAcGFyYW0ge1VpbnQ4QXJyYXl9IGNodW5rXG4gICAqL1xuICBzZW5kIChjaHVuaykge1xuICAgIC8vIGNvbnN0IGNoYW5uZWwgPSB0aGlzLl9jaGFubmVsXG4gICAgLy8gaWYgKHRoaXMuZGVzdHJveWVkKSByZXR1cm5cbiAgICAvLyBpZiAoY2hhbm5lbC5yZWFkeVN0YXRlID09PSAnY2xvc2luZycpIHJldHVybiB0aGlzLmRlc3Ryb3koKVxuICAgIC8vIGlmIChjaGFubmVsLnJlYWR5U3RhdGUgPT09ICdvcGVuJykge1xuICAgIC8vICAgY2hhbm5lbC5zZW5kKGNodW5rKVxuICAgIC8vIH1cblxuICAgIGlmICghd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2spIHtcbiAgICAgIGNvbnN0IGNoYW5uZWwgPSB0aGlzLl9kY1xuICAgICAgaWYgKHRoaXMuZGVzdHJveWVkKSByZXR1cm5cbiAgICAgIGlmIChjaGFubmVsLnJlYWR5U3RhdGUgPT09ICdjbG9zaW5nJykgcmV0dXJuIHRoaXMuZGVzdHJveSgpXG5cbiAgICAgIGNoYW5uZWwuc2VuZChjaHVuaylcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmICh0aGlzLmV2dExvb3BUaW1lcikge1xuICAgICAgdGhpcy5xdWV1ZS5wdXNoKGNodW5rKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnF1ZXVlID0gW2NodW5rXVxuICAgICAgdGhpcy5ldnRMb29wVGltZXIgPSB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFjayh0aGlzLl9idWxrU2VuZClcbiAgICB9XG4gIH1cblxuICBidWxrU2VuZCAoKSB7XG4gICAgY29uc3QgZGMgPSB0aGlzLl9kY1xuICAgIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuXG4gICAgaWYgKGRjLnJlYWR5U3RhdGUgPT09ICdjbG9zaW5nJykgcmV0dXJuIHRoaXMuZGVzdHJveSgpXG4gICAgY29uc3QgY2h1bmtzID0gdGhpcy5xdWV1ZVxuXG4gICAgaWYgKGNodW5rcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIGRjLnNlbmQoY2h1bmtzWzBdKVxuICAgICAgdGhpcy5ldnRMb29wVGltZXIgPSB0aGlzLnF1ZXVlID0gbnVsbFxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgbGV0IG9mZnNldCA9IDBcbiAgICBsZXQgbWVyZ2VkID0gW11cbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IGNodW5rcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGNvbnN0IGNodW5rID0gY2h1bmtzW2ldXG4gICAgICBpZiAoY2h1bmsubGVuZ3RoICsgb2Zmc2V0ID49IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgLy8gU2VuZCBtYW55IHNtYWxsIG1lc3NhZ2VzIGFzIG9uZVxuICAgICAgICBpZiAob2Zmc2V0KSB7XG4gICAgICAgICAgZGMuc2VuZChidWZmZXIuc3ViYXJyYXkoMCwgb2Zmc2V0KSlcbiAgICAgICAgICBvZmZzZXQgPSAwXG4gICAgICAgICAgbWVyZ2VkID0gW11cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkYy5zZW5kKGNodW5rKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG1lcmdlZC5wdXNoKGNodW5rLmxlbmd0aClcbiAgICAgIGJ1ZmZlci5zZXQoY2h1bmssIG9mZnNldClcbiAgICAgIG9mZnNldCArPSBjaHVuay5sZW5ndGhcbiAgICB9XG5cbiAgICBkYy5zZW5kKGJ1ZmZlci5zdWJhcnJheSgwLCBvZmZzZXQpKVxuXG4gICAgdGhpcy5ldnRMb29wVGltZXIgPSB0aGlzLnF1ZXVlID0gbnVsbFxuICB9XG5cbiAgZGVzdHJveSAoZXJyKSB7XG4gICAgaWYgKHRoaXMuZGVzdHJveWVkKSByZXR1cm5cbiAgICB0aGlzLmRlc3Ryb3llZCA9IHRydWVcbiAgICB0aGlzLmVycm9yID0gdHlwZW9mIGVyciA9PT0gJ3N0cmluZydcbiAgICAgID8gbmV3IEVycm9yKGVycilcbiAgICAgIDogZXJyIHx8IG5ldyBFcnJvcignc29tZXRoaW5nIGNsb3NlZCcpXG5cbiAgICAvLyB0aGlzLmVycm9yID0gZXJyIHx8IG51bGxcbiAgICAvLyB0aGlzLl9kZWJ1ZygnZGVzdHJveSAoZXJyb3I6ICVzKScsIGVyciAmJiAoZXJyLm1lc3NhZ2UgfHwgZXJyKSlcbiAgICBjb25zdCBjaGFubmVsID0gdGhpcy5fZGNcbiAgICBjb25zdCBwYyA9IHRoaXMuX3BjXG5cbiAgICAvLyBDbGVhbnVwIERhdGFDaGFubmVsXG4gICAgaWYgKHRoaXMuX2RjKSB7XG4gICAgICBjaGFubmVsLm9uY2xvc2UgPSBudWxsXG4gICAgICBjaGFubmVsLm9uZXJyb3IgPSBudWxsXG4gICAgICBjaGFubmVsLm9ubWVzc2FnZSA9IG51bGxcbiAgICAgIGNoYW5uZWwub25vcGVuID0gbnVsbFxuICAgICAgaWYgKGNoYW5uZWwucmVhZHlTdGF0ZSAhPT0gJ2Nsb3NlZCcpIGNoYW5uZWwuY2xvc2UoKVxuICAgIH1cblxuICAgIHBjLm9uZGF0YWNoYW5uZWwgPSBudWxsXG4gICAgcGMub25pY2VjYW5kaWRhdGUgPSBudWxsXG4gICAgcGMub25pY2Vjb25uZWN0aW9uc3RhdGVjaGFuZ2UgPSBudWxsXG4gICAgcGMub25pY2VnYXRoZXJpbmdzdGF0ZWNoYW5nZSA9IG51bGxcbiAgICBwYy5vbnNpZ25hbGluZ3N0YXRlY2hhbmdlID0gbnVsbFxuICAgIGlmIChwYy5pY2VDb25uZWN0aW9uU3RhdGUgPT09ICduZXcnKSBmYWxzZSAmJiBjb25zb2xlLmxvZyhuZXcgRXJyb3IoJ2RvbnQgY2xvc2UgdGhpcycpKVxuICAgIHBjLmNsb3NlKClcblxuICAgIC8vIENsZWFudXAgbG9jYWwgdmFyaWFibGVzXG4gICAgdGhpcy5fY2hhbm5lbFJlYWR5ID1cbiAgICB0aGlzLl9wY1JlYWR5ID1cbiAgICB0aGlzLmNvbm5lY3RlZCA9XG4gICAgdGhpcy5vbk1lc3NhZ2UgPVxuICAgIHRoaXMudGltZXN0YW1wID1cbiAgICB0aGlzLl9kYyA9XG4gICAgdGhpcy5fcGMgPSBudWxsXG5cbiAgICB0aGlzLm9uRGVzdHJveSAmJiB0aGlzLm9uRGVzdHJveShlcnIpXG4gIH1cbn1cblxuLyoqXG4gKiBFeHBvc2UgY29uZmlnLCBjb25zdHJhaW50cywgYW5kIGRhdGEgY2hhbm5lbCBjb25maWcgZm9yIG92ZXJyaWRpbmcgYWxsIFBlZXJcbiAqIGluc3RhbmNlcy4gT3RoZXJ3aXNlLCBqdXN0IHNldCBvcHRzLmNvbmZpZywgb3B0cy5jb25zdHJhaW50cywgb3Igb3B0cy5jaGFubmVsQ29uZmlnXG4gKiB3aGVuIGNvbnN0cnVjdGluZyBhIFBlZXIuXG4gKi9cblBlZXIuY29uZmlnID0ge1xuICBpY2VTZXJ2ZXJzOiBbXG4gICAgeyB1cmxzOiAnc3R1bjpzdHVuLmwuZ29vZ2xlLmNvbToxOTMwMicgfSxcbiAgICB7IHVybHM6ICdzdHVuOmdsb2JhbC5zdHVuLnR3aWxpby5jb206MzQ3OD90cmFuc3BvcnQ9dWRwJyB9XG4gIF1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQZWVyXG4iLCIvKiBnbG9iYWwgV2ViU29ja2V0ICovXG5cbmNvbnN0IFBlZXIgPSByZXF1aXJlKCcuLi8uLi8uLi9saWdodC1wZWVyL2xpZ2h0LmpzJylcbmNvbnN0IFRyYWNrZXIgPSByZXF1aXJlKCcuL3RyYWNrZXInKVxuY29uc3QgeyBoZXhUb0JpbmFyeSwgYmluYXJ5VG9IZXggfSA9IHJlcXVpcmUoJy4uLy4uLy4uL2NvbW1vbicpXG5cbi8vIFVzZSBhIHNvY2tldCBwb29sLCBzbyB0cmFja2VyIGNsaWVudHMgc2hhcmUgV2ViU29ja2V0IG9iamVjdHMgZm9yIHRoZSBzYW1lIHNlcnZlci5cbi8vIEluIHByYWN0aWNlLCBXZWJTb2NrZXRzIGFyZSBwcmV0dHkgc2xvdyB0byBlc3RhYmxpc2gsIHNvIHRoaXMgZ2l2ZXMgYSBuaWNlIHBlcmZvcm1hbmNlXG4vLyBib29zdCwgYW5kIHNhdmVzIGJyb3dzZXIgcmVzb3VyY2VzLlxuY29uc3Qgc29ja2V0UG9vbCA9IHt9XG5cbmNvbnN0IFJFQ09OTkVDVF9NSU5JTVVNID0gMTUgKiAxMDAwXG5jb25zdCBSRUNPTk5FQ1RfTUFYSU1VTSA9IDMwICogNjAgKiAxMDAwXG5jb25zdCBSRUNPTk5FQ1RfVkFSSUFOQ0UgPSAzMCAqIDEwMDBcbmNvbnN0IE9GRkVSX1RJTUVPVVQgPSA1MCAqIDEwMDBcbmNvbnN0IE1BWF9CVUZGRVJFRF9BTU9VTlQgPSA2NCAqIDEwMjRcblxuY2xhc3MgV2ViU29ja2V0VHJhY2tlciBleHRlbmRzIFRyYWNrZXIge1xuICBjb25zdHJ1Y3RvciAoY2xpZW50LCBhbm5vdW5jZVVybCkge1xuICAgIHN1cGVyKGNsaWVudCwgYW5ub3VuY2VVcmwpXG4gICAgLy8gZGVidWcoJ25ldyB3ZWJzb2NrZXQgdHJhY2tlciAlcycsIGFubm91bmNlVXJsKVxuXG4gICAgdGhpcy5wZWVycyA9IHt9IC8vIHBlZXJzIChvZmZlciBpZCAtPiBwZWVyKVxuICAgIHRoaXMucmV1c2FibGUgPSB7fSAvLyBwZWVycyAob2ZmZXIgaWQgLT4gcGVlcilcbiAgICB0aGlzLnNvY2tldCA9IG51bGxcblxuICAgIHRoaXMucmVjb25uZWN0aW5nID0gZmFsc2VcbiAgICB0aGlzLnJldHJpZXMgPSAwXG4gICAgdGhpcy5yZWNvbm5lY3RUaW1lciA9IG51bGxcblxuICAgIC8vIFNpbXBsZSBib29sZWFuIGZsYWcgdG8gdHJhY2sgd2hldGhlciB0aGUgc29ja2V0IGhhcyByZWNlaXZlZCBkYXRhIGZyb21cbiAgICAvLyB0aGUgd2Vic29ja2V0IHNlcnZlciBzaW5jZSB0aGUgbGFzdCB0aW1lIHNvY2tldC5zZW5kKCkgd2FzIGNhbGxlZC5cbiAgICB0aGlzLmV4cGVjdGluZ1Jlc3BvbnNlID0gZmFsc2VcblxuICAgIHRoaXMuX29wZW5Tb2NrZXQoKVxuICB9XG5cbiAgYW5ub3VuY2UgKG9wdHMpIHtcbiAgICBpZiAodGhpcy5kZXN0cm95ZWQgfHwgdGhpcy5yZWNvbm5lY3RpbmcpIHJldHVyblxuICAgIGlmICh0aGlzLnNvY2tldC5fd3MucmVhZHlTdGF0ZSAhPT0gV2ViU29ja2V0Lk9QRU4pIHtcbiAgICAgIHRoaXMuc29ja2V0Ll93cy5hZGRFdmVudExpc3RlbmVyKCdvcGVuJywgKCkgPT4ge1xuICAgICAgICB0aGlzLmFubm91bmNlKG9wdHMpXG4gICAgICB9LCB7IG9uY2U6IHRydWUgfSlcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGNvbnN0IHBhcmFtcyA9IE9iamVjdC5hc3NpZ24oe30sIG9wdHMsIHtcbiAgICAgIGFjdGlvbjogJ2Fubm91bmNlJyxcbiAgICAgIGluZm9faGFzaDogdGhpcy5jbGllbnQuX2luZm9IYXNoQmluYXJ5LFxuICAgICAgcGVlcl9pZDogdGhpcy5jbGllbnQuX3BlZXJJZEJpbmFyeVxuICAgIH0pXG4gICAgaWYgKHRoaXMuX3RyYWNrZXJJZCkgcGFyYW1zLnRyYWNrZXJpZCA9IHRoaXMuX3RyYWNrZXJJZFxuXG4gICAgaWYgKG9wdHMuZXZlbnQgPT09ICdzdG9wcGVkJyB8fCBvcHRzLmV2ZW50ID09PSAnY29tcGxldGVkJykge1xuICAgICAgLy8gRG9uJ3QgaW5jbHVkZSBvZmZlcnMgd2l0aCAnc3RvcHBlZCcgb3IgJ2NvbXBsZXRlZCcgZXZlbnRcbiAgICAgIHRoaXMuX3NlbmQocGFyYW1zKVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBMaW1pdCB0aGUgbnVtYmVyIG9mIG9mZmVycyB0aGF0IGFyZSBnZW5lcmF0ZWQsIHNpbmNlIGl0IGNhbiBiZSBzbG93XG4gICAgICBjb25zdCBudW13YW50ID0gTWF0aC5taW4ob3B0cy5udW13YW50LCAxMClcblxuICAgICAgdGhpcy5fZ2VuZXJhdGVPZmZlcnMobnVtd2FudCwgb2ZmZXJzID0+IHtcbiAgICAgICAgcGFyYW1zLm51bXdhbnQgPSBudW13YW50XG4gICAgICAgIHBhcmFtcy5vZmZlcnMgPSBvZmZlcnNcbiAgICAgICAgdGhpcy5fc2VuZChwYXJhbXMpXG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIHNjcmFwZSAob3B0cykge1xuICAgIGlmICh0aGlzLmRlc3Ryb3llZCB8fCB0aGlzLnJlY29ubmVjdGluZykgcmV0dXJuXG4gICAgaWYgKHRoaXMuc29ja2V0Ll93cy5yZWFkeVN0YXRlICE9PSBXZWJTb2NrZXQuT1BFTikge1xuICAgICAgdGhpcy5zb2NrZXQuX3dzLmFkZEV2ZW50TGlzdGVuZXIoJ29wZW4nLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuc2NyYXBlKG9wdHMpXG4gICAgICB9LCB7IG9uY2U6IHRydWUgfSlcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBjb25zb2xlLmxvZygnaG93IGRpZCB5b3Ugbm90IG5vdGljZSB0aGlzPyEnKVxuICAgIGNvbnN0IGluZm9IYXNoZXMgPSAoQXJyYXkuaXNBcnJheShvcHRzLmluZm9IYXNoKSAmJiBvcHRzLmluZm9IYXNoLmxlbmd0aCA+IDApXG4gICAgICA/IG9wdHMuaW5mb0hhc2gubWFwKGluZm9IYXNoID0+IHtcbiAgICAgICAgcmV0dXJuIGluZm9IYXNoLnRvU3RyaW5nKCdiaW5hcnknKVxuICAgICAgfSlcbiAgICAgIDogKG9wdHMuaW5mb0hhc2ggJiYgb3B0cy5pbmZvSGFzaC50b1N0cmluZygnYmluYXJ5JykpIHx8IHRoaXMuY2xpZW50Ll9pbmZvSGFzaEJpbmFyeVxuICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgIGFjdGlvbjogJ3NjcmFwZScsXG4gICAgICBpbmZvX2hhc2g6IGluZm9IYXNoZXNcbiAgICB9XG5cbiAgICB0aGlzLl9zZW5kKHBhcmFtcylcbiAgfVxuXG4gIGRlc3Ryb3kgKCkge1xuICAgIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuXG5cbiAgICB0aGlzLmRlc3Ryb3llZCA9IHRydWVcblxuICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbClcbiAgICBjbGVhckludGVydmFsKHRoaXMuc29ja2V0LmludGVydmFsKVxuICAgIGNsZWFyVGltZW91dCh0aGlzLnJlY29ubmVjdFRpbWVyKVxuXG4gICAgLy8gRGVzdHJveSBwZWVyc1xuICAgIGZvciAoY29uc3QgcGVlcklkIGluIHRoaXMucGVlcnMpIHtcbiAgICAgIGNvbnN0IHBlZXIgPSB0aGlzLnBlZXJzW3BlZXJJZF1cbiAgICAgIGNsZWFyVGltZW91dChwZWVyLnRyYWNrZXJUaW1lb3V0KVxuICAgICAgcGVlci5kZXN0cm95KClcbiAgICB9XG4gICAgdGhpcy5wZWVycyA9IG51bGxcblxuICAgIGlmICh0aGlzLnNvY2tldCkge1xuICAgICAgdGhpcy5zb2NrZXQuX3dzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ29wZW4nLCB0aGlzLl9vblNvY2tldENvbm5lY3RCb3VuZClcbiAgICAgIHRoaXMuc29ja2V0Ll93cy5yZW1vdmVFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5fb25Tb2NrZXREYXRhQm91bmQpXG4gICAgICB0aGlzLnNvY2tldC5fd3MucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xvc2UnLCB0aGlzLl9vblNvY2tldENsb3NlQm91bmQpXG4gICAgICB0aGlzLnNvY2tldC5fd3MucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLl9vblNvY2tldEVycm9yQm91bmQpXG4gICAgICB0aGlzLnNvY2tldCA9IG51bGxcbiAgICB9XG5cbiAgICB0aGlzLl9vblNvY2tldENvbm5lY3RCb3VuZCA9IG51bGxcbiAgICB0aGlzLl9vblNvY2tldEVycm9yQm91bmQgPSBudWxsXG4gICAgdGhpcy5fb25Tb2NrZXREYXRhQm91bmQgPSBudWxsXG4gICAgdGhpcy5fb25Tb2NrZXRDbG9zZUJvdW5kID0gbnVsbFxuXG4gICAgaWYgKHNvY2tldFBvb2xbdGhpcy5hbm5vdW5jZVVybF0pIHtcbiAgICAgIHNvY2tldFBvb2xbdGhpcy5hbm5vdW5jZVVybF0uY29uc3VtZXJzIC09IDFcbiAgICB9XG5cbiAgICAvLyBPdGhlciBpbnN0YW5jZXMgYXJlIHVzaW5nIHRoZSBzb2NrZXQsIHNvIHRoZXJlJ3Mgbm90aGluZyBsZWZ0IHRvIGRvIGhlcmVcbiAgICBpZiAoc29ja2V0UG9vbFt0aGlzLmFubm91bmNlVXJsXS5jb25zdW1lcnMgPiAwKSByZXR1cm5cblxuICAgIGxldCBzb2NrZXQgPSBzb2NrZXRQb29sW3RoaXMuYW5ub3VuY2VVcmxdXG4gICAgZGVsZXRlIHNvY2tldFBvb2xbdGhpcy5hbm5vdW5jZVVybF1cblxuICAgIC8vIElmIHRoZXJlIGlzIG5vIGRhdGEgcmVzcG9uc2UgZXhwZWN0ZWQsIGRlc3Ryb3kgaW1tZWRpYXRlbHkuXG4gICAgaWYgKCF0aGlzLmV4cGVjdGluZ1Jlc3BvbnNlKSByZXR1cm4gZGVzdHJveUNsZWFudXAoKVxuXG4gICAgLy8gT3RoZXJ3aXNlLCB3YWl0IGEgc2hvcnQgdGltZSBmb3IgcG90ZW50aWFsIHJlc3BvbnNlcyB0byBjb21lIGluIGZyb20gdGhlXG4gICAgLy8gc2VydmVyLCB0aGVuIGZvcmNlIGNsb3NlIHRoZSBzb2NrZXQuXG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGRlc3Ryb3lDbGVhbnVwLCAxMDAwKVxuXG4gICAgLy8gQnV0LCBpZiBhIHJlc3BvbnNlIGNvbWVzIGZyb20gdGhlIHNlcnZlciBiZWZvcmUgdGhlIHRpbWVvdXQgZmlyZXMsIGRvIGNsZWFudXBcbiAgICAvLyByaWdodCBhd2F5LlxuICAgIHNvY2tldC5fd3MuYWRkRXZlbnRMaXN0ZW5lcignZGF0YScsIGRlc3Ryb3lDbGVhbnVwKVxuXG4gICAgZnVuY3Rpb24gZGVzdHJveUNsZWFudXAgKCkge1xuICAgICAgaWYgKHRpbWVvdXQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpXG4gICAgICAgIHRpbWVvdXQgPSBudWxsXG4gICAgICB9XG4gICAgICBzb2NrZXQuX3dzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RhdGEnLCBkZXN0cm95Q2xlYW51cClcbiAgICAgIHNvY2tldC5fd3MuY2xvc2UoKVxuICAgIH1cbiAgfVxuXG4gIF9vcGVuU29ja2V0ICgpIHtcbiAgICB0aGlzLmRlc3Ryb3llZCA9IGZhbHNlXG5cbiAgICBpZiAoIXRoaXMucGVlcnMpIHRoaXMucGVlcnMgPSB7fVxuICAgIGNvbnN0IG9uY2UgPSB7IG9uY2U6IHRydWUgfVxuXG4gICAgdGhpcy5fb25Tb2NrZXRDb25uZWN0Qm91bmQgPSAoKSA9PiB7XG4gICAgICB0aGlzLl9vblNvY2tldENvbm5lY3QoKVxuICAgIH1cbiAgICB0aGlzLl9vblNvY2tldEVycm9yQm91bmQgPSBlcnIgPT4ge1xuICAgICAgdGhpcy5fb25Tb2NrZXRFcnJvcihlcnIpXG4gICAgfVxuICAgIHRoaXMuX29uU29ja2V0RGF0YUJvdW5kID0gZXZ0ID0+IHtcbiAgICAgIHRoaXMuX29uU29ja2V0RGF0YShldnQuZGF0YSlcbiAgICB9XG4gICAgdGhpcy5fb25Tb2NrZXRDbG9zZUJvdW5kID0gKCkgPT4ge1xuICAgICAgdGhpcy5fb25Tb2NrZXRDbG9zZSgpXG4gICAgfVxuXG4gICAgdGhpcy5zb2NrZXQgPSBzb2NrZXRQb29sW3RoaXMuYW5ub3VuY2VVcmxdXG4gICAgaWYgKHRoaXMuc29ja2V0KSB7XG4gICAgICBzb2NrZXRQb29sW3RoaXMuYW5ub3VuY2VVcmxdLmNvbnN1bWVycyArPSAxXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdvcGVuZWQnLCB0aGlzLmFubm91bmNlVXJsKVxuICAgICAgdGhpcy5zb2NrZXQgPSBzb2NrZXRQb29sW3RoaXMuYW5ub3VuY2VVcmxdID0ge1xuICAgICAgICBfd3M6IG5ldyBXZWJTb2NrZXQodGhpcy5hbm5vdW5jZVVybCksXG4gICAgICAgIGNvbnN1bWVyczogMSxcbiAgICAgICAgYnVmZmVyOiBbXVxuICAgICAgfVxuICAgICAgdGhpcy5zb2NrZXQuX3dzLmFkZEV2ZW50TGlzdGVuZXIoJ29wZW4nLCB0aGlzLl9vblNvY2tldENvbm5lY3RCb3VuZCwgb25jZSlcbiAgICB9XG5cbiAgICB0aGlzLnNvY2tldC5fd3MuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMuX29uU29ja2V0RGF0YUJvdW5kKVxuICAgIHRoaXMuc29ja2V0Ll93cy5hZGRFdmVudExpc3RlbmVyKCdjbG9zZScsIHRoaXMuX29uU29ja2V0Q2xvc2VCb3VuZCwgb25jZSlcbiAgICB0aGlzLnNvY2tldC5fd3MuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLl9vblNvY2tldEVycm9yQm91bmQsIG9uY2UpXG4gIH1cblxuICBfb25Tb2NrZXRDb25uZWN0ICgpIHtcbiAgICBjb25zb2xlLmxvZygnY29ubmVjdGVkJylcbiAgICBpZiAodGhpcy5kZXN0cm95ZWQpIHJldHVyblxuXG4gICAgaWYgKHRoaXMucmVjb25uZWN0aW5nKSB7XG4gICAgICB0aGlzLnJlY29ubmVjdGluZyA9IGZhbHNlXG4gICAgICB0aGlzLnJldHJpZXMgPSAwXG4gICAgICB0aGlzLmFubm91bmNlKHRoaXMuY2xpZW50Ll9kZWZhdWx0QW5ub3VuY2VPcHRzKCkpXG4gICAgfVxuICB9XG5cbiAgX29uU29ja2V0RGF0YSAoZGF0YSkge1xuICAgIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuXG5cbiAgICB0aGlzLmV4cGVjdGluZ1Jlc3BvbnNlID0gZmFsc2VcblxuICAgIHRyeSB7XG4gICAgICBkYXRhID0gSlNPTi5wYXJzZShkYXRhKVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy5jbGllbnQuZW1pdCgnd2FybmluZycsIG5ldyBFcnJvcignSW52YWxpZCB0cmFja2VyIHJlc3BvbnNlJykpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoZGF0YS5hY3Rpb24gPT09ICdhbm5vdW5jZScpIHtcbiAgICAgIHRoaXMuX29uQW5ub3VuY2VSZXNwb25zZShkYXRhKVxuICAgIH0gZWxzZSBpZiAoZGF0YS5hY3Rpb24gPT09ICdzY3JhcGUnKSB7XG4gICAgICB0aGlzLl9vblNjcmFwZVJlc3BvbnNlKGRhdGEpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX29uU29ja2V0RXJyb3IobmV3IEVycm9yKGBpbnZhbGlkIGFjdGlvbiBpbiBXUyByZXNwb25zZTogJHtkYXRhLmFjdGlvbn1gKSlcbiAgICB9XG4gIH1cblxuICBfb25Bbm5vdW5jZVJlc3BvbnNlIChkYXRhKSB7XG4gICAgaWYgKGRhdGEuaW5mb19oYXNoICE9PSB0aGlzLmNsaWVudC5faW5mb0hhc2hCaW5hcnkpIHtcbiAgICAgIC8vIGRlYnVnKFxuICAgICAgLy8gICAnaWdub3Jpbmcgd2Vic29ja2V0IGRhdGEgZnJvbSAlcyBmb3IgJXMgKGxvb2tpbmcgZm9yICVzOiByZXVzZWQgc29ja2V0KScsXG4gICAgICAvLyAgIHRoaXMuYW5ub3VuY2VVcmwsIGJpbmFyeVRvSGV4KGRhdGEuaW5mb19oYXNoKSwgdGhpcy5jbGllbnQuaW5mb0hhc2hcbiAgICAgIC8vIClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmIChkYXRhLnBlZXJfaWQgJiYgZGF0YS5wZWVyX2lkID09PSB0aGlzLmNsaWVudC5fcGVlcklkQmluYXJ5KSB7XG4gICAgICAvLyBpZ25vcmUgb2ZmZXJzL2Fuc3dlcnMgZnJvbSB0aGlzIGNsaWVudFxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gZGVidWcoXG4gICAgLy8gICAncmVjZWl2ZWQgJXMgZnJvbSAlcyBmb3IgJXMnLFxuICAgIC8vICAgSlNPTi5zdHJpbmdpZnkoZGF0YSksIHRoaXMuYW5ub3VuY2VVcmwsIHRoaXMuY2xpZW50LmluZm9IYXNoXG4gICAgLy8gKVxuXG4gICAgY29uc3QgZmFpbHVyZSA9IGRhdGFbJ2ZhaWx1cmUgcmVhc29uJ11cbiAgICBpZiAoZmFpbHVyZSkgcmV0dXJuIHRoaXMuY2xpZW50LmVtaXQoJ3dhcm5pbmcnLCBuZXcgRXJyb3IoZmFpbHVyZSkpXG5cbiAgICBjb25zdCB3YXJuaW5nID0gZGF0YVsnd2FybmluZyBtZXNzYWdlJ11cbiAgICBpZiAod2FybmluZykgdGhpcy5jbGllbnQuZW1pdCgnd2FybmluZycsIG5ldyBFcnJvcih3YXJuaW5nKSlcblxuICAgIGNvbnN0IGludGVydmFsID0gZGF0YS5pbnRlcnZhbCB8fCBkYXRhWydtaW4gaW50ZXJ2YWwnXVxuICAgIGlmIChpbnRlcnZhbCkgdGhpcy5zZXRJbnRlcnZhbChpbnRlcnZhbCAqIDEwMDApXG5cbiAgICBjb25zdCB0cmFja2VySWQgPSBkYXRhWyd0cmFja2VyIGlkJ11cbiAgICBpZiAodHJhY2tlcklkKSB7XG4gICAgICAvLyBJZiBhYnNlbnQsIGRvIG5vdCBkaXNjYXJkIHByZXZpb3VzIHRyYWNrZXJJZCB2YWx1ZVxuICAgICAgdGhpcy5fdHJhY2tlcklkID0gdHJhY2tlcklkXG4gICAgfVxuXG4gICAgaWYgKGRhdGEuY29tcGxldGUgIT0gbnVsbCkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBPYmplY3QuYXNzaWduKHt9LCBkYXRhLCB7XG4gICAgICAgIGFubm91bmNlOiB0aGlzLmFubm91bmNlVXJsLFxuICAgICAgICBpbmZvSGFzaDogYmluYXJ5VG9IZXgoZGF0YS5pbmZvX2hhc2gpXG4gICAgICB9KVxuICAgICAgdGhpcy5jbGllbnQuZW1pdCgndXBkYXRlJywgcmVzcG9uc2UpXG4gICAgfVxuXG4gICAgbGV0IHBlZXJcbiAgICBpZiAoZGF0YS5vZmZlciAmJiBkYXRhLnBlZXJfaWQpIHtcbiAgICAgIGNvbnN0IHBlZXJJZCA9IGJpbmFyeVRvSGV4KGRhdGEucGVlcl9pZClcbiAgICAgIGlmICh0aGlzLmNsaWVudC5fZmlsdGVyICYmICF0aGlzLmNsaWVudC5fZmlsdGVyKHBlZXJJZCkpIHJldHVyblxuICAgICAgcGVlciA9IHRoaXMuX2NyZWF0ZVBlZXIoeyBvZmZlcjogZGF0YS5vZmZlciB9KVxuICAgICAgcGVlci5pZCA9IHBlZXJJZFxuXG4gICAgICBwZWVyLm9uU2lnbmFsID0gcGVlciA9PiB7XG4gICAgICAgIHBlZXIub25TaWduYWwgPSBudWxsXG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHtcbiAgICAgICAgICBhY3Rpb246ICdhbm5vdW5jZScsXG4gICAgICAgICAgaW5mb19oYXNoOiB0aGlzLmNsaWVudC5faW5mb0hhc2hCaW5hcnksXG4gICAgICAgICAgcGVlcl9pZDogdGhpcy5jbGllbnQuX3BlZXJJZEJpbmFyeSxcbiAgICAgICAgICB0b19wZWVyX2lkOiBkYXRhLnBlZXJfaWQsXG4gICAgICAgICAgYW5zd2VyOiBwZWVyLnNkcCxcbiAgICAgICAgICBvZmZlcl9pZDogZGF0YS5vZmZlcl9pZFxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl90cmFja2VySWQpIHBhcmFtcy50cmFja2VyaWQgPSB0aGlzLl90cmFja2VySWRcbiAgICAgICAgdGhpcy5fc2VuZChwYXJhbXMpXG4gICAgICAgIHRoaXMuY2xpZW50LmVtaXQoJ3BlZXInLCBwZWVyKVxuICAgICAgICAvLyBwZWVyLm9uQ29ubmVjdCA9ICgpID0+IHtcbiAgICAgICAgLy8gICBjb25zb2xlLmxvZyhwZWVyLl9kYylcbiAgICAgICAgLy8gICBwZWVyLmNvbm5lY3RlZCA9IHRydWVcbiAgICAgICAgLy8gICB0aGlzLmNsaWVudC5lbWl0KCdwZWVyJywgcGVlcilcbiAgICAgICAgLy8gfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChkYXRhLmFuc3dlciAmJiBkYXRhLnBlZXJfaWQpIHtcbiAgICAgIGNvbnN0IG9mZmVySWQgPSBiaW5hcnlUb0hleChkYXRhLm9mZmVyX2lkKVxuICAgICAgcGVlciA9IHRoaXMucGVlcnNbb2ZmZXJJZF1cbiAgICAgIGlmIChwZWVyKSB7XG4gICAgICAgIHBlZXIuaWQgPSBiaW5hcnlUb0hleChkYXRhLnBlZXJfaWQpXG4gICAgICAgIGNvbnN0IHBlZXJJZCA9IGJpbmFyeVRvSGV4KGRhdGEucGVlcl9pZClcblxuICAgICAgICBpZiAodGhpcy5jbGllbnQuX2ZpbHRlciAmJiAhdGhpcy5jbGllbnQuX2ZpbHRlcihwZWVySWQpKSB7XG4gICAgICAgICAgcmV0dXJuIHBlZXIuZGVzdHJveSgnZmlsdGVyZWQnKVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jbGllbnQuZW1pdCgncGVlcicsIHBlZXIpXG5cbiAgICAgICAgcGVlci5zaWduYWwoZGF0YS5hbnN3ZXIpXG5cbiAgICAgICAgY2xlYXJUaW1lb3V0KHBlZXIudHJhY2tlclRpbWVvdXQpXG4gICAgICAgIHBlZXIudHJhY2tlclRpbWVvdXQgPSBudWxsXG4gICAgICAgIGRlbGV0ZSB0aGlzLnBlZXJzW29mZmVySWRdXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBkZWJ1ZyhgZ290IHVuZXhwZWN0ZWQgYW5zd2VyOiAke0pTT04uc3RyaW5naWZ5KGRhdGEuYW5zd2VyKX1gKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9vblNjcmFwZVJlc3BvbnNlIChkYXRhKSB7XG4gICAgZGF0YSA9IGRhdGEuZmlsZXMgfHwge31cblxuICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhkYXRhKVxuICAgIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5jbGllbnQuZW1pdCgnd2FybmluZycsIG5ldyBFcnJvcignaW52YWxpZCBzY3JhcGUgcmVzcG9uc2UnKSlcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGtleXMuZm9yRWFjaChpbmZvSGFzaCA9PiB7XG4gICAgICAvLyBUT0RPOiBvcHRpb25hbGx5IGhhbmRsZSBkYXRhLmZsYWdzLm1pbl9yZXF1ZXN0X2ludGVydmFsXG4gICAgICAvLyAoc2VwYXJhdGUgZnJvbSBhbm5vdW5jZSBpbnRlcnZhbClcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gT2JqZWN0LmFzc2lnbihkYXRhW2luZm9IYXNoXSwge1xuICAgICAgICBhbm5vdW5jZTogdGhpcy5hbm5vdW5jZVVybCxcbiAgICAgICAgaW5mb0hhc2g6IGJpbmFyeVRvSGV4KGluZm9IYXNoKVxuICAgICAgfSlcbiAgICAgIHRoaXMuY2xpZW50LmVtaXQoJ3NjcmFwZScsIHJlc3BvbnNlKVxuICAgIH0pXG4gIH1cblxuICBfb25Tb2NrZXRDbG9zZSAoKSB7XG4gICAgaWYgKHRoaXMuZGVzdHJveWVkKSByZXR1cm5cbiAgICB0aGlzLmRlc3Ryb3koKVxuICAgIHRoaXMuX3N0YXJ0UmVjb25uZWN0VGltZXIoKVxuICB9XG5cbiAgX29uU29ja2V0RXJyb3IgKGVycikge1xuICAgIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuXG4gICAgdGhpcy5kZXN0cm95KClcbiAgICAvLyBlcnJvcnMgd2lsbCBvZnRlbiBoYXBwZW4gaWYgYSB0cmFja2VyIGlzIG9mZmxpbmUsIHNvIGRvbid0IHRyZWF0IGl0IGFzIGZhdGFsXG4gICAgdGhpcy5jbGllbnQuZW1pdCgnd2FybmluZycsIGVycilcbiAgICB0aGlzLl9zdGFydFJlY29ubmVjdFRpbWVyKClcbiAgfVxuXG4gIF9zdGFydFJlY29ubmVjdFRpbWVyICgpIHtcbiAgICBjb25zdCBtcyA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIFJFQ09OTkVDVF9WQVJJQU5DRSkgKyBNYXRoLm1pbihNYXRoLnBvdygyLCB0aGlzLnJldHJpZXMpICogUkVDT05ORUNUX01JTklNVU0sIFJFQ09OTkVDVF9NQVhJTVVNKVxuXG4gICAgdGhpcy5yZWNvbm5lY3RpbmcgPSB0cnVlXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMucmVjb25uZWN0VGltZXIpXG4gICAgdGhpcy5yZWNvbm5lY3RUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5yZXRyaWVzKytcbiAgICAgIHRoaXMuX29wZW5Tb2NrZXQoKVxuICAgIH0sIG1zKVxuICAgIC8vIGRlYnVnKCdyZWNvbm5lY3Rpbmcgc29ja2V0IGluICVzIG1zJywgbXMpXG4gIH1cblxuICBfc2VuZCAocGFyYW1zKSB7XG4gICAgaWYgKHRoaXMuZGVzdHJveWVkKSByZXR1cm5cbiAgICB0aGlzLmV4cGVjdGluZ1Jlc3BvbnNlID0gdHJ1ZVxuICAgIGNvbnN0IG1lc3NhZ2UgPSBKU09OLnN0cmluZ2lmeShwYXJhbXMpXG4gICAgLy8gZGVidWcoJ3NlbmQgJXMnLCBtZXNzYWdlKVxuICAgIGNvbnN0IHsgX3dzLCBidWZmZXIgfSA9IHRoaXMuc29ja2V0XG4gICAgaWYgKGJ1ZmZlci5sZW5ndGggfHwgX3dzLnJlYWR5U3RhdGUgIT09IFdlYlNvY2tldC5PUEVOIHx8IF93cy5idWZmZXJlZEFtb3VudCA+IE1BWF9CVUZGRVJFRF9BTU9VTlQpIHtcbiAgICAgIGJ1ZmZlci5wdXNoKG1lc3NhZ2UpXG5cbiAgICAgIGlmICghdGhpcy5zb2NrZXQuaW50ZXJ2YWwpIHtcbiAgICAgICAgdGhpcy5zb2NrZXQuaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgd2hpbGUgKF93cy5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuT1BFTiAmJiBidWZmZXIubGVuZ3RoICYmIF93cy5idWZmZXJlZEFtb3VudCA8IE1BWF9CVUZGRVJFRF9BTU9VTlQpIHtcbiAgICAgICAgICAgIF93cy5zZW5kKGJ1ZmZlci5zaGlmdCgpKVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIWJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5zb2NrZXQuaW50ZXJ2YWwpXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5zb2NrZXQuaW50ZXJ2YWxcbiAgICAgICAgICB9XG4gICAgICAgIH0sIDE1MClcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgX3dzLnNlbmQobWVzc2FnZSlcbiAgICB9XG4gIH1cblxuICBhc3luYyBfZ2VuZXJhdGVPZmZlcnMgKG51bXdhbnQsIGNiKSB7XG4gICAgbGV0IG9mZmVycyA9IFtdXG4gICAgbGV0IGkgPSBudW13YW50XG4gICAgLy8gZGVidWcoJ2NyZWF0aW5nIHBlZXIgKGZyb20gX2dlbmVyYXRlT2ZmZXJzKScpXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgY29uc3QgcGVlciA9IHRoaXMuX2NyZWF0ZVBlZXIoKVxuXG4gICAgICBvZmZlcnMucHVzaChuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgcGVlci5vblNpZ25hbCA9IHJlc29sdmVcbiAgICAgIH0pKVxuICAgIH1cblxuICAgIGNvbnN0IHBlZXJzID0gYXdhaXQgUHJvbWlzZS5hbGwob2ZmZXJzKVxuXG4gICAgb2ZmZXJzID0gW11cblxuICAgIGZvciAobGV0IHBlZXIgb2YgcGVlcnMpIHtcbiAgICAgIGNvbnN0IG9mZmVySWQgPSBwZWVyLnNkcC5zZHBcbiAgICAgICAgLm1hdGNoKC9hPWZpbmdlcnByaW50OltcXHctXSpcXHMoLiopLylbMV0ucmVwbGFjZSgvW15cXHddKi9nLCAnJylcbiAgICAgICAgLnN1YnN0cigwLCAyMClcbiAgICAgICAgLnRvTG93ZXJDYXNlKClcblxuICAgICAgcGVlci5vbkRlc3Ryb3kgPSAoKSA9PiB7XG4gICAgICAgIHBlZXJbJ2Rlc3Ryb3lDYWxsZWQnXSA9IHRydWVcbiAgICAgICAgZGVsZXRlIHRoaXMucGVlcnNbb2ZmZXJJZF1cbiAgICAgIH1cblxuICAgICAgdGhpcy5wZWVyc1tvZmZlcklkXSA9IHBlZXJcblxuICAgICAgb2ZmZXJzLnB1c2goe1xuICAgICAgICBvZmZlcjogcGVlci5zZHAsXG4gICAgICAgIG9mZmVyX2lkOiBoZXhUb0JpbmFyeShvZmZlcklkKVxuICAgICAgfSlcblxuICAgICAgcGVlci50cmFja2VyVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBwZWVyLnRyYWNrZXJUaW1lb3V0ID0gbnVsbFxuICAgICAgICBkZWxldGUgdGhpcy5wZWVyc1tvZmZlcklkXVxuICAgICAgICBwZWVyLmRlc3Ryb3koKVxuICAgICAgfSwgT0ZGRVJfVElNRU9VVClcbiAgICB9XG5cbiAgICBjYihvZmZlcnMpXG4gIH1cblxuICBfY3JlYXRlUGVlciAob3B0cykge1xuICAgIG9wdHMgPSBPYmplY3QuYXNzaWduKHtcbiAgICAgIGNvbmZpZzogdGhpcy5jbGllbnQuX3J0Y0NvbmZpZ1xuICAgIH0sIG9wdHMpXG5cbiAgICBjb25zdCBwZWVyID0gbmV3IFBlZXIob3B0cylcblxuICAgIHJldHVybiBwZWVyXG4gIH1cbn1cblxuV2ViU29ja2V0VHJhY2tlci5wcm90b3R5cGUuREVGQVVMVF9BTk5PVU5DRV9JTlRFUlZBTCA9IDMwICogMTAwMCAvLyAzMCBzZWNvbmRzXG4vLyBOb3JtYWxseSB0aGlzIHNob3VsZG4ndCBiZSBhY2Nlc3NlZCBidXQgaXMgb2NjYXNpb25hbGx5IHVzZWZ1bFxuV2ViU29ja2V0VHJhY2tlci5fc29ja2V0UG9vbCA9IHNvY2tldFBvb2xcblxubW9kdWxlLmV4cG9ydHMgPSBXZWJTb2NrZXRUcmFja2VyXG4iLCIvLyBjb25zdCBkZWJ1ZyA9IHJlcXVpcmUoJ2RlYnVnJykoJ2JpdHRvcnJlbnQtdHJhY2tlcjpjbGllbnQnKVxuY29uc3QgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJylcbmNvbnN0IGNvbW1vbiA9IHJlcXVpcmUoJy4uL2NvbW1vbicpXG5jb25zdCBXZWJTb2NrZXRUcmFja2VyID0gcmVxdWlyZSgnLi9saWIvY2xpZW50L3dlYnNvY2tldC10cmFja2VyJylcblxuY29uc3QgeyBhcnIyaGV4IH0gPSByZXF1aXJlKCcuLi9jb21tb24nKVxuXG4vKipcbiAqIEJpdFRvcnJlbnQgdHJhY2tlciBjbGllbnQuXG4gKiBGaW5kIHRvcnJlbnQgcGVlcnMsIHRvIGhlbHAgYSB0b3JyZW50IGNsaWVudCBwYXJ0aWNpcGF0ZSBpbiBhIHRvcnJlbnQgc3dhcm0uXG4gKi9cbmNsYXNzIENsaWVudCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge09iamVjdH0gb3B0cyAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyBvYmplY3RcbiAgICogQHBhcmFtIHtVaW50OEFycmF5fSBvcHRzLmluZm9IYXNoICAgICAgICAgICAgIHRvcnJlbnQgaW5mbyBoYXNoXG4gICAqIEBwYXJhbSB7VWludDhBcnJheX0gb3B0cy5wZWVySWQgICAgICAgICAgICAgICBwZWVyIGlkXG4gICAqIEBwYXJhbSB7c3RyaW5nfEFycmF5LjxzdHJpbmc+fSBvcHRzLmFubm91bmNlICBhbm5vdW5jZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRzLmdldEFubm91bmNlT3B0cyAgICAgICAgY2FsbGJhY2sgdG8gcHJvdmlkZSBkYXRhIHRvIHRyYWNrZXJcbiAgICogQHBhcmFtIHtudW1iZXJ9IG9wdHMucnRjQ29uZmlnICAgICAgICAgICAgICAgIFJUQ1BlZXJDb25uZWN0aW9uIGNvbmZpZ3VyYXRpb24gb2JqZWN0XG4gICAqL1xuICBjb25zdHJ1Y3RvciAob3B0cykge1xuICAgIHN1cGVyKClcbiAgICB0aGlzLl9wZWVySWRCaW5hcnkgPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG9wdHMucGVlcklkKVxuXG4gICAgLy8gVE9ETzogZG8gd2UgbmVlZCB0aGlzIHRvIGJlIGEgc3RyaW5nP1xuICAgIHRoaXMuaW5mb0hhc2ggPSB0eXBlb2Ygb3B0cy5pbmZvSGFzaCA9PT0gJ3N0cmluZydcbiAgICAgID8gb3B0cy5pbmZvSGFzaC50b0xvd2VyQ2FzZSgpXG4gICAgICA6IGFycjJoZXgob3B0cy5pbmZvSGFzaClcbiAgICB0aGlzLl9pbmZvSGFzaEJpbmFyeSA9IGNvbW1vbi5oZXhUb0JpbmFyeSh0aGlzLmluZm9IYXNoKVxuXG4gICAgdGhpcy5kZXN0cm95ZWQgPSBmYWxzZVxuXG4gICAgdGhpcy5fZ2V0QW5ub3VuY2VPcHRzID0gb3B0cy5nZXRBbm5vdW5jZU9wdHNcbiAgICB0aGlzLl9maWx0ZXIgPSBvcHRzLmZpbHRlclxuICAgIHRoaXMuX3J0Y0NvbmZpZyA9IG9wdHMucnRjQ29uZmlnXG5cbiAgICBsZXQgYW5ub3VuY2UgPSB0eXBlb2Ygb3B0cy5hbm5vdW5jZSA9PT0gJ3N0cmluZydcbiAgICAgID8gWyBvcHRzLmFubm91bmNlIF1cbiAgICAgIDogb3B0cy5hbm5vdW5jZSA9PSBudWxsID8gW10gOiBvcHRzLmFubm91bmNlXG5cbiAgICAvLyBSZW1vdmUgdHJhaWxpbmcgc2xhc2ggZnJvbSB0cmFja2VycyB0byBjYXRjaCBkdXBsaWNhdGVzXG4gICAgYW5ub3VuY2UgPSBhbm5vdW5jZS5tYXAoYW5ub3VuY2VVcmwgPT4ge1xuICAgICAgYW5ub3VuY2VVcmwgPSBhbm5vdW5jZVVybC50b1N0cmluZygpXG4gICAgICBpZiAoYW5ub3VuY2VVcmxbYW5ub3VuY2VVcmwubGVuZ3RoIC0gMV0gPT09ICcvJykge1xuICAgICAgICBhbm5vdW5jZVVybCA9IGFubm91bmNlVXJsLnN1YnN0cmluZygwLCBhbm5vdW5jZVVybC5sZW5ndGggLSAxKVxuICAgICAgfVxuICAgICAgcmV0dXJuIGFubm91bmNlVXJsXG4gICAgfSlcbiAgICBhbm5vdW5jZSA9IFsuLi5uZXcgU2V0KGFubm91bmNlKV1cblxuICAgIHRoaXMuX3RyYWNrZXJzID0gYW5ub3VuY2VcbiAgICAgIC5tYXAoYW5ub3VuY2VVcmwgPT4ge1xuICAgICAgICAvLyBUT0RPOiBzaG91bGQgd2UgdHJ5IHRvIGNhc3Qgd3M6IHRvIHdzczo/XG4gICAgICAgIGlmIChhbm5vdW5jZVVybC5zdGFydHNXaXRoKCd3c3M6JykgfHwgYW5ub3VuY2VVcmwuc3RhcnRzV2l0aCgnd3M6JykpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFdlYlNvY2tldFRyYWNrZXIodGhpcywgYW5ub3VuY2VVcmwpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gY29uc29sZS53YXJuKGBVbnN1cHBvcnRlZCB0cmFja2VyIHByb3RvY29sOiAke2Fubm91bmNlVXJsfWApXG4gICAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgYHN0YXJ0YCBhbm5vdW5jZSB0byB0aGUgdHJhY2tlcnMuXG4gICAqIEBwYXJhbSB7T2JqZWN0PX0gb3B0c1xuICAgKiBAcGFyYW0ge251bWJlcj19IG9wdHMudXBsb2FkZWRcbiAgICogQHBhcmFtIHtudW1iZXI9fSBvcHRzLmRvd25sb2FkZWRcbiAgICogQHBhcmFtIHtudW1iZXI9fSBvcHRzLmxlZnQgKGlmIG5vdCBzZXQsIGNhbGN1bGF0ZWQgYXV0b21hdGljYWxseSlcbiAgICovXG4gIHN0YXJ0IChvcHRzID0ge30pIHtcbiAgICAvLyBkZWJ1Zygnc2VuZCBgc3RhcnRgJylcbiAgICBvcHRzID0gdGhpcy5fZGVmYXVsdEFubm91bmNlT3B0cyhvcHRzKVxuICAgIG9wdHMuZXZlbnQgPSAnc3RhcnRlZCdcbiAgICB0aGlzLl9hbm5vdW5jZShvcHRzKVxuXG4gICAgLy8gc3RhcnQgYW5ub3VuY2luZyBvbiBpbnRlcnZhbHNcbiAgICB0aGlzLl90cmFja2Vycy5mb3JFYWNoKHRyYWNrZXIgPT4ge1xuICAgICAgdHJhY2tlci5zZXRJbnRlcnZhbCgpXG4gICAgfSlcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgYHN0b3BgIGFubm91bmNlIHRvIHRoZSB0cmFja2Vycy5cbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAgICogQHBhcmFtIHtudW1iZXI9fSBvcHRzLnVwbG9hZGVkXG4gICAqIEBwYXJhbSB7bnVtYmVyPX0gb3B0cy5kb3dubG9hZGVkXG4gICAqIEBwYXJhbSB7bnVtYmVyPX0gb3B0cy5udW13YW50XG4gICAqIEBwYXJhbSB7bnVtYmVyPX0gb3B0cy5sZWZ0IChpZiBub3Qgc2V0LCBjYWxjdWxhdGVkIGF1dG9tYXRpY2FsbHkpXG4gICAqL1xuICBzdG9wIChvcHRzKSB7XG4gICAgLy8gZGVidWcoJ3NlbmQgYHN0b3BgJylcbiAgICBvcHRzID0gdGhpcy5fZGVmYXVsdEFubm91bmNlT3B0cyhvcHRzKVxuICAgIG9wdHMuZXZlbnQgPSAnc3RvcHBlZCdcbiAgICB0aGlzLl9hbm5vdW5jZShvcHRzKVxuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgYSBgY29tcGxldGVgIGFubm91bmNlIHRvIHRoZSB0cmFja2Vycy5cbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAgICogQHBhcmFtIHtudW1iZXI9fSBvcHRzLnVwbG9hZGVkXG4gICAqIEBwYXJhbSB7bnVtYmVyPX0gb3B0cy5kb3dubG9hZGVkXG4gICAqIEBwYXJhbSB7bnVtYmVyPX0gb3B0cy5udW13YW50XG4gICAqIEBwYXJhbSB7bnVtYmVyPX0gb3B0cy5sZWZ0IChpZiBub3Qgc2V0LCBjYWxjdWxhdGVkIGF1dG9tYXRpY2FsbHkpXG4gICAqL1xuICBjb21wbGV0ZSAob3B0cykge1xuICAgIC8vIGRlYnVnKCdzZW5kIGBjb21wbGV0ZWAnKVxuICAgIGlmICghb3B0cykgb3B0cyA9IHt9XG4gICAgb3B0cyA9IHRoaXMuX2RlZmF1bHRBbm5vdW5jZU9wdHMob3B0cylcbiAgICBvcHRzLmV2ZW50ID0gJ2NvbXBsZXRlZCdcbiAgICB0aGlzLl9hbm5vdW5jZShvcHRzKVxuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgYSBgdXBkYXRlYCBhbm5vdW5jZSB0byB0aGUgdHJhY2tlcnMuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzXG4gICAqIEBwYXJhbSB7bnVtYmVyPX0gb3B0cy51cGxvYWRlZFxuICAgKiBAcGFyYW0ge251bWJlcj19IG9wdHMuZG93bmxvYWRlZFxuICAgKiBAcGFyYW0ge251bWJlcj19IG9wdHMubnVtd2FudFxuICAgKiBAcGFyYW0ge251bWJlcj19IG9wdHMubGVmdCAoaWYgbm90IHNldCwgY2FsY3VsYXRlZCBhdXRvbWF0aWNhbGx5KVxuICAgKi9cbiAgdXBkYXRlIChvcHRzKSB7XG4gICAgb3B0cyA9IHRoaXMuX2RlZmF1bHRBbm5vdW5jZU9wdHMob3B0cylcbiAgICBpZiAob3B0cy5ldmVudCkgZGVsZXRlIG9wdHMuZXZlbnRcbiAgICB0aGlzLl9hbm5vdW5jZShvcHRzKVxuICB9XG5cbiAgX2Fubm91bmNlIChvcHRzKSB7XG4gICAgdGhpcy5fdHJhY2tlcnMuZm9yRWFjaCh0cmFja2VyID0+IHtcbiAgICAgIC8vIHRyYWNrZXIgc2hvdWxkIG5vdCBtb2RpZnkgYG9wdHNgIG9iamVjdCwgaXQncyBwYXNzZWQgdG8gYWxsIHRyYWNrZXJzXG4gICAgICB0cmFja2VyLmFubm91bmNlKG9wdHMpXG4gICAgfSlcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgc2NyYXBlIHJlcXVlc3QgdG8gdGhlIHRyYWNrZXJzLlxuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSBvcHRzXG4gICAqL1xuICBzY3JhcGUgKG9wdHMgPSB7fSkge1xuICAgIHRoaXMuX3RyYWNrZXJzLmZvckVhY2godHJhY2tlciA9PiB7XG4gICAgICAvLyB0cmFja2VyIHNob3VsZCBub3QgbW9kaWZ5IGBvcHRzYCBvYmplY3QsIGl0J3MgcGFzc2VkIHRvIGFsbCB0cmFja2Vyc1xuICAgICAgdHJhY2tlci5zY3JhcGUob3B0cylcbiAgICB9KVxuICB9XG5cbiAgc2V0SW50ZXJ2YWwgKGludGVydmFsTXMpIHtcbiAgICB0aGlzLl90cmFja2Vycy5mb3JFYWNoKHRyYWNrZXIgPT4ge1xuICAgICAgdHJhY2tlci5zZXRJbnRlcnZhbChpbnRlcnZhbE1zKVxuICAgIH0pXG4gIH1cblxuICBkZXN0cm95ICgpIHtcbiAgICBpZiAodGhpcy5kZXN0cm95ZWQpIHJldHVyblxuICAgIHRoaXMuZGVzdHJveWVkID0gdHJ1ZVxuICAgIGNvbnN0IHRyYWNrZXJzID0gdGhpcy5fdHJhY2tlcnNcbiAgICBsZXQgaSA9IHRyYWNrZXJzLmxlbmd0aFxuICAgIHdoaWxlIChpLS0pIHRyYWNrZXJzW2ldLmRlc3Ryb3koKVxuXG4gICAgdGhpcy5fdHJhY2tlcnMgPSBbXVxuICAgIHRoaXMuX2dldEFubm91bmNlT3B0cyA9IG51bGxcbiAgfVxuXG4gIF9kZWZhdWx0QW5ub3VuY2VPcHRzIChvcHRzID0ge30pIHtcbiAgICBpZiAoIW9wdHMubnVtd2FudCkgb3B0cy5udW13YW50ID0gNTBcbiAgICBpZiAoIW9wdHMudXBsb2FkZWQpIG9wdHMudXBsb2FkZWQgPSAwXG4gICAgaWYgKCFvcHRzLmRvd25sb2FkZWQpIG9wdHMuZG93bmxvYWRlZCA9IDBcbiAgICBpZiAodGhpcy5fZ2V0QW5ub3VuY2VPcHRzKSBvcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgb3B0cywgdGhpcy5fZ2V0QW5ub3VuY2VPcHRzKCkpXG5cbiAgICByZXR1cm4gb3B0c1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xpZW50XG4iLCJjb25zdCBUcmFja2VyID0gcmVxdWlyZSgnLi9tb2R1bGVzL2JpdHRvcnJlbnQtdHJhY2tlci9jbGllbnQnKVxuY29uc3QgY29tbW9uID0gcmVxdWlyZSgnLi9tb2R1bGVzL2NvbW1vbicpXG5cbmZ1bmN0aW9uIGpzb24ydWludChtc2cpIHtcbiAgcmV0dXJuIGNvbW1vbi50ZXh0MmFycihKU09OLnN0cmluZ2lmeShtc2cpKVxufVxuXG5mdW5jdGlvbiB1aW50Mmpzb24obXNnKSB7XG4gIHJldHVybiBKU09OLnBhcnNlKGNvbW1vbi5hcnIydGV4dChtc2cpKVxufVxuXG5hc3luYyBmdW5jdGlvbiBtYWluIChpbml0aWF0b3IpIHtcbiAgdmFyIHBlZXJJZCA9IG5ldyBVaW50OEFycmF5KFs0NSwgODcsIDg3LCA0OCwgNDgsIDUxLCA0NV0uY29uY2F0KFsuLi5BcnJheSgxMyldLm1hcChfID0+IE1hdGgucmFuZG9tKCkgKiAxNiB8IDApKSlcbiAgdmFyIGlwID0gYXdhaXQgZmV0Y2goJ2h0dHBzOi8vYXBpLmRiLWlwLmNvbS92Mi9mcmVlL3NlbGYvaXBBZGRyZXNzJykudGhlbihyID0+IHIudGV4dCgpKVxuICB2YXIgaW5mb0hhc2ggPSBhd2FpdCBjb21tb24uc2hhMShjb21tb24udGV4dDJhcnIoJ0hHRjphcHA6JyArIGlwKSlcbiAgdmFyIGFubm91bmNlID0gWyAnd3NzOi8vdHJhY2tlci5vcGVud2VidG9ycmVudC5jb20nIF1cblxuICB2YXIgdHJhY2tlciA9IG5ldyBUcmFja2VyKHtcbiAgICBpbmZvSGFzaCxcbiAgICBwZWVySWQsXG4gICAgYW5ub3VuY2VcbiAgfSlcblxuICB0cmFja2VyLnN0YXJ0KClcbiAgdHJhY2tlci5vbigncGVlcicsIGFzeW5jIHBlZXIgPT4ge1xuICAgIHdpbmRvdy5wZWVyID0gcGVlclxuICAgIHRyYWNrZXIuc3RvcCgpXG5cbiAgICBwZWVyLl9wYy5vbm5lZ290aWF0aW9ubmVlZGVkID0gYXN5bmMgZSA9PiB7XG4gICAgICBjb25zdCBvZmZlciA9IGF3YWl0IHBlZXIuX3BjLmNyZWF0ZU9mZmVyKClcblxuICAgICAgLy8gb2ZmZXIuc2RwID0gdGV4dC50cmltKClcbiAgICAgIGF3YWl0IHBlZXIuX3BjLnNldExvY2FsRGVzY3JpcHRpb24ob2ZmZXIpXG4gICAgICBwZWVyLnNlbmQoanNvbjJ1aW50KHsgb2ZmZXI6IHBlZXIuX3BjLmxvY2FsRGVzY3JpcHRpb24gfSkpXG4gICAgfVxuXG4gICAgcGVlci5fcGMub250cmFjayA9IChlKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZygnb24gdHJhY2snKVxuICAgICAgY29uc3QgeyB0cmFuc2NlaXZlciB9ID0gZVxuICAgICAgY29uc29sZS5sb2coJ29udHJhY2snLCBlKVxuICAgICAgbXNlVmlkZW8uc3JjT2JqZWN0ID0gZS5zdHJlYW1zWzBdXG4gICAgICBtc2VWaWRlby5wbGF5KClcbiAgICAgIGUucmVjZWl2ZXIuaml0dGVyQnVmZmVyRGVsYXlIaW50ID0gMTBcbiAgICB9XG5cbiAgICBwZWVyLm9uTWVzc2FnZSA9IGFzeW5jIHVpbnQgPT4ge1xuICAgICAgY29uc3QgZGF0YSA9IHVpbnQyanNvbih1aW50KVxuICAgICAgY29uc29sZS5sb2coJ21zZyBkYXRhJywgZGF0YSlcbiAgICAgIGlmIChkYXRhLm9mZmVyKSB7XG4gICAgICAgIHBlZXIuX3BjLnNldFJlbW90ZURlc2NyaXB0aW9uKGRhdGEub2ZmZXIpXG5cbiAgICAgICAgY29uc3QgYW5zd2VyID0gYXdhaXQgcGVlci5fcGMuY3JlYXRlQW5zd2VyKClcbiAgICAgICAgY29uc29sZS5sb2coJ2Fuc3dlcicsIGFuc3dlcilcbiAgICAgICAgLy8gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgLy8gICB3aW5kb3cudHJhbnNmb3JtID0gdHJhbnNmb3JtXG4gICAgICAgIC8vICAgd2luZG93LmFuc3dlciA9IGFuc3dlclxuICAgICAgICAvLyAgIHdpbmRvdy5yZXNvbHZlID0gcmVzb2x2ZVxuICAgICAgICAvLyB9KVxuXG4gICAgICAgIHBlZXIuX3BjLnNldExvY2FsRGVzY3JpcHRpb24oYW5zd2VyKVxuICAgICAgICBwZWVyLnNlbmQoanNvbjJ1aW50KHthbnN3ZXI6IHBlZXIuX3BjLmxvY2FsRGVzY3JpcHRpb259KSlcbiAgICAgIH1cbiAgICAgIGlmIChkYXRhLmFuc3dlcikge1xuICAgICAgICBhd2FpdCBwZWVyLl9wYy5zZXRSZW1vdGVEZXNjcmlwdGlvbihkYXRhLmFuc3dlcilcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaW5pdGlhdG9yKSB7XG4gICAgICB2YXIgY2FtU3RyZWFtID0gYXdhaXQgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEoeyB2aWRlbzogdHJ1ZSB9KVxuXG4gICAgICAvLyBjb25zdCBjYW52YXNTdHJlYW0gPSBjYW52YXMuY2FwdHVyZVN0cmVhbSgyMDApXG4gICAgICBjb25zb2xlLmxvZygnY2FudmFzU3RyZWFtJywgY2FtU3RyZWFtKVxuICAgICAgcGVlci5fcGMuYWRkVHJhbnNjZWl2ZXIoY2FtU3RyZWFtLmdldFRyYWNrcygpWzBdLCB7XG4gICAgICAgIHN0cmVhbXM6IFsgY2FtU3RyZWFtIF1cbiAgICAgIH0pXG4gICAgfVxuICB9KVxufVxuXG5tYWluKGxvY2F0aW9uLnNlYXJjaCA9PT0gJz9pbml0aWF0b3InKVxuXG4vLyBHbG9iYWwgc3RhdGVcbndpbmRvdy5hcHBEaWVkID0gZmFsc2U7XG53aW5kb3cubXNlVmlkZW87XG53aW5kb3cuc3JjRXFWaWRlbztcbndpbmRvdy50aGVSZWNvcmRlcjtcbndpbmRvdy5tZWRpYVNvdXJjZTtcbndpbmRvdy5zb3VyY2VCdWZmZXI7XG4iLCJcbn0pO1xuIl19
