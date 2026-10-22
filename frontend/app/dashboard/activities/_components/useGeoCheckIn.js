"use client";

import { useState } from "react";

const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

function geoErrorMessage(error) {
  if (error?.code === 1) {
    return "Location permission was denied. Allow location access in your browser and try again.";
  }
  if (error?.code === 3) return "Getting your location timed out. Please try again.";
  return "Your location is not available right now. Please try again.";
}

// Reads the device position once on request; the check-in time is the moment it is read.
export default function useGeoCheckIn() {
  const [checkIn, setCheckIn] = useState(null);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  function locate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This browser cannot share your location.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition((position) => {
      setCheckIn({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        at: new Date().toISOString(),
      });
      setLocating(false);
    }, (geoError) => {
      setError(geoErrorMessage(geoError));
      setLocating(false);
    }, GEO_OPTIONS);
  }

  return {
    checkIn, error, locating, locate,
  };
}
