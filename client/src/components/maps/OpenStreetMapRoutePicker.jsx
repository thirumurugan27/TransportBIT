import React, {useMemo, useState} from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  Search,
  Sparkles,
  Route,
  LocateFixed,
  CornerDownRight,
  Clock3,
} from "lucide-react";

// Sathyamangalam, Erode (default focus)
const DEFAULT_CENTER = [11.5059, 77.2389];

const startIcon = new L.DivIcon({
  className: "custom-start-marker",
  html: '<div style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;box-shadow:0 4px 12px rgba(16, 185, 129, 0.4);border:3px solid white;font-family:system-ui,-apple-system,sans-serif">S</div>',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const endIcon = new L.DivIcon({
  className: "custom-end-marker",
  html: '<div style="background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;box-shadow:0 4px 12px rgba(239, 68, 68, 0.4);border:3px solid white;font-family:system-ui,-apple-system,sans-serif">E</div>',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const TILE_PROVIDERS = [
  {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
  },
];

function SmartTileLayer() {
  const [providerIndex, setProviderIndex] = useState(0);
  const provider = TILE_PROVIDERS[providerIndex];

  return (
    <TileLayer
      key={provider.url}
      attribution={provider.attribution}
      url={provider.url}
      eventHandlers={{
        tileerror: () => {
          setProviderIndex((prev) =>
            prev < TILE_PROVIDERS.length - 1 ? prev + 1 : prev,
          );
        },
      }}
    />
  );
}

function MapClickHandler({activePin, onPick}) {
  useMapEvents({
    click: async (e) => {
      if (!activePin) return;

      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      let place = "";

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        );
        const data = await res.json();
        place = data?.display_name || "";
      } catch {
        place = "";
      }

      onPick(activePin, {
        location: place,
        latitude: lat,
        longitude: lng,
      });
    },
  });

  return null;
}

function FitToRoute({points}) {
  const map = useMap();

  React.useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14, {animate: true});
      return;
    }
    map.fitBounds(points, {padding: [32, 32]});
  }, [map, points]);

  return null;
}

function useDebouncedValue(value, delay = 280) {
  const [debounced, setDebounced] = useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function buildPhotonLabel(properties = {}) {
  const primaryParts = [properties.name, properties.street].filter(Boolean);
  const secondaryParts = [
    properties.district,
    properties.city,
    properties.state,
    properties.country,
  ].filter(Boolean);

  return {
    title: primaryParts.join(", ") || properties.name || "Unknown place",
    subtitle: secondaryParts.join(", "),
  };
}

function usePhotonSuggestions(query, enabled) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const q = query.trim();
      if (!enabled || q.length < 2) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?lang=en&limit=5&lat=11.5059&lon=77.2389&q=${encodeURIComponent(q)}`,
        );
        const data = await res.json();

        if (!cancelled) {
          const mapped = Array.isArray(data?.features)
            ? data.features
                .filter((feature) =>
                  Array.isArray(feature?.geometry?.coordinates),
                )
                .map((feature, idx) => {
                  const [lon, lat] = feature.geometry.coordinates;
                  const props = feature.properties || {};
                  const {title, subtitle} = buildPhotonLabel(props);

                  return {
                    place_id: props.osm_id || `${title}-${idx}`,
                    title,
                    subtitle,
                    display_name: [title, subtitle].filter(Boolean).join(", "),
                    lat: Number(lat),
                    lon: Number(lon),
                  };
                })
                .slice(0, 5)
            : [];

          setSuggestions(mapped);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [enabled, query]);

  return {suggestions, loading, setSuggestions};
}

function SuggestionInput({
  id,
  label,
  manualValue,
  onManualChange,
  searchValue,
  onSearchChange,
  onSelectSuggestion,
  suggestions,
  loading,
  selectedMapName,
  activePin,
  setActivePin,
  showSuggestions,
  setShowSuggestions,
}) {
  return (
    <div className="relative space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <label className="block text-xs font-bold text-primarytext uppercase tracking-wider mb-2.5">
        {label}
      </label>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-gray-700">
          Custom Name (Optional)
        </p>
        <input
          type="text"
          value={manualValue}
          onChange={(e) => onManualChange(e.target.value)}
          placeholder="e.g., Office, Home, Campus..."
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-primarytext placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          autoComplete="off"
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-gray-700">Search Place</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
          <input
            id={id}
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => {
              setActivePin(id);
              setShowSuggestions(true);
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 140);
            }}
            placeholder="Search address or location"
            className="w-full pl-9 pr-24 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-primarytext placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setActivePin(id)}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
              activePin === id
                ? "bg-primary text-white border-primary shadow-md"
                : "bg-white text-primarytext border-gray-300 hover:bg-gray-50"
            }`}
          >
            On Map
          </button>
        </div>
      </div>

      {selectedMapName ? (
        <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg flex items-start gap-2">
          <Sparkles size={13} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Location Set</p>
            <p className="text-emerald-600 line-clamp-1">{selectedMapName}</p>
          </div>
        </div>
      ) : null}

      {showSuggestions && (loading || suggestions.length > 0) && (
        <div
          className="absolute mt-1 w-full bg-white border border-gray-200 rounded-md shadow-xl overflow-hidden"
          style={{zIndex: 1200}}
        >
          {loading ? (
            <div className="px-3 py-2 text-xs text-secondarytext">
              Searching...
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={`${id}-${s.place_id}`}
                  type="button"
                  onClick={() => onSelectSuggestion(s)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-primarybg transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <p className="font-medium text-primarytext line-clamp-1">
                    {s.title || s.display_name}
                  </p>
                  {s.subtitle ? (
                    <p className="text-[11px] text-secondarytext mt-0.5 line-clamp-1">
                      {s.subtitle}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {Number(s.lat).toFixed(5)}, {Number(s.lon).toFixed(5)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OpenStreetMapRoutePicker({
  departureLocation,
  departureLatitude,
  departureLongitude,
  arrivalLocation,
  arrivalLatitude,
  arrivalLongitude,
  onChange,
}) {
  const [activePin, setActivePin] = useState("start");

  const [manualStart, setManualStart] = useState(departureLocation || "");
  const [manualEnd, setManualEnd] = useState(arrivalLocation || "");
  const [searchStart, setSearchStart] = useState("");
  const [searchEnd, setSearchEnd] = useState("");
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [showEndSuggestions, setShowEndSuggestions] = useState(false);
  const [selectedStartMapName, setSelectedStartMapName] = useState("");
  const [selectedEndMapName, setSelectedEndMapName] = useState("");

  React.useEffect(() => {
    setManualStart(departureLocation || "");
  }, [departureLocation]);

  React.useEffect(() => {
    setManualEnd(arrivalLocation || "");
  }, [arrivalLocation]);

  const debouncedStart = useDebouncedValue(searchStart);
  const debouncedEnd = useDebouncedValue(searchEnd);

  const {
    suggestions: startSuggestions,
    loading: searchingStart,
    setSuggestions: setStartSuggestions,
  } = usePhotonSuggestions(debouncedStart, activePin === "start");

  const {
    suggestions: endSuggestions,
    loading: searchingEnd,
    setSuggestions: setEndSuggestions,
  } = usePhotonSuggestions(debouncedEnd, activePin === "end");

  const routePoints = useMemo(() => {
    const points = [];
    const startLat = Number(departureLatitude);
    const startLng = Number(departureLongitude);
    const endLat = Number(arrivalLatitude);
    const endLng = Number(arrivalLongitude);

    if (Number.isFinite(startLat) && Number.isFinite(startLng)) {
      points.push([startLat, startLng]);
    }
    if (Number.isFinite(endLat) && Number.isFinite(endLng)) {
      points.push([endLat, endLng]);
    }

    return points;
  }, [
    departureLatitude,
    departureLongitude,
    arrivalLatitude,
    arrivalLongitude,
  ]);

  const mapCenter = useMemo(() => {
    if (routePoints.length > 0) return routePoints[0];
    return DEFAULT_CENTER;
  }, [routePoints]);

  const [routeGeometry, setRouteGeometry] = useState([]);
  const [routingError, setRoutingError] = useState("");
  const [routeMetrics, setRouteMetrics] = useState(null);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setRoutingError("");
      if (routePoints.length < 2) {
        setRouteGeometry([]);
        setRouteMetrics(null);
        return;
      }

      try {
        const [from, to] = routePoints;
        const coordinates = `${from[1]},${from[0]};${to[1]},${to[0]}`;
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
        );
        const data = await res.json();
        const route = data?.routes?.[0];
        const geometry = data?.routes?.[0]?.geometry?.coordinates || [];
        const latLng = geometry.map(([lon, lat]) => [lat, lon]);

        if (!cancelled) {
          setRouteGeometry(Array.isArray(latLng) ? latLng : []);
          if (route?.distance && route?.duration) {
            setRouteMetrics({
              distanceKm: route.distance / 1000,
              durationMin: route.duration / 60,
            });
          } else {
            setRouteMetrics(null);
          }

          if (!latLng.length) {
            setRoutingError(
              "Real road route not available. Showing straight path.",
            );
          }
        }
      } catch {
        if (!cancelled) {
          setRouteGeometry([]);
          setRouteMetrics(null);
          setRoutingError(
            "Routing service unavailable. Showing straight path.",
          );
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [routePoints]);

  const applyLocation = (type, data) => {
    if (type === "start") {
      onChange({
        departureLocation: manualStart,
        departureLatitude: data.latitude,
        departureLongitude: data.longitude,
      });
      setStartSuggestions([]);
      setSelectedStartMapName(data.location || "");
      setSearchStart("");
      setShowStartSuggestions(false);
      return;
    }

    onChange({
      arrivalLocation: manualEnd,
      arrivalLatitude: data.latitude,
      arrivalLongitude: data.longitude,
    });
    setEndSuggestions([]);
    setSelectedEndMapName(data.location || "");
    setSearchEnd("");
    setShowEndSuggestions(false);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-visible shadow-md">
      <div className="px-4 py-3.5 border-b border-gray-200 bg-blue-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route size={16} className="text-primary" />
          <p className="text-sm font-bold text-primarytext">Route Planner</p>
        </div>
        <div className="text-[11px] text-primarytext flex items-center gap-1.5">
          <LocateFixed size={12} />
          <span className="font-medium">
            {activePin === "start" ? "📍 Setting Start" : "📍 Setting End"}
          </span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 relative z-30">
        <SuggestionInput
          id="start"
          label="Starting Place"
          manualValue={manualStart}
          onManualChange={(text) => {
            setManualStart(text);
            onChange({
              departureLocation: text,
            });
          }}
          searchValue={searchStart}
          onSearchChange={(text) => {
            setSearchStart(text);
            setActivePin("start");
            setShowStartSuggestions(true);
          }}
          onSelectSuggestion={(s) =>
            applyLocation("start", {
              location: s.display_name,
              latitude: Number(s.lat),
              longitude: Number(s.lon),
            })
          }
          suggestions={startSuggestions}
          loading={searchingStart}
          selectedMapName={selectedStartMapName}
          activePin={activePin}
          setActivePin={setActivePin}
          showSuggestions={showStartSuggestions}
          setShowSuggestions={setShowStartSuggestions}
        />

        <SuggestionInput
          id="end"
          label="Ending Place"
          manualValue={manualEnd}
          onManualChange={(text) => {
            setManualEnd(text);
            onChange({
              arrivalLocation: text,
            });
          }}
          searchValue={searchEnd}
          onSearchChange={(text) => {
            setSearchEnd(text);
            setActivePin("end");
            setShowEndSuggestions(true);
          }}
          onSelectSuggestion={(s) =>
            applyLocation("end", {
              location: s.display_name,
              latitude: Number(s.lat),
              longitude: Number(s.lon),
            })
          }
          suggestions={endSuggestions}
          loading={searchingEnd}
          selectedMapName={selectedEndMapName}
          activePin={activePin}
          setActivePin={setActivePin}
          showSuggestions={showEndSuggestions}
          setShowSuggestions={setShowEndSuggestions}
        />
      </div>

      <div className="px-4 pb-4 relative z-0">
        <div className="rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
          <MapContainer
            center={mapCenter}
            zoom={12}
            scrollWheelZoom
            style={{height: 320, width: "100%"}}
          >
            <SmartTileLayer />
            <FitToRoute points={routePoints} />
            <MapClickHandler
              activePin={activePin}
              onPick={(type, data) => applyLocation(type, data)}
            />

            {Number.isFinite(departureLatitude) &&
              Number.isFinite(departureLongitude) && (
                <Marker
                  position={[departureLatitude, departureLongitude]}
                  icon={startIcon}
                >
                  <Popup>
                    <div className="space-y-1">
                      <p className="font-semibold">Start</p>
                      <p>{departureLocation || "Selected start"}</p>
                    </div>
                  </Popup>
                </Marker>
              )}

            {Number.isFinite(arrivalLatitude) &&
              Number.isFinite(arrivalLongitude) && (
                <Marker
                  position={[arrivalLatitude, arrivalLongitude]}
                  icon={endIcon}
                >
                  <Popup>
                    <div className="space-y-1">
                      <p className="font-semibold">End</p>
                      <p>{arrivalLocation || "Selected destination"}</p>
                    </div>
                  </Popup>
                </Marker>
              )}

            {routePoints.length >= 2 && (
              <Polyline
                positions={
                  routeGeometry.length >= 2 ? routeGeometry : routePoints
                }
                pathOptions={{color: "#1769e0", weight: 5, opacity: 0.85}}
              />
            )}
          </MapContainer>
        </div>

        {routeMetrics ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
              <Route size={12} />
              {routeMetrics.distanceKm.toFixed(2)} km
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              <Clock3 size={12} />
              {Math.round(routeMetrics.durationMin)} min
            </span>
          </div>
        ) : null}

        {routingError ? (
          <p className="mt-2 text-[11px] text-amber-600">{routingError}</p>
        ) : null}

        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-secondarytext">
          <p className="flex items-center gap-1.5">
            <CornerDownRight size={12} className="text-green" />
            Start:{" "}
            {Number.isFinite(departureLatitude)
              ? `${departureLatitude.toFixed(6)}, ${departureLongitude.toFixed(6)}`
              : "Not set"}
          </p>
          <p className="flex items-center gap-1.5">
            <CornerDownRight size={12} className="text-red" />
            End:{" "}
            {Number.isFinite(arrivalLatitude)
              ? `${arrivalLatitude.toFixed(6)}, ${arrivalLongitude.toFixed(6)}`
              : "Not set"}
          </p>
        </div>
      </div>
    </div>
  );
}
