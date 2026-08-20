import { NextResponse } from "next/server";

export const POST = () => NextResponse.json(
  { error: "Trưởng phòng được xác định tự động theo chức vụ nhân sự." },
  { status: 410 },
);
