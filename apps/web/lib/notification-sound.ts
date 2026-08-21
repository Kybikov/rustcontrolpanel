const preferenceKey = "rustcontrol.notification-sound"
let context: AudioContext | null = null

export function notificationSoundEnabled() {
  return (
    typeof window !== "undefined" &&
    localStorage.getItem(preferenceKey) === "true"
  )
}

export async function setNotificationSoundEnabled(enabled: boolean) {
  localStorage.setItem(preferenceKey, String(enabled))
  if (enabled) await audioContext()
}

export function playNotificationSound() {
  if (!notificationSoundEnabled()) return
  void audioContext().then((audio) => {
    if (audio.state !== "running") return
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(660, audio.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(
      880,
      audio.currentTime + 0.09
    )
    gain.gain.setValueAtTime(0.0001, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.05, audio.currentTime + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18)
    oscillator.connect(gain).connect(audio.destination)
    oscillator.start()
    oscillator.stop(audio.currentTime + 0.2)
  })
}

async function audioContext() {
  if (!context) context = new AudioContext()
  if (context.state === "suspended") await context.resume()
  return context
}
