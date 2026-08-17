import process from "node:process";

process.loadEnvFile("/opt/thoidai-work/.env.local");
process.loadEnvFile("/opt/thoidai-work/.env.production");
const secret = process.env.RECURRENCE_RUNNER_SECRET;
if (!secret || secret.length < 32) throw new Error("Recurrence runner credential is missing.");
const response = await fetch("http://127.0.0.1:3001/api/task-recurrence/run", {
  method: "POST",
  headers: { "x-recurrence-secret": secret },
});
if (!response.ok) throw new Error(`Recurrence runner failed with ${response.status}.`);
