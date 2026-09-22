/**
 * Mock flight data for the Flight overview screen: the day's departures and,
 * for each, how its ULDs are spread across the handling stages.
 *
 * Like the rest of this POC there's no ops backend behind it. Flights are
 * built once per screen mount, anchored to the clock at that moment, so the
 * demo always shows a realistic mix -- a departure inside the hour, others
 * spread across the shift -- instead of times that drifted into the past
 * overnight. Anchoring also means the timing states are live: as the clock
 * runs forward against fixed deadlines, at-risk ULDs really do appear.
 */

import { getDeadlineStatus } from './dispatch';

/**
 * Where a ULD is in the handling chain, in the order the icons appear on a
 * flight card. A flight rarely has ULDs in every stage -- zeroes are the
 * normal case, not a gap in the data.
 */
export type UldStage = 'unknown' | 'empty' | 'packing' | 'in_route' | 'buffer' | 'delivered';

export const ULD_STAGES: UldStage[] = [
  'unknown',
  'empty',
  'packing',
  'in_route',
  'buffer',
  'delivered',
];

/**
 * What each stage means, in full. Used by the legend at the top of the screen
 * and as the spoken label for each count, so the icon row -- which is
 * otherwise icons and numbers only -- explains itself exactly one way.
 */
export const STAGE_LABELS: Record<UldStage, string> = {
  unknown: 'Unknown',
  empty: 'Empty ULDs assigned',
  packing: 'Being packed at baggage hall',
  in_route: 'In route',
  buffer: 'Staged at buffer area',
  delivered: 'Delivered to aircraft',
};

export interface FlightUld {
  stage: UldStage;
  /** When this ULD has to be at the aircraft to make the flight. */
  latestDeliveryTime: number;
}

export interface Flight {
  id: string;
  /** e.g. "SQ305". */
  flightNo: string;
  /** IATA aircraft type, e.g. "359" for an A350-900. */
  aircraftType: string;
  /** IATA destination station, e.g. "SIN". */
  destination: string;
  /** IATA carrier code, resolvable through KNOWN_AIRLINE_CODES. */
  airlineCode: string;
  /** When the make-up window opened -- usually hours before departure. */
  makeUpOpen: number;
  etd: number;
  ulds: FlightUld[];
}

/** Loading closes this long before ETD, so that's each ULD's real deadline. */
const AIRCRAFT_CUTOFF_MIN = 20;

/** How late a ULD flagged as running behind actually is. */
const LATE_BY_MIN = 6;

interface FlightSpec {
  flightNo: string;
  aircraftType: string;
  destination: string;
  airlineCode: string;
  /** Departure, in minutes from the moment the screen was opened. */
  etdInMin: number;
  /** Make-up opened this many minutes before ETD. */
  makeUpLeadMin: number;
  counts: Partial<Record<UldStage, number>>;
  /** ULDs per stage that are running behind, driving the at-risk highlight. */
  late?: Partial<Record<UldStage, number>>;
}

// Hand-written rather than generated: the point of this screen is the spread
// of states across a shift, and specific numbers (a flight nearly loaded, one
// that hasn't started, one with ULDs slipping) read better than random ones.
const FLIGHT_SPECS: FlightSpec[] = [
  {
    flightNo: 'SQ305',
    aircraftType: '359',
    destination: 'SIN',
    airlineCode: 'SQ',
    etdInMin: 55,
    makeUpLeadMin: 240,
    counts: { packing: 2, in_route: 3, buffer: 8, delivered: 20 },
    late: { in_route: 1 },
  },
  {
    flightNo: 'TK1986',
    aircraftType: '77W',
    destination: 'IST',
    airlineCode: 'TK',
    etdInMin: 130,
    makeUpLeadMin: 180,
    counts: { unknown: 1, empty: 2, packing: 4, in_route: 2, buffer: 5, delivered: 6 },
    late: { packing: 2, buffer: 1 },
  },
  {
    flightNo: 'EK52',
    aircraftType: '388',
    destination: 'DXB',
    airlineCode: 'EK',
    etdInMin: 205,
    makeUpLeadMin: 240,
    counts: { empty: 4, packing: 6, in_route: 1, buffer: 2 },
  },
  {
    flightNo: 'LH811',
    aircraftType: '359',
    destination: 'FRA',
    airlineCode: 'LH',
    etdInMin: 280,
    makeUpLeadMin: 200,
    counts: { unknown: 2, buffer: 3 },
    late: { unknown: 2 },
  },
  {
    flightNo: 'QR128',
    aircraftType: '77W',
    destination: 'DOH',
    airlineCode: 'QR',
    etdInMin: 355,
    makeUpLeadMin: 220,
    counts: { empty: 3, packing: 2 },
  },
  {
    flightNo: 'KL634',
    aircraftType: '789',
    destination: 'AMS',
    airlineCode: 'KL',
    etdInMin: 430,
    makeUpLeadMin: 180,
    counts: { empty: 2 },
  },
];

function buildUlds(spec: FlightSpec, etd: number, now: number): FlightUld[] {
  const onTimeDeadline = etd - AIRCRAFT_CUTOFF_MIN * 60_000;
  const ulds: FlightUld[] = [];

  for (const stage of ULD_STAGES) {
    const total = spec.counts[stage] ?? 0;
    const late = spec.late?.[stage] ?? 0;
    for (let i = 0; i < total; i++) {
      ulds.push({
        stage,
        latestDeliveryTime: i < late ? now - LATE_BY_MIN * 60_000 : onTimeDeadline,
      });
    }
  }

  return ulds;
}

/** The day's active flights, soonest departure first. */
export function getMockFlights(now: number = Date.now()): Flight[] {
  return FLIGHT_SPECS.map((spec) => {
    const etd = now + spec.etdInMin * 60_000;
    return {
      id: spec.flightNo,
      flightNo: spec.flightNo,
      aircraftType: spec.aircraftType,
      destination: spec.destination,
      airlineCode: spec.airlineCode,
      makeUpOpen: etd - spec.makeUpLeadMin * 60_000,
      etd,
      ulds: buildUlds(spec, etd, now),
    };
  }).sort((a, b) => a.etd - b.etd);
}

/** How the flight is identified on the card, e.g. "SQ305-359-SIN". */
export function flightLabel(flight: Flight): string {
  return `${flight.flightNo}-${flight.aircraftType}-${flight.destination}`;
}

export function stageCount(flight: Flight, stage: UldStage): number {
  return flight.ulds.filter((u) => u.stage === stage).length;
}

/**
 * True when any ULD in this stage is at risk of missing the flight, by the
 * same deadline rule Task overview grades tasks with.
 *
 * Delivered ULDs are never flagged: they're already on the aircraft, so their
 * deadline stopped mattering the moment they got there -- the same reason a
 * resolved task stops counting as overdue.
 */
export function stageAtRisk(flight: Flight, stage: UldStage, now: number): boolean {
  if (stage === 'delivered') return false;
  return flight.ulds.some(
    (u) => u.stage === stage && getDeadlineStatus(u.latestDeliveryTime, now) !== 'on_time',
  );
}
