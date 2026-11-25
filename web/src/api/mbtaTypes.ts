// Raw response shapes from the MBTA V3 API (JSON:API format), exactly as sent.
// Only the fields the app reads are listed. Every field is treated as possibly
// missing, because types disappear at runtime and the feed is not always complete.

export interface ResourceRef {
  type: string
  id: string
}

export interface Relationship {
  data: ResourceRef | null
}

export interface Resource<Attributes> {
  type: string
  id: string
  attributes: Attributes
  relationships?: Record<string, Relationship | undefined>
}

export interface Document<Attributes> {
  data: Resource<Attributes>[]
  included?: Resource<unknown>[]
}

export interface VehicleAttributes {
  label?: string | null
  latitude?: number | null
  longitude?: number | null
  bearing?: number | null
  current_status?: string | null
  direction_id?: number | null
  updated_at?: string | null
}

export interface TripAttributes {
  headsign?: string | null
}

export interface StopAttributes {
  name?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface ShapeAttributes {
  polyline?: string | null
}

export interface InformedEntity {
  route?: string | null
  route_type?: number | null
  stop?: string | null
  activities?: string[]
}

export interface AlertAttributes {
  header?: string | null
  effect?: string | null
  severity?: number | null
  lifecycle?: string | null
  informed_entity?: InformedEntity[]
  updated_at?: string | null
}

export type VehiclesDocument = Document<VehicleAttributes>
export type StopsDocument = Document<StopAttributes>
export type RoutePatternsDocument = Document<unknown>
export type AlertsDocument = Document<AlertAttributes>

export interface PredictionAttributes {
  arrival_time?: string | null
  departure_time?: string | null
  stop_sequence?: number | null
  schedule_relationship?: string | null
}

export type PredictionsDocument = Document<PredictionAttributes>
