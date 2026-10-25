import React, {useMemo} from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import {Clock3, Route} from "lucide-react";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
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
  const [providerIndex, setProviderIndex] = React.useState(0);
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

function FitBounds({points}) {
  const map = useMap();

  React.useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, {padding: [24, 24]});
    } else if (points.length === 1) {
      map.setView(points[0], 14, {animate: false});
    }
  }, [map, points]);

  return null;
}

function buildPointsFromTrips(trips = []) {
  const points = [];

  trips.forEach((trip) => {
    const fromLat = Number(trip?.departure_latitude);
    const fromLng = Number(trip?.departure_longitude);
    const toLat = Number(trip?.arrival_latitude);
    const toLng = Number(trip?.arrival_longitude);

    if (Number.isFinite(fromLat) && Number.isFinite(fromLng)) {
      points.push({
        type: "departure",
        label: trip?.departure_location || "Departure",
        coords: [fromLat, fromLng],
      });
    }

    if (Number.isFinite(toLat) && Number.isFinite(toLng)) {
      points.push({
        type: "arrival",
        label: trip?.arrival_location || "Arrival",
        coords: [toLat, toLng],
      });
    }
  });

  // Remove exact duplicates in sequence
  const deduped = [];
  points.forEach((p) => {
    const prev = deduped[deduped.length - 1];
    if (
      !prev ||
      prev.coords[0] !== p.coords[0] ||
      prev.coords[1] !== p.coords[1]
    ) {
      deduped.push(p);
    }
  });

  return deduped;
}

export default function RouteMapPreview({trips = [], height = 260}) {
  const points = useMemo(() => buildPointsFromTrips(trips), [trips]);
  const polyline = useMemo(() => points.map((p) => p.coords), [points]);
  const [routeGeometry, setRouteGeometry] = React.useState([]);
  const [routeMetrics, setRouteMetrics] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (polyline.length < 2) {
        setRouteGeometry([]);
        setRouteMetrics(null);
        return;
      }

      try {
        const coords = polyline.map(([lat, lon]) => `${lon},${lat}`).join(";");
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
        );
        const data = await res.json();
        const route = data?.routes?.[0];
        const geometry = route?.geometry?.coordinates || [];
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
        }
      } catch {
        if (!cancelled) {
          setRouteGeometry([]);
          setRouteMetrics(null);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [polyline]);

  if (!points.length) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-primarybg px-4 py-6 text-sm text-secondarytext text-center">
        No map coordinates available for this trip.
      </div>
    );
  }

  return (
    <div className="rounded-md overflow-hidden border border-gray-200 relative">
      <MapContainer
        center={points[0].coords}
        zoom={13}
        scrollWheelZoom={false}
        style={{height, width: "100%"}}
      >
        <SmartTileLayer />
        <FitBounds points={polyline} />

        {polyline.length >= 2 && (
          <Polyline
            positions={routeGeometry.length >= 2 ? routeGeometry : polyline}
            pathOptions={{color: "#1769e0", weight: 5, opacity: 0.82}}
          />
        )}

        {points.map((p, idx) => (
          <Marker
            key={`${p.type}-${idx}`}
            position={p.coords}
            icon={markerIcon}
          >
            <Popup>{p.label}</Popup>
          </Marker>
        ))}
      </MapContainer>

      {routeMetrics ? (
        <div className="absolute left-2 top-2 z-50 flex gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50/95 text-blue-700 border border-blue-200 font-semibold shadow-sm">
            <Route size={12} />
            {routeMetrics.distanceKm.toFixed(2)} km
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50/95 text-emerald-700 border border-emerald-200 font-semibold shadow-sm">
            <Clock3 size={12} />
            {Math.round(routeMetrics.durationMin)} min
          </span>
        </div>
      ) : null}
    </div>
  );
}
