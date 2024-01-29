async function delay(duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

function truncateText(text, desiredLength) {
  if (Buffer.byteLength(text) < desiredLength) {
    return text
  } else {
    const enc = new TextEncoder()
    const dec = new TextDecoder('utf-8')
    const uint8 = enc.encode(text)
    const section = uint8.slice(0, desiredLength)
    const result = dec.decode(section)
    const out = result.replace(/\uFFFD/g, '')
    return out
  }
}

module.exports = {
  delay,
  truncateText
}
