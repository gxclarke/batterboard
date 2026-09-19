/**
 * Things that show up in aerial photos with predictable sizes. The first entry
 * is the important one: a measurement the user actually knows beats any of
 * these. Values in feet.
 */
export interface KnownDimension {
  label: string;
  feet: number | null;
}

export const KNOWN_DIMENSIONS: readonly KnownDimension[] = [
  { label: "A measurement I know", feet: null },
  { label: "Single garage door, 8 ft", feet: 8 },
  { label: "Single garage door, 9 ft", feet: 9 },
  { label: "Double garage door, 16 ft", feet: 16 },
  { label: "Double garage door, 18 ft", feet: 18 },
  { label: "Parking space width, 9 ft", feet: 9 },
  { label: "Parking space length, 18 ft", feet: 18 },
  { label: "Compact car length, 14.5 ft", feet: 14.5 },
  { label: "Sedan length, 16 ft", feet: 16 },
  { label: "Minivan or SUV length, 17 ft", feet: 17 },
  { label: "Full-size pickup length, 19.5 ft", feet: 19.5 },
  { label: "Pool lounge chair, 6.5 ft", feet: 6.5 },
  { label: "Entry door, 3 ft", feet: 3 },
  { label: "Residential sidewalk, 4 ft", feet: 4 },
  { label: "Residential sidewalk, 5 ft", feet: 5 },
];
