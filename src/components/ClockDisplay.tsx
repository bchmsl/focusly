import { useState, useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { supabase } from "@/integrations/supabase/client";
import { CloudSun, Cloud, CloudRain, CloudSnow, Sun, CloudLightning, CloudDrizzle, Thermometer, MapPin, Loader2 } from "lucide-react";

interface WeatherData {
  temperature: number;
  weatherCode: number;
  city: string;
}

const WEATHER_ICONS: Record<number, React.ElementType> = {
  0: Sun, 1: Sun, 2: CloudSun, 3: Cloud,
  45: Cloud, 48: Cloud,
  51: CloudDrizzle, 53: CloudDrizzle, 55: CloudDrizzle, 56: CloudDrizzle, 57: CloudDrizzle,
  61: CloudRain, 63: CloudRain, 65: CloudRain, 66: CloudRain, 67: CloudRain,
  71: CloudSnow, 73: CloudSnow, 75: CloudSnow, 77: CloudSnow,
  80: CloudRain, 81: CloudRain, 82: CloudRain, 85: CloudSnow, 86: CloudSnow,
  95: CloudLightning, 96: CloudLightning, 99: CloudLightning,
};

async function getLocationByIP(): Promise<{ lat: number; lon: number; city: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("ip-location");
    if (error) throw error;
    if (data?.lat && data?.lon) return data;
  } catch {
    // silent fail
  }
  return null;
}

async function getLocationByBrowser(): Promise<{ lat: number; lon: number; city: string } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // Reverse geocode to get city name
          const res = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&count=1`
          );
          const data = await res.json();
          const city = data.results?.[0]?.name || "Your location";
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, city });
        } catch {
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, city: "Your location" });
        }
      },
      () => resolve(null),
      { timeout: 5000 }
    );
  });
}

const ClockDisplay = ({ expanded = false }: { expanded?: boolean }) => {
  const { settings } = useSettings();
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch weather
  useEffect(() => {
    if (!settings.showWeather) { setWeather(null); return; }

    const fetchWeather = async () => {
      try {
        setWeatherLoading(true);
        let lat: number, lon: number, cityName: string;

        if (settings.weatherCity) {
          const geoRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(settings.weatherCity)}&count=1`
          );
          const geoData = await geoRes.json();
          if (!geoData.results?.length) { setWeatherLoading(false); return; }
          lat = geoData.results[0].latitude;
          lon = geoData.results[0].longitude;
          cityName = geoData.results[0].name;
        } else {
          // Try IP-based first, then browser geolocation as fallback
          const ipResult = await getLocationByIP();
          if (ipResult) {
            lat = ipResult.lat;
            lon = ipResult.lon;
            cityName = ipResult.city;
          } else {
            const browserResult = await getLocationByBrowser();
            if (!browserResult) { setWeatherLoading(false); return; }
            lat = browserResult.lat;
            lon = browserResult.lon;
            cityName = browserResult.city;
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
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [settings.weatherCity, settings.showWeather]);

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
            <span className={`text-muted-foreground ${expanded ? "text-3xl sm:text-5xl md:text-6xl" : "text-3xl sm:text-4xl"}`}>:{seconds}</span>
          )}
        </span>
        <span className={`mt-2 text-muted-foreground ${expanded ? "text-sm sm:text-base md:text-xl" : "text-sm"}`}>{dateStr}</span>
      </div>

      {/* Weather */}
      {settings.showWeather && weatherLoading && !weather && (
        <div className={`flex items-center rounded-xl bg-muted/50 ${expanded ? "gap-3 px-4 py-2.5" : "gap-3 px-4 py-2.5"}`}>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading weather...</span>
        </div>
      )}
      {weather && (
        <div className={`flex items-center rounded-xl bg-muted/50 ${expanded ? "gap-3 px-4 py-2.5 sm:gap-4 sm:px-5 sm:py-3 md:gap-5 md:px-6 md:py-4" : "gap-3 px-4 py-2.5"}`}>
          {WeatherIcon && <WeatherIcon className={`text-primary ${expanded ? "h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8" : "h-5 w-5"}`} />}
          <div className="flex items-center gap-1.5">
            <Thermometer className={`text-muted-foreground ${expanded ? "h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" : "h-3.5 w-3.5"}`} />
            <span className={`font-medium ${expanded ? "text-sm sm:text-base md:text-xl" : "text-sm"}`}>{weather.temperature}°C</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className={`text-muted-foreground ${expanded ? "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" : "h-3 w-3"}`} />
            <span className={`text-muted-foreground ${expanded ? "text-xs sm:text-sm md:text-base" : "text-xs"}`}>{weather.city}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClockDisplay;
