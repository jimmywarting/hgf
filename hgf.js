window.webcams = new WeakMap()

function json2uint(msg) {
  return common.text2arr(JSON.stringify(msg))
}

function uint2json(msg) {
  return JSON.parse(common.arr2text(msg))
}

const connectedPeers = {
  // peerId: peer
}

let isSharing = false
let stream

async function main (initiator) {
  var peerId = new Uint8Array([45, 87, 87, 48, 48, 51, 45].concat([...Array(13)].map(_ => Math.random() * 16 | 0)))
  var ip = await fetch('https://api.db-ip.com/v2/free/self/ipAddress').then(r => r.text())
  var infoHash = await common.sha1(common.text2arr('HGF:app:' + ip))
  var announce = [ 'wss://tracker.openwebtorrent.com' ]

  var tracker = new Tracker({
    infoHash,
    peerId,
    announce,
    filter (peerId) {
      return !(peerId in connectedPeers)
    }
  })

  let nr = 0
  tracker.start()
  tracker.on('newListener', (a,b,c) => console.log('b'))
  tracker.on('peer', async peer => {
    peer.nr = nr++

    isSharing && setTimeout(shareSnapshot, 1000)

    connectedPeers[peer.id] = peer

    log.innerText += `\nfound peer#${peer.nr} (${peer.id})`

    peer.onDestroy = function() {
      log.innerText += `\npeer#${peer.nr} destroyed (${peer.id})`
      delete connectedPeers[peer.id]
      log.innerText += `\nyou are now connected to ${
        Object.keys(connectedPeers).length
      } peers`
      const el = webcams.get(peer)
      el && el.remove()
      webcams.delete(peer)
    }

    peer._pc.onnegotiationneeded = async e => {
      const offer = await peer._pc.createOffer()
      await peer._pc.setLocalDescription(offer)
      peer.send(json2uint({ offer: peer._pc.localDescription }))
    }

    peer._pc.ontrack = evt => {
      const tpl = webcams.get(peer)
      const video = tpl.querySelector('video')
      const delay = tpl.querySelector('input')
      const { receiver, streams } = evt
      video.srcObject = streams[0]
      video.play()
      delay.onchange = () => receiver.jitterBufferDelayHint = delay.valueAsNumber
    }

    peer.onMessage = async uint => {
      const data = uint2json(uint)
      console.log('msg data', data)

      if (data.share) {
        peer._pc.addTransceiver(stream.getTracks()[0], {
          streams: [ stream ]
        })
      }

      if (data.snapshot) {
        const snapshot = data.snapshot

        let webcamClone
        if (webcams.get(peer)) {
          webcamClone = webcams.get(peer)
        } else {
          webcamClone = document.importNode(webcamItem.content, true).children[0]
          webcamClone.querySelector('button').onclick = () => {
            peer.send(json2uint({ share: true }))
          }
        }

        const video = webcamClone.querySelector('video')
        video.poster = snapshot
        album.appendChild(webcamClone)
        webcams.set(peer, webcamClone)
        return
      }

      if (data.offer) {
        peer._pc.setRemoteDescription(data.offer)

        const answer = await peer._pc.createAnswer()
        console.log('answer', answer)
        peer._pc.setLocalDescription(answer)
        peer.send(json2uint({answer: peer._pc.localDescription}))
      }
      if (data.answer) {
        await peer._pc.setRemoteDescription(data.answer)
      }
    }
  })
}

main()

function shareSnapshot() {
  log.innerText += '\nsharing screenshot'
  let mySnapshot = ''

  let myStream =
    document
    .querySelector('video, canvas')

  if (myStream.matches('video')) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.height = myStream.height
    canvas.width = myStream.width
    ctx.drawImage(myStream, 0, 0, canvas.width, canvas.height)
    myStream = canvas
  }

  mySnapshot = myStream.toDataURL('image/webp')

  for (const peer of Object.values(connectedPeers)) {
    peer.send(json2uint({
      snapshot: mySnapshot
    }))
  }
}

window.streamClock = async evt => {
  const { target } = evt
  const { Clock } = await import('./clock.js')
  const clock = new Clock()
  target.closest('.container').replaceWith(clock.canvas)
  stream = clock.canvas.captureStream(200)
  isSharing = true
  shareSnapshot()
}

window.streamCamera = async evt => {
  const { target } = evt
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' }
  })
  isSharing = true
  const video = document.createElement('video')
  target.closest('.container').replaceWith(video)
  video.srcObject = stream
  video.muted = true
  video.onloadedmetadata = () => {
    video.play()
    setTimeout(shareSnapshot, 1000)
  }
}

window.onerror = message => {
  log.innerText += `\n${message}`
}

log.innerText += `7`
