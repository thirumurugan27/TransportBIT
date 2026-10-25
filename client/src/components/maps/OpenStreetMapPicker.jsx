import React, {useMemo, useState} from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {MapPin, Navigation, Search, X, Sparkles} from "lucide-react";

const DEFAULT_CENTER = [11.3428, 77.7282]; // BIT, Sathyamangalam

const markerIcon = new L.DivIcon({
  className: "custom-location-marker",
  html: '<div style="background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;box-shadow:0 4px 12px rgba(59, 130, 246, 0.4);border:3px solid white;font-family:system-ui,-apple-system,sans-serif">📍</div>',
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
  {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, style: &copy; OpenTopoMap',
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
          setProviderIndex((prev) => {
            if (prev >= TILE_PROVIDERS.length - 1) return prev;
            return prev + 1;
          });
        },
      }}
    />
  );
}

function RecenterMap({center}) {
  const map = useMap();
  React.useEffect(() => {
    if (Array.isArray(center) && center.length === 2) {
      map.setView(center, map.getZoom(), {animate: true});
    }
  }, [center, map]);
  return null;
}

function ClickHandler({onSelect}) {
  useMapEvents({
    click: async (e) => {
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

      onSelect({lat, lng, place});
    },
  });
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
          `https://photon.komoot.io/api/?lang=en&limit=5&lat=11.3428&lon=77.7282&q=${encodeURIComponent(q)}`,
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

export default function OpenStreetMapPicker({
  label,
  value,
  latitude,
  longitude,
  onChange,
  placeholder = "Search location...",
  required = false,
}) {
  const [showMap, setShowMap] = useState(false);
  const [search, setSearch] = useState(value || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");
  const [mapLocationName, setMapLocationName] = useState("");

  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

  React.useEffect(() => {
    setSearch(value || "");
  }, [value]);

  const debouncedSearch = useDebouncedValue(search);
  const {suggestions, loading} = usePhotonSuggestions(
    debouncedSearch,
    showSuggestions,
  );

  const initialCenter = useMemo(() => {
    if (hasCoords) {
      return [latitude, longitude];
    }
    return DEFAULT_CENTER;
  }, [hasCoords, latitude, longitude]);

  const handleSelectSuggestion = (suggestion) => {
    onChange({
      location: search || suggestion.display_name,
      latitude: suggestion.lat,
      longitude: suggestion.lon,
    });
    setMapLocationName(suggestion.display_name);
    setShowSuggestions(false);
    setError("");
  };

  const handleMapSelect = ({lat, lng, place}) => {
    onChange({
      location: search || place || value || "",
      latitude: lat,
      longitude: lng,
    });
    setMapLocationName(place || "");
    setShowMap(false);
    setError("");
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-bold text-primarytext uppercase tracking-wider mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowSuggestions(true);
              setError("");
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 140);
            }}
            placeholder={placeholder}
            className="w-full pl-9 pr-28 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-primarytext placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />

          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1">
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-all shadow-sm"
            >
              Map
            </button>
          </div>
        </div>

        {showSuggestions && (loading || suggestions.length > 0) && (
          <div
            className="absolute mt-1 left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
            style={{zIndex: 1200}}
          >
            {loading ? (
              <div className="px-3 py-2 text-xs text-secondarytext">
                Searching...
              </div>
            ) : suggestions.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.place_id}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    <p className="font-medium text-primarytext line-clamp-1">
                      {s.title}
                    </p>
                    {s.subtitle && (
                      <p className="text-[11px] text-secondarytext mt-0.5 line-clamp-1">
                        {s.subtitle}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {Number(s.lat).toFixed(5)}, {Number(s.lon).toFixed(5)}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {hasCoords && (
          <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg flex items-start gap-2">
            <Sparkles size={13} className="mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Location Set</p>
              {value && (
                <p className="text-emerald-600 font-medium line-clamp-1">
                  {value}
                </p>
              )}
              {mapLocationName && (
                <p className="text-emerald-600 text-[10px] mt-0.5 line-clamp-1">
                  📍 {mapLocationName}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {hasCoords && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <MapContainer
            center={[latitude, longitude]}
            zoom={14}
            scrollWheelZoom={false}
            style={{height: 200, width: "100%"}}
          >
            <SmartTileLayer />
            <Marker position={[latitude, longitude]} icon={markerIcon}>
              <Popup>
                <div className="space-y-1">
                  {value && (
                    <div>
                      <p className="font-bold text-blue-700 text-sm">{value}</p>
                    </div>
                  )}
                  {mapLocationName && (
                    <div>
                      <p className="text-xs text-gray-600 leading-tight">
                        {mapLocationName}
                      </p>
                    </div>
                  )}
                  {!value && !mapLocationName && (
                    <p className="text-sm font-medium text-gray-700">
                      Selected location
                    </p>
                  )}
                  <p className="text-xs text-gray-500 pt-1 border-t border-gray-200 mt-1">
                    {latitude.toFixed(5)}, {longitude.toFixed(5)}
                  </p>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
          <div className="px-3 py-3 bg-blue-50 border-t border-gray-200 text-xs text-primarytext flex items-center gap-2 font-semibold">
            <Navigation size={12} />
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </div>
        </div>
      )}

      {showMap && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200 bg-blue-50">
              <h3 className="font-bold text-primarytext">
                Pick Location from Map
              </h3>
              <button
                type="button"
                onClick={() => setShowMap(false)}
                className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-secondarytext font-medium">
                📍 Click on the map to select a location
              </p>

              <div className="rounded-lg overflow-hidden border border-gray-200 bg-white">
                <MapContainer
                  center={initialCenter}
                  zoom={12}
                  scrollWheelZoom
                  style={{height: 420, width: "100%"}}
                >
                  <SmartTileLayer />
                  <RecenterMap center={initialCenter} />
                  <ClickHandler onSelect={handleMapSelect} />
                  {hasCoords && (
                    <Marker position={[latitude, longitude]} icon={markerIcon}>
                      <Popup>
                        <div className="space-y-1">
                          {value && (
                            <div>
                              <p className="font-bold text-blue-700 text-sm">
                                {value}
                              </p>
                            </div>
                          )}
                          {mapLocationName && (
                            <div>
                              <p className="text-xs text-gray-600 leading-tight">
                                {mapLocationName}
                              </p>
                            </div>
                          )}
                          {!value && !mapLocationName && (
                            <p className="text-sm font-medium text-gray-700">
                              Selected location
                            </p>
                          )}
                          <p className="text-xs text-gray-500 pt-1 border-t border-gray-200 mt-1">
                            {latitude.toFixed(5)}, {longitude.toFixed(5)}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMap(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-primarytext font-medium hover:bg-gray-100 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
