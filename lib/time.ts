export async function getTime(): Promise<number> {
  try {
    const res = await fetch("/favicon.ico", { method: "HEAD" });
    const serverDate = res.headers.get("date");

    if (!serverDate) return 0;

    const serverTime = new Date(serverDate).getTime();
    return serverTime - Date.now();
  } catch {
    return 0;
  }
}
