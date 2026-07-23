import type { MeterType } from "@/lib/types";

export type MaintenancePreset = {
  name: string;
  interval_days: number | null;
  interval_meter: number | null;
};

// Starting points, not gospel — every fleet's manufacturer recommendations
// differ, so these are meant to get "+ Track common items" from a blank
// slate to something reasonable in one click; admins can still add a
// custom item with their own interval for anything not covered here, and
// nothing stops them from deleting/re-adding a tracked item with a
// different interval afterward. Keyed by the asset's meter_type since a
// mileage interval means nothing for hour-metered equipment and vice versa.
export const MAINTENANCE_PRESETS: Record<MeterType, MaintenancePreset[]> = {
  mileage: [
    { name: "Oil change", interval_meter: 5000, interval_days: 180 },
    { name: "Tire rotation", interval_meter: 6000, interval_days: 180 },
    { name: "Brake inspection", interval_meter: 12000, interval_days: 365 },
    { name: "Air filter", interval_meter: 12000, interval_days: 365 },
    { name: "Transmission fluid", interval_meter: 30000, interval_days: 730 },
    { name: "Coolant flush", interval_meter: 30000, interval_days: 730 },
    { name: "Battery check", interval_meter: null, interval_days: 180 },
    { name: "Wiper blades", interval_meter: null, interval_days: 365 },
  ],
  hours: [
    { name: "Oil change", interval_meter: 250, interval_days: 180 },
    { name: "Hydraulic fluid", interval_meter: 1000, interval_days: 365 },
    { name: "Air filter", interval_meter: 500, interval_days: 365 },
    { name: "Grease fittings", interval_meter: 50, interval_days: 30 },
    { name: "Brake/track inspection", interval_meter: 500, interval_days: 365 },
    { name: "Battery check", interval_meter: null, interval_days: 180 },
    { name: "Coolant check", interval_meter: null, interval_days: 180 },
  ],
  // No meter (e.g. a trailer) — calendar-only items.
  none: [
    { name: "Tire inspection", interval_meter: null, interval_days: 180 },
    { name: "Brake inspection", interval_meter: null, interval_days: 365 },
    { name: "Lights & wiring check", interval_meter: null, interval_days: 180 },
    { name: "Registration / inspection renewal", interval_meter: null, interval_days: 365 },
  ],
};
