import { useState, useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { CloudSun, Cloud, CloudRain, CloudSnow, Sun, CloudLightning, CloudDrizzle, Thermometer, MapPin } from "lucide-react";

interface WeatherData {
  temperature: number;
  weatherCode: number;
  city: string;
}

const WEATHER_ICONS: Record<number, React.ElementType> = {
  0: Sun,
  1: Sun,
  2: CloudSun,
  3: Cloud,
  45: Cloud,
  48: Cloud,
  51: CloudDrizzle,
  53: CloudDrizzle,
  55: CloudDrizzle,
  56: CloudDrizzle,
  57: CloudDrizzle,
  61: CloudRain,
  63: CloudRain,
  65: CloudRain,
  66: CloudRain,
  67: CloudRain,
  71: CloudSnow,
  73: CloudSnow,
  75: CloudSnow,
  77: CloudSnow,
  80: CloudRain,
  81: CloudRain,
  82: CloudRain,
  85: CloudSnow,
  86: CloudSnow,
  95: CloudLightning,
  96: CloudLightning,
  99: CloudLightning,
};

const ClockDisplay = ({ expanded = false }: { expanded?: boolean }) => {
  const { settings } = useSettings();
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch weather
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        let lat: number, lon: number, cityName: string;

        if (settings.weatherCity) {
          // Geocode the city name
          const geoRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(settings.weatherCity)}&count=1`
          );
          const geoData = await geoRes.json();
          if (!geoData.results?.length) return;
          lat = geoData.results[0].latitude;
          lon = geoData.results[0].longitude;
          cityName = geoData.results[0].name;
        } else {
          // Auto-detect via IP geolocation
          try {
            const ipRes = await fetch("https://ipapi.co/json/");
            const ipData = await ipRes.json();
            lat = ipData.latitude;
            lon = ipData.longitude;
            cityName = ipData.city || "Your location";
          } catch {
            return;
          }
        }

        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        const weatherData = await weatherRes.json();
        if (weatherData.current_weather) {
          setWeather({
            temperature: Math.round(weatherData.current_weather.temperature),
            weatherCode: weatherData.current_weather.weathercode,
            city: cityName,
          });
        }
      } catch {
        // Weather is non-critical
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000); // refresh every 10 min
    return () => clearInterval(interval);
  }, [settings.weatherCity]);

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const WeatherIcon = weather ? (WEATHER_ICONS[weather.weatherCode] || CloudSun) : null;

  return (
    <div className={`flex flex-col items-center ${expanded ? "gap-10" : "gap-6"}`}>
      {/* Clock */}
      <div className="flex flex-col items-center">
        <span className={`font-mono-timer font-bold tracking-tight ${expanded ? "text-5xl sm:text-7xl md:text-[8rem] leading-none" : "text-5xl sm:text-6xl"}`}>
          {hours}:{minutes}
          {settings.showSeconds && (
            <span className={`text-muted-foreground ${expanded ? "text-6xl" : "text-4xl"}`}>:{seconds}</span>
          )}
        </span>
        <span className={`mt-2 text-muted-foreground ${expanded ? "text-xl" : "text-sm"}`}>{dateStr}</span>
      </div>

      {/* Weather */}
      {weather && (
        <div className={`flex items-center rounded-xl bg-muted/50 ${expanded ? "gap-5 px-6 py-4" : "gap-3 px-4 py-2.5"}`}>
          {WeatherIcon && <WeatherIcon className={`text-primary ${expanded ? "h-8 w-8" : "h-5 w-5"}`} />}
          <div className="flex items-center gap-1.5">
            <Thermometer className={`text-muted-foreground ${expanded ? "h-5 w-5" : "h-3.5 w-3.5"}`} />
            <span className={`font-medium ${expanded ? "text-xl" : "text-sm"}`}>{weather.temperature}°C</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className={`text-muted-foreground ${expanded ? "h-4 w-4" : "h-3 w-3"}`} />
            <span className={`text-muted-foreground ${expanded ? "text-base" : "text-xs"}`}>{weather.city}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClockDisplay;
