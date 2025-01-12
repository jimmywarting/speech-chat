import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.5/+esm'
import Peer from 'https://jimmy.warting.se/packages/peer/perfect-negotiation.js'

Object.groupBy ??= function groupBy (iterable, callbackfn) {
  const obj = Object.create(null)
  let i = 0
  for (const value of iterable) {
    const key = callbackfn(value, i++)
    key in obj ? obj[key].push(value) : (obj[key] = [value])
  }
  return obj
}

Map.groupBy ??= function groupBy (iterable, callbackfn) {
  const map = new Map()
  let i = 0
  for (const value of iterable) {
    const key = callbackfn(value, i++), list = map.get(key)
    list ? list.push(value) : map.set(key, [value])
  }
  return map
}

const peer1 = new Peer({
  polite: location.href.includes('room'), // the peer that says you go ahead I will rollback on colision
  trickle: !true // default
})

const dataChannel = peer1.pc.createDataChannel('textChannel', {
  negotiated: true,
  id: 21,
})

// only used to signal description and candidates to the other peer
// once a connection is establish the RTCDataChannel takes over and sends signals over it
// then you can usually disconnect any websocket connection once the `peer.ready` promise resolves
//
// All the 'onnegotiationneeded' will be handled for you in our internal datachannel that's created by default
// So all the datachannels and tracks that gets added later will be handled automaticallyl by perfect negotiation
globalThis.peer1 = peer1

// peer2.signalingPort.onmessage = ({ data }) => {
//   peer1.signalingPort.postMessage(data)
// }

// _NqV463R567dc#q
// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55Zm1vd2Vuam5za2hnaWtjb3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY2MTA4ODYsImV4cCI6MjA1MjE4Njg4Nn0.-9YWeeFKV9O2QuMEwTjN8HvEbcfZdQND5GFMiUG8aAQ
// https://nyfmowenjnskhgikcorb.supabase.co

// Initialize the JS client
const SUPABASE_URL = 'https://nyfmowenjnskhgikcorb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55Zm1vd2Vuam5za2hnaWtjb3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY2MTA4ODYsImV4cCI6MjA1MjE4Njg4Nn0.-9YWeeFKV9O2QuMEwTjN8HvEbcfZdQND5GFMiUG8aAQ'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Create a function to handle inserts
const handleInserts = (payload) => {
  console.log('Change received!', payload)
}

const channel = supabase.channel('room_1')
const EVENT = 'rtc_signal'

// Subscribe to mouse events.
// Our second parameter filters only for mouse events.
// channel.on('broadcast', { event: 'rtc' }, (event) => {
//   console.log(event)
// }).subscribe()

channel.on('broadcast', { event: EVENT }, (event) => {
  const rtc = JSON.parse(event.payload)
  peer1.signalingPort.postMessage(rtc)
  peer1.signalingPort.onmessage ??= ({ data }) => {
    channel.send({
      type: 'broadcast',
      event: EVENT,
      payload: data,
    })
  }
}).subscribe()

if (location.href.includes('room')) {
  setTimeout(() => {
    peer1.signalingPort.onmessage = ({ data }) => {
      channel.send({
        type: 'broadcast',
        event: EVENT,
        payload: data
      })
    }
  }, 1000)
}

await peer1.ready
channel.unsubscribe()
peer1.signalingPort.onmessage = null
peer1.signalingPort = null

let recognition

if (speechSynthesis.getVoices().length === 0) {
  await speechSynthesis.when('voiceschanged').first()
}

const voices = [...speechSynthesis.getVoices()]

// UI Elements
const voiceSelect = document.getElementById('voiceSelect')
const pitchInput = document.getElementById('pitch')
const rateInput = document.getElementById('rate')
const startButton = document.getElementById('startRecognition')
const log = document.getElementById('log')

// Populate voice options
const populateVoices = () => {
  const copy = voices.map((voice, key) => ({voice, key}))
  console.log(copy)
  const group = Object.groupBy(copy, (v) => v.voice.lang)
  for (const [lang, voices] of Object.entries(group)) {
    const optgroup = document.createElement('optgroup')
    optgroup.label = lang
    voiceSelect.appendChild(optgroup)

    for (const {voice, key} of voices) {
      const option = document.createElement('option')
      option.value = key
      option.textContent = voice.name
      optgroup.appendChild(option)
    }
  }
}
populateVoices()
setupRecognition()

voiceSelect.onchange = () => {
  setupRecognition()
}

function setupRecognition() {
  let hadIt = false
  if (recognition) {
    recognition.onresult = null
    recognition.onend = null
    recognition.stop()
    hadIt = true
  }

  recognition = new webkitSpeechRecognition()
  // Speech Recognition Setup
  recognition.lang = voices[voiceSelect.value].lang
  recognition.continuous = true
  recognition.interimResults = false
  recognition.onresult = (event) => {
    const results = [...event.results]
    const transcript = results.at(-1)[0].transcript
    log.value += `${(~~(performance.now() / 100)).toLocaleString() + 's'} You: ${transcript}\n`
    sendText(transcript, recognition.lang)
  }
  recognition.onend = () => {
    console.log('Speech recognition ended')
    recognition.start()
  }

  if (hadIt) {
    recognition.start()
  }
}

startButton.onclick = () => recognition.start()



dataChannel.onopen = () => console.log('DataChannel open')
dataChannel.onmessage = (e) => handleReceivedText(JSON.parse(e.data))

const sendText = (text, langSource) => {
  if (dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({text, langSource}))
  }
}

// Handle Received Text
const handleReceivedText = async (data) => {
  log.value += `${(~~(performance.now() / 100)).toLocaleString() + 's'} Hen: ${data.text}\n`

  console.log(data)
  console.log(voices[voiceSelect.value])
  if (data.langSource === voices[voiceSelect.value].lang) {
    speak(data.text)
  } else {
    const translatedText = await translateText(data.text, data.langSource)
    log.value += `Translation: ${translatedText}\n`
    speak(translatedText)
  }
}

/**
 * Decodes HTML entities in a string
 * @param {string} str - The string with HTML entities
 * @returns {string} - The decoded string
 */
export function decodeHtmlEntities(str) {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = str
  return textarea.value
}

// Text Translation Function (Mock Example, Replace with Real API)
const translateText = async (text, source) => {
  const target = voices[voiceSelect.value].lang
  const key = new URL(location.href).searchParams.get('key')
  return fetch("https://translation.googleapis.com/language/translate/v2?key=" + key, {
    "headers": {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      q: text,
      target,
      source
    }),
    method: "POST"
  }).then(response => response.json())
    .then(json => {
      console.log(json.data.translations)
      return decodeHtmlEntities(json.data.translations[0].translatedText)
    })
}

// Play incoming audio
peer1.pc.ontrack = (event) => {
  console.log(event.streams)
}

// Get local audio stream
const localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
setTimeout(() => {
  localStream.getTracks().forEach(track => peer1.pc.addTrack(track, localStream))
}, 1000)

async function logBandwidthStats(peerConnection) {
  const stats = await peerConnection.getStats()

  // Rensa gamla värden i DOM
  const audioStatsEl = document.getElementById('audioStats')
  const dataChannelStatsEl = document.getElementById('dataChannelStats')
  audioStatsEl.innerHTML = ''
  dataChannelStatsEl.innerHTML = ''

  stats.forEach(report => {
    if (report.type === 'outbound-rtp' && report.kind === 'audio') {
      const audioStats = `
        <p><strong>Audio Bandwidth Usage (Outgoing):</strong></p>
        <ul>
          <li>Bytes Sent: ${report.bytesSent.toLocaleString()}</li>
          <li>Packets Sent: ${report.packetsSent.toLocaleString()}</li>
          <li>Bitrate: ${(report.bytesSent * 8 / 1000).toFixed(2)} kbps</li>
        </ul>
      `
      audioStatsEl.innerHTML += audioStats
    } else if (report.type === 'inbound-rtp' && report.kind === 'audio') {
      const audioStats = `
        <p><strong>Audio Bandwidth Usage (Incoming):</strong></p>
        <ul>
          <li>Bytes Received: ${report.bytesReceived.toLocaleString()}</li>
          <li>Packets Received: ${report.packetsReceived.toLocaleString()}</li>
          <li>Bitrate: ${(report.bytesReceived * 8 / 1000).toFixed(2)} kbps</li>
        </ul>
      `
      audioStatsEl.innerHTML += audioStats
    } else if (report.label === 'textChannel') {
      const dataChannelStats = `
        <p><strong>Data Channel Bandwidth Usage:</strong></p>
        <ul>
          <li>Bytes Sent: ${report.bytesSent}</li>
          <li>Bytes Received: ${report.bytesReceived}</li>
        </ul>
      `
      dataChannelStatsEl.innerHTML += dataChannelStats
    }
  })
}




setInterval(() => {
  logBandwidthStats(peer1.pc)
}, 1000)

globalThis.translate = translateText
console.log(voices[voiceSelect.value])
// Text-to-Speech Function
const speak = (text) => {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voices[voiceSelect.value]
  utterance.pitch = pitchInput.valueAsNumber
  utterance.rate = rateInput.valueAsNumber
  speechSynthesis.speak(utterance)
}

export { }