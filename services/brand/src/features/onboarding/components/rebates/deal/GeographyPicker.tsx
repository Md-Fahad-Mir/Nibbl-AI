import { X } from "lucide-react";

export type Geography = "nationwide" | "states" | "zip_radius";
export interface GeoArea {
  zip: string;
  radius_miles: number;
}

export const RADIUS_CHOICES = [5, 10, 25, 50, 100];

export const US_STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["PR", "Puerto Rico"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"],
  ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

export const geographyText = (geography: unknown, states: unknown, areas: unknown) => {
  if (geography === "states") {
    const list = Array.isArray(states) ? (states as string[]) : [];
    return list.length ? `Selected states: ${list.join(", ")}` : "Selected states";
  }
  if (geography === "zip_radius") {
    const list = Array.isArray(areas) ? (areas as GeoArea[]) : [];
    return list.length
      ? `Within ${list.map((a) => `${a.radius_miles} mi of ${a.zip}`).join("; ")}`
      : "ZIP + radius";
  }
  return "Nationwide";
};

interface GeographyPickerProps {
  geography: Geography;
  states: string[];
  areas: GeoArea[];
  onChange: (geography: Geography, states: string[], areas: GeoArea[]) => void;
}

/** Master Discovery Geography: controls where the campaign appears in
 *  discovery. Direct links / QR codes work anywhere. */
export default function GeographyPicker({ geography, states, areas, onChange }: GeographyPickerProps) {
  const input =
    "h-10 px-3 rounded-xl border border-[#E0E3F5] bg-white text-sm text-[#131B2E] outline-none focus:border-[#001BD2]";
  const options: { value: Geography; title: string; text: string }[] = [
    { value: "nationwide", title: "Nationwide", text: "Maximum reach" },
    { value: "states", title: "Selected States", text: "Target specific markets" },
    { value: "zip_radius", title: "ZIP + Radius", text: "Target a local area" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value, states, areas.length ? areas : [{ zip: "", radius_miles: 25 }])}
            className={`text-left rounded-2xl border p-4 cursor-pointer ${
              geography === opt.value ? "border-[#001BD2] bg-[#F2F3FF]" : "border-[#EAEDFF] hover:bg-[#FAF8FF]"
            }`}
          >
            <span className="block text-sm font-bold text-[#131B2E]">{opt.title}</span>
            <span className="block text-xs text-[#64748B] mt-1">{opt.text}</span>
          </button>
        ))}
      </div>

      {geography === "states" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-56 overflow-y-auto border border-[#F1F2FA] rounded-xl p-3">
          {US_STATES.map(([code, name]) => (
            <label key={code} className="flex items-center gap-2 text-xs text-[#131B2E]">
              <input
                type="checkbox"
                checked={states.includes(code)}
                onChange={() =>
                  onChange(geography, states.includes(code) ? states.filter((s) => s !== code) : [...states, code], areas)
                }
              />
              {name}
            </label>
          ))}
        </div>
      )}

      {geography === "zip_radius" && (
        <div className="flex flex-col gap-2">
          {areas.map((area, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={`${input} w-32`}
                placeholder="ZIP code"
                inputMode="numeric"
                maxLength={5}
                value={area.zip}
                onChange={(e) =>
                  onChange(geography, states, areas.map((a, j) => (j === i ? { ...a, zip: e.target.value.replace(/\D/g, "") } : a)))
                }
              />
              <select
                className={input}
                value={area.radius_miles}
                onChange={(e) =>
                  onChange(geography, states, areas.map((a, j) => (j === i ? { ...a, radius_miles: Number(e.target.value) } : a)))
                }
              >
                {RADIUS_CHOICES.map((r) => (
                  <option key={r} value={r}>
                    {r} miles
                  </option>
                ))}
              </select>
              {areas.length > 1 && (
                <button type="button" onClick={() => onChange(geography, states, areas.filter((_, j) => j !== i))}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center cursor-pointer" title="Remove">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => onChange(geography, states, [...areas, { zip: "", radius_miles: 25 }])}
            className="self-start text-xs font-bold text-[#001BD2] cursor-pointer">
            + Add another area
          </button>
        </div>
      )}

      <p className="text-xs text-[#64748B]">
        Geography controls where the campaign appears in Nibbl discovery. It doesn&apos;t guarantee the product is available
        at every store. Your campaign link and QR code can be claimed from anywhere.
      </p>
    </div>
  );
}
