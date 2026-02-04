import { useEffect, useMemo, useState } from 'react'

const toRadians = (value) => (value * Math.PI) / 180

const haversineKm = (start, end) => {
  const earthRadiusKm = 6371
  const dLat = toRadians(end[0] - start[0])
  const dLng = toRadians(end[1] - start[1])
  const lat1 = toRadians(start[0])
  const lat2 = toRadians(end[0])
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

const moveTowardTarget = (current, target, stepFactor) => {
  const [lat, lng] = current
  const [targetLat, targetLng] = target
  const nextLat = lat + (targetLat - lat) * stepFactor
  const nextLng = lng + (targetLng - lng) * stepFactor
  return [nextLat, nextLng]
}

const useSimulatedTracking = ({
  initialPosition,
  targetPosition,
  intervalMs = 3000,
  stepFactor = 0.08,
  speedKmph = 20,
}) => {
  const [position, setPosition] = useState(initialPosition)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setPosition((current) => moveTowardTarget(current, targetPosition, stepFactor))
      setLastUpdated(new Date())
    }, intervalMs)

    return () => clearInterval(timer)
  }, [intervalMs, stepFactor, targetPosition])

  const distanceKm = useMemo(
    () => haversineKm(position, targetPosition),
    [position, targetPosition],
  )
  const etaMinutes = Math.max(1, Math.round((distanceKm / speedKmph) * 60))

  return { distanceKm, etaMinutes, lastUpdated, position }
}

export default useSimulatedTracking
