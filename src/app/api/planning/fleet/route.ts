import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser, handleApiError } from "@/lib/api-utils";
import { PermissionError } from "@/lib/errors";
import { fleetAircraftSchema } from "@/lib/validations/planning";
import * as planningLookupsRepo from "@/lib/repositories/planning-lookups-repository";
import type { Database } from "@/types/database.types";

/** Fleet Master: A321/A339/A351/A359 aircraft registrations by station.
 * Viewable by anyone signed in (task form's Aircraft Type → Registration
 * cascade needs it); only Manager/Admin can add aircraft, mirroring the
 * departments/reference-data RLS pattern. */
export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser();
    // Aircraft Type is multi-select in the task form, so this accepts
    // repeated ?aircraft_type=A321&aircraft_type=A339 params.
    const aircraftTypes = request.nextUrl.searchParams.getAll("aircraft_type");
    const supabase = await createClient();
    const fleet = await planningLookupsRepo.findAllFleet(supabase, aircraftTypes.length ? aircraftTypes : undefined);
    return NextResponse.json(fleet);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    if (currentUser.role !== "Manager" && currentUser.role !== "Admin") {
      throw new PermissionError("只有主管或管理員可以新增機隊主檔");
    }
    const body = await request.json();
    const values = fleetAircraftSchema.parse(body);
    const supabase = await createClient();
    const aircraft = await planningLookupsRepo.createFleetAircraft(supabase, {
      aircraft_type: values.aircraft_type as Database["taskflow"]["Enums"]["aircraft_type_enum"],
      aircraft_registration: values.aircraft_registration,
      station: (values.station ?? "TPE") as Database["taskflow"]["Enums"]["station_enum"],
      status: values.status ?? "Active",
    });
    return NextResponse.json(aircraft, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
