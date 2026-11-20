"use client";
import { useEffect, useRef, useState } from "react";
import type { GeoPoint } from "@/lib/types";

/**
 * Captures GPS coordinates from the device. If the browser refuses (or there is no GPS, e.g. a desktop),
 * the person can type coordinates instead so the flow is never blocked.
 */
export function LocationPicker({
  onChange,
}: {
  onChange: (p: GeoPoint | null) => void;
}) {
  const [state, setState] = useState<"locating" | "ok" | "failed">("locating");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [accuracy, setAccuracy] = useState<number | undefined>();
  const cb = useRef(onChange);
  cb.current = onChange;

  function locate() {
    setState("locating");
    if (!("geolocation" in navigator)) {
      setState("failed");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setAccuracy(Math.round(pos.coords.accuracy));
        setState("ok");
      },
      () => setState("failed"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }
  useEffect(locate, []);

  useEffect(() => {
    const a = parseFloat(lat),
      b = parseFloat(lng);
    const valid =
      lat !== "" &&
      lng !== "" &&
      Math.abs(a) <= 90 &&
      Math.abs(b) <= 180 &&
      !Number.isNaN(a) &&
      !Number.isNaN(b);
    cb.current(
      valid
        ? { lat: a, lng: b, ...(accuracy !== undefined ? { accuracy } : {}) }
        : null,
    );
  }, [lat, lng, accuracy]);

  return (
    <fieldset
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "0.8rem",
      }}
    >
      <legend style={{ fontWeight: 600, padding: "0 0.3rem" }}>
        Your location
      </legend>
      {state === "locating" && (
        <p className="muted" role="status">
          Finding your location…
        </p>
      )}
      {state === "ok" && (
        <p className="small muted" role="status">
          Location captured{accuracy ? `, accurate to about ${accuracy} m` : ""}
          .
        </p>
      )}
      {state === "failed" && (
        <p className="notice small" role="status">
          We could not read your location. Allow location access and retry, or
          enter coordinates below.
        </p>
      )}
      <div className="form-grid" style={{ marginTop: "0.6rem" }}>
        <label className="field">
          <span>Latitude</span>
          <input
            inputMode="decimal"
            value={lat}
            onChange={(e) => {
              setLat(e.target.value);
              setAccuracy(undefined);
            }}
            placeholder="28.459500"
          />
        </label>
        <label className="field">
          <span>Longitude</span>
          <input
            inputMode="decimal"
            value={lng}
            onChange={(e) => {
              setLng(e.target.value);
              setAccuracy(undefined);
            }}
            placeholder="77.026600"
          />
        </label>
      </div>
      <button
        type="button"
        className="btn btn-quiet"
        style={{ marginTop: "0.4rem" }}
        onClick={locate}
      >
        Use my location again
      </button>
    </fieldset>
  );
}
